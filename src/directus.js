import fs from 'fs';
import got from 'got';
import DirectusSDK from '@directus/sdk-js';
import AdmZip from 'adm-zip';
import mailer from './mailer';
import redis from './redis';
import help from './helper';

const userRequestsCollection = 'user_requests';
const emailLogCollection = 'email_log';

const directusUrl = process.env.DIRECTUS_URL;
const directusProject = process.env.DIRECTUS_PROJECT;
const directusEmail = process.env.DIRECTUS_USER_EMAIL;
const directusPass = process.env.DIRECTUS_USER_PASSWORD;

const inPath = `${process.env.NODE_PATH}/in`;
const tmpPath = `${process.env.NODE_PATH}/tmp`;
const outPath = `${process.env.NODE_PATH}/out`;

async function getDirectusClient() {
  const client = new DirectusSDK({
    url: directusUrl,
    project: directusProject,
  });

  await client.login({
    email: directusEmail,
    password: directusPass,
  });

  return client;
}

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

async function saveError(fileName, errors) {
  const client = await getDirectusClient();
  const itemID = fileName.substr(0, fileName.indexOf('_'));
  const error = help.formatErrorMsg(errors);
  const updatedItem = await client.updateItem(userRequestsCollection, itemID, { status: 'error', error });
  console.log('erro updatedItem', updatedItem);
  fs.unlinkSync(`${tmpPath}/${fileName}`);
  await resetRedis(fileName);
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

  const found = await client.getItem(userRequestsCollection, itemID);
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

  // search for files with status "waitin"
  const toProcess = await client.getItems(userRequestsCollection, { filter: { status: { eq: 'waiting' } } });

  // no files to process were found
  if (!toProcess || !toProcess.data || toProcess.data.length === 0) return null;

  const { data: allFiles } = await client.getFiles();
  const desiredFiles = [];

  // get details of all the files we want
  toProcess.data.forEach((e) => {
    const currentFile = allFiles.find((x) => x.id === e.input_file);
    currentFile.itemID = e.id;
    desiredFiles.push(currentFile);
  });

  return desiredFiles;
}

async function saveFilesToDisk(files) {
  for (const file of files) { // eslint-disable-line

    if (file.filename_download.endsWith('.zip')) { // handle zip files
      const res = await got(file.data.full_url, { responseType: 'buffer' }); // eslint-disable-line

      const zip = new AdmZip(res.body); // load zip buffer
      const zipEntries = zip.getEntries();

      zipEntries.forEach((entry, i) => {
        const { entryName } = entry;

        const isInvalidFile = help.checkInvalidFiles(entryName);
        if (isInvalidFile) {
          delete zipEntries[i]; // remove unwanted files
        } else {
          // rename files inside of zip to prefix the item id
          entry.entryName = `${file.itemID}_${entryName}`; // eslint-disable-line no-param-reassign
        }
      });

      zip.extractAllTo(inPath); // extract files from zip
    } else if (file.filename_download.endsWith('.csv')) {
      const newFilePath = `${inPath}/${file.itemID}_${file.filename_download}`;
      const res = await got(file.data.full_url); // eslint-disable-line
      fs.writeFileSync(newFilePath, res.body);
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
  const { email } = item;

  const mailSent = await mailer.sendEmail(email, mailData.subject, mailData.body);

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

async function saveFileToDirectus(fileName) {
  const client = await getDirectusClient();
  const localfile = `${outPath}/${fileName}`;
  const zip = new AdmZip(); // create archive
  await zip.addLocalFile(localfile); // add local file
  const willSendthis = zip.toBuffer(); // get everything as a buffer
  const newFileName = fileName.replace('csv', 'zip');

  const fileData = await client.uploadFiles({
    title: newFileName, data: willSendthis.toString('base64'), filename_disk: newFileName, filename_download: newFileName,
  });

  const fileID = fileData.data.id; // get the file id
  const itemID = fileName.substr(0, fileName.indexOf('_')); // find the item this file should be uploaded to (numbers before the first underline)
  const analysisDate = help.dateMysqlFormat(new Date());
  const updatedItem = await client.updateItem(userRequestsCollection, itemID, { status: 'complete', output_file: fileID, analysis_date: analysisDate });

  // if item was uploaded correctly
  if (updatedItem && updatedItem.data && updatedItem.data.id) {
    const file = await getOneFile(updatedItem.data.output_file);
    // if there's an e-mail set, send the result file to the e-mail
    if (updatedItem.data.email && file && file.data && file.data.url) {
      const canDelete = await sendMail(updatedItem.data, file.data.url);
      // delete file from /out only if it was sent by e-mail successfully
      if (canDelete) fs.unlinkSync(localfile);
    } else {
      fs.unlinkSync(localfile); // delete file from /out
    }
    await resetRedis(fileName);
  }
}

// save each file inside of the /out directory on direct
async function getResults() {
  const fileNames = await fs.readdirSync(outPath);
  for (let i = 0; i < fileNames.length; i++) { // eslint-disable-line
    const fileName = fileNames[i];
    await saveFileToDirectus(fileName); // eslint-disable-line
  }
}

async function populateIn() {
  const files = await getFilesToProcess();
  console.log('files', files);
  if (files) await saveFilesToDisk(files);
}

export default {
  populateIn, getResults, saveFileToDirectus, updateFileStatus, saveError, getFileItem,
};
