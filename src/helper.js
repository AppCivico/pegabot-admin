import axios from 'axios';
import fs from 'fs';
import neatCsv from 'neat-csv';
import excelToJson from 'convert-excel-to-json';

/**
 * You first need to create a formatting function to pad numbers to two digits…
 * */
function twoDigits(d) {
  if (d >= 0 && d < 10) return `0${d.toString()}`;
  if (d > -10 && d < 0) return `-0${(-1 * d).toString()}`;
  return d.toString();
}

/**
 * …and then create the method to output the date string as desired.
 * Some people hate using prototypes this way, but if you are going
 * to apply this to more than one Date object, having it as a prototype
 * makes sense.
 * */
function dateMysqlFormat(date) {
  date.setMinutes(date.getMinutes() - 180); // remove timezone from date
  return `${date.getUTCFullYear()}-${twoDigits(1 + date.getUTCMonth())}-${twoDigits(date.getUTCDate())} ${twoDigits(date.getUTCHours())}:${twoDigits(date.getUTCMinutes())}:${twoDigits(date.getUTCSeconds())}`;
}

function checkValue(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return value;
  if (typeof value === 'undefined') return null;
  if (value === null) return null;
  return null;
}

function isValidDate(d) {
  return d instanceof Date && !isNaN(d); // eslint-disable-line
}

function formatErrorMsg(errors) {
  try {
    if (errors && Array.isArray(errors)) {
      let text = '';

      errors.forEach((e) => {
        let aux = '';
        if (typeof e.line === 'number' && e.msg) {
          aux = `Linha: ${e.line + 2} - ${e.msg}\n\n`;
        } else {
          aux = e;
        }

        text += aux;
      });

      return text;
    }

    return null;
  } catch (error) {
    console.log('formatErrorMsg', error);
    return null;
  }
}

function checkInvalidFiles(fileName) {
  if (!fileName || typeof fileName !== 'string') return true;
  const invalidStrings = ['__MACOSX', '._'];
  const hasInvalidStrings = invalidStrings.some((v) => fileName.includes(v));
  if (hasInvalidStrings) return true;

  const supportedExtensions = ['csv', 'xls', 'xlsx'];
  let validExt = false;

  supportedExtensions.forEach((e) => {
    if (!validExt) validExt = fileName.endsWith(`.${e}`);
  });

  return !validExt;
}

function handleRequestError(error) {
  const response = error.response ? error.response : {};
  const { data } = response;

  if (!data || !data.metadata) return error.toString();

  let erro = data.metadata.error[0] || {};
  if (erro.code === 34) return 'Esse usuário não existe';
  if (erro.code === 88) return 'Chegamos no rate limit';

  erro = data.metadata.error || {};
  if (erro.request === '/1.1/statuses/user_timeline.json' && erro.error === 'Not authorized.') return 'Sem permissão para acessar. Usuário pode estar bloqueado/suspendido.';

  if (data && JSON.stringify(data)) return JSON.stringify(data);
  return 'Erro da api desconhecido';
}

async function requestPegabot(profile) {
  const pegabotAPI = process.env.PEGABOT_API;

  const searchParams = {
    socialnetwork: 'twitter',
    search_for: 'profile',
    limit: 1,
    authenticated: false,
    profile,
    getData: true,
    is_admin: true,
  };

  try {
    console.log('Fazendo request para', profile);
    const result = await axios({ url: `${pegabotAPI}/botometer`, method: 'get', params: searchParams });
    if (!result) throw new Error('Não houve resposta da api');
    if (Array.isArray(result.data) && result.data.length === 0) throw new Error('Parece que usuário não tem tweets na timeline');

    return result.data;
  } catch (error) {
    const msg = handleRequestError(error);
    return { error, msg, searchParams };
  }
}

/**
* Get key with the user to be analysed from the input JSON
* @param {object} csvJson - the current json from the input csv to array of jsons covertion
* @return {string} The key we have to use to get the users to analyse
* @example getCSVKey({ perfil: 'twitter' })
*/
function getCSVKey(csvJson) {
  if (!csvJson || typeof csvJson !== 'object') return null;

  const acceptedKeys = ['perfil', 'perfis', 'profile', 'profiles', 'screenname', 'screennames', 'user', 'users', 'screen_name', 'screen_names'];
  let keyFound = null;
  const keys = Object.keys(csvJson);

  keys.forEach((e) => {
    if (acceptedKeys.includes(e) && !keyFound) {
      keyFound = e;
    }
  });

  return keyFound;
}

function formatScreenname(screenname) {
  if (typeof screenname === 'number') screenname = screenname.toString(); // eslint-disable-line no-param-reassign
  if (!screenname || typeof screenname !== 'string') return '';
  return screenname.trim();
}

async function getFileContent(filePath) {
  if (filePath.endsWith('.csv')) {
    const content = await fs.readFileSync(filePath, 'utf-8');
    return neatCsv(content, { mapHeaders: ({ header }) => header.toLowerCase() });
  }

  if (filePath.endsWith('.xlsx') || filePath.endsWith('.xls')) {
    const excel = await excelToJson({
      sourceFile: filePath,
      header: { rows: 1 },
      columnToKey: { A: '{{A1}}' },
    });
    const result = [];
    let columnToUse = null;
    const sheets = Object.keys(excel);

    // get data from exery sheet
    sheets.forEach((sheet) => {
      const rows = excel[sheet];
      rows.forEach((row) => {
        // use first column as the main column
        const currentKey = Object.keys(row)[0];
        if (!columnToUse && currentKey) columnToUse = currentKey;
        const aux = { perfil: row[columnToUse] };
        result.push(aux);
      });
    });

    return result;
  }

  return null;
}

export default {
  dateMysqlFormat,
  checkValue,
  isValidDate,
  formatErrorMsg,
  checkInvalidFiles,
  requestPegabot,
  getCSVKey,
  formatScreenname,
  getFileContent,
};
