// lib/helpers/lib/helpers.js
/* eslint-disable array-callback-return */
/* eslint-disable camelcase */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const pool = require('../../socketServer/lib/database');
const db = require('../../socketServer/lib/sequelize/init');
const vars = require('../../socketServer/lib/vars');
// eslint-disable-next-line import/order
const AWS = require('aws-sdk');
const _ = require('lodash');
const { Op } = require("sequelize");

const kms = new AWS.KMS({ region: process.env.AWS_REGION, accessKeyId: process.env.AWS_KMS_ACCESSKEY_ID, secretAccessKey: process.env.AWS_KMS_SECRET_ACCESS_KEY });

const privateKey = `${process.env.TDM_PRIVATE_KEY_NAME}.pem`;
const publicKey = `${process.env.TDM_PUBLIC_KEY_NAME}.pem`;

module.exports.encryptWithPem = async function (toDecrypt, relativeOrAbsolutePathtoPrivateKey = `lib/App-TDM/keys/${publicKey}`) {
  const absolutePath = path.resolve(relativeOrAbsolutePathtoPrivateKey);
  const publicKey = fs.readFileSync(absolutePath, 'utf8');
  const buffer = Buffer.from(toDecrypt, 'utf8');
  const encrypted = crypto.publicEncrypt(publicKey, buffer);
  return encrypted.toString('base64');
};

// module.exports.decrypt()
module.exports.decryptWithPem = function (toDecrypt, relativeOrAbsolutePathtoPrivateKey = `lib/App-TDM/keys/${privateKey}`) {
  const absolutePath = path.resolve(relativeOrAbsolutePathtoPrivateKey);
  const privateKey = fs.readFileSync(absolutePath, 'utf8');
  const buffer = Buffer.from(toDecrypt, 'base64');
  try {
    const decrypted = crypto.privateDecrypt(
      {
        key: privateKey.toString(),
        passphrase: '',
      },
      buffer,
    );
    return decrypted.toString('utf8');
  } catch (error) {
    return 'error';
  }
};
// module.exports = helpers;
function safeLog(object, modes) {
  let msg;
  if (!modes) modes = ['pan'];

  if (typeof object === 'object'){
    msg = _.cloneDeep(object);
  }else{
    msg = object;
  }

  if(modes.includes('emv_tags')){
    return pruneEmvTags(msg.toString());
  }

  // In dangerous mode hex dump is available
  if (global.c.dangerous && modes.indexOf('hex') >= 0) {
    let result = msg.toString('hex');

    len = result.length;
    for (let i = 0; i < len; i += 2) {
      if (i) {
        result = `${result.slice(0, i)} ${result.slice(i)}`;
        len++;
        i++;
      }
    }
    return result;
  }

  if (msg instanceof Buffer) msg = msg.toString();
  else if (typeof msg === 'number') msg = msg.toString();

  // Whole Message
  if (modes.indexOf('isoMessage') >= 0) {
    // Replace non-printable
    var regexp = /[^a-z0-9=]/gmi;
    msg = msg.replace(regexp, '.');
  }

  // In dangerous mode -- do nothing
  if (!global.c.dangerous) {
    // Card Pan
    if (modes.indexOf('pan') >= 0) {
      if (typeof msg === 'string') {
        var regexp = /(.*)(\d{6})(\d{4})\=(\d{4})(.*)/gm;
        let panPart = '';
        msg = msg.replace(regexp, (complete, a, b, c, d, f) => {
          panPart = b;
          return `${a + new Array(b.length + 1).join('*') + c}=${d}${f}`;
        });

        // Need to swipe away the detected part of pan from entire message
        if (panPart) {
          var regexp = /(\.\.)(\d{16,18})/gm;
          msg = msg.replace(regexp, (complete, a, b) => a + new Array(b.length + 1).join('*'));
        }
      } else if (typeof msg === 'object') {
        for (const k in msg) {
          if (k == 'card_number') {
            msg[k] = safeLog(msg[k], 'number');
          } else if (k == 'cvv') {
            msg[k] = '***';
          } else if (msg.hasOwnProperty(k)) {
            msg[k] = safeLog(msg[k]);          }
        }
      }
    }

    // Card Number
    if (modes.indexOf('number') >= 0) {
      var regexp = /(\d{6})(\d{6})(\d{4})/gm;
      if (msg) {
        msg = msg.replace(regexp, (complete, a, b, c) => a + new Array(b.length + 1).join('*') + c);
      }
    }

    // Field 55 (what to do?)
    if (modes.indexOf('field55') >= 0) {

    }
  }

  if(typeof msg == 'object' && msg && msg.cardInformation && msg.cardInformation.emv_tags){
    msg.cardInformation.emv_tags = pruneEmvTags(msg.cardInformation.emv_tags);
    if(msg.cardInformation.track2) { delete msg.cardInformation.track2; }
  }

  return msg;
};

module.exports.safeLog = safeLog;

// Random string generator
module.exports.randomString = function (length, mode) {
  const charsNumbers = '0123456789';
  const charsLower = 'abcdefghijklmnopqrstuvwxyz';
  const charsUpper = charsLower.toUpperCase();

  let chars = '';
  if (!mode || mode == 1) chars += charsNumbers;
  if (!mode || mode == 2) chars += charsLower + charsUpper;
  if (!length) length = 32;

  let string = '';

  for (let i = 0; i < length; i++) {
    const randomNumber = Math.floor(Math.random() * chars.length);
    string += chars.substring(randomNumber, randomNumber + 1);
  }

  return string;
};

// Random string generator
module.exports.randomStringHex = function (length, mode) {
  const charsNumbers = '5703491628';
  const charsLower = 'cebdfa';
  const charsUpper = charsLower.toUpperCase();

  let chars = '';
  if (!mode || mode == 1) chars += charsNumbers;
  if (!mode || mode == 2) chars += charsLower + charsUpper;
  if (!length) length = 32;

  let string = '';

  for (let i = 0; i < length; i++) {
    const randomNumber = Math.floor(Math.random() * chars.length);
    string += chars.substring(randomNumber, randomNumber + 1);
  }

  return string;
};

module.exports.randomCase = function (v) {
  return Math.floor(Math.random() * (v - 0)) == 1;
};

module.exports.fecha = function () {
  const d = new Date();
  return `${d.getFullYear()}-${
    (`0${d.getMonth() + 1}`).substr(-2)}-${
    (`0${d.getDate()}`).substr(-2)} ${
    (`0${d.getHours()}`).substr(-2)}:${
    (`0${d.getMinutes()}`).substr(-2)}:${
    (`0${d.getSeconds()}`).substr(-2)}`;
};

module.exports.horaLocalBnrg = function () {
  const d = new Date();
  return (`0${d.getHours()}`).substr(-2)
    + (`0${d.getMinutes()}`).substr(-2)
    + (`0${d.getSeconds()}`).substr(-2);
};

module.exports.fechaLocalBnrg = function () {
  const d = new Date();
  return (`0${d.getDate()}`).substr(-2)
    + (`0${d.getMonth() + 1}`).substr(-2)
    + d.getFullYear();
};

module.exports.fechaPasada = function (retentionDays) {
  const d = new Date();
  const dias = retentionDays; // Número de días a mantener
  d.setDate(d.getDate() - dias);
  return `${d.getFullYear()}-${
    (`0${d.getMonth() + 1}`).substr(-2)}-${
    (`0${d.getDate()}`).substr(-2)} ${
    (`0${d.getHours()}`).substr(-2)}:${
    (`0${d.getMinutes()}`).substr(-2)}:${
    (`0${d.getSeconds()}`).substr(-2)}`;
};

module.exports.fechaUTC = function () {
  const d = new Date();
  return (`0${d.getUTCMonth() + 1}`).substr(-2)
    + (`0${d.getUTCDate()}`).substr(-2)
    + (`0${d.getUTCHours()}`).substr(-2)
    + (`0${d.getUTCMinutes()}`).substr(-2)
    + (`0${d.getUTCSeconds()}`).substr(-2);
};

module.exports.padRight = function (num, size, padWith) {
  let s = `${num}`;
  while (s.length < size) s += padWith;
  return s;
};

module.exports.padLeft = function (num, size, padWith) {
  let s = `${num}`;
  while (s.length < size) s = padWith + s;
  return s;
};

module.exports.chunkString = function (str) {
  const _size = Math.ceil(str.length / 2); const _ret = new Array(_size); let
    _offset;

  for (let _i = 0; _i < _size; _i++) {
    _offset = _i * 2;
    _ret[_i] = `0x${str.substring(_offset, _offset + 2)}`;
  }

  return _ret;
};

module.exports.getBnrgKeyMk = async function (serial) {
  const BnrgKeyMk = await pool.query(`SELECT keys_op.key FROM ${process.env.DB_NAME}.keys_op where pos_serie = ?`, [serial]);
  return (BnrgKeyMk[0]) ? BnrgKeyMk[0].key : '';
};

module.exports.getBnrgKeyall = async function () {
  const BnrgKeyMk = await pool.query(
    `SELECT * FROM ${process.env.DB_NAME}.keys_op`,
  );
  return BnrgKeyMk;
};
//Función para limpiar el emv tags
function pruneEmvTags(emvString) {
  if(!emvString) {
    return ''
  }
  let i = 0;
  let result = '';
  const tagsToRemove = [
    "57"
  ];
  const tags4Prefixex = ["9F", "5F"];

  while (i < emvString.length) {
      let tag;
      let length;

      // Check if the tag is one bytes long
      if( !tags4Prefixex.includes(emvString.substring(i, i + 2))) {
          tag = emvString.substring(i, i + 2); 
          length = parseInt(emvString.substring(i + 2, i + 4), 16);
          i += 4; // Move past the tag and length
      }else{
        tag = emvString.substring(i, i + 4); // Assume two byte tag
          length = parseInt(emvString.substring(i + 4, i + 6), 16);
          i += 6; // Move past the tag and length
      }

      // Check if this tag should be removed
      if (!tagsToRemove.includes(tag)) {
          // If not, add it to the result
          result += tag + emvString.substring(i - 2, i + length * 2);
      }

      // Move to the next tag
      i += length * 2;
  }

  return result;
}

// FUNCION PARA FORMATEAR EL MONTO
function formatMount(numberStr) {
  // Convert to string if not already
  const strNumber = String(numberStr);
  
  // If it's already in cents format (3 or more digits), treat as cents
  if (/^\d+$/.test(strNumber) && strNumber.length >= 3) {
    const num = [parseInt(strNumber.substr(0, strNumber.length - 2)), strNumber.substr(-2)];
    return `${num[0]}.${num[1]}`;
  }
  
  // Otherwise, treat as a regular number and format to 2 decimal places
  const num = parseFloat(strNumber);
  if (isNaN(num)) return '0.00';
  return num.toFixed(2);
}
function processMerchantData(data_send) {
  // Handle null/undefined input or missing merchant_data
  if (!data_send || !data_send.merchant_data) {
    return {
      client_data: {},
      estatus_f: null,
      // Add other expected fields with default values
      merchant_data: {}
    };
  }

  // Safely clone the merchant_data object
  const r = JSON.parse(JSON.stringify(data_send.merchant_data));
  
  // Initialize client_data with safe defaults
  r.client_data = r.client_data || {};
  r.client_data.name = r.iso_client_dt?.name || '';
  
  // Handle estatus_f with proper type checking
  if (r.estatus_f === '1') {
    r.estatus_f = 'Pendiente';
  } else if (r.estatus_f === '2') {
    r.estatus_f = 'Por liquidar';
  } else if (r.estatus_f === '3') {
    r.estatus_f = 'Liquidado';
  } else {
    r.estatus_f = r.estatus_f || null;
  }

  // Define fields to delete in a more maintainable way
  const fieldsToDelete = [
    'modo_transac', 'url_destino', 'id_merchant', 'razon_social', 'url_merchant', 
    'rfc_merchant', 'representative', 'agente_comercial', 'description', 
    'contact_merchant', 'rol_contact', 'email_contact', 'tel1_contact', 
    'tel2_contact', 'mobile_contact', 'use_moreterminals', 'active', 
    'token_activation', 'cybersource', 'serie_terminal', 'max', 'min', 
    'last_update', 'creation_date', 'modo_transac', 'url_destino', 
    'banco_adq', 'iso_client_dt', 'deleted_at', 'id_acqbank', 'id_client', 
    'id_datos_bancarios', 'id_direccion', 'id_esquema', 'id_ln', 'id_mcc', 
    'id_modo_transaccion', 'id_persona', 'id_processor', 
    'id_profile_transaction', 'id_url_destino'
  ];

  // Safely delete fields
  fieldsToDelete.forEach(field => {
    if (r[field] !== undefined) {
      delete r[field];
    }
  });

  return r;
}

async function getOperationType(id_operation) {
  let op = '';
  const o = await db.cisoOperation.findOne({ where: { id_operation } });
  if (o) { op = o.name; }
  return op;
}


module.exports.haveValue = function haveValue(data) {
  return (data && data.trim() != '') ? data : 'NO DISPONIBLE';
}
// utils/isoFormatter.js
// utils/isoFieldFormatter.js
class IsoFieldFormatter {
  static formatField(fieldValue, fieldConfig) {
    if (!fieldValue) return null;

    const strValue = String(fieldValue);
    const { type, dataLength } = fieldConfig;

    // Ensure data is correct length
    let processedValue = strValue;
    if (dataLength && processedValue.length !== dataLength) {
      if (type.includes('n')) {
        // Numeric - pad with zeros
        processedValue = processedValue.padStart(dataLength, '0').substring(0, dataLength);
      } else {
        // Alphanumeric - pad with spaces
        processedValue = processedValue.padEnd(dataLength, ' ').substring(0, dataLength);
      }
    }

    // Add length indicator based on type
    let result;
    if (type.startsWith('lll')) {
      // 3-digit length indicator
      result = processedValue.length.toString().padStart(3, '0') + processedValue;
    } else if (type.startsWith('ll')) {
      // 2-digit length indicator
      result = processedValue.length.toString().padStart(2, '0') + processedValue;
    } else {
      // No length indicator
      result = processedValue;
    }

    console.log(`📦 Formatted field (${type}):`, {
      input: strValue,
      processed: processedValue,
      resultLength: result.length,
      preview: result.substring(0, 20)
    });

    return result;
  }
}

module.exports.IsoFieldFormatter = IsoFieldFormatter;
module.exports.formatLLLField = function(fieldValue, expectedLength = null) {
  if (fieldValue === undefined || fieldValue === null) {
    return null;
  }

  const strValue = String(fieldValue);

  // Check if already has 3-digit prefix (LLL format)
  const hasLLL = /^\d{3}/.test(strValue);

  let dataPart = strValue;
  if (hasLLL) {
    // Extract data part (remove existing LLL)
    const existingLLL = strValue.substring(0, 3);
    dataPart = strValue.substring(3);
    console.log(`[formatLLLField] Existing LLL: ${existingLLL}, Data length: ${dataPart.length}`);
  }

  // Validate/truncate to expected length if provided
  if (expectedLength !== null) {
    if (dataPart.length > expectedLength) {
      console.warn(`[formatLLLField] Truncating from ${dataPart.length} to ${expectedLength} chars`);
      dataPart = dataPart.substring(0, expectedLength);
    } else if (dataPart.length < expectedLength) {
      console.warn(`[formatLLLField] Padding from ${dataPart.length} to ${expectedLength} chars`);
      dataPart = dataPart.padEnd(expectedLength, ' ');
    }
  }

  // Add 3-digit length indicator
  const lengthIndicator = dataPart.length.toString().padStart(3, '0');
  const result = lengthIndicator + dataPart;

  console.log(`[formatLLLField] Result: ${lengthIndicator} + ${dataPart.length} chars = ${result.length} total`);

  return result;
};
module.exports.addLengthIndicator = function(fieldData, fieldType) {
  if (!fieldData) return fieldData;

  const dataStr = String(fieldData);
  const length = dataStr.length;

  if (fieldType === 'lll-n' || fieldType === 'lll-ans') {
    // 3-digit length indicator
    const lengthLLL = length.toString().padStart(3, '0');
    console.log(`[FieldFormatter] LLL format: "${lengthLLL}" + "${dataStr.substring(0, 20)}..."`);
    return lengthLLL + dataStr;
  }

  if (fieldType === 'll-n' || fieldType === 'll-ans') {
    // 2-digit length indicator
    const lengthLL = length.toString().padStart(2, '0');
    console.log(`[FieldFormatter] LL format: "${lengthLL}" + "${dataStr.substring(0, 20)}..."`);
    return lengthLL + dataStr;
  }

  return dataStr;
};

// Line 1: Module export declaration
module.exports.saveIsoMessage = async function saveIsoMessage(
  // Function parameters with ISO8583 field references:
  id_operation,      // Custom identifier (not ISO8583)
  msg_type,          // ISO8583 Field 0: Message Type Indicator (MTI)
  trace_number,      // ISO8583 Field 11: Systems Trace Audit Number
  reference_number,  // ISO8583 Field 37: Retrieval Reference Number
  amount,            // ISO8583 Field 4: Amount, Transaction
  resp_code,         // ISO8583 Field 39: Response Code
  authorization,     // ISO8583 Field 38: Authorization Code
  bin,               // Bank Identification Number (from PAN - Field 2)
  last4,             // Last 4 digits of PAN (from Field 2)
  draft_capture,     // Custom field for draft capture flag
  entry_mode,        // ISO8583 Field 22: Point of Service Entry Mode
  reverse_code,      // Custom field for reversal indication
  tran_date,         // ISO8583 Field 13: Local Transaction Date
  tran_time,         // ISO8583 Field 12: Local Transaction Time
  capture_date,      // ISO8583 Field 17: Capture Date
  tkn_data_63_rq,    // ISO8583 Field 63: Private Use - Request data
  tkn_data_63_rp,    // ISO8583 Field 63: Private Use - Response data
  card_acceptor,     // ISO8583 Field 43: Card Acceptor Name/Location
  node,              // Custom field for node identification
  dataSend = {},     // Additional data object
  tkn_data_35 = null, // ISO8583 Field 35: Track 2 Data
  more_info = null,   // Additional info parameter
  isReversal = false  // Flag to indicate if this is a reversal operation
) {
  console.log('==================================== saveIsoMessage ====================================');

  try {
    // Process merchant data from dataSend object with proper null checks
    const auxInfo = processMerchantData(dataSend || {});
    const aux = {
      client_data: auxInfo?.client_data || {},
      estatus_f: auxInfo?.estatus_f || null,
      merchant_data: { ...auxInfo }
    };
    
    // Clean up the merchant_data object
    if (aux.merchant_data) {
      delete aux.merchant_data.client_data;
      delete aux.merchant_data.estatus_f;
      
      // Remove any undefined or null values
      Object.keys(aux.merchant_data).forEach(key => {
        if (aux.merchant_data[key] === undefined || aux.merchant_data[key] === null) {
          delete aux.merchant_data[key];
        }
      });
    }

    // Lines 36-44: Determine card brand based on BIN (first digit of PAN)
    let metodo = null;
    if (bin) {
      switch (bin.substring(0, 1)) {
        case '3': metodo = 'AMEX'; break;
        case '4': metodo = 'VISA'; break;
        case '5': metodo = 'MASTERCARD'; break;
        default: metodo = ''; break;
      }
    }

    // Lines 46-56: Encrypt Track 2 Data (ISO8583 Field 35) using AWS KMS
    let track2Cipher = '';
    if (tkn_data_35) {
      try {
        const params = { KeyId: process.env.AWS_KMS_KEY_ID, Plaintext: tkn_data_35 };
        const result = await kms.encrypt(params).promise();
        track2Cipher = result.CiphertextBlob.toString('base64');
      } catch (error) {
        console.log(error);
      }
    }

    // Lines 58-89: Parse and prepare additional information object
    let moreInfo = more_info ? JSON.parse(more_info) : {
      emv_tags: (dataSend.body.cardInformation) ? pruneEmvTags(dataSend.body.cardInformation.emv_tags) : null,
      tip: (dataSend.body.tip) ? `${dataSend.body.tip}` : null,
      waiter: (dataSend.body.waiter) ? `${dataSend.body.waiter}` : null,
      iva: vars.iva,
      auth: (dataSend.body.authentication === 'unknown') ? null : dataSend.body.authentication,
      merchant_data: aux.merchant_data,
      client_data: aux.client_data,
      estatus_f: aux.estatus_f,
      metodo,
      tipo_tx: await getOperationType(id_operation),
      chargePlan: (dataSend.body.chargePlan) ? dataSend.body.chargePlan : null,
      link_pago: (dataSend.body.link_pago) ? dataSend.body.link_pago : null,
      autoReverseInfo: dataSend.autoReverseInfo
    };

    // Lines 91-96: Clean up null values from moreInfo object
    Object.keys(moreInfo).map((v) => {
      if (!moreInfo[v]) {
        delete moreInfo[v];
      }
    });
    moreInfo = (Object.keys(moreInfo).length > 0) ? JSON.stringify(moreInfo) : null;

    // Log the original amount received
    console.log('🔵 🔵 🔵 🔵 [saveIsoMessage] Original amount received:', amount, 'Type:', typeof amount);
    
    // Amount already comes in cents, use it directly
    let amountInCents = 0;
    
    if (amount) {
      // Remove any non-digit characters except decimal point and minus sign
      const numericString = String(amount).replace(/[^\d.-]/g, '');
      // Convert to number - already in cents
      amountInCents = parseFloat(numericString || 0);
    }
    
    console.log('🟢 🟢 🟢 [saveIsoMessage] Amount in cents to be stored:', amountInCents, 'Type:', typeof amountInCents);
    
    // Create ISO message object for database insertion
    const newIsoMessage = {
      id_operation,        // Custom operation ID
      msg_type,            // Field 0: Message Type Indicator
      trace_number,        // Field 11: Systems Trace Audit Number
      reference_number,    // Field 37: Retrieval Reference Number
      amount: amountInCents, // Field 4: Amount, Transaction (in cents)
      resp_code,           // Field 39: Response Code
      authorization,       // Field 38: Authorization Code
      bin,                 // BIN from PAN (Field 2)
      last4,               // Last 4 digits of PAN (Field 2)
      draft_capture,       // Draft capture flag
      entry_mode: (moreInfo.link_pago) ? '010' : entry_mode, // Field 22: POS Entry Mode
      reverse_code,        // Reversal code
      tran_date,           // Field 13: Local Transaction Date
      tran_time,           // Field 12: Local Transaction Time
      capture_date,        // Field 17: Capture Date
      tkn_data_63_rq,      // Field 63: Private Use (Request)
      tkn_data_63_rp,      // Field 63: Private Use (Response)
      card_acceptor,       // Field 43: Card Acceptor Name/Location
      node,                // Node identifier
      name_merchant: dataSend.merchant_data?.id_merchant, // Merchant ID
      terminal: ( dataSend.body?.device?.serial ) ? dataSend.body.device.serial : '001', // Terminal ID
      reference_number_ant: (dataSend.reference_number_ant) ? dataSend.reference_number_ant.substr(0, 12) : '', // Previous reference number
      folio: (dataSend.folio) ? dataSend.folio : '', // Folio number
      card_type: dataSend.data125, // Card type data
      more_info: moreInfo, // Additional information JSON
      track2: track2Cipher, // Encrypted Field 35: Track 2 Data
    };

    // Lines 131-151: Handle reversal/cancellation logic
    if (newIsoMessage.reference_number_ant && newIsoMessage.resp_code === '00') {
      const ref = dataSend.reference_number_ant.substr(0, 12);
      const tx = await db.isoMessage.findOne({ where: { reference_number: dataSend.reference_number_ant.substr(0, 12) } });
      if (tx) {
        newIsoMessage.card_type = tx.card_type;
        let nAuth = newIsoMessage.authorization;

        if (nAuth) {
          if (typeof nAuth === 'String') {
            nAuth = nAuth.replace(/ /g, '');
            if (nAuth === '') { nAuth = null; }
          }
        }

        newIsoMessage.authorization = tx.authorization;
      }
    }

    // Lines 152-170: Handle reversal operations - DISABLED to prevent amount corruption
    // Cancellations should create new records, not update original transaction amounts
    // if (isReversal && reference_number) {
    //   console.log('🔄 [saveIsoMessage] REVERSAL MODE - Updating original transaction');
    //   
    //   // Find original transaction by reference number
    //   const originalTx = await db.isoMessage.findOne({ 
    //     where: { reference_number: reference_number.substring(0, 12) } 
    //   });
    //   
    //   if (originalTx) {
    //     console.log('🔄 [saveIsoMessage] Found original transaction:', originalTx.id_message);
    //     
    //     // Prepare update data for reversal
    //     const updateData = {
    //       resp_code: String(resp_code || '').substring(0, 12),
    //       authorization: authorization ? String(authorization).substring(0, 8) : null,
    //       estatus_f: resp_code === '00' || resp_code === '0' ? 2 : 3, // approved/declined
    //       tkn_data_63_rp: tkn_data_63_rp,
    //       more_info: JSON.stringify({
    //         ...JSON.parse(originalTx.more_info || '{}'),
    //         reversal_info: {
    //           reversal_trace_number: trace_number,
    //           reversal_date: new Date().toISOString(),
    //           reversal_resp_code: resp_code,
    //           reversal_authorization: authorization,
    //           reversal_operation: id_operation
    //         },
    //         updated_at: new Date().toISOString()
    //       }).substring(0, 99999)
    //     };

    //     // Update the original transaction
    //     await db.isoMessage.update(updateData, { 
    //       where: { id_message: originalTx.id_message } 
    //     });
    //     
    //     console.log('🔄 [saveIsoMessage] ✅ Original transaction updated successfully');
    //     
    //     return {
    //       error: false,
    //       response: { ...originalTx.dataValues, ...updateData, id_message: originalTx.id_message }
    //     };
    //   } else {
    //     console.error('🔄 [saveIsoMessage] ❌ Original transaction not found for reference:', reference_number);
    //     // Continue with normal insert if original not found (fallback)
    //   }
    // }

    // Line 153: Insert the ISO message into database
    console.log('🔥 [saveIsoMessage] Before INSERT query');
    const queryResult = await pool.query('INSERT INTO iso_message set ?', [newIsoMessage]);
    console.log('🔥 [saveIsoMessage] After INSERT query');

    // Try to get insertId - handle different possible return formats
    let insertId = null;

    // Method 1: Direct property
    if (queryResult && queryResult.insertId) {
        insertId = queryResult.insertId;
        console.log('🔥 [saveIsoMessage] Got insertId from queryResult.insertId:', insertId);
    }
    // Method 2: First element of array
    else if (Array.isArray(queryResult) && queryResult[0] && queryResult[0].insertId) {
        insertId = queryResult[0].insertId;
        console.log('🔥 [saveIsoMessage] Got insertId from queryResult[0].insertId:', insertId);
    }
    // Method 3: Use LAST_INSERT_ID() as fallback
    else {
        console.log('🔥 [saveIsoMessage] Could not find insertId directly, using LAST_INSERT_ID()');
        try {
            const [lastIdRows] = await pool.query('SELECT LAST_INSERT_ID() as lastId');
            insertId = lastIdRows[0]?.lastId;
            console.log('🔥 [saveIsoMessage] Got insertId from LAST_INSERT_ID():', insertId);
        } catch (err) {
            console.error('🔥 [saveIsoMessage] LAST_INSERT_ID() failed:', err.message);
            insertId = 0; // Fallback
        }
    }

    // Add id_message to the response
    const responseWithId = {
        ...newIsoMessage,
        id_message: insertId,
        insertId: insertId
    };

    console.log('🔥 [saveIsoMessage] Returning response with id_message:', insertId);
    return {
        error: false,
        response: responseWithId
    };

  } catch (error) {
    console.error(error);
    return { error: true, response: error };
  }
};

module.exports.saveEchoLog = function (iso_header, msg_type, bitmap, tran_date, trace_number, resp_code, nm_code, node) {
  const newEchoLog = {
    iso_header, msg_type, bitmap, tran_date, trace_number, resp_code, nm_code, node,
  };
  pool.query('INSERT INTO iso_echo_log set ?', [newEchoLog]);
};

module.exports.saveKeysOp = async function (key, id_medio, pos_serie) {
  const newKeysOp = {
    key,
    id_medio,
    pos_serie,
  };

  const actualKey = await db.keyOp.findOne({ where: { pos_serie } });

  if (!actualKey) {
    await db.keyOp.create(newKeysOp);
  } else {
    actualKey.key = newKeysOp.key;
    await actualKey.save();
  }
};

module.exports.saveIsoApiLog = async function (id_request, uri, method, request, response, entry_time, exit_time) {
  try{
    if (request.cardInformation && request.cardInformation.card_number) {
      request.cardInformation.card_number = request.cardInformation.card_number.substring(0, 6)
      + (request.cardInformation.card_number.length == 15 ? '*****' : '******')
      + request.cardInformation.card_number.substring(12, 16);
    }
    if (request.cardInformation && request.cardInformation.expiration_year) request.cardInformation.expiration_year = '**';
    if (request.cardInformation && request.cardInformation.expiration_month) request.cardInformation.expiration_month = '**';
    if (request.cardInformation && request.cardInformation.cvv) request.cardInformation.cvv = '***';
    if (request.cardInformation && request.cardInformation.emv_tags) request.cardInformation.emv_tags = pruneEmvTags(request.cardInformation.emv_tags);
    if (request.cardInformation && request.cardInformation.track2)  delete request.cardInformation.track2; 
    if (request.req) { delete request.req; }
    if (request.tk2) { delete request.tk2; }
    if (request.isoAddress) { delete  request.isoAddress; }
    request = JSON.stringify(request);
    const newApiLog = {
      id_request, uri, method, request, response, entry_time, exit_time,
    };
    await pool.query('INSERT INTO iso_api_log set ?', [newApiLog]);
  } catch (e) {
    console.error(e);
  }
};

module.exports.decryptWithKms = async function decryptWithKms(textToDeCipher) {
  const params = {
    CiphertextBlob: Buffer.from(textToDeCipher, 'base64'),
  };
  const { Plaintext } = await kms.decrypt(params).promise();
  return Plaintext.toString('ascii');
};

module.exports.getIso = async function getIso(reference) {
  const result = await db.isoMessage.findOne({ attributes: ['track2'], where: { reference_number: reference } });
  return result;
};

module.exports.getBinInfo = async function getBinInfo(reference, afiliation_number, terminal) {
  const result = await this.getMessageByReference(reference, afiliation_number, terminal);
  const decrypted = await this.decryptWithKms(result.track2);
  const info = decrypted.split('=');
  const card_info = {
    card_number: info[0],
    bin: info[0].slice(0, 6),
    last4: info[0].slice(-4),
    expiration_year: info[1].slice(0, 2),
    expiration_month: info[1].slice(-2),
    track2: decrypted
  };
  result.card_info = card_info;
  return result;
};

module.exports.getMessageByReference = async function(reference, afiliation_number, terminal) {
  terminal = terminal ? terminal.substr(4, 20) : '001';
  reference = `000000000000${reference}`.slice(-12);
  const result = await db.isoMessage.findOne({ 
    order: [['id_message', 'ASC']],
    where: { 
      reference_number: reference,
      terminal: {
        [Op.like]: `%${terminal}`
      }
    },
    include: {
      model: db.merchant,
      as: 'merchant',
      where: {
        afiliation_number
      }
    }
  });
  return result;
};

module.exports.getOperationLabel = (name) => {
  const operationsLabel  = {
    'LOGON' : 'LOGON',
    'LOGOUT' : 'LOGOUT',
    'INICIALIZACION' : 'INICIALIZACIÓN',
    'VENTA' : 'VENTA',
    'VENTA CON CASH BACK' : 'VENTA CON CASH BACK',
    'CANCELACION' : 'CANCELACIÓN',
    'DEVOLUCION' : 'DEVOLUCIÓN',
    'POS-PROPINA' : 'POS-PROPINA',
    'CIERRE POS-PROPINA' : 'CIERRE POS-PROPINA',
    'CHECK IN' : 'CHECK IN',
    'CHECK OUT' : 'CHECK OUT',
    'RENTA IN' : 'RENTA IN',
    'REAUTORIZACION' : 'REAUTORIZACIÓN',
    'RENTA OUT' : 'RENTA OUT',
    'REVERSO' : 'REVERSO',
    'ECHO HOST' : 'ECHO HOST',
    'PRE AUTH' : 'PRE AUTH',
    'POST AUTH' : 'POST AUTH',
  };
  return operationsLabel[name] || name; 
}


//module.exports.saveIsoMessage = async function saveIsoMessage(
//  id_operation,
//  msg_type,
//  trace_number,
//  reference_number,
//  amount,
//  resp_code,
//  authorization,
//  bin,
//  last4,
//  draft_capture,
//  entry_mode,
//  reverse_code,
//  tran_date,
//  tran_time,
//  capture_date,
//  tkn_data_63_rq,
//  tkn_data_63_rp,
//  card_acceptor,
//  node,
//  dataSend = {},
//  tkn_data_35 = null,
//  more_info = null,
//) {
//  console.log('==================================== saveIsoMessage ====================================');
//  try {
//    const auxInfo = processMerchantData(dataSend);
//    const aux = {};
//    aux.client_data = auxInfo?.client_data;
//    aux.estatus_f = auxInfo?.estatus_f;
//    delete auxInfo?.client_data;
//    delete auxInfo?.estatus_f;
//    aux.merchant_data = auxInfo;
//    let metodo = null;
//    if (bin) {
//      switch (bin.substring(0, 1)) {
//        case '3': metodo = 'AMEX'; break;
//        case '4': metodo = 'VISA'; break;
//        case '5': metodo = 'MASTERCARD'; break;
//        default: metodo = ''; break;
//      }
//    }
//    let track2Cipher = '';
//    if (tkn_data_35) {
//      try {
//        const params = { KeyId: process.env.AWS_KMS_KEY_ID, Plaintext: tkn_data_35 };
//        const result = await kms.encrypt(params).promise();
//        track2Cipher = result.CiphertextBlob.toString('base64');
//      } catch (error) {
//        console.log(error);
//      }
//    }
//    let moreInfo = more_info ? JSON.parse(more_info) : {
//      emv_tags: (dataSend.body.cardInformation) ? pruneEmvTags(dataSend.body.cardInformation.emv_tags) : null,
//      tip: (dataSend.body.tip) ? `${dataSend.body.tip}` : null,
//      waiter: (dataSend.body.waiter) ? `${dataSend.body.waiter}` : null,
//      iva: vars.iva,
//      auth: (dataSend.body.authentication === 'unknown') ? null : dataSend.body.authentication,
//      merchant_data: aux.merchant_data,
//      client_data: aux.client_data,
//      estatus_f: aux.estatus_f,
//      metodo,
//      tipo_tx: await getOperationType(id_operation),
//      chargePlan: (dataSend.body.chargePlan) ? dataSend.body.chargePlan : null,
//      link_pago: (dataSend.body.link_pago) ? dataSend.body.link_pago : null,
//      autoReverseInfo: dataSend.autoReverseInfo
//    };
//    Object.keys(moreInfo).map((v) => {
//      if (!moreInfo[v]) {
//        delete moreInfo[v];
//      }
//    });
//    moreInfo = (Object.keys(moreInfo).length > 0) ? JSON.stringify(moreInfo) : null;
//    const newIsoMessage = {
//      id_operation,
//      msg_type,
//      trace_number,
//      reference_number,
//      amount,
//      resp_code,
//      authorization,
//      bin,
//      last4,
//      draft_capture,
//      entry_mode: (moreInfo.link_pago) ? '010' : entry_mode,
//      reverse_code,
//      tran_date,
//      tran_time,
//      capture_date,
//      tkn_data_63_rq,
//      tkn_data_63_rp,
//      card_acceptor,
//      node,
//      name_merchant: dataSend.merchant_data?.id_merchant,
//      terminal: ( dataSend.body?.device?.serial ) ? dataSend.body.device.serial : '001' ,
//      reference_number_ant: (dataSend.reference_number_ant) ? dataSend.reference_number_ant.substr(0, 12) : '',
//      folio: (dataSend.folio) ? dataSend.folio : '',
//      card_type: dataSend.data125,
//      more_info: moreInfo,
//      track2: track2Cipher,
//    };
//    if (newIsoMessage.reference_number_ant && newIsoMessage.resp_code === '00') {
//      const ref = dataSend.reference_number_ant.substr(0, 12);
//      const tx = await db.isoMessage.findOne({ where: { reference_number: dataSend.reference_number_ant.substr(0, 12) } });
//      if (tx) {
//        newIsoMessage.card_type = tx.card_type;
//        let nAuth = newIsoMessage.authorization;
//
//        if (nAuth) {
//          if (typeof nAuth === 'String') {
//            nAuth = nAuth.replace(/ /g, '');
//            if (nAuth === '') { nAuth = null; }
//          }
//        }
//
//        newIsoMessage.authorization = tx.authorization;
//      }
//    }
//    await pool.query('INSERT INTO iso_message set ?', [newIsoMessage]);
//    return { error: false, response: newIsoMessage };
//  } catch (error) {
//    console.error(error);
//    return { error: true, response: error };
//  }
//
//};

// 🔴 SECURITY WARNING: Track2 Decryption Function
// ⚠️  EXPOSING DECRYPTED TRACK2 DATA IS A SECURITY RISK ⚠️
// Only use this if absolutely necessary and proper access controls
module.exports.decryptTrack2 = async function(encryptedTrack2) {
  if (!encryptedTrack2) return null;
  
  try {
    const params = {
      CiphertextBlob: Buffer.from(encryptedTrack2, 'base64'),
      KeyId: process.env.AWS_KMS_KEY_ID
    };
    const result = await kms.decrypt(params).promise();
    return result.Plaintext.toString('utf8');
  } catch (error) {
    console.error('[helpers.js] ❌ Error decrypting track2:', error.message);
    return null;
  }
};

// Store transaction events to S3 with comprehensive SELIA logging
module.exports.storeTransactionEventToS3 = async function(guid, eventType, eventData) {
    try {
        const AWS = require('aws-sdk');
        const s3 = new AWS.S3({
            region: process.env.AWS_REGION,
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        });

        const timestamp = new Date().toISOString();
        const logData = {
            guid,
            timestamp,
            eventType,
            seliaMode: process.env.SELIA_ISO_MODE || 'Unknown',
            seliaConfig: {
                host: process.env.SELIA_ISO_MODE === 'Dev' ? process.env.SELIA_ISO_DEV_HOST : process.env.SELIA_ISO_HOST,
                port: process.env.SELIA_ISO_MODE === 'Dev' ? process.env.SELIA_ISO_DEV_PORT : process.env.SELIA_ISO_PORT,
                companyId: process.env.SELIA_COMPANY_TPV_ID,
                username: process.env.SELIA_ISO_USERNAME,
                timeout: process.env.SELIA_TIMEOUT,
                debug: process.env.SELIA_DEBUG === 'true'
            },
            ...eventData
        };

        const bucketName = process.env.S3_LOGS_BUCKET || 'transaction-logs';
        const key = `transactions/${timestamp}_${guid}.json`;
        
        await s3.upload({
            Bucket: bucketName,
            Key: key,
            Body: JSON.stringify(logData, null, 2),
            ContentType: 'application/json'
        }).promise();

        console.log(`[helpers.js] 📝 Transaction event stored to S3: ${key}`);
        return { success: true, key };
    } catch (error) {
        console.error('[helpers.js] ❌ Error storing transaction event to S3:', error.message);
        return { success: false, error: error.message };
    }
};