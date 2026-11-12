const pool = require('../database');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

 async function getPassLong(){
    rows = await pool.query('SELECT * FROM params WHERE idparams = 2');
   if (rows.length > 0) {
    params = rows[0];
    if (params.active != 1){
        return false
    } else {

        long = params.value;
        return long;

    }
   }
 };

 async function getPassUpper(){
    rows = await pool.query('SELECT * FROM params WHERE idparams = 6');
   if (rows.length > 0) {
    params = rows[0];
    if (params.active != 1){
        return false
    } else {

        return true

    }
   }
 };

 async function getPassLower(){
    rows = await pool.query('SELECT * FROM params WHERE idparams = 7');
   if (rows.length > 0) {
    params = rows[0];
    if (params.active != 1){
        return false
    } else {

        return true

    }
   }
 };

 async function getPassNumber(){
    rows = await pool.query('SELECT * FROM params WHERE idparams = 8');
   if (rows.length > 0) {
    params = rows[0];
    if (params.active != 1){
        return false
    } else {

        return true

    }
   }
 };

 async function getPassEspecial(){
    rows = await pool.query('SELECT * FROM params WHERE idparams = 9');
   if (rows.length > 0) {
    params = rows[0];
    if (params.active != 1){
        return false
    } else {

        return true

    }
   }
 };

 async function getidTx(){
  timeStamp   = Date.now();
  date_ob     = new Date(timeStamp);
  let date = ("0" + date_ob.getDate()).slice(-2);
  let month = ("0" + (date_ob.getMonth() + 1)).slice(-2);
  let year = date_ob.getFullYear().toString().substr(2);
  let hours = date_ob.getHours();
  let minutes = date_ob.getMinutes();
  let seconds = date_ob.getSeconds();
  idTx = date+month+year+hours+minutes+seconds;
  return idTx;
};

async function getExpReg(){
  rows = await pool.query('SELECT value FROM params where param="USR_PWD_REGEXP" AND active=1 order by last_update desc limit 1');
 if (rows.length > 0) {
  params = rows[0];
  value = params.value;
  return value;
 }
};

async function getsession_exp(){
  rows = await pool.query('SELECT * FROM params WHERE idparams = 11');
 if (rows.length > 0) {
  params = rows[0];
  value = params.value;
  return value;
 }
};

async function gethtml_message(){
  rows = await pool.query('SELECT * FROM params WHERE idparams = 20');
 if (rows.length > 0) {
  params = rows[0];
  value = params.value;
  return value;
 }
};
async function S4() {
  return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
};

async function decrypt(toDecrypt,relativeOrAbsolutePathtoPrivateKey){
  const absolutePath = path.resolve(relativeOrAbsolutePathtoPrivateKey)
  const privateKey = fs.readFileSync(absolutePath, 'utf8')
  const buffer = Buffer.from(toDecrypt, 'base64')
  const decrypted = crypto.privateDecrypt(
    {
      key: privateKey.toString(),
      passphrase: '',
    },
    buffer,
  )
  return decrypted.toString('utf8');
};

async function getMAxTime(){

  rows = await pool.query('SELECT * FROM params WHERE idparams = 11');
 if (rows.length > 0) {
  params = rows[0];
  max = params.value;
  maxTime = await max.substr(0,2)+"m";
  return  await maxTime;
 }
};

 exports.S4=S4;
 exports.getPassLong=getPassLong;
 exports.getPassUpper=getPassUpper;
 exports.getPassLower=getPassLower;
 exports.getPassNumber=getPassNumber;
 exports.getPassEspecial=getPassEspecial;
 exports.getidTx=getidTx;
 exports.getExpReg=getExpReg;
 exports.getsession_exp=getsession_exp;
 exports.gethtml_message=gethtml_message;
 exports.getMAxTime=getMAxTime;