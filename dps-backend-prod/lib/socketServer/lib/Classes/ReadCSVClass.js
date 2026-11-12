const csv = require('csvtojson');

const readFile = data => {
  return csv().fromString(data);
}

const makeOut = data => {
  return data.map(obj => {
    const transformedObj = {};
    Object.keys(obj).forEach(key => {
      const normalizedKey = key.replace(/ /g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      transformedObj[normalizedKey] = obj[key];
    });
    transformedObj['MARCA'] = normalizeBrand(obj['MARCA']);
    transformedObj['NATURALEZA'] = normalizeType(obj['NATURALEZA']);

    return transformedObj;
  });
}

const normalizeBrand = (data) => {

  data = String(data).toUpperCase();

  switch(data){
    case 'MASTERCARD':
    case 'MASTER CARD':
      data = 'MASTERCARD';
      break;
    case 'AMEX':
    case 'AMERICAN EXPRESS':
    case 'AMERICANEXPRESS':
      data = 'AMEX'
      break;
  }

  return data;

}

const normalizeType = (data) => {

  data = String(data).toUpperCase();

  switch(data){
    case 'CRÉDITO':
    case 'CREDITO':
      data = 'CRÉDITO';
      break;
    case 'DÉBITO':
    case 'DEBITO':
      data = 'DÉBITO'
      break;
  }

  return data;

}

module.exports.init = async (data) => {
  const csvData = await readFile(data);
  
  return makeOut(csvData);
}