const pool = require('../database')
const db = require('../sequelize/init')

const unique = data => {
  return data.filter((value, index, self) => self.indexOf(value) === index);
}

const extract = async (data) => {
  const ProItemColl = data.map(async d => d['BIN'].substring(0, parseInt(d['LONGITUD'] || '6')));
  data = await Promise.all(ProItemColl);

  return unique(data);;
}

const inExistence = async () => {
  try {
      const brand = await pool.query('SELECT * FROM ciso_bin order by bin');
      
      return unique(brand.map(r => r.bin));
  } catch (message_1) {
      console.error(message_1);

      return false;
  }
}

const searchNew = (newItems, oldItems) => {
  const insert = [];
  const update = [];

  const oldItemsSet = new Set(oldItems);

  for (const item of newItems) {
    if (!oldItemsSet.has(item))
      insert.push(item);
    else
      update.push(item);
  }

  return { insert, update };
};

const newFilter = async (data) => {
  console.log('class.DataConverterProClass.js -----> newFilter');
  const ProNewItems = extract(data);
  const ProInExistence = inExistence();
  
  const results = await Promise.all([ProNewItems, ProInExistence]);
  
  return searchNew(results[0], results[1]);
}

const dataMakeData = async (data, nData) => {
  console.log('class.DataConverterProClass.js -----> dataMakeData');
  const nDataSet = new Set(nData);

  data = [...nDataSet].map( bin => data.find(d => d['BIN'].substring(0, parseInt(d['LONGITUD'] || '6')) == bin));

  const [issuerBank, cardProduct, cardType, brand] = await Promise.all([
    pool.query('SELECT * FROM iso_issuer_bank order by name'),
    pool.query('SELECT * FROM iso_card_product order by name'),
    pool.query('SELECT * FROM iso_card_type order by name'),
    pool.query('SELECT * FROM iso_brand order by name')
  ]);

  const AllCat = new Map([
    ['iso_issuer_bank', new Map(issuerBank.map(row => [row.name, row]))],
    ['iso_card_product', new Map(cardProduct.map(row => [row.name, row]))],
    ['iso_card_type', new Map(cardType.map(row => [row.name, row]))],
    ['iso_brand', new Map(brand.map(row => [row.name, row]))]
  ]);

  const ProDataColl = data.map(async d => {
    return {
      bin: d['BIN'].substring(0, parseInt(d['LONGITUD'] || '6')),
      id_issbank: AllCat.get('iso_issuer_bank').get(d.INSTITUCION)?.id_issbank,
      id_card_product: AllCat.get('iso_card_product').get(d.PRODUCTO)?.id_card_product,
      id_card_type: AllCat.get('iso_card_type').get(d.NATURALEZA)?.id_card_type,
      id_processor: null,
      id_brand: AllCat.get('iso_brand').get(d.MARCA)?.id_brand,
      '3DS': 'NO' === d.AC3DSECURE ? 0 : 1
    };
  });

  return await Promise.all(ProDataColl);
};

const dataUpgradeData = async (data, nData) => {
  console.log('class.DataConverterProClass.js -----> dataUpgradeData');
  const nDataSet = new Set(nData);


  data = data.filter(d => nDataSet.has(d['BIN'].substring(0, parseInt(d['LONGITUD'] || '6'))));

  const [issuerBank, cardProduct, cardType, processor, brand] = await Promise.all([
    pool.query('SELECT * FROM iso_issuer_bank order by name'),
    pool.query('SELECT * FROM iso_card_product order by name'),
    pool.query('SELECT * FROM iso_card_type order by name'),
    pool.query('SELECT * FROM iso_processor order by name'),
    pool.query('SELECT * FROM iso_brand order by name')
  ]);

  const AllCat = [
    new Map(issuerBank.map(row => [row.name, row])),
    new Map(cardProduct.map(row => [row.name, row])),
    new Map(cardType.map(row => [row.name, row])),
    new Map(processor.map(row => [row.name, row])),
    new Map(brand.map(row => [row.name, row]))
  ];

  const ProDataColl = data.map(async d => {
    return {
      where: { bin: d['BIN'].substring(0, parseInt(d['LONGITUD'] || '6')) },
      data: {
        id_issbank: AllCat[0].get(d.INSTITUCION)?.id_issbank,
        id_card_product: AllCat[1].get(d.PRODUCTO)?.id_card_product,
        id_card_type: AllCat[2].get(d.NATURALEZA)?.id_card_type,
        id_processor: AllCat[3].get(d.PROCESADOR)?.id_processor ?? AllCat[3].get('PROSA')?.id_processor,
        id_brand: AllCat[4].get(d.MARCA)?.id_brand,
        '3DS': 'NO' === d.AC3DSECURE ? 0 : 1
      }
    };
  });

  return await Promise.all(ProDataColl);
};

module.exports.init = async (data) => {
  console.log('class.DataConverterProClass.js -----> init');
  const nRegistros = await newFilter(data);
  const newData = await dataMakeData(data, nRegistros.insert);
  const updateData = await dataMakeData(data, nRegistros.update);

  const ProNewColl = db.cisoBin.bulkCreate(newData);
  const ProUpdateColl = db.cisoBin.bulkCreate(updateData, { updateOnDuplicate: ["id_issbank","id_card_product","id_card_type","id_brand","3DS"] });

  await Promise.all([ProNewColl, ProUpdateColl]);

  return true;
};