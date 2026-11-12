const bcrypt = require('bcryptjs');
const bitwise = require('bitwise');
const path = require('path');
const crypto = require("crypto");
const CryptoJS = require("crypto-js");
const { crc32 } = require('crc');
const fs = require('fs');
const iv = Buffer.from("00000000000000000000000000000000", "hex");

const helpers = {};

/**
 * Hashes a base64-encoded password using bcrypt.
 * PCI DSS 4.0: Req 8.2.1 / 8.2.4 (strong password hashing).
 * @param {string} password - Base64-encoded plaintext password.
 * @returns {Promise<string>} Bcrypt hash.
 */
helpers.encryptPassword = async (password) => {
  password = Buffer.from(password, 'base64').toString('utf8');
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  return hash;
};

/**
 * Compares a base64-encoded password with a stored bcrypt hash.
 * PCI DSS 4.0: Req 8.2.1 / 8.2.4 (password verification).
 * @param {string} password - Base64-encoded plaintext password.
 * @param {string} savedPassword - Stored bcrypt hash.
 * @returns {Promise<boolean>} True if the password matches.
 */
helpers.matchPassword = async (password, savedPassword) => {
  try {
    password = Buffer.from(password, 'base64').toString('utf8');
    return await bcrypt.compare(password, savedPassword);
  } catch (e) {
    console.log(e)
  }
};
// In ./lib/socketServer/lib/lib/helpers.js - UPDATE THE VALIDATION
/**
 * Validates a TKA using HMAC-SHA256.
 * PCI DSS 4.0: Req 8.3.1 / 8.3.2 / 8.3.6 (authentication token validation).
 * @param {string} tkr - Merchant token_activation.
 * @param {string} tms - Timestamp/nonce.
 * @param {string} afiliation_number - Merchant affiliation number.
 * @param {string} tka - Received token to validate.
 * @returns {Promise<boolean>} True if the token is valid.
 */
helpers.validateTKA = async (tkr, tms, afiliation_number, tka) => {
    try {
        console.log('=== TKA VALIDATION DEBUG ===');
        console.log('Input parameters:');
        console.log('tkr:', tkr, 'length:', tkr.length);
        console.log('tms:', tms, 'length:', tms.length);
        console.log('afiliation_number:', afiliation_number, 'length:', afiliation_number.length);
        console.log('tka:', tka, 'length:', tka.length);

        // 🔥 CHANGE THIS: Use HMAC validation instead of bitwise
        const secretKey = process.env.TKA_SECRET_KEY || 'your-super-secure-256-bit-key-change-this-in-production';

        const hmac = crypto.createHmac('sha256', secretKey);
        hmac.update(tkr + tms + afiliation_number);
        const expectedTKA = hmac.digest('base64');

        console.log('Expected TKA (HMAC):', expectedTKA);
        console.log('Match:', expectedTKA === tka);

        return expectedTKA === tka;

    } catch (error) {
        console.error('❌ Error in validateTKA:', error);
        return false;
    }
};

/**
 * Encrypts text using Triple-DES in ECB mode.
 * PCI DSS 4.0: Req 3.5.1 / 4.2.1 (strong cryptography for stored/transit data).
 * @param {string} text - Hex string to encrypt.
 * @param {string} secretKey - Hex secret key.
 * @returns {string} Ciphertext as a hex string.
 */
helpers.encrypt3des = (text, secretKey) => {
  const encrypted = CryptoJS.TripleDES.encrypt(CryptoJS.enc.Hex.parse(text), CryptoJS.enc.Hex.parse(secretKey), {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7
});
  return encrypted.ciphertext.toString();;
};

/**
 * Decrypts Triple-DES ciphertext in ECB mode.
 * @param {string} toDecrypt - Hex ciphertext.
 * @param {string} key - Hex secret key.
 * @returns {string} Decrypted hex string.
 */
helpers.decrypt3des = (toDecrypt, key) => {
  const cipher = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Hex.parse(toDecrypt));

  const decrypted = CryptoJS.TripleDES.decrypt(cipher, CryptoJS.enc.Hex.parse(key), { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.NoPadding}).toString();

  return decrypted;
};

/**
 * Encrypts text using AES-256-CBC with a zero IV and no auto padding.
 * PCI DSS 4.0: Req 3.5.1 / 4.2.1 (strong cryptography).
 * @param {string} text - Plaintext to encrypt.
 * @param {string} key - Hex-encoded 256-bit key.
 * @returns {string} Uppercase hex ciphertext.
 */
helpers.encryptAES = (text, key) => {
  var cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, "hex"), iv).setAutoPadding(false);
  var encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
  return encrypted.toUpperCase();
};

/**
 * Decrypts AES-256-CBC ciphertext with a zero IV and no auto padding.
 * @param {string} encrypted - Hex ciphertext.
 * @param {string} key - Hex-encoded 256-bit key.
 * @returns {string} Uppercase hex plaintext.
 */
helpers.decryptAES = (encrypted, key) => {
  var bufferKey = Buffer.from(key, "hex");
  var decipher = crypto.createDecipheriv('aes-256-cbc', bufferKey, iv);
      decipher.setAutoPadding(false);
  var decrypted = decipher.update(encrypted, 'hex', 'hex');
  return (decrypted + decipher.final()).toUpperCase();
};

/**
 * Encrypts data using an RSA public key loaded from a file.
 * PCI DSS 4.0: Req 3.5.1 / 4.2.1 (strong cryptography).
 * @param {string} toEncrypt - Data to encrypt.
 * @param {string} relativeOrAbsolutePathToPublicKey - Path to the PEM public key.
 * @returns {Buffer} Encrypted data.
 */
helpers.encryptStringWithRsaPublicKey = (toEncrypt, relativeOrAbsolutePathToPublicKey) => {
  var absolutePath = path.resolve(relativeOrAbsolutePathToPublicKey);
  var publicKey = fs.readFileSync(absolutePath, "utf8");
  var buffer = Buffer.from(toEncrypt);
  var encrypted = crypto.publicEncrypt(publicKey, buffer);
  return encrypted;
};

/**
 * Decrypts data using an RSA private key loaded from a file.
 * Uses RSA_PKCS1_PADDING (legacy PKCS#1 v1.5). Consider migrating to OAEP.
 * @param {string} toDecrypt - Base64-encoded ciphertext.
 * @param {string} relativeOrAbsolutePathtoPrivateKey - Path to the PEM private key.
 * @returns {string} Decrypted hex string, or empty string on error.
 */
helpers.decryptStringWithRsaPrivateKey = (toDecrypt, relativeOrAbsolutePathtoPrivateKey) => {
  var absolutePath = path.resolve(relativeOrAbsolutePathtoPrivateKey);
  var privateKey = fs.readFileSync(absolutePath, "utf8");
  var buffer = Buffer.from(toDecrypt, "base64");

  try {
    var decrypted = crypto.privateDecrypt({
      key: privateKey.toString(),
      padding:crypto.constants.RSA_PKCS1_PADDING
    }, buffer);
    return decrypted.toString("hex");
  } catch (error) {
    dd(("Error de Desencripción RSA!").red);
    return '';
  }

};

/**
 * Computes a CRC32 checksum over a hex string, padded to 8 hex digits.
 * @param {string} text - Hex input string.
 * @returns {string} Uppercase 8-character hex CRC32.
 */
helpers.calcCrc32 = (text) => {
  var dataCrc32 = crc32(Buffer.from(text, 'hex')).toString(16);
  while (dataCrc32.length < 8) {
    dataCrc32 = '0' + dataCrc32;
  }
  return dataCrc32.toUpperCase();
};

/**
 * Builds the nested left sidebar menu for the authenticated user's profile.
 * PCI DSS 4.0: Req 7.1.1 / 7.2.1 / 7.2.2 (role-based access control).
 * @param {import('express').Request} req
 * @returns {Promise<Array>} Nested menu structure.
 */
helpers.getLeftbar = async(req) =>{
  const db = require("../sequelize/init");
  
    const perfil = await db.profileResources.findAll({
      where:{
        id_profile: req.user.id_profile
      },
      include:[{
        model: db.profileUsers,
        required: true,
        as: 'perfil_user'
      },{
        model: db.resources,
        required: true,
        as: 'resource'
      }]
      // include:['perfil_user','resource']
    });
    let leftBar = [];
    let perfiles = JSON.parse(JSON.stringify(perfil));
    perfiles.map( p => { 
      p.child=[];
      if(!p.resource.father_resource){
        leftBar.push(p);
      }else{
        for (const key in leftBar) {
          if (Object.hasOwnProperty.call(leftBar, key)) {
            const lb = leftBar[key];
            let found = false;
            // VERIFICA DENTRO DE SUS CHILDS CHILDS
            for (const kkey in lb.child) {
              if (Object.hasOwnProperty.call(lb.child, kkey)) {
                const element = lb.child[kkey];
                if(element.resource.id == p.resource.father_resource){
                  element.child.push(p);
                  lb.child[kkey] = element;
                  found = true;
                }
              }
            }
            //
            if(!found && lb.resource.id == p.resource.father_resource){
              lb.child.push(p);
              leftBar[key] = lb;
            }
          }
        }
      }
    }) 
    return leftBar;
  }

/**
 * Parses a 40-bit hex ISO bitmap into a structured object.
 * @param {string} bitmap - Hex bitmap string.
 * @returns {Promise<{aplicacion: number, trans: number[], indicadores: number[]}>} Parsed bitmap.
 */
helpers.decript_bitmap = async (bitmap) => {
    let bitmap_bin = parseInt(bitmap,16).toString(2);
    if (bitmap_bin.length == 39){
      bitmap_bin =  "0"+bitmap_bin;
    }
    if (bitmap_bin.length == 38){
      bitmap_bin =  "00"+bitmap_bin;
    }
    if (bitmap_bin.length == 37){
      bitmap_bin =  "000"+bitmap_bin;
    }
    if (bitmap_bin.length == 36){
      bitmap_bin =  "0000"+bitmap_bin;
    }
    if (bitmap_bin.length == 35){
      bitmap_bin =  "00000"+bitmap_bin;
    }
    if (bitmap_bin.length == 34){
      bitmap_bin =  "000000"+bitmap_bin;
    }
    if (bitmap_bin.length == 33){
      bitmap_bin =  "0000000"+bitmap_bin;
    }
  
    bit_type_op   = bitmap_bin.split('');
    let OP_TX = {
      aplicacion: 0, trans: [], indicadores: []
    };
  
    for (let index = 0; index < bit_type_op.length; index++) {
      const element = bit_type_op[index];
      if(element == 1){
        switch (index) {
          // APLICACION
          case 0: OP_TX.aplicacion = 1; break;
          case 1: OP_TX.aplicacion = 2; break;
          case 2: OP_TX.aplicacion = 3; break;
          case 3: OP_TX.aplicacion = 4; break;
          case 4: OP_TX.aplicacion = 5; break;
          // TRANSACCIONES
          case 8: OP_TX.trans.push( 1 ); break;
          case 9: OP_TX.trans.push( 2 ); break;
          case 10: OP_TX.trans.push( 3 ); break;
          case 11: OP_TX.trans.push( 4 ); break;
          case 12: OP_TX.trans.push( 5 ); break;
          case 13: OP_TX.trans.push( 6 ); break;
          case 14: OP_TX.trans.push( 7 ); break;
          case 15: OP_TX.trans.push( 8 ); break;
          case 16: OP_TX.trans.push( 9 ); break;
          case 17: OP_TX.trans.push( 10 ); break;
          case 18: OP_TX.trans.push( 11 ); break;
          case 19: OP_TX.trans.push( 12 ); break;
          case 20: OP_TX.trans.push( 13 ); break;
          case 21: OP_TX.trans.push( 14 ); break;
          case 22: OP_TX.trans.push( 15 ); break;
          case 23: OP_TX.trans.push( 16 ); break;
          // IDICADORES
          case 40: OP_TX.indicadores.push( 1 ); break;
          case 41: OP_TX.indicadores.push( 2 ); break;
          case 42: OP_TX.indicadores.push( 3 ); break;
          case 43: OP_TX.indicadores.push( 4 ); break;
          case 44: OP_TX.indicadores.push( 5 ); break;
  
        }
      }
      
    }
  
  
    return OP_TX;
  };

/**
 * Generates a timestamp-prefixed alphanumeric identifier.
 * @param {number} [length=16] - Desired total length.
 * @returns {string} Generated identifier.
 */
helpers.makeid = (length = 16) => {
  var result           = '';
  var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;
  result += Date.now() ;
  const auxlength = length - result.length 
  for ( var i = 0; i < auxlength; i++ ) {
     result += characters.charAt( Math.floor(Math.random() * charactersLength) );
  }
  return result;
}
  

/**
 * Parses a 16-bit hex profile ISO bitmap into a structured object.
 * @param {string} bitmap - Hex bitmap string.
 * @returns {Promise<{aplicacion: number, trans: number[], indicadores: number[]}>} Parsed bitmap.
 */
helpers.decript_bitmap_profile = async (bitmap) => {
  // SE SACA HEX DE CADA SECCION
  let bitmap_bin = [
    parseInt(bitmap.substring(0,4),16).toString(2).padStart(8,'0'),
    parseInt(bitmap.substring(4,10),16).toString(2).padStart(24,'0'),
    parseInt(bitmap.substring(10,14),16).toString(2).padStart(8,'0')
  ];
  bitmap_bin = bitmap_bin.join('');
  let OP_TX = {
    aplicacion: 0, trans: [], indicadores: []
  };

  for (let index = 0; index < bitmap_bin.length; index++) {
    const element = bitmap_bin[index];
    if(element == 1){
      switch (index) {
        // APLICACION
        case 0: OP_TX.aplicacion = 1; break;
        case 1: OP_TX.aplicacion = 2; break;
        case 2: OP_TX.aplicacion = 3; break;
        case 3: OP_TX.aplicacion = 4; break;
        case 4: OP_TX.aplicacion = 5; break;
        // TRANSACCIONES
        case 8: OP_TX.trans.push( 1 ); break;
        case 9: OP_TX.trans.push( 2 ); break;
        case 10: OP_TX.trans.push( 3 ); break;
        case 11: OP_TX.trans.push( 4 ); break;
        case 12: OP_TX.trans.push( 5 ); break;
        case 13: OP_TX.trans.push( 6 ); break;
        case 14: OP_TX.trans.push( 7 ); break;
        case 15: OP_TX.trans.push( 8 ); break;
        case 16: OP_TX.trans.push( 9 ); break;
        case 17: OP_TX.trans.push( 10 ); break;
        case 18: OP_TX.trans.push( 11 ); break;
        case 19: OP_TX.trans.push( 12 ); break;
        case 20: OP_TX.trans.push( 13 ); break;
        case 21: OP_TX.trans.push( 14 ); break;
        case 22: OP_TX.trans.push( 15 ); break;
        case 23: OP_TX.trans.push( 16 ); break;
        // IDICADORES
        case 32: OP_TX.indicadores.push( 1 ); break;
        case 33: OP_TX.indicadores.push( 2 ); break;
        case 34: OP_TX.indicadores.push( 3 ); break;
        case 35: OP_TX.indicadores.push( 4 ); break;
        case 36: OP_TX.indicadores.push( 5 ); break;

      }
    }
    
  }
  return OP_TX;
};

module.exports = helpers;