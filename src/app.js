import fs from 'fs';
import json2xls from 'json2xls';
import storage from 'node-persist';
import redis from './redis';
import directus from './directus';
import help from './helper';
import getDirectusClient from './DirectusSDK';

const inPath = `${process.env.NODE_PATH}/in`;
const tmpPath = `${process.env.NODE_PATH}/tmp`;
const outPath = `${process.env.NODE_PATH}/out`;

const rateLimitMaximum = process.env.RATE_LIMIT_MAXIMUM ? parseInt(process.env.RATE_LIMIT_MAXIMUM, 10) : 10;
const nextExecutionKey = 'next_execution';

const userRequestsCollection = 'user_requests';

async function sendInToTmp() {
  const fileNames = await fs.readdirSync(inPath);
  for (let i = 0; i < fileNames.length; i++) { // eslint-disable-line
    const filename = fileNames[i];
    const oldPath = `${inPath}/${filename}`;

    const stat = await fs.lstatSync(oldPath);
    const isDirectory = stat.isDirectory();

    if (isDirectory) {
      fs.rmdirSync(oldPath, { recursive: true }); // if its a dir, delete it
    } else {
      const isInvalidFile = help.checkInvalidFiles(filename);

      // if file is invalid, delete it
      if (isInvalidFile) {
        fs.unlinkSync(oldPath);
      } else {
      // move from /in to /tmp
        const newPath = `${tmpPath}/${filename}`;
        fs.renameSync(`${inPath}/${filename}`, newPath);
      }
    }
  }
}

function formatResults(data) {
  const csv = [];
  const keys = Object.keys(data);
  keys.forEach((screenname) => {
    const aux = {};

    if (data[screenname] && data[screenname].profiles && data[screenname].profiles[0]) {
      const results = data[screenname].profiles[0];
      const twitterData = data[screenname].twitter_data;

      aux['Perfil Twitter'] = screenname;
      aux['Mensagem de Erro'] = '';
      aux['Análise Total'] = results.bot_probability.all;

      const langInd = results.language_independent;
      aux['Análise Usuário'] = help.checkValue(langInd.user);
      aux['Análise Amigos'] = help.checkValue(langInd.friend);
      aux['Análise Temporal'] = help.checkValue(langInd.temporal);
      aux['Análise Rede'] = help.checkValue(langInd.network);

      const langDep = results.language_dependent;
      if (langDep && langDep.sentiment) aux['Análise Sentimento'] = help.checkValue(langDep.sentiment.value);

      aux['URL do Perfil'] = results.url;
      aux['Avatar do Perfil'] = results.avatar;

      aux['ID do Usuário'] = `"${twitterData.user_id}"`;
      aux['Nome do Usuário'] = twitterData.user_name;
      aux['Criação da Conta'] = help.dateMysqlFormat(new Date(twitterData.created_at));
      aux.Seguindo = twitterData.following;
      aux.Seguidores = twitterData.followers;
      aux['Número de Tweets'] = twitterData.number_tweets;
      aux['Hashtags Recentes'] = twitterData.hashtags;
      aux['Menções Recentes'] = twitterData.mentions;
      aux['Usou Cache'] = twitterData.usedCache ? 'Sim' : 'Não';
      csv.push(aux);
    } else if (data[screenname].msg) {
      aux['Perfil Twitter'] = data[screenname].searchParams.profile;
      const { msg } = data[screenname];
      if (msg) aux['Mensagem de Erro'] = msg.replace('Error:', '').trim();
      csv.push(aux);
    }
  });

  return csv;
}

async function saveResult(result) {
  const { data, filename } = result;
  const content = formatResults(data);

  const xlsxData = json2xls(content);

  let newFilename = filename.substr(0, filename.indexOf('.'));
  newFilename += '_results.xlsx';
  const filepath = `${outPath}/${newFilename}`;

  await fs.writeFileSync(filepath, xlsxData, 'binary');

  console.log(`[saveResult] filepath: ${filepath}`);

  return filepath;
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

async function getResults(profiles, filename) {
  let results = {};
  let hasOneResult = false;
  let rateLimit = {};
  let waitTime = false;
  const resultKey = `${filename}_results`;
  const errorKey = `${filename}_error`;
  const allErrors = [];

  // Init storage
  await storage.init({
    dir: process.env.PEGABOT_ADMIN_CACHE,
    stringify: JSON.stringify,
    parse: JSON.parse,
    encoding: 'utf8',
    logging: false,
    ttl: false,
    expiredInterval: 60 * 60 * 1000,
    forgiveParseErrors: false,
  });

  try {
    // check if we already analysed a part of this file
    const oldResult = await redis.get(resultKey);

    // save string result as json (if it exists)
    if (oldResult && typeof oldResult === 'string') results = JSON.parse(oldResult);

    let progress = 0;
    const profilesCount = profiles.length;

    let progressOffset = Number.parseInt((profilesCount / 100), 10);
    if (progressOffset < 10) { progressOffset = 10; } // Min offset
    console.log(`progressOffset: ${progressOffset}`);

    for (let i = 0; i < profilesCount; i += 1) {
      console.log(`currentLine: ${i + 1}`);

      const line = profiles[i];

      // Savepoint
      await redis.set(`filename_${filename}_current_line`, i);

      // get the user key from the CSV
      const keyToUse = help.getCSVKey(line);

      if (!keyToUse) { // if there's no valid key, save the error
        const error = { line: i, msg: 'Adicione uma coluna para servir de header da lista de usuários chamada "Perfil"' };
        allErrors.push(error); // store all errors
        break;
      } else {
        const screenName = help.formatScreenname(line[keyToUse]); // get the screenname

        console.log(`Processando o perfil ${screenName}`);

        if (!screenName) { // if the screenname is not valid, save the error
          const error = { line: i, msg: 'Nome de perfil inválido! Tenha certeza de que é apenas um texto!' };
          allErrors.push(error); // store all errors
        } else {
          // if we already have the analysis result for this screenname, dont analyse it again. (screename must exist)
          if (!results[screenName]) { // eslint-disable-line no-lonely-if
            let reqAnswer = await storage.getItem(screenName);
            if (!reqAnswer) {
              reqAnswer = await help.requestPegabot(screenName);
              await storage.setItem(screenName, reqAnswer);
            }

            // make request to the pegabotAPI
            // results[screenName] = reqAnswer;
            if (reqAnswer && reqAnswer.profiles && !reqAnswer.error) {
              hasOneResult = true;

              const newRateLimit = reqAnswer.rate_limit;
              if (newRateLimit && newRateLimit.remaining) {
                rateLimit = newRateLimit;
                const remaining = rateLimit.remaining ? parseInt(rateLimit.remaining, 10) : 10;

                // check if we reached the rateLimitMaximum
                if (remaining <= rateLimitMaximum) {
                  await saveResultsForLater(resultKey, results, rateLimit.toReset);
                  // return this so that caller funciton stops execution and break current loop
                  waitTime = true;
                  break;
                }
              }
            } else {
              const error = { line: i, msg: `Erro ao analisar handle "${screenName}"`, error: reqAnswer };
              if (reqAnswer && reqAnswer.msg) error.msg += ` - ${reqAnswer.msg}`; // add erro detail on msg
              allErrors.push(error); // store all errors
              await redis.set(errorKey, JSON.stringify(allErrors));
            }
          }
        }
      }

      // Set progress
      progress = Math.round((100 - ((profilesCount - (i + 1)) * 100) / profilesCount) - 1);
      if (progress < 0) progress = 0;
      if (progress > 99) progress = 99;

      if (i > 0 && i % progressOffset === 0) {
        const itemId = filename.substr(0, filename.indexOf('_'));
        const client = await getDirectusClient();
        await client.updateItem(userRequestsCollection, itemId, { progress });
      }
    }

    await redis.del(`filename_${filename}_current_line`);

    // return that we have to wait for time to pass
    if (waitTime) return { waitTime };
    return {
      filename, data: results, errors: allErrors, hasOneResult,
    };
  } catch (error) {
    return { filename, error, errors: allErrors };
  }
}

const itemStatuses = {};

async function getOutputCSV() {
  await sendInToTmp();

  const now = new Date();
  let nextExecutionTime = null;
  const getNextExecution = await redis.get(nextExecutionKey);
  if (getNextExecution) nextExecutionTime = new Date(getNextExecution);

  if (!nextExecutionTime || !help.isValidDate(nextExecutionTime) || now > nextExecutionTime) {
    const fileNames = await fs.readdirSync(tmpPath);
    for (let i = 0; i < fileNames.length; i++) { // eslint-disable-line
      const filename = fileNames[i];

      console.info(`[getOutputCSV] start processing filename: ${filename}`);

      const analysedNow = itemStatuses[filename];
      // if file is being analysed right now, ignore it
      if (!analysedNow) {
        await redis.set('current_processing', 1);
        // await redis.set('current_file_name', filename);

        itemStatuses[filename] = true;
        const newPath = `${tmpPath}/${filename}`;
        const content = await help.getFileContent(newPath);

        // const { status: fileStatus } = await directus.getFileItem(filename);
        // get status of the item this file is supposed to represent and update it to "analysing" if it's not like that yet
        // if (fileStatus !== 'analysing') await directus.updateFileStatus(filename, 'analysing');

        // Set progress to zero percent and file status to 'analysing'
        const itemId = filename.substr(0, filename.indexOf('_'));
        const client = await getDirectusClient();
        await client.updateItem(userRequestsCollection, itemId, { status: 'analysing', progress: 0 });

        // await directus.updateFileStatus(filename, 'analysing');
        const result = await getResults(content, filename);

        itemStatuses[filename] = false;
        // await redis.set('current_file_name', '');

        // if waitTime, then break out of loop and wait for the "ExecutionTime" to pass
        if (result && result.waitTime) break;

        if (result && result.data && result.hasOneResult) {
          const filepath = await saveResult(result);
          const updatedItem = await directus.saveFileToDirectus(filepath, result.errors);

          fs.unlinkSync(`./tmp/${filename}`);
          if (updatedItem && !updatedItem.error) await directus.sendResultMail(updatedItem, filepath);
        } else {
          await directus.saveError(result.filename, result.errors);
        }
      }
    }
  } else {
    console.log('Não é hora de executar, espera o rate limit resetar', nextExecutionTime);
  }
}

async function procedure() {
  try {
    console.info('exec populateIn');
    await directus.populateIn();

    console.info('exec getOutputCSV');
    await getOutputCSV();

    console.info('exec getResults');
    await directus.getResults();

    console.info('updating redis, set current_processing to 0');
    await redis.set('current_processing', 0);
  } catch (error) {
    console.error(error);

    // In case of any error, try to update both the file and redis
    await redis.set('current_processing', 0);

    const fileId = await redis.get('current_file_directus_id');
    if (fileId) {
      const client = await getDirectusClient();

      await client.updateItem(userRequestsCollection, itemID, {
        status: 'error', analysis_date: analysisDate, error,
      });
    }
  }
}

export default { procedure };
