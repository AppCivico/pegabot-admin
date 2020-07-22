import got from 'got';
import neatCsv from 'neat-csv';
import { parseAsync } from 'json2csv';
import fs from 'fs';
import redis from './redis';
import directus from './directus';
import helper from './helper';

const pegabotAPI = process.env.PEGABOT_API;
const inPath = `${process.env.NODE_PATH}/in`;
const tmpPath = `${process.env.NODE_PATH}/tmp`;
const outPath = `${process.env.NODE_PATH}/out`;

const rateLimitMaximum = 15;
const nextExecutionKey = 'next_execution';

async function sendInToTmp() {
  const fileNames = await fs.readdirSync(inPath);
  for (let i = 0; i < fileNames.length; i++) { // eslint-disable-line
    const filename = fileNames[i];

    // move from /in to /tmp
    const newPath = `${tmpPath}/${filename}`;
    await fs.renameSync(`${inPath}/${filename}`, newPath); // eslint-disable-line
  }
}

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
    console.log('Fazendo a req para', profile);
    const result = await got(`${pegabotAPI}/botometer`, { searchParams, responseType: 'json' });
    return result.body;
  } catch (error) {
    return {
      error,
      msg: 'Algo deu errado com a request para o pegabot',
      body: error.response || error,
      searchParams,
    };
  }
}

async function saveResultsForLater(resultKey, results, waitTime) {
  // save the results we have so far on redis
  await redis.set(resultKey, JSON.stringify(results));
  await directus.updateFileStatus(resultKey, 'waiting');

  // add the time we have to wait to current time
  const setNextExecution = new Date();
  setNextExecution.setMinutes(setNextExecution.getMinutes() + waitTime);
  await redis.set(nextExecutionKey, setNextExecution);
}

async function getResults(content, filename) {
  let results = {};
  let rateLimit = {};
  let waitTime = false;
  const resultKey = `${filename}_results`;
  const errorKey = `${filename}_error`;
  try {
    const csv = await neatCsv(content);

    // check if we already analysed a part of this file
    const oldResult = await redis.get(resultKey);
    // save string result as json (if it exists)
    if (oldResult && typeof oldResult === 'string') results = JSON.parse(oldResult);

    for (let i = 0; i < csv.length; i++) { // eslint-disable-line
      const line = csv[i];
      const screenName = line.perfil || line.screen_name;

      //  if we already have the analysis result for this screenname, dont analyse it again. (screename must exist)
      if (screenName && !results[screenName]) {
      // make request to the pegabotAPI
        const reqAnswer = await requestPegabot(screenName); // eslint-disable-line no-await-in-loop

        if (reqAnswer && !reqAnswer.error) {
          results[screenName] = reqAnswer;
          rateLimit = reqAnswer.rate_limit;

          // check if we reached the rateLimitMaximum
          if (rateLimit.remaining <= rateLimitMaximum) {
            await saveResultsForLater(resultKey, results, rateLimit.waitTime); // eslint-disable-line no-await-in-loop
            // return this so that caller funciton stops execution and break current loop
            waitTime = true;
            break;
          }
        } else {
        // save the last error on redis
          const error = { line: i, error: reqAnswer && reqAnswer.error ? `Erro ao analisar handle ${screenName}:\n${reqAnswer.error}` : '' };
          await redis.set(errorKey, JSON.stringify(error)); // eslint-disable-line no-await-in-loop
          throw new Error('Erro ao realizar a análise');
        }
      }
    }

    // return that we have to wait for time to pass
    if (waitTime) return { waitTime };
    return { filename, data: results };
  } catch (error) {
    return { filename, error, errors: await redis.get(errorKey) };
  }
}

async function getOutputCSV() {
  await sendInToTmp();

  const now = new Date();
  let nextExecutionTime = null;
  const getNextExecution = await redis.get(nextExecutionKey);
  if (getNextExecution) nextExecutionTime = new Date(getNextExecution);

  if (!nextExecutionTime || now > nextExecutionTime) {
    const fileNames = await fs.readdirSync(tmpPath);
    for (let i = 0; i < fileNames.length; i++) { // eslint-disable-line
      const filename = fileNames[i];

      // get status of the item this file is supposed to represent
      const { status: fileStatus } = await directus.getFileItem(filename); // eslint-disable-line no-await-in-loop
      // if file is being analysed right now, ignore it
      if (fileStatus !== 'analysing') {
        const newPath = `${tmpPath}/${filename}`;
        const content = await fs.readFileSync(newPath, 'utf-8'); // eslint-disable-line no-await-in-loop

        await directus.updateFileStatus(filename, 'analysing'); // eslint-disable-line no-await-in-loop
        const result = await getResults(content, filename); // eslint-disable-line no-await-in-loop

        // if waitTime, then break out of loop and wait for the "ExecutionTime" to pass
        if (result && result.waitTime) break;

        if (result && !result.errors) {
          const filepath = await saveResult(result); // eslint-disable-line no-await-in-loop
          await directus.saveFileToDirectus(filepath); // eslint-disable-line no-await-in-loop
        } else {
          await directus.saveError(result.filename, result.errors); // eslint-disable-line no-await-in-loop
        }
      }
    }
  } else {
    console.log('Não é hora de executar, espera o rate limit resetar', nextExecutionTime);
  }
}

async function procedure() {
  await directus.populateIn();
  await getOutputCSV();
  await directus.getResults();
}

export default { procedure };
