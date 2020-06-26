import { writeFileSync } from 'fs';
import got from 'got';
import DirectusSDK from '@directus/sdk-js';

const directusUrl = process.env.DIRECTUS_URL;
const directusProject = process.env.DIRECTUS_PROJECT;
const directusEmail = process.env.DIRECTUS_USER_EMAIL;
const directusPass = process.env.DIRECTUS_USER_PASSWORD;

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
  const toProcess = await client.getItems('user_files', { filter: { status: { eq: 'waitin' } } });

  // no files to process were found
  if (!toProcess || !toProcess.data || toProcess.data.length === 0) return null;

  const { data: allFiles } = await client.getFiles();
  const desiredFiles = [];

  // get details of all the files we want
  toProcess.data.forEach((e) => {
    const currentFile = allFiles.find((x) => x.id === e.file);
    desiredFiles.push(currentFile);
  });

  return desiredFiles;
}

async function saveFilesToDisk(files) {
  for (const file of files) { // eslint-disable-line
    const res = await got(file.data.full_url); // eslint-disable-line
    writeFileSync(`./in/${file.id}_${file.filename_download}`, res.body);
  }
}

async function populateIn() {
  const files = await getFilesToProcess();
  if (files) await saveFilesToDisk(files);
}

export default { populateIn };
