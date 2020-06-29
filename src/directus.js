import fs from 'fs';
import got from 'got';
import DirectusSDK from '@directus/sdk-js';
import AdmZip from 'adm-zip';

const myCollection = 'user_files';

const directusUrl = process.env.DIRECTUS_URL;
const directusProject = process.env.DIRECTUS_PROJECT;
const directusEmail = process.env.DIRECTUS_USER_EMAIL;
const directusPass = process.env.DIRECTUS_USER_PASSWORD;

const inPath = `${process.env.NODE_PATH}/in`;
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

async function getFilesToProcess() {
  const client = await getDirectusClient();

  // search for files with status "waitin"
  const toProcess = await client.getItems(myCollection, { filter: { status: { eq: 'waiting' } } });

  // no files to process were found
  if (!toProcess || !toProcess.data || toProcess.data.length === 0) return null;

  const { data: allFiles } = await client.getFiles();
  const desiredFiles = [];

  // get details of all the files we want
  toProcess.data.forEach((e) => {
    const currentFile = allFiles.find((x) => x.id === e.file);
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

      // rename files inside of zip to prefix the item id
      zipEntries.forEach((entry) => { entry.entryName = `${file.itemID}_${entry.entryName}`; }); // eslint-disable-line no-param-reassign

      zip.extractAllTo(inPath); // extract files from zip
    } else if (file.filename_download.endsWith('.csv')) {
      const newFilePath = `${inPath}/${file.id}_${file.filename_download}`;
      const res = await got(file.data.full_url); // eslint-disable-line
      fs.writeFileSync(newFilePath, res.body);
    }
  }
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

  const updatedItem = await client.updateItem(myCollection, itemID, { result_file: fileID, status: 'complete' });
  // if item was uploaded correctly
  if (updatedItem && updatedItem.data && updatedItem.data.id) {
    fs.unlinkSync(localfile);
  }
}

async function getResults() {
  fs.readdir(outPath, (err, filenames) => {
    if (err) { return; }

    filenames.forEach(async (fileName) => {
      await saveFileToDirectus(fileName);
    });
  });
}

async function populateIn() {
  const files = await getFilesToProcess();
  if (files) await saveFilesToDisk(files);
}

export default { populateIn, getResults };
