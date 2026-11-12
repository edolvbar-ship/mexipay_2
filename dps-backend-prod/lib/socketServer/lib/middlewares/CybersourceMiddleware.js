const router            = require('express').Router();
const axios             = require('axios').default;
const out = {};

/**
 * Express middleware that calls the Cybersource fraud/verification service when enabled for the merchant.
 * If the merchant has cybersource disabled ('0'), the request proceeds without calling the service.
 * PCI DSS 4.0: Req 4.2.1 (protect CHD in transit), Req 11.4.6 (fraud detection integration).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
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
 * Builds the JSON payload for the Cybersource webservice.
 * @param {Object} [data={}] - Transaction data including cardInformation and amount.
 * @param {string} [modo='AUT'] - Transaction mode (e.g., AUT for authorization).
 * @returns {Object} Payload for the Cybersource webservice.
 */
function getMsgJson(data = {} , modo = 'AUT'){
  const msj = {
    "datos_venta": {
    "id_medio":     "3sb1ujfv",
    "folio":        data.reference,
    "fecha_local":  "05082021",
    "hora_local":   "152635",
    "modo_trans":   modo,
    "monto":        data.amount,
    "tarjeta": {
      "numero":           data.cardInformation.card_number,
      "marca":            "MC",
      "fecha_expiracion": data.cardInformation.expiration_month + data.cardInformation.expiration_year,
      "codigo_seguridad": data.cardInformation.cvv
      }
    },
    "datos_tarjetahabiente": {
           "id":"1431",
           "nombres":     data.cardInformation.holder_name,
           "apellidos":   data.cardInformation.holder_name,
           "direccion": {
               "linea1":        "TLAXCALA 13",
               "linea2":        "COL. EL QUEMADO",
               "ciudad":        "TULTEPEC",
               "entidad":       "MEX",
               "pais":          "MX",
               "codigo_postal": "54960"
           },
           "telefono":"5536599368",
           "correo":  "accept@banregio.com"
    },
    "datos_envio": {
      "nombres":   data.cardInformation.holder_name,
      "apellidos": data.cardInformation.holder_name
    },
    "detalle_compra": [
      {
        "cantidad": 1,
        "precio_unitario": data.amount
      }
    ],
    "datos_comercio":{
           "canal":               "WEB",
           "promo":               "NO",
           "cliente_preferente":  "NO",
           "comentarios":         "test",
           "id_dispositivo":      "ed47e6a7-ec50-48b7-a3ff-ccb10f9bca4f",
           "acepta_devoluciones": "SI",
           "fecha_registro":      "01022021"
    }
  }
  return msj;
}

module.exports = out;