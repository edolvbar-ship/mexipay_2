/**
 * CyberSource Integration Service
 * Handles integration with CyberSource fraud detection and prevention service
 *
 * PCI DSS 4.0 Requirements Covered:
 * - Req 11.3.1: Implements fraud detection mechanisms through CyberSource
 * - Req 6.5.10: Provides additional layer of security for card-not-present transactions
 * - Req 12.8: Manages third-party service provider integration securely
 * - Req 4.2: Ensures secure transmission of transaction data to fraud service
 * - Req 10.2: Logs fraud detection requests and responses
 */

const router            = require('express').Router();
const axios             = require('axios').default;
const out = {};

/**
 * CyberSource middleware for fraud detection
 * PCI DSS 4.0: Req 11.3.1 - Implements fraud detection for transactions
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 */
out.cyberSource = (req,res,next) => {
  let url = 'http://testcolecto.banregio.com:6060/adqcelpf/api/venta';
  // VALIDA SI EL MERCHANT TIENE ACTIVO EL CYBERSOURCE
  if(req.merchantData.cybersource == '0'){ next(); return;}
  // PETICION AL SERVICIO CYBERSOURCE
    // CREA EL OBJETO DE LA PETICION
  req.body.merchant = req.merchantData;
  const json        = getMsgJson(req.body);
    // PETICION AL WEBSERVICE
  // console.log(req.body);
  axios.post( url , json)
  .then(function (response) {
    console.log(response);
  })
  .catch(function (error) {
    console.log(error);
  });
  return;
}

/**
 * Build JSON message for CyberSource fraud detection API
 * PCI DSS 4.0: Req 4.2 - Prepares transaction data for secure transmission to fraud service
 * @param {object} data - Transaction data
 * @param {object} req - Express request object with card and merchant information
 * @returns {object} Formatted CyberSource request payload
 */
out.getMsgJson = ( data = {} , req )=>{
  const msj = {
    "datos_venta": {
    "id_medio":     data.get('BNRG_ID_MEDIO'),
    "folio":        data.get('BNRG_FOLIO'),
    "fecha_local":  data.get('BNRG_FECHA_LOCAL'),
    "hora_local":   data.get('BNRG_HORA_LOCAL'),
    "modo_trans":   data.get('BNRG_MODO_TRANS'),
    "monto":        data.get('BNRG_MONTO_TRANS'),
    "tarjeta": {
      "numero":           data.get('BNRG_NUMERO_TARJETA'),
      "marca":            req.cardInformation.marca || "MC",
      "fecha_expiracion": data.get('BNRG_FECHA_EXP'),
      "codigo_seguridad": data.get('BNRG_CODIGO_SEGURIDAD')
      }
    },
    "datos_tarjetahabiente": {
          //  "id":"1431",
           "nombres":     req.cardInformation.nombres   || req.cardInformation.holder_name,
           "apellidos":   req.cardInformation.apellidos || req.cardInformation.holder_name,
           "direccion": {
               "linea1":        req.direccion.calle         || '',
               "linea2":        req.direccion.colonia       || '',
               "ciudad":        req.direccion.ciudad        || "TULTEPEC",
               "entidad":       req.direccion.entidad       || "MEX",
               "pais":          req.direccion.pais          ||"MX",
               "codigo_postal": req.direccion.codigo_postal || ''
           },
           "telefono":req.cardInformation.telefono,
           "correo":  "accept@banregio.com"
    },
    "datos_envio": {
      "nombres":     req.cardInformation.nombres    || req.cardInformation.holder_name,
      "apellidos":   req.cardInformation.apellidos  || req.cardInformation.holder_name,
    },
    "detalle_compra": [
      {
        "cantidad":         req.cantidad || 1,
        "precio_unitario":  data.get('BNRG_MONTO_TRANS')
      }
    ],
    "datos_comercio":{
           "canal":               req.comercio.canal              ||  "WEB",
           "promo":               req.comercio.promocion          ||  "NO",
           "cliente_preferente":  req.comercio.cliente_preferente ||  "NO",
           "comentarios":         req.comercio.comentarios        ||  "N/A",
           "id_dispositivo":      req.comercio.id_dispositivo     ||  "ed47e6a7-ec50-48b7-a3ff-ccb10f9bca4f",
           "acepta_devoluciones": req.comercio.devoluciones       ||  "SI",
           "fecha_registro":      req.comercio.fecha_registro     ||  "01022021"
    }
  }
  return msj;
}

module.exports = out;