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
  let text = '';

  errors.forEach((e) => {
    let aux = '';
    if (typeof e.line === 'number' && e.error) {
      aux = `Linha: ${e.line} - ${e.error}`;
    } else {
      aux = e;
    }

    text += aux;
  });

  return text;
}

function checkInvalidFiles(fileName) {
  if (!fileName || typeof fileName !== 'string') return true;
  const invalidStrings = ['__MACOSX', '._'];
  const hasInvalidStrings = invalidStrings.some((v) => fileName.includes(v));
  const endsWithCSV = fileName.endsWith('.csv');

  return hasInvalidStrings || !endsWithCSV;
}

export default {
  dateMysqlFormat, checkValue, isValidDate, formatErrorMsg, checkInvalidFiles,
};
