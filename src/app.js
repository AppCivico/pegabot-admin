import got from 'got';
import neatCsv from 'neat-csv';
import fs from 'fs';

const pegabotAPI = process.env.PEGABOT_API;
const inPath = `${process.env.NODE_PATH}/in`;
const outPath = `${process.env.NODE_PATH}/out`;

function convertResultsToCSV(data) {
  const csv = ['screenname, results'];
  const keys = Object.keys(data);
  keys.forEach((screenname) => {
    const results = JSON.stringify(data[screenname]);
    const aux = `${screenname}, ${results}`;
    csv.push(aux);
  });

  return csv.join('\n');
}

async function saveResult(result) {
  const { data, filename } = result;
  const content = convertResultsToCSV(data);

  const newFilename = filename.replace('.', '_results.');
  fs.writeFileSync(`${outPath}/${newFilename}`, content);
}

async function requestPegabot(profile) {
  const searchParams = {
    socialnetwork: 'twitter',
    search_for: 'profile',
    limit: 1,
    authenticated: false,
    profile,
  };

  try {
    const result = await got(`${pegabotAPI}/botometer`, { searchParams, responseType: 'json' });
    return result.body;
  } catch (error) {
    return { error };
  }
}

async function getResults(content, filename) {
  const csv = await neatCsv(content);
  const results = {};
  const errors = [];

  for (let i = 0; i < csv.length; i++) { // eslint-disable-line
    const line = csv[i];
    const screenName = line.screen_name;
    const result = await requestPegabot(screenName); // eslint-disable-line

    if (result && !result.error) {
      results[screenName] = result;
    } else {
      errors.push({ line: i, error: result && result.error ? result.error : '' });
    }
  }

  return { filename, data: results };
}

async function getCSV() {
  fs.readdir(inPath, (err, filenames) => {
    if (err) { return; }
    filenames.forEach((filename) => {
      fs.readFile(`${inPath}/${filename}`, 'utf-8', async (err2, content) => {
        if (err2) { return; }
        const result = await getResults(content, filename);
        await saveResult(result);
      });
    });
  });
}

async function procedure() {
  await getCSV();
}

export default procedure;
