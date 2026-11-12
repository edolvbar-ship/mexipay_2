const pool = require('../database')

const unique = data => [...new Set(data)];

const searchNew = (newItems, oldItems) => {
  const oldItemsSet = new Set(oldItems);
  return newItems.filter(i => !oldItemsSet.has(i));
};

const extract = async (data) => {
  const itemColl = data.map(d => d['INSTITUCION']);
  
  return unique(itemColl);
};

const inExistence = async () => {
  try {
      const banks = await pool.query('SELECT * FROM iso_issuer_bank order by name');
      
      return unique(banks.map(r => r.name));
  } catch (message_1) {
      console.error(message_1);

      return false;
  }
}

const newFilter = async (data) => {
  const [newItems, inExistenceItems] = await Promise.all([extract(data), inExistence()]);

  return inExistenceItems ? searchNew(newItems, inExistenceItems) : false;
};

const makeInsert = async (data) => {
  if(data && data.length) {
    const saveColl = data.map(async name => await pool.query('INSERT INTO iso_issuer_bank set ?', [{name}]));

    await Promise.all(saveColl);
  }

  return true;
}

module.exports.init = async (data) => {
  const nRegistros = await newFilter(data);
  await makeInsert(nRegistros);
}