/**
 * @fileoverview Transaction Service - Legacy JSON to ISO Parser
 *
 * This service handles the conversion of JSON payment requests to ISO 8583 messages
 * and routes them to appropriate payment processors. It includes validation, routing,
 * and response handling for card-present and card-not-present transactions.
 *
 * @module tx.service
 *
 * PCI DSS 4.0 Compliance Requirements:
 * - Req 3.4: PAN masked/encrypted during processing (3DES decryption for track2)
 * - Req 4.2: Cardholder data encrypted during transmission
 * - Req 6.5.1: Input validation prevents injection attacks
 * - Req 6.5.3: Secure authentication data handling
 * - Req 8.2: Secure key management (global.mk for 3DES)
 * - Req 10.2: All transaction attempts logged
 * - Req 10.3: Audit trail includes user, timestamp, event details
 *
 * Security Considerations:
 * - Track2 data decrypted using 3DES with global master key
 * - Reference number validation prevents duplicate transactions
 * - Amount validation ensures merchant limits enforced
 * - MSI (months without interest) validation
 * - Timeout handling prevents hung transactions
 * - BIN routing to appropriate processor
 *
 * @deprecated Consider migrating to tx.service.pro.js for enhanced features
 * @author Payment Gateway Team
 * @version 1.0.0
 */

// const app               = require("express")();
const pool = require("../database");
var helpers = require('../../../helpers/lib/helpers');
const Translator = require("../../../Translator");
const { rechazarTx, jsonRechazo } = require('../lib/txHelpers');
const db = require("../sequelize/init");
const { v4: uuidv4 } = require('uuid');
const helpersSec = require('../../lib/lib/helpers');
const _ = require('lodash');

let output = {};
var hexFields = [52, 55];
var hastimeOut = false;

/**
 * Parse JSON to ISO 8583 and process transaction
 *
 * Main entry point for transaction processing. Handles validation,
 * ISO message construction, routing, and response processing.
 *
 * PCI DSS Req 3.4: Track2 decrypted securely using 3DES
 * PCI DSS Req 6.5.1: Input validation on all parameters
 * PCI DSS Req 10.2: Transaction attempts logged with guid
 *
 * @async
 * @function parserJsonIso
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {number} msgType - ISO message type (0200, 0220, etc.)
 * @param {string} typeTran - Transaction type code
 * @param {string} tknQ2 - Token Q2 for routing
 * @param {string} dftCpt - Draft capture flag
 * @param {number} id_operation - Operation ID from database
 * @returns {Promise<boolean>} False on completion
 */
output.parserJsonIso = async (req, res, msgType, typeTran, tknQ2, dftCpt, id_operation) => {
  req.originalBody = _.cloneDeep(req.body);
  this.noMore = false;
  var guid = uuidv4();
  var parent = this;
  var onlyNumbers = /^[0-9]+$/;
  var refnum = (req.params.id && req.params.id.match(onlyNumbers)) ? req.params.id : "";
  var last4 = req.body.cardInformation ? req.body.cardInformation.last4 : "";
  var binDataInfo = '';
  var reverseCode = req.body.reverseCode;
  var node_dest = '';

  let checkOutData = '';

  // recover ISO state and country data
  const addresses = await recoverIsoAddressData( req.merchantData.id_direccion ) ;
  req.body.isoAddress = addresses[0];

  dd('Reference validation....');
  if( !refnum && await helpers.getMessageByReference(req.body.reference, req.merchantData.afiliation_number, req.body.device?.serial)){
      const dataObject = { guid, id_operation, msgType, typeTran, tknQ2, dftCpt, binDataInfo, checkOutData, reverseCode, node_dest }
      return await rechazarTx(req, dataObject, res, '94');
  }
  dd('Reference validated.');

  // 🔴 CRITICAL: Detect reversal operations for proper message type handling
  const msgTypeStr = String(msgType).padStart(4, '0');
  const isReversal = (msgTypeStr === '0220' || msgTypeStr === '0230' || msgTypeStr === '0420') || 
                     [6, 7, 16].includes(id_operation); // Include operation IDs: cancel(6), refund(7), reverse(16)

  if (refnum) {
    dd('ES UNA OPERACION DE BIN')
    req.body.cardInformation = {}
    try{
      checkOutData = await helpers.getBinInfo(refnum, req.merchantData.afiliation_number, req.body.device?.serial);
      req.body.tk2 = checkOutData.card_info.track2;
      req.body.cardInformation = {
        card_number: checkOutData.card_info.card_number,
        bin: checkOutData.card_info.bin,
        last4: checkOutData.card_info.last4,
        expiration_year: checkOutData.card_info.expiration_year,
        expiration_month: checkOutData.card_info.expiration_month
      }
      last4 = checkOutData.card_info.last4;
      dd('===========================');
    }catch(err) {
      dd(err.stack, 'error');
      const dataObject = { guid, id_operation, msgType, typeTran, tknQ2, dftCpt, binDataInfo, checkOutData, reverseCode, node_dest }
      return await rechazarTx(req, dataObject, res, 'M2');
    }
  }

  if (req.body.cardInformation !== null && req.body.cardInformation !== undefined) {
    if (req.body.cardInformation.track2 !== undefined && req.body.cardInformation.track2 !== null) {
      const track2_under_local_key = helpers.padRight((await helpersSec.decrypt3des(req.body.cardInformation.track2, global.mk)), 48, ' ').replace(/f/g, ' ').replace(/d/g, '=');
      req.body.tk2 = track2_under_local_key;
      req.body.cardInformation.card_number = track2_under_local_key.split('=')[0];
    }
  }

  if (req.body.cardInformation) {
    let bin = String(req.body.cardInformation.card_number).slice(0,8);
    let binObject = binData.find(binInfo => binInfo.bin === bin);
    if(!binObject){
      bin = bin.slice(0,6);
      binObject = binData.find(binInfo => binInfo.bin === bin);
    }
    binDataInfo = binObject ? binObject : getBinDataInfoInt(req.body.cardInformation.bin);
  }

  
  var data_res_iso_raw = '';
  var device = req.body.device ? req.body.device : {};
  var id_processor = binDataInfo.id_processor ? binDataInfo.id_processor : req.merchantData.id_processor;
  var fiid = binDataInfo.id_processor ? binDataInfo.processor : req.merchantData.procesador.fiid;

  

  req.txStatus = {};
  
  if (req.body.chargePlan && req.body.chargePlan.months)
    validateMSI(req.merchantData, req);
  else
    validateAmount(req.merchantData, req);
  
  if (req.txStatus.error) {
    const dataObject = { guid, id_operation, msgType, typeTran, tknQ2, dftCpt, binDataInfo, checkOutData, reverseCode, node_dest }
    return await rechazarTx(req, dataObject, res, req.txStatus.code);
  }
  var upstream = routing(tknQ2, {id_processor, fiid}, id_operation, req.dataInit);




  req.sendJsonReponse = async function(jsonObject, code){
    let stringifiedData = typeof jsonObject == 'string' ? jsonObject : JSON.stringify(jsonObject, null, 3);
    // delete req.session.dataInit;
    res.writeHead(code, {
      "Content-Type": "application/json",
      "Content-Length":  Buffer.byteLength(stringifiedData, 'utf8'),
    });

    dd(("Response: " + req.protocol + "://" + req.get("host") + req.originalUrl).yellow);
    dd(("\n\nJSON Response: \n================================================================================================\n"
      + stringifiedData
      + "\n================================================================================================\n"), 'verbose');

    res.write(stringifiedData);
  };

  // This method sends client reply

  req.sendReply = async function (data_res_iso, code, errors) {
    if (!errors)
      errors = [];
    else
      if (!Array.isArray(errors)) errors = [errors];

    if (!code) code = 200;

    if (!req.isRawMode) {
      const dataSend = {
        name_merchant: req.merchantData.id_merchant,
        terminal_id: '',
        reference_number_ant: null,
        data125: null,
        device,
        folio: req.body.reference,
        body: req.body, 
	      merchant_data: req.merchantData 
      }
      if (data_res_iso) {
        
        var jsonAggregator = new Translator.isoToJson(data_res_iso, req.originalUrl, binDataInfo, respCodeData, guid);
        data_res_json = JSON.stringify(jsonAggregator.getJsonDestTran(req.body.reference), null, 4);

        // dataSend.name_merchant = headers['commerce-name'].split(',')[0];
        dataSend.terminal_id = data_res_iso[41];
        dataSend.reference_number_ant = data_res_iso[90] ? data_res_iso[90].substr(4, 16) : null;
        if(typeTran === "20" || typeTran === "02"){
          dataSend.reference_number_ant = req.params.id ? req.params.id : null;
        }

        if(msgType === 220 || msgType == 420){
          data_res_iso[38] = data_req_iso_de.getFields()[38];
        }
        // dataSend.data125 = data_res_iso[125]; //Con esto se obtine el campo de la respuesta, pero hace falta el catálogo para realizar un match correcto

        dataSend.data125 = '00';

        if(binDataInfo.type == "CREDITO" || binDataInfo.type == "CRÉDITO"){
          dataSend.data125 = 'C0';
        }else if(binDataInfo.type == "DEBITO" || binDataInfo.type == "DÉBITO"){
          dataSend.data125 = 'P0';
        }

        // VERFICA EL RESP CODE
        const resp_code = data_res_iso[39];
        if (resp_code != '00')
          generateErrorMsg({ resp_code: resp_code, trace_number: data_res_iso[11] })

        await helpers.saveIsoMessage(id_operation, parseInt(data_res_iso[0]), data_res_iso[11], data_res_iso[37], data_res_iso[4],
          data_res_iso[39], data_res_iso[38], binDataInfo.bin, last4, dftCpt, data_res_iso[22], reverseCode, data_res_iso[13], data_res_iso[12],
          data_res_iso[17], data_req_iso_de.fields[63], data_res_iso[63],  data_req_iso_de.fields[43], node_dest, dataSend, data_req_iso_de.fields[35] );
      }
      else {
        dataSend.autoReverseInfo = {
          fld125: data_req_iso_de.fields[125],
          fld43: data_req_iso_de.fields[43]
        };

        // 🔴 CRITICAL FIX: Use correct message type for timeout errors in reversals
        // If this is a reversal operation that timed out, save as 220 (reversal response)
        const errorMsgType = (errors[0].includes("timeout") && isReversal) ? 220 : msgType;
        
        // 🔴 CRITICAL FIX: Ensure amount is always in cents for failed transactions
        // data_req_iso_de.fields[4] should already be in cents, but let's validate
        let amountForStorage = data_req_iso_de.fields[4];
        if (amountForStorage && amountForStorage.toString().includes('.')) {
            // Only convert if amount contains decimal point (is in dollars format like "11.11")
            amountForStorage = Math.round(parseFloat(amountForStorage) * 100).toString();
            console.log('[tx.service.js] 🔧 Converted amount from dollars to cents:', {
                original: data_req_iso_de.fields[4],
                converted: amountForStorage
            });
        }
        
        const data_res = jsonRechazo(null, guid, data_req_iso_de.fields[11], errors[0].includes("timeout") ? '91':'06', req.body.reference);

        await helpers.saveIsoMessage(id_operation, errorMsgType, data_req_iso_de.fields[11], data_req_iso_de.fields[37], amountForStorage,
        data_res.resp_code, '', binDataInfo.bin, last4, dftCpt, data_req_iso_de.fields[22], reverseCode, data_req_iso_de.fields[13], data_req_iso_de.fields[12],
        data_req_iso_de.fields[17], data_req_iso_de.fields[63], '', data_req_iso_de.fields[43], node_dest, dataSend);

        data_res_json = JSON.stringify(data_res);

      }

      data_res_json += "\n";
    }

    req.sendJsonReponse(data_res_json, code);

  };

  // This method is triggered by Client Host to reply to the sender
  req.reply = async function (p, data_qe, rq, node) {
    if (this.isRawMode)
      var data_res_iso = p.getRawMessage().toString("hex");
    else {
      var data_res_iso = prepareObjectDataOut(p.getFields());
      data_res_iso_raw = p.rawData.toString().toUpperCase();
      node_dest = node;
    }
    // SE BUSCA EL NUMERO DE REF ANTERIOR
    const reference_number_ant = (data_res_iso[90]) ? data_res_iso[90].substr(4, 12) : null;
    if (reference_number_ant) {
      const originTx = await db.isoMessage.findOne({ where: { reference_number: reference_number_ant } });
      if (!data_res_iso[38] && originTx)
        data_res_iso[38] = originTx.authorization;
    }
    //
    await this.sendReply(data_res_iso);
    return true;
  };

  // This method is triggered on queue timeout
  req.queueTimeout = function () {
    dd(`Client ${req.originalUrl} gateway timeout`);
    req.timeoutState.hasTimedOut = true;
    this.sendReply("", 504, "Gateway timeout");
  };
  // This method is triggered to say client goodbye
  req.end = function () {
    req.client.end();
  };
  // Checks if req was already closed
  req.isClosed = function () {
    return !this.client.writable;
  };

  var org_crd_num = "";
  var org_cvv = "";
  org_crd_num = (req.body.cardInformation) ? req.body.cardInformation.card_number : "";
  org_cvv = (req.body.cardInformation) ? req.body.cardInformation.cvv : "";
  dd(("Request: " + req.protocol + "://" + req.get("host") + req.originalUrl).yellow);
  dd(("\n\nJSON Request: \n================================================================================================\n"
    + JSON.stringify(req.headers, null, 4) + "\n"
    + JSON.stringify(helpers.safeLog(req.body), null, 4)
    + "\n================================================================================================\n"), 'verbose');
  if (req.body.cardInformation) req.body.cardInformation.card_number = org_crd_num;
  if (req.body.cardInformation) req.body.cardInformation.cvv = org_cvv;

  if (!req.headers.hasOwnProperty("content-length"))
    await req.sendReply("", 400, "Bad request");

  try {
    var data_req_json = prepareObjectDataIn(req.body);
  } catch (ex) {
    await req.sendReply("", 400, [ex.toString()]);
    return;
  }

  if (req.headers["commerce-id"] && req.headers["commerce-name"]) {
    var commerce_id = req.headers["commerce-id"];
    var commerce_name = req.headers["commerce-name"].toUpperCase();
    var system_fiid = req.headers["system-fiid"];
    var mcc = req.headers["mcc"];
    var errReturn = [];
    var entry_time = new Date();
    data_req_json.req = req;

    // set 3DS information
    if(res.locals.response3ds ) {
      data_req_json.response3ds = res.locals.response3ds 
    }else {
      // get 3DS information from request
      if(req.body['3DS_XID'] && req.body['3DS_UCAF'] && req.body['3DS_ECI']){
        data_req_json.response3ds = {
          eci : req.body['3DS_ECI'],
          authenticationValue : req.body['3DS_UCAF'],
          messageVersion : req.body['3DS_VERSION'],
          dsTransID : req.body['3DS_XID'],
        }
      }
    }

    // MODIFICA LA AFILIACION SI VIENE DE LINK DE PAGO 
    if (req.body.link_pago && req.merchantData.afiliation_link) {
      commerce_id = req.merchantData.afiliation_link;
      req.headers["commerce-id"] = commerce_id;
      req.merchantData.id_bnrg_channel = req.merchantData.id_medio_link;
    }

    

    data_req_json.req = req;

    var isoAggregator = new Translator.jsonToIso(data_req_json, commerce_id, commerce_name, system_fiid, mcc, msgType, typeTran, binDataInfo, checkOutData, tknQ2, dftCpt);
    var data_req_iso_de = isoAggregator.getISOReqTranDE();
    var data_req_iso_raw = isoAggregator.getISODestTran(); //Utilizar isoAggregator.destpacket
    var data_res_json = JSON.stringify({ errors: ["Client has gone"] });

    if ('string' === typeof upstream) {
      console.log("UPSTREAM IS STRING (BR)");
      const api = require(`./../extras/${upstream}`);

      const ref = `Request: ${req.protocol}://${req.get("host")}${req.originalUrl}`;
      const limitAmount = [req.merchantData.min, req.merchantData.max]
      const result = await api(guid, req.merchantData.apiKey, req.merchantData.url_merchant, req.body, binDataInfo, ref, limitAmount)

      if (result.ok) {
        const isoMSG = require(`./../extras/iso8583_${upstream}`);

        const dataSend = {
          name_merchant: req.merchantData.id_merchant, terminal_id: '', reference_number_ant: null, data125: null, device,
          folio: req.body.reference, body: req.body, merchant_data: req.merchantData
        }

        dataSend.terminal_id = data_req_iso_de[41];
        dataSend.reference_number_ant = data_req_iso_de[90] ? data_req_iso_de[90].substr(4, 16) : null;
        dataSend.data125 = data_req_iso_de[125];

        const newMsg = isoMSG(req.body, result.dataRes, id_operation, msgType, data_req_iso_de, node_dest, dftCpt);
        await helpers.saveIsoMessage(newMsg[0], newMsg[1], newMsg[2], newMsg[3], newMsg[4], newMsg[5], newMsg[6], newMsg[7], newMsg[8], newMsg[9], newMsg[10], newMsg[11], newMsg[12], newMsg[13], newMsg[14], newMsg[15], newMsg[16], newMsg[17], newMsg[18], dataSend);
        var exit_time = new Date();
        helpers.saveIsoApiLog(guid, req.originalUrl, req.method, data_req_json, JSON.stringify(result.out), entry_time.toISOString(), exit_time.toISOString());
      }

      return res.status(result.ok ? 200 : 400).json(result.out);
    }
    else {
        console.log('++++++++++++++++++++ sending data to QUEUE');
        if (!upstream?.sendData(req, data_req_iso_raw, null, errReturn, req)) {
          await req.sendReply("", 500, !errReturn.length ? "Failed to queue message" : errReturn);
        }
    }
  }

  // 'Close' event is triggered on connection close
  req.client.on("close", function () {
    var exit_time = new Date();
    console.log(' ======================== Entra en close =======================');
    dd((`Client ${req.originalUrl} <close> event`).yellow);
    data_req_json.headers = req.headers;

    helpers.saveIsoApiLog(guid, req.originalUrl, req.method, data_req_json, data_res_json, entry_time.toISOString(), exit_time.toISOString());

    if (req.queueMessageId)
      upstream.hasGone(req.queueMessageId);
  });
  // 'Error' event is triggered on req errors
  req.on("error", err => dd("Client <error> " + err));
  res.on("error", err => dd("Client res <error> " + err));
  req.client.on("error", err => dd("Client socket <error> " + err));
  // 'Timeout' event is triggered on req timeout
  req.on("timeout", function () {
    this.sendReply("", 408, "Request timeout");
  });
  // 'Timeout' event is triggered on req timeout
  res.on("timeout", () => req.sendReply("", 504, "Gateway timeout"));

  // If deny mode is on
  if (parent.noMore)
    req.sendReply("", 503, "Service Temporarily Unavailable");

  return false;
}


function prepareObjectDataIn(data_req) {
  for (var i in hexFields) {
    if (data_req.hasOwnProperty(hexFields[i]))
      data_req[hexFields[i]] = Buffer.from(data_req[hexFields[i]], "hex");
  }

  return data_req;
}
// Do data transition before sending out
function prepareObjectDataOut(data) {
  for (var i in hexFields) {
    if (data.hasOwnProperty(hexFields[i])) {
      if (typeof data[hexFields[i]] == "object" && data[hexFields[i]] instanceof Buffer)
        data[hexFields[i]] = data[hexFields[i]].toString("hex");
      else
        data[hexFields[i]] = Buffer.from(data[hexFields[i]], "binary").toString("hex");
    }
  }

  return data;
}
//
function S4() {
  return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
}
//


function routing(tknQ2, processor, id_operation, dataInit) {
  let {id_processor, fiid} = processor;

  
  try {
    let upstream = {};

     
    dd('+++++++ seleccionando upstream');

    if (tknQ2 === '03' && id_processor === 1) dd('dataInit.tcpClient1Prosa');
    if (tknQ2 === '09' && id_processor === 1) dd('dataInit.tlsClient1Prosa');
    if (tknQ2 === '08' && id_processor === 1) dd('tlsClient1Prosa');
    if (tknQ2 === '03' && id_processor === 2) dd('tcpClient1Amex');
    if (tknQ2 === '09' && id_processor === 2) dd('tlsClient1Amex');
    if (tknQ2 === '08' && id_processor === 2) dd('tlsClient1Amex');
    if (tknQ2 === '03' && id_processor === 3) dd('httpClient1Bnrg');
    if (tknQ2 === '09' && id_processor === 3) dd('httpClient1Bnrg');
    if (tknQ2 === '08' && id_processor === 3) dd('httpClient1Bnrg');
    if (fiid === 'MBBL' && id_operation != 3) dd('httpClientBroxelWhitelabel');


    if (tknQ2 === '03' && id_processor === 1) upstream = dataInit.tcpClient1Prosa;
    if (tknQ2 === '09' && id_processor === 1) upstream = dataInit.tlsClient1Prosa;
    if (tknQ2 === '08' && id_processor === 1) upstream = dataInit.tlsClient1Prosa;
    if (tknQ2 === '03' && id_processor === 2) upstream = dataInit.tcpClient1Amex;
    if (tknQ2 === '09' && id_processor === 2) upstream = dataInit.tlsClient1Amex;
    if (tknQ2 === '08' && id_processor === 2) upstream = dataInit.tlsClient1Amex;
    if (tknQ2 === '03' && id_processor === 3) upstream = dataInit.httpClient1Bnrg;
    if (tknQ2 === '09' && id_processor === 3) upstream = dataInit.httpClient1Bnrg;
    if (tknQ2 === '08' && id_processor === 3) upstream = dataInit.httpClient1Bnrg;

    if (fiid === 'MBBL' && id_operation != 3) upstream = dataInit.httpClientBroxelWhitelabel;

    if(id_operation == 3 && (['MBBL'].includes(fiid)) ) {
      upstream = dataInit.tcpClient1Prosa;
      dd('dataInit.tcpClient1' + fiid);
    }


    if (0 === Object.keys(upstream).length) {
      if (tknQ2 === '09' && id_processor === 5)
        upstream = 'api_banorte';
      if (tknQ2 === '09' && id_processor === 6)
        upstream = 'api_PayCIPS';
    }

    return upstream;
  } catch (err) {
    dd(err.stack, 'error');
    return undefined;
  }
}

//
function getBinDataInfoInt(bin) {
  let  binDataInfo = bin ? { "id_bin": 0, "id_processor": null, "processor": "Definido por comercio", "bin": bin, "bank": "INTERNACIONAL", "product": "INTERNACIONAL", "type": "GENERAL", "brand": "GENERAL" } : {};
  if (bin.substring(0, 1) === '3') binDataInfo = { "id_bin": 0, "id_processor": null, "processor": "Definido por comercio", "bin": bin, "bank": "INTERNACIONAL", "product": "INTERNACIONAL", "type": "GENERAL", "brand": "AMEX" };
  if (bin.substring(0, 1) === '4') binDataInfo = { "id_bin": 0, "id_processor": null, "processor": "Definido por comercio", "bin": bin, "bank": "INTERNACIONAL", "product": "INTERNACIONAL", "type": "GENERAL", "brand": "VISA" };
  if (bin.substring(0, 1) === '5' || bin.substring(0, 1) === '6') binDataInfo = { "id_bin": 0, "id_processor": null, "processor": "Definido por comercio", "bin": bin, "bank": "INTERNACIONAL", "product": "INTERNACIONAL", "type": "GENERAL", "brand": "MASTERCARD" };
  return binDataInfo;
}

function validateMSI(merchant, { body, txStatus }) {
  dd('Valida MSI');
  try {
    const msi = JSON.parse(merchant.MSI || '[]');
    if (Array.isArray(msi) && msi.length > 0) {
      if (typeof msi[0] === 'object') {
        const selectedMSI = msi.find(plan => parseInt(plan.type) === parseInt(body.chargePlan.months));
        if (selectedMSI) {
          if (parseFloat(body.amount) < parseFloat(selectedMSI.min_mount)) {
            txStatus.error = true;
            txStatus.text = 'Monto mínimo de MSI no superado.';
          }
        }
        else {
          txStatus.error = true;
          txStatus.text = 'Promoción a MSI no valida.';
        }
      } else if (typeof msi[0] === 'number' || typeof msi[0] === 'string') {
        txStatus.error = true;
        txStatus.text = 'MSI no habilitados al comercio.';
      }
    } else {
      txStatus.error = true;
      txStatus.text = 'MSI no habilitados al comercio.';
    }
  } catch (error) {
    console.error(error);
    txStatus.error = true;
    txStatus.text = 'Error al procesar MSI.';
  }
  if(txStatus.error){
    txStatus.code = 57;
  }
}


function validateAmount(merchant, { originalUrl, body, txStatus }) {
  if (!originalUrl.includes('/postauth')) {
    // 🚨 DEPRECATED: This service should use TransactionContext
    // parseFloat allows floats and bypasses strict cents-only validation
    // Use tx.service.pro.js with TransactionContext instead
    console.warn('[tx.service.js] ⚠️  LEGACY VALIDATION - Use TransactionContext in tx.service.pro.js');
    const amount = Number.parseFloat(body.amount);
    const min = Number.parseFloat(merchant.min);
    const max = Number.parseFloat(merchant.max);

    if ((min && min > amount) || (max && max < amount)) {
      txStatus.error = true;
      txStatus.text = 'Monto fuera de rango.';
      txStatus.code = "61";
    } else {
      txStatus = {};
    }
  }
}

async function recoverIsoAddressData( idDireccion ){

  return await pool.query(
    `  select  dd.*,
          		 c.id_country ,
          		 c.name countryuName,
          		 c.alpha_2_code country2code,
          		 c.alpha_3_code country3code,
          		 c.numeric_code countryNumericCode,
          		 e.id_state ,
          		 e.name stateName,
          		 e.alpha_2_code state2code,
          		 e.alpha_3_code state3code
    from datos_direccion dd
    left join ciso_country c on c.id_country  = dd.id_country
    left join ciso_state e on e.id_state  = dd.id_state
    where dd.id =  ${idDireccion}`
 );

}

output.hasTimeout = function () {
  return hastimeOut;
}

output.setTimeout = function (newValue)  {
  hastimeOut = newValue;
}
//////
module.exports = output;
