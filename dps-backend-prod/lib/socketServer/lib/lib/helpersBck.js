const bcrypt = require('bcryptjs');
const bitwise = require('bitwise');

const helpers = {};

/**
 * Legacy password hashing using bcrypt (without base64 decoding).
 * PCI DSS 4.0: Req 8.2.1 / 8.2.4 (strong password hashing).
 * @param {string} password - Plaintext password.
 * @returns {Promise<string>} Bcrypt hash.
 */
helpers.encryptPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  return hash;
};

/**
 * Legacy password comparison using bcrypt (without base64 decoding).
 * PCI DSS 4.0: Req 8.2.1 / 8.2.4 (password verification).
 * @param {string} password - Plaintext password.
 * @param {string} savedPassword - Stored bcrypt hash.
 * @returns {Promise<boolean>} True if the password matches.
 */
helpers.matchPassword = async (password, savedPassword) => {
  try {
    return await bcrypt.compare(password, savedPassword);
  } catch (e) {
    console.log(e)
  }
};

/**
 * Legacy TKA validation using bitwise OR/XOR and bcrypt comparison.
 * This approach is deprecated; use the HMAC-SHA256 implementation in helpers.js/tka.js instead.
 * @param {string} tkr - Merchant token_activation.
 * @param {string} tms - Timestamp/nonce.
 * @param {string} afiliation_number - Merchant affiliation number.
 * @param {string} tka - Received token to validate.
 * @returns {Promise<boolean>} True if the token matches.
 */
helpers.validateTKA = async (tkr, tms, afiliation_number,tka) => {
    const dato1 = new Buffer.from(tkr);
    const dato2 = new Buffer.from(tms);
    const dato3 = new Buffer.from(afiliation_number);

    sk1 = await bitwise.buffer.or(dato1,dato2);
    console.log("sk1 : "+sk1);
    sk2 = await bitwise.buffer.xor(sk1,dato3);
    console.log("sk2 : "+sk2);
    base64 = sk2.toString('base64');
    console.log("base 64 : "+base64);
    console.log("base 64 tka: "+tka);

    try {
        // Compare TKA
       console.log( await bcrypt.compare(base64,tka));
        return await bcrypt.compare(base64,tka);
    } catch (error) {
        console.log(error);
    }

    // Return false if error
    return false;
};

/**
 * Legacy left sidebar builder that groups resources by icon.
 * PCI DSS 4.0: Req 7.2.1 (role-based access control).
 * @param {import('express').Request} req
 * @returns {Promise<Array>} Nested menu structure.
 */
helpers.getLeftbar = async(req) =>{
const db = require("../sequelize/init");

  const perfil = await db.profileResources.findAll({
    where:{
      id_profile: req.user.id_profile
    },
    include:['perfil_user','resource']
  })
  let leftBar = [];
  let perfiles = JSON.parse(JSON.stringify(perfil));
  perfiles.map( p => { 
    p.child=[];
    if(p.resource.icon && p.resource.icon != ''){
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

module.exports = helpers;