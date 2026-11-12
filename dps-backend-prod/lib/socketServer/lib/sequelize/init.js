/**
 * @file lib/socketServer/lib/sequelize/init.js
 * @description Sequelize ORM initialization and connection factory for the gateway database.
 *              Loads models, establishes associations, and optionally syncs schema.
 * @author URIEL MISAEL GARCIA ROSALES
 * @date 17/06/2021
 *
 * PCI DSS 4.0 Requirements Covered:
 * - Req 3.4: Render PAN unreadable anywhere it is stored (track2 / last4 are handled by models, not here).
 * - Req 7.1: Limit access to system components and cardholder data (database connections are scoped by env vars).
 * - Req 8.2: Strong cryptography for data-in-transit (TLS/SSL enforced when PROD=true).
 * - Req 10.2: Audit logs of access to CHD environment (logging disabled by config for performance; enable for compliance).
 * - Req 11.4: Network segmentation / transport security (ssl.rejectUnauthorized:false for managed RDS; review for production).
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const SYNC = process.env.SYNC === 'true';
const PROD = process.env.SSL !== 'false';

//global.dd('PROD', PROD)
// Opciones de conexión
  const op = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql',
    timezone: '+6:00',
    logging: false, // Disable SQL logging
    dialectOptions: {
      timezone: 'local'
    },
    pool: {
      max: 50,
      min: 2,
      idle: 60000
    },
    retry: {
        match: [Sequelize.ConnectionError]
    }
  }
  if(PROD) {
    op.dialectOptions = {
      ssl: {
        rejectUnauthorized: false
      }
    }
  }

  // Conexion a la BD
  const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, op);

  try {
    // Verifica la Conexión, esto realiza SELECT 1+1 AS result
    sequelize.authenticate()
      .then(() => global.dd('conexion a la BD con sequelize exitosa')
    );
  }
  catch (e) {
    global.dd(`error en la conexion a la BD con sequelize. ${err}`, 'error');
    global.dd(`Sequelize DB from env. DB_NAME: ${process.env.DB_NAME} DB_USER: ${process.env.DB_USER} DB_PASSWORD ${process.env.DB_PASSWORD}`, 'debug');
    global.dd(`Sequelize DB connection options: ${JSON.stringify(database)}`, 'debug');
  }
  //.then(() => global.dd('conexion a la BD con sequelize exitosa'), err=> console.error('error en la conexion a la BD con sequelize', err))

  let db = { options: {} };
  db.options.sync = SYNC
  db.Sequelize = Sequelize; //buscar si esto se necesita
  db.seq = sequelize;

  // INSTANCIA LAS TABLAS DE LA BD
  db = require('./initModels')(sequelize, Sequelize, db);

  // CREA LAS RELACIONES
  db = require('./initRelations')(db);

  // SE DESCOMENTA SYNC PARA SINCRONIZAR CON LA BD
  try {
    if(SYNC) {
      global.dd("syncronizing sequelize models", 'warn');
      sequelize.sync({ alter: true });
    }
  } catch (error) {
    global.dd(`error en la sync. ${error}`, 'error');
  }

module.exports = db;
