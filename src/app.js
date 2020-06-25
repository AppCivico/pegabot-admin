import got from 'got';
import neatCsv from 'neat-csv';

const csvLink = process.env.LINK_TO_CSV;
const pegabotAPI = process.env.PEGABOT_API;

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
  const response = await got(csvLink);
  const csv = response.body;
  const res = await neatCsv(csv);
  return res;
}

async function getResults(csv) {
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
  const csvData = await getCSV();
  const results = await getResults(csvData);
  return results;
}

export default procedure;
