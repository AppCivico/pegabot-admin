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
function dateMysqlFormat(data) {
  return `${data.getUTCFullYear()}-${twoDigits(1 + data.getUTCMonth())}-${twoDigits(data.getUTCDate())} ${twoDigits(data.getUTCHours())}:${twoDigits(data.getUTCMinutes())}:${twoDigits(data.getUTCSeconds())}`;
}

export default { dateMysqlFormat };
