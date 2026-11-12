require('dotenv').config();
const { Sequelize } = require('sequelize');
const initModels = require('../lib/socketServer/lib/sequelize/initModels');
const initRelations = require('../lib/socketServer/lib/sequelize/initRelations');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false
  }
);

const db = { seq: sequelize, options: { sync: false } };
initModels(sequelize, Sequelize, db);
initRelations(db);

async function check() {
  console.log('\n=== FINDING RESOURCE 21 ===');
  
  const resource21 = await db.resources.findByPk(21);
  if (resource21) {
    console.log('Resource 21 (the missing parent):');
    console.table([{
      id: resource21.id,
      name: resource21.resource_name,
      url: resource21.resource_url,
      father_resource: resource21.father_resource
    }]);
  } else {
    console.log('Resource 21 does not exist!');
  }

  console.log('\n=== RESOURCE 19 (what Dashboard has) ===');
  const resource19 = await db.resources.findByPk(19);
  if (resource19) {
    console.table([{
      id: resource19.id,
      name: resource19.resource_name,
      url: resource19.resource_url,
      father_resource: resource19.father_resource
    }]);
  }

  console.log('\n=== ALL RESOURCES WITH URL LIKE /movimientos ===');
  const movResources = await db.resources.findAll({
    where: {
      resource_url: { [Sequelize.Op.like]: '%/movimientos%' }
    }
  });
  console.table(movResources.map(r => ({
    id: r.id,
    name: r.resource_name,
    url: r.resource_url,
    father_resource: r.father_resource
  })));

  await sequelize.close();
}

check().catch(console.error);
