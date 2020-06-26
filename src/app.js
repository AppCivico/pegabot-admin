import got from 'got';
import neatCsv from 'neat-csv';
import fs from 'fs';

const pegabotAPI = process.env.PEGABOT_API;
const inPath = `${process.env.NODE_PATH}/in`;

async function requestPegabot(profile) {
  const searchParams = {
    socialnetwork: 'twitter',
    search_for: 'profile',
    limit: 1,
    authenticated: false,
    profile,
  };

  try {
    const result = await got(`${pegabotAPI}/botometer`, { searchParams });
    return result.body;
  } catch (error) {
    return { error };
  }
}

async function getCSV() {
  fs.readdir(inPath, (err, filenames) => {
    if (err) { return err; }
    filenames.forEach((filename) => {
      fs.readFile(`${inPath}/${filename}`, 'utf-8', async (err, content) => {
        if (err) { return err; }
        await getResults(content, filename)
      });
    });
  })
}

async function getResults(content, filename) {
  const csv = await neatCsv(content);
  const results = [];
  const errors = [];

  for (let i = 0; i < csv.length; i++) { // eslint-disable-line
    const line = csv[i];
    const screenName = line.screen_name;
    const result = await requestPegabot(screenName); // eslint-disable-line

    if (result && !result.error) {
      results.push(result);
    } else {
      errors.push({ line: i, error: result && result.error ? result.error : '' });
    }
  }

  return results;
}

async function procedure() {
  await getCSV();
}


export default procedure;
