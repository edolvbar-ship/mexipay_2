const { default: axios } = require("axios");
const pool = require('../database');
const helpers = require("../lib/helpers");
var mensaje = {};
var response = {};
const db = require('../../../socketServer/lib/sequelize/init');

async function consultMerchant(url, headers) {
  //let res = await got.get(url,headers);
  try {
    const instance = axios.create({
      baseURL: process.env.TDM_URL,
      headers: headers
    });
    let res = await instance.get(url, headers);
    if(res.data.mensaje == "No existe el comercio") return "No existe el comercio";
    mensaje = {
      "idmerchant": res.data.id_merchant,
      "mcc_idmcc": 1,
      "name_merchant": res.data.name_merchant,
      "afiliation_number": res.data.afiliation_number,
      "acquirer_bank": res.data.acquirer_bank,
      "representative": res.data.representative,
      "url_merchant": res.data.url_merchant,
      "rfc_merchant": res.data.rfc_merchant,
      "description": res.data.description,
      "agente_comercial": res.data.agente_comercial,
      "contact_merchant": res.data.contact_merchant,
      "rol_contact": res.data.rol_contact,
      "email_contact": res.data.email_contact,
      "tel1_contact": res.data.tel1_contact,
      "tel2_contact": res.data.tel2_contact,
      "mobile_contact": res.data.mobile_contact,
      "use_moreterminals": 1,
      "active": res.data.active,
      "create_date": new Date(res.data.creation_date),
      "id_profile_transaction": res.data.id_profile_transaction,
      "last_update": new Date(res.data.last_update)
    };
    const rowsMerch = await pool.query('SELECT * FROM merchant WHERE idmerchant = ?', [res.data.id_merchant]);
    if (rowsMerch.length > 0) {
      var data = rowsMerch[0];
      const merchant = await db.merchant.findOne({
        include: [
          { required: false, model: db.datosDireccion, as: 'datos_direccion', include: [{model: db.cisoCountry, as: 'country'}, {model: db.cisoState , as: 'state'}] },
        ],
        where: { id_merchant: res.data.id_merchant
         }
      });
      address = {
        'calle': merchant.datos_direccion.calle,
        'no_ext': merchant.datos_direccion.no_ext,
        'no_int': merchant.datos_direccion.no_int,
        'colonia': merchant.datos_direccion.colonia,
        'alcaldia': merchant.datos_direccion.alcaldia,
        'ciudad': merchant.datos_direccion.ciudad,
        'cp': merchant.datos_direccion.cp,
        'estado': merchant.datos_direccion.state.name,
        'pais': merchant.datos_direccion.country.name,
      } 
      id_result = data.idmerchant;
      name_merchant = data.name_merchant;
      valores = {
        id_result,
        name_merchant,
        msi: res.data.MSI,
        acquirer_bank: mensaje.acquirer_bank,
        address: address
      }
      return valores;
    } else {
      result = await pool.query('INSERT INTO merchant SET ? ', mensaje);
      id_result = result.insertId;
      name_merchant = mensaje.name_merchant;
      valores = {
        id_result,
        name_merchant,
        msi: res.data.MSI,
        acquirer_bank: mensaje.acquirer_bank,
        address: null
      }
      bitmap = res.data.profile_transaction;
      // bitmap_bin = parseInt(bitmap,16).toString(2);
      idoperations = await helpers.getidop(bitmap);

      for (let index = 0; index < idoperations.length; index++) {
        result = await pool.query('INSERT INTO merchant_has_operations (`merchant_idmerchant`,`operations_idoperations`) VALUES (?,?)', [id_result, idoperations[index]]);
      }
      return valores;
    }
  } catch (error) {
    dd(("Error Venta : " + error).red);
    return "error";
  }

};

async function cancelacion(url, data, headers, newTX) {
  try {
    let res = await axios.post(url, data, { "headers": headers });
    idtransaction = await helpers.insertTx(newTX, data);
    mensaje = res.data;
    trace_number = mensaje.trace_id;
    resp_code = mensaje.error_code;
    authorization = mensaje.authorization;
    response = JSON.stringify(mensaje);

    let upTX = {
      trace_number,
      resp_code,
      authorization,
      response
    };
    await helpers.updateTx(idtransaction, upTX);

    return mensaje.error_code;
  } catch (error) {
    idtransaction = await helpers.insertTx(newTX, data);
    trace_number = "error";
    resp_code = "ER";
    authorization = "error";
    response = error;

    let upTX = {
      trace_number,
      resp_code,
      authorization,
      response
    };
    dd(("Error Cancelación : " + error).red);
    await helpers.updateTx(idtransaction, upTX);
    return "error";
  }

};

async function consultaPerfilTrans(id_perfil) {
  var merchant = await db.merchant.findOne({ where: { id_merchant: id_perfil }, include: ['profile_trans'] });
  return merchant.profile_trans;
}
exports.consultMerchant = consultMerchant;
exports.cancelacion = cancelacion;
exports.consultaPerfilTrans = consultaPerfilTrans;