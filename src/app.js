import got from 'got';
import neatCsv from 'neat-csv';
import fs from 'fs';
import directus from './directus';

const pegabotAPI = process.env.PEGABOT_API;
const inPath = `${process.env.NODE_PATH}/in`;
const tmpPath = `${process.env.NODE_PATH}/tmp`;
const outPath = `${process.env.NODE_PATH}/out`;

function convertResultsToCSV(data) {
  const csv = ['screenname, total, url, avatar'];
  const keys = Object.keys(data);
  keys.forEach((screenname) => {
    const results = data[screenname].profiles[0];
    const { url } = results;
    const { avatar } = results;
    const total = results.bot_probability.all;
    const aux = `${screenname}, ${total}, ${url}, ${avatar}`;
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

async function getOutputCSV() {
  fs.readdir(inPath, (err, filenames) => {
    if (err) { return; }
    filenames.forEach(async (filename) => {
      const newPath = `${tmpPath}/${filename}`;
      await fs.renameSync(`${inPath}/${filename}`, newPath); // move from /in to /tmp
      fs.readFile(newPath, 'utf-8', async (err2, content) => {
        if (err2) { return; }
        await directus.updateFileStatus(filename);
        const result = await getResults(content, filename);

        await saveResult(result);
      });
    });
  });
}

async function procedure() {
  await getOutputCSV();
}

export default procedure;
