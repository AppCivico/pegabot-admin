import got from 'got';
import neatCsv from 'neat-csv';
import { parseAsync } from 'json2csv';
import fs from 'fs';
import directus from './directus';
import helper from './helper';

const pegabotAPI = process.env.PEGABOT_API;
const inPath = `${process.env.NODE_PATH}/in`;
const tmpPath = `${process.env.NODE_PATH}/tmp`;
const outPath = `${process.env.NODE_PATH}/out`;

function convertResultsToCSV(data) {
  const csv = [];
  const keys = Object.keys(data);
  keys.forEach((screenname) => {
    const results = data[screenname].profiles[0];
    const twitterData = data[screenname].twitter_data;
    const aux = {};

    aux['Perfil Twitter'] = screenname;
    aux['Análise Total'] = results.bot_probability.all;

    const langInd = results.language_independent;
    aux['Análise Usuário'] = helper.checkValue(langInd.user);
    aux['Análise Amigos'] = helper.checkValue(langInd.friend);
    aux['Análise Temporal'] = helper.checkValue(langInd.temporal);
    aux['Análise Rede'] = helper.checkValue(langInd.network);

    const langDep = results.language_dependent;
    if (langDep && langDep.sentiment) aux['Análise Sentimento'] = helper.checkValue(langDep.sentiment.value);

    aux['URL do Perfil'] = results.url;
    aux['Avatar do Perfil'] = results.avatar;

    aux['ID do Usuário'] = `"${twitterData.user_id}"`;
    aux['Nome do Usuário'] = twitterData.user_name;
    aux['Criação da Conta'] = helper.dateMysqlFormat(new Date(twitterData.created_at));
    aux.Seguindo = twitterData.following;
    aux.Seguidores = twitterData.followers;
    aux['Número de Tweets'] = twitterData.number_tweets;
    aux['Hashtags Recentes'] = twitterData.hashtags;
    aux['Menções Recentes'] = twitterData.mentions;

    csv.push(aux);
  });

  return csv;
}

async function saveResult(result) {
  const { data, filename } = result;
  const content = convertResultsToCSV(data);

  const newFilename = filename.replace('.', '_results.');
  const filepath = `${outPath}/${newFilename}`;
  await fs.writeFileSync(filepath, await parseAsync(content));
  await fs.unlinkSync(`${tmpPath}/${filename}`);
  return newFilename;
}

async function requestPegabot(profile) {
  const searchParams = {
    socialnetwork: 'twitter',
    search_for: 'profile',
    limit: 1,
    authenticated: false,
    profile,
    getData: true,
  };

  try {
    console.log('Fazendo a req');
    const result = await got(`${pegabotAPI}/botometer`, { searchParams, responseType: 'json' });
    if (!result.body || (result.body && result.body.error)) throw new Error({ msg: 'Algo deu errado com a request para o pegabots', body: result.body, searchParams });
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
    // perfil is the name of the first CSV column
    const screenName = line.perfil;

    const result = await requestPegabot(screenName); // eslint-disable-line
    if (result && !result.error) {
      results[screenName] = result;
    } else {
      errors.push({ line: i, error: result && result.error ? `Erro ao analisar ${screenName}:\n${result.error}` : '' });
    }
  }

  if (errors.length > 0) return { filename, errors };
  return { filename, data: results };
}

async function sendInToTmp() {
  const fileNames = await fs.readdirSync(inPath);
  for (let i = 0; i < fileNames.length; i++) { // eslint-disable-line
    const filename = fileNames[i];

    // move from /in to /tmp
    const newPath = `${tmpPath}/${filename}`;
    await fs.renameSync(`${inPath}/${filename}`, newPath); // eslint-disable-line
  }
}

async function getOutputCSV() {
  await sendInToTmp();
  const fileNames = await fs.readdirSync(tmpPath);
    for (let i = 0; i < fileNames.length; i++) { // eslint-disable-line
    const filename = fileNames[i];

    const newPath = `${tmpPath}/${filename}`;
    const content = await fs.readFileSync(newPath, 'utf-8'); // eslint-disable-line

    await directus.updateFileStatus(filename); // eslint-disable-line
    const result = await getResults(content, filename); // eslint-disable-line

    if (result && !result.errors) {
      const filepath = await saveResult(result); // eslint-disable-line
      await directus.saveFileToDirectus(filepath); // eslint-disable-line
    } else {
      await directus.saveError(result.filename, result.errors); // eslint-disable-line
    }
  }
}

async function procedure() {
  await directus.populateIn();
  await getOutputCSV();
  await directus.getResults();
}

export default { procedure };
