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

export default { dateMysqlFormat, checkValue, isValidDate };
