const db = require('../../sequelize/init');
const dbTDM = require('../../../../App-TDM/src/sequelize/init');
const helper = require('../../../../App-TDM/src/lib/helpers');
const { Console } = require('winston/lib/winston/transports');
const { stringify } = require('uuid');

const tdmClass = class tdmClass {
  constructor() {
    this.dbName = process.env.DB_NAME_TDM;
  }

  // FUNCION PARA ACTUALIZAR UN COMERCIO
  async updateMerchant(M) {
    dd(('tdm.class.updateMerchant').green);
    try {
      // SE ACTUALIZA EL BITMAP

      await this.verifyBitmap(M);
      // SE ACTUALZA EL MERCHANT
      const dataReplace = [
        M.name_merchant, M.afiliation_number, M.representative, M.url_merchant, M.rfc_merchant,
        M.description, M.agente_comercial, M.contact_merchant, M.rol_contact, M.email_contact,
        M.tel1_contact, M.tel2_contact, M.mobile_contact, M.active, M.last_update, M.id_profile_transaction, M.MSI,
        M.id_merchant,
      ];
      await db.seq.query(`
        UPDATE ${this.dbName}.merchant SET 
        name_merchant = ?, afiliation_number = ?, representative = ?, url_merchant = ?,  rfc_merchant = ?, 
        description = ?, agente_comercial = ?, contact_merchant = ?, rol_contact = ?, email_contact = ?, 
        tel1_contact = ?, tel2_contact = ?, mobile_contact = ?, active = ?, last_update = ? , id_profile_transaction = ?, MSI = ?
        WHERE idmerchant = ? 
      `, { replacements: dataReplace });
    } catch (error) {
      dd(('tdm.class.updateMerchant err').red);
    }

    return { data: 'ok', error: null };
  }

  // VERIFICA EL BITMAP ANTERIOR Y SI ES ASI ACTUALIZA LA TABLA DEL TDM
  async verifyBitmap(M) {
    const profile = await db.isoProfileTrans.findOne({ where: { id_profile_transaction: M.id_profile_transaction } });
    dd(('tdm.class.verifyBitmap').green);
    const sqlSelect = `SELECT * FROM ${this.dbName}.merchant WHERE idmerchant = ?`;
    const merchantAux = await db.seq.query(sqlSelect, { replacements: [M.id_merchant], type: db.seq.QueryTypes.SELECT });

    if (merchantAux.length == 0) return;

    if (merchantAux.length > 0) {
      // SE ELIMINAN LOS REGISTROS ANTES CREADOS PARA REMPLAZARLOS POR EL NUEVO BITMAP
      const sql = `DELETE FROM ${this.dbName}.merchant_has_operations WHERE merchant_idmerchant=?`;
      await db.seq.query(sql, { replacements: [M.id_merchant] });
    }

    // SE LLENA LA TABLA MERCHANT_HAS_OPERATIONS
    const bitmap = profile.hex_value;
    const idoperations = await helper.getidop(bitmap);
    if (idoperations.length) {
      for (let index = 0; index < idoperations.length; index++) {
        const sqlInsert = `INSERT INTO ${this.dbName}.merchant_has_operations (merchant_idmerchant,operations_idoperations) VALUES (?,?)`;
        db.seq.query(sqlInsert, { replacements: [M.id_merchant, idoperations[index]] });
      }
    }
  }

  async createMerchant(merchant, transaction) {
    try {
      dd(('tdm.class.createMerchant').green);
      
      const commerce = await dbTDM.merchant.create({
        idmerchant: merchant.id_merchant,
        name_merchant: merchant.name_merchant,
        mcc_idmcc: merchant.id_mcc,
        afiliation_number: merchant.afiliation_number,
        representative: merchant.representative,
        alias_name: merchant.alias_name,
        url_merchant: merchant.url_merchant,
        rfc_merchant: merchant.rfc_merchant,
        description: merchant.description,
        agente_comercial: merchant.agente_comercial,
        contact_merchant: merchant.contact_merchant,
        rol_contact: merchant.rol_contact,
        email_contact: merchant.email_contact,
        tel1_contact: merchant.tel1_contact,
        tel2_contact: merchant.tel2_contact,
        mobile_contact: merchant.mobile_contact,
        use_moreterminals: merchant.use_moreterminals,
        token_activation: merchant.token_activation,
        active: merchant.active,
        id_profile_transaction: merchant.id_profile_transaction,
        MSI: merchant.MSI,
      });
      if (!commerce) {
        return false;
      }
      const profile = await db.isoProfileTrans.findOne({ where: { id_profile_transaction: commerce.id_profile_transaction } });
      if (!profile) {
        return false;
      }
      const bitmap = profile.hex_value;
      const idoperations = await helper.getidop(bitmap);
      if (idoperations.length) {
        for (let index = 0; index < idoperations.length; index++) {
          const sqlInsert = `INSERT INTO ${this.dbName}.merchant_has_operations (merchant_idmerchant,operations_idoperations) VALUES (?,?)`;
          db.seq.query(sqlInsert, { replacements: [merchant.id_merchant, idoperations[index]] });
        }
      }
      return true;
    }
    catch (e) {
      console.log(e);
      return false;
    }

  }
};

module.exports = tdmClass;
