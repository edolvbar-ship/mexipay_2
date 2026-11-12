/* eslint-disable camelcase */
const Translator = require('../../../Translator');
const helpers = require('../../../helpers/lib/helpers');

const H = {};

/**
 * Builds a standardized JSON decline response for a transaction.
 * PCI DSS 4.0: Req 6.4.1 (consistent error handling), Req 10.2.1 (audit logging).
 * @param {string} error_txt - Human-readable decline reason.
 * @param {string} guid - Request identifier.
 * @param {string} trace_number - ISO trace number (field 11).
 * @param {string} [error_code='65'] - ISO error code.
 * @param {string} [reference=''] - Transaction reference.
 * @returns {Object} Standardized decline response object.
 */
H.jsonRechazo = (error_txt, guid, trace_number, error_code = '65', reference = '') => {
  console.log('txHelpers.js -----> H.jsonRechazo');
  // SE GENERA LA RESPUESTA
  const R = {
    request_id: guid,
    request_status: false,
    http_code: 409,
    error_code,
    description: 'DECLINADA',
    id: reference,
    emv_tags: '',
    emvResponseCode: '',
    response: error_txt,
  };
  generateErrorMsg({
    error_code,
    trace_number,
  });

  return R;
};

/**
 * Converts the request into an ISO packet, builds a decline response, and logs the failure.
 * PCI DSS 4.0: Req 10.2.1 / 10.3.1 (audit logging), Req 3.4 (PAN masking), Req 6.4.1 (error handling).
 * @param {import('express').Request} REQ - Express request object.
 * @param {Object} DATAOBJ - Transaction context object.
 * @param {import('express').Response} res - Express response object.
 * @param {string} [errorCode='65'] - ISO error code.
 * @returns {Promise<import('express').Response>} JSON decline response.
 */
H.rechazarTx = async (REQ, DATAOBJ, res, errorCode = '65') => {
  console.log('txHelpers.js -----> H.rechazarTx');
  const entry_time = new Date();
  const data_req_json = REQ.body;
  const commerce_id = REQ.headers['commerce-id'];
  const commerce_name = REQ.headers['commerce-name'].toUpperCase();
  const system_fiid = REQ.headers['system-fiid'];
  const { mcc } = REQ.headers;
  data_req_json.req = REQ;
  // DATAOBJ.checkOutData

  const isoPacket = new Translator.jsonToIso(
    data_req_json,
    commerce_id,
    commerce_name,
    system_fiid,
    mcc,
    DATAOBJ.msgType,
    DATAOBJ.typeTran,
    DATAOBJ.binDataInfo,
    DATAOBJ.checkOutData,
    DATAOBJ.tknQ2,
    DATAOBJ.dftCpt,
  );
  const data_req_iso_de = isoPacket.getISOReqTranDE();

  // SE GENERA LA RESPUESTA
  if(!REQ.txStatus.text) {
    REQ.txStatus.text = respCodeData.find((respCode) => respCode.iso_code ===errorCode)?.device_description || 'Desconocido.'
  }
  
  const R = H.jsonRechazo(REQ.txStatus.text, DATAOBJ.guid, data_req_iso_de.fields[11], errorCode, REQ.body.reference);
  const dataSend = { body: REQ.body, merchant_data: REQ.merchantData };
  // SE INSERTA EN ISO MESSAGE
  helpers.saveIsoMessage(
    DATAOBJ.id_operation,
    DATAOBJ.msgType,
    data_req_iso_de.fields[11],
    data_req_iso_de.fields[37],
    data_req_iso_de.fields[4],
    errorCode,
    '',
    DATAOBJ.binDataInfo.bin,
    data_req_json.cardInformation.last4,
    DATAOBJ.dftCpt,
    data_req_iso_de.fields[22],
    DATAOBJ.reverseCode,
    data_req_iso_de.fields[13],
    data_req_iso_de.fields[12],
    data_req_iso_de.fields[17],
    data_req_iso_de.fields[63],
    '',
    data_req_iso_de.fields[43],
    DATAOBJ.node_dest,
    dataSend,
  );
  
  const exit_time = new Date();
  helpers.saveIsoApiLog(DATAOBJ.guid, REQ.originalUrl, REQ.method, REQ.body, JSON.stringify(R), entry_time.toISOString(), exit_time.toISOString());
  return res.json(R);
};

module.exports = H;
