const mysql = require('mysql2');
const { promisify }= require('util');

const { database } = require('./keys');

const pool = mysql.createPool(database);

pool.getConnection((err, connection) => {
  if (err) {
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      dd('Database connection was closed.', 'error');
    }
    if (err.code === 'ER_CON_COUNT_ERROR') {
      dd('Database has to many connections', 'error');
    }
    if (err.code === 'ECONNREFUSED') {
      dd(('Database TDM connection was refused').red);
    }
  }else{
    if (connection) connection.release();
  dd(('DB TDM is Connected').green);
  return;
  }
});

// Promisify Pool Querys
pool.query = promisify(pool.query);

module.exports = pool;