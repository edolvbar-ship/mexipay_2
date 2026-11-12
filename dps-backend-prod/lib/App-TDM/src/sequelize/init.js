const { Sequelize } = require('sequelize');
const SYNC = (process.env.SYNC) ? ((process.env.SYNC == 'true') ? true : false) : false // SE PONE EN TRUE PARA SINCRONIZAR LA BASE DE DATOS
const PROD = (process.env.SSL) ? ((process.env.SSL == 'true') ? true : false) : true   // SE PONE EN TRUE PARA AGREGAR EL SSL A LAS CONSULTA 

const op = {
  host: process.env.DB_HOST_TDM,
  port: process.env.DB_PORT_TDM,
  dialect: 'mysql',
  logging: false,
  define: {
    timestamps: false,  // I do not want timestamp fields by default
  },
  dialectOptions: {
    //useUTC: false, //for reading from database
    dateStrings: true,
    typeCast: function (field, next) { // for reading from database
      if (field.type === 'DATETIME') {
        return field.string()
      }
      return next()
    },
  }
}

if (PROD) {
  op.dialectOptions = {
    ssl: {
      rejectUnauthorized: false,
      useUTC: false
    }
  }
}


// Conexion a la BD
const sequelize = new Sequelize(process.env.DB_NAME_TDM, process.env.DB_USER_TDM, process.env.DB_PASSWORD_TDM, op);

// Verifica la Conexión
sequelize.authenticate().then(() => {
  global.dd('conexion a la BD TDM con sequelize exitosa');
}, (err) => {
    global.dd(`error en la conexion a la BD TDM con sequelize. ${err}`, 'error');
    global.dd(`Database TDM from env. DB_NAME_TDM: ${process.env.DB_NAME_TDM} DB_USER_TDM: ${process.env.DB_USER_TDM} DB_PASSWORD_TDM ${process.env.DB_PASSWORD_TDM}`, 'debug');
    global.dd(`DB connection options: ${JSON.stringify(op)}`, 'debug');
})

let db = { options: {} };
db.options.sync = SYNC
db.Sequelize = Sequelize;
db.seq = sequelize;

// INSTANCIA LAS TABLAS DE LA BD 
db = require('./initModels')(sequelize, Sequelize, db);

// CREA LAS RELACIONES
db = require('./initRelations')(db);

// SE DESCOMENTA SYNC PARA SINCRONIZAR CON LA BD
try {
  if (SYNC) {
    console.warn("syncronizing TDM sequelize models");
    sequelize.sync({ alter: true });
  }
} catch (error) {
  global.dd('error en la sync', error)
}

module.exports = db;
