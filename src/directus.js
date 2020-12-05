import fs from 'fs';
import axios from 'axios';
import AdmZip from 'adm-zip';
import Debug from 'debug';
import mailer from './mailer';
import redis from './redis';
import help from './helper';
import getDirectusClient from './DirectusSDK';

const debug = Debug('pegabot-admin:app');

const userRequestsCollection = 'user_requests';
const emailLogCollection = 'email_log';

const inPath = `${process.env.NODE_PATH}/in`;
const tmpPath = `${process.env.NODE_PATH}/tmp`;
const outPath = `${process.env.NODE_PATH}/out`;

async function getOneFile(fileID) {
  const client = await getDirectusClient();

  const { data: allFiles } = await client.getFiles();

  const myFile = await allFiles.find((x) => x.id === fileID);
  return myFile;
}

async function resetRedis(fileName) {
  await redis.set(`${fileName}_results`, '');
  await redis.set(`${fileName}_error`, '');
}

async function saveMailLog(client, item, email, mailSent) {
  // format attributes to save on the email_log collection
  const attributes = {
    request_id: item.id, // the id of the requeste for analysis
    file_id: item.result_file, // the result file id
    sent_to: email,
    sent_at: help.dateMysqlFormat(new Date()),
    status: 'sent', // might be overwritten if something goes wrong
  };

  // save e-mail error
  if (!mailSent || mailSent.error) {
    attributes.status = 'error';
    if (mailSent.error && mailSent.error.message) attributes.error = mailSent.error.message;
  }

  // save email log
  const res = await client.createItem(emailLogCollection, attributes);

  if (!res || !res.data) throw new Error('Could not save email log');

  return attributes.status !== 'error';
}

async function saveError(fileName, errors) {
  const client = await getDirectusClient();
  const itemID = fileName.substr(0, fileName.indexOf('_'));
  const error = help.formatErrorMsg(errors);
  const updatedItem = await client.updateItem(userRequestsCollection, itemID, { status: 'error', error });

  fs.unlinkSync(`${tmpPath}/${fileName}`);
  await resetRedis(fileName);

  const { data: item } = await client.getItem(userRequestsCollection, itemID);
  const owner = await client.getUser(item.owner);

  const subject = 'Pegabots - Erro análise';
  const body = `Não foi possível concluir a análise ${item.id}.`;

  const email = help.getEveryEmailFromItem(item, owner);
  const mailSent = await mailer.sendEmail(email, subject, body, [{ filename: `erros_${itemID}.txt`, content: error }]);
  return saveMailLog(client, item, email, mailSent);
}

async function getCollections() { // eslint-disable-line
  const client = await getDirectusClient();

  const myCollections = [];
  const { data: allCollections } = await client.getCollections();

  allCollections.forEach((e) => { if (e.collection.includes('directus') === false) myCollections.push(e); });

  return myCollections;
}

async function getFileItem(fileName) {
  const client = await getDirectusClient();

  const itemID = fileName.substr(0, fileName.indexOf('_')); // find the item this file should be uploaded to (numbers before the first underline)
  if (!itemID || !parseInt(itemID, 10)) return {};

  const found = await client.getItem(userRequestsCollection, itemID);
  if (!found || !found.data) return {};
  return found.data;
}

async function updateFileStatus(fileName, newStatus) {
  const client = await getDirectusClient();

  const itemID = fileName.substr(0, fileName.indexOf('_')); // find the item this file should be uploaded to (numbers before the first underline)

  const updatedItem = await client.updateItem(userRequestsCollection, itemID, { status: newStatus });
  if (updatedItem && updatedItem.data && updatedItem.data.id) return;
  throw Error('Could not update item', { itemID, fileName, updatedItem });
}

async function getFilesToProcess() {
  const client = await getDirectusClient();

  debug('[getFilesToProcess] Fetching files with status "waiting"');

  // search for files with status "waitin"
  const toProcess = await client.getItems(userRequestsCollection, { filter: { status: { eq: 'waiting' } } });

  // no files to process were found
  if (!toProcess || !toProcess.data || toProcess.data.length === 0) {
    debug('[getFilesToProcess] No files with status "waiting"');

    return [];
  };

  const { data: allFiles } = await client.getFiles({ limit: -1 });
  const desiredFiles = [];

  // get details of all the files we want
  toProcess.data.forEach((e) => {
    const currentFile = allFiles.find((x) => x.id === e.input_file);
    if (currentFile) {
      currentFile.itemID = e.id;
      desiredFiles.push(currentFile);
    }
  });

  return desiredFiles;
}

async function saveFilesToDisk(files, whereToSave = inPath) {
  const client = await getDirectusClient();

  for (const file of files) { // eslint-disable-line
    let foundValid = false;
    let validOnZip = null;

    const fileName = file.filename_download;

    debug('[saveFilesToDisk] file_id: ' + file.id + ', itemID: ' + file.itemID + ', filename: ' + fileName);

    if (fileName.endsWith('.zip')) { // handle zip files
      foundValid = true;
      validOnZip = false;

      const res = await axios.get(file.data.full_url, { responseType: 'arraybuffer' });

      const zip = new AdmZip(res.data); // load zip buffer
      const zipEntries = zip.getEntries();

      zipEntries.forEach((entry, i) => {
        const { entryName } = entry;

        const isInvalidFile = help.checkInvalidFiles(entryName);
        if (isInvalidFile || validOnZip) {
          delete zipEntries[i]; // remove unwanted files
        } else {
          // rename files inside of zip to prefix the item id
          entry.entryName = `${file.itemID}_${entryName}`; // eslint-disable-line no-param-reassign
          validOnZip = true;
        }
      });

      if (validOnZip) zip.extractAllTo(whereToSave); // extract files from zip
    } else if (fileName.endsWith('.csv') || fileName.endsWith('xls') || fileName.endsWith('xlsx')) {
      debug('[saveFilesToDisk] Is a spreadsheet');

      const newFilePath = `${whereToSave}/${file.itemID}_${file.filename_download}`;
      const res = await axios.get(file.data.full_url, { responseType: 'arraybuffer' });
      fs.writeFileSync(newFilePath, res.data);
      foundValid = true;

      debug('[saveFilesToDisk] New path: ' + newFilePath);
    }

    let error = '';
    if (foundValid === false && validOnZip === null) { // no valid csv nor zip
      error = 'A extensão do arquivo adicionado não é válida, adicione apenas .csv, .xls, .xlsx ou um .zip com um desses dentro.';
    } else if (foundValid === true && validOnZip === false) { // no valid file found on the zip file
      error = 'Não foi encontrado nenhum arquivo .csv dentro do .zip adicionado.';
    }

    if (error) {
      const invalidFile = await client.updateItem(userRequestsCollection, file.itemID, { status: 'error', error });
      if (invalidFile) console.error('invalidFile', invalidFile);
    }
  }
}

async function sendMail(item, filelink) {
  const client = await getDirectusClient();

  // set actual host for the file
  const newFileLink = process.env.DIRECTUS_HOST + filelink;

  // copy texts and add file link to body
  const mailData = JSON.parse(JSON.stringify(mailer.mailText.results));
  mailData.body = mailData.body.replace('<FILE_LINK>', newFileLink);

  const owner = await client.getUser(item.owner);
  const email = help.getEveryEmailFromItem(item, owner);

  const mailSent = await mailer.sendEmail(email, mailData.subject, mailData.body);
  return saveMailLog(client, item, email, mailSent);
}

async function sendResultMail(updatedItem, fileName, whereToLoad = outPath) {
  const localfile = fileName;

  // if item was uploaded correctly
  if (updatedItem && updatedItem.data && updatedItem.data.id) {
    const file = await getOneFile(updatedItem.data.output_file);
    // if there's an e-mail set, send the result file to the e-mail
    if (file && file.data && file.data.url) {
      const canDelete = await sendMail(updatedItem.data, file.data.url);
      // delete file from /out only if it was sent by e-mail successfully
      if (canDelete) fs.unlinkSync(localfile);
    } else {
      fs.unlinkSync(localfile); // delete file from /out
    }
    await resetRedis(fileName);
  }
}

async function saveFileToDirectus(fileName, errors = [], whereToLoad = outPath) {
  const client = await getDirectusClient();
  const localfile = `${whereToLoad}/${fileName}`;
  const zip = new AdmZip(); // create archive
  await zip.addLocalFile(fileName); // add local file
  const willSendthis = zip.toBuffer(); // get everything as a buffer
  const newFileName = fileName.replace('xlsx', 'zip');

  const error = help.formatErrorMsg(errors);

  const fileData = await client.uploadFiles({
    title: newFileName, data: willSendthis.toString('base64'), filename_disk: newFileName, filename_download: newFileName,
  });

  const fileID = fileData.data.id; // get the file id
  let   itemID = fileName.substr(0, fileName.indexOf('_')); // find the item this file should be uploaded to (numbers before the first underline)
  // itemID = itemID.substring(itemID.length - 2, fileName.indexOf('/'));
  itemID = itemID.match(/(\d){1,}/g);

  await redis.set('current_file_directus_id', itemID);

  const analysisDate = help.dateMysqlFormat(new Date());
  const updatedItem = await client.updateItem(userRequestsCollection, itemID, {
    status: 'complete', output_file: fileID, analysis_date: analysisDate, error,
  });

  if (!updatedItem || !updatedItem.data || !updatedItem.data.id) return { error: 'Could not save result file to Directus' };

  await redis.set('current_file_directus_id', undefined);

  return updatedItem;
}

// save each file inside of the /out directory on direct
async function getResults() {
  const fileNames = await fs.readdirSync(outPath);
  for (let i = 0; i < fileNames.length; i++) { // eslint-disable-line
    const fileName = fileNames[i];
    const updatedItem = await saveFileToDirectus(fileName);
    if (updatedItem && !updatedItem.error) await sendResultMail(updatedItem, fileName);
  }
}

async function populateIn() {
  const files = await getFilesToProcess();

  if (files) {
    debug('There are files pending');

    console.info('exec saveFilesToDisk');
    await saveFilesToDisk(files)
  };
}

export default {
  populateIn,
  getFilesToProcess,
  getResults,
  saveFileToDirectus,
  sendResultMail,
  updateFileStatus,
  saveError,
  getFileItem,
  getOneFile,
  saveFilesToDisk,
  sendMail,
  getDirectusClient,
};
