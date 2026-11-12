// This module exports an object 'output' that handles parsing JSON to ISO for transaction processing.
// It processes incoming requests, validates data, routes to appropriate upstream processors, and handles responses.
// The code is part of a payment gateway system dealing with ISO 8583 messages for credit/debit card transactions.
// It includes validation for references, BIN info, amounts, MSI (Months Without Interest), and prepares ISO messages.
// Routing selects the upstream based on token type (tknQ2), processor ID, and operation ID.
// Potential issues/alerts:
// - Security: Decrypting track2 data with 3DES using a global key (global.mk) – ensure key management is secure; potential vulnerability if key is compromised.
// - Hardcoding: Many hardcoded values like hexFields [52,55], response codes ('94', 'M2', etc.) – consider extracting to constants for maintainability.
// - Error Handling: Some catches are present, but not all paths have comprehensive error logging; e.g., routing failures could be more robust.
// - Validation: MSI validation assumes merchant.MSI is JSON-parsable array; no check for parse errors beyond catch.
// - International BIN handling: getBinDataInfoInt assumes broad categories based on first digit; may not cover all edge cases accurately.
// - Timeout Handling: hasTimeout is a global flag; could lead to race conditions in concurrent requests.
// - Dependencies: Relies on external modules like Translator, helpers, etc.; ensure they are properly imported and error-free.
// - No changes to logic as per instructions.

// const app = require("express")(); // This line is commented out or unused; appears to be a remnant. Alert: Unnecessary if not using Express app here.
const pool = require("../database"); // Database pool for queries.
var helpers = require('../../../helpers/lib/helpers'); // Helper functions for various utilities.
const Translator = require("../../../Translator"); // ISO <-> JSON translator class.
const { rechazarTx, jsonRechazo } = require('../lib/txHelpers'); // Transaction rejection helpers.
const db = require("../sequelize/init"); // Sequelize DB instance.
const { v4: uuidv4 } = require('uuid'); // UUID generator.
const helpersSec = require('../../lib/lib/helpers'); // Secure helpers, likely for encryption/decryption.
const _ = require('lodash'); // Lodash for utility functions.
let output = {}; // The exported object.
var hexFields = [52, 55]; // Fields that are handled as hex in ISO messages.
var hastimeOut = false; // Global timeout flag; alert: potential concurrency issue.
output.parserJsonIso = async (req, res, msgType, typeTran, tknQ2, dftCpt, id_operation) => {
  // Clones the original body to preserve it.
  req.originalBody = _.cloneDeep(req.body);
  // Flag to control flow; not used extensively.
  this.noMore = false;
  // Generates a unique GUID for the transaction.
  var guid = uuidv4();
  // Reference to 'this' for nested scopes.
  var parent = this;
  // Regex for numeric validation.
  var onlyNumbers = /^[0-9]+$/;
  // Extracts reference number from params if numeric.
  var refnum = (req.params.id && req.params.id.match(onlyNumbers)) ? req.params.id : "";
  // Extracts last4 digits from card info if present.
  var last4 = req.body.cardInformation ? req.body.cardInformation.last4 : "";
  // Initializes variables for BIN data, reverse code, node dest, etc.
  var binDataInfo = '';
  var reverseCode = req.body.reverseCode;
  var node_dest = '';
  let checkOutData = '';
  // Recovers ISO address data from DB using merchant's address ID.
  const addresses = await recoverIsoAddressData( req.merchantData.id_direccion ) ;
  // Attaches the first address to the body.
  req.body.isoAddress = addresses[0];
  // Logs reference validation start.
  dd('Reference validation....');
  // Checks if reference already exists; if so, rejects with code '94'.
  if( !refnum && await helpers.getMessageByReference(req.body.reference, req.merchantData.afiliation_number, req.body.device?.serial)){
      // Prepares data object for rejection.
      const dataObject = { guid, id_operation, msgType, typeTran, tknQ2, dftCpt, binDataInfo, checkOutData, reverseCode, node_dest }
      // Rejects the transaction.
      return await rechazarTx(req, dataObject, res, '94');
  }
  // Logs successful validation.
  dd('Reference validated.');

  // 🔴 CRITICAL: Detect reversal operations for proper message type handling
  const msgTypeStr = String(msgType).padStart(4, '0');
  const isReversal = (msgTypeStr === '0220' || msgTypeStr === '0230' || msgTypeStr === '0420') || 
                     [6, 7, 16].includes(id_operation); // Include operation IDs: cancel(6), refund(7), reverse(16)

  // Handles BIN operation if refnum present.
  if (refnum) {
    dd('ES UNA OPERACION DE BIN')
    // Initializes cardInformation if not present.
    req.body.cardInformation = {}
    try{
      // Fetches BIN info from helpers.
      checkOutData = await helpers.getBinInfo(refnum, req.merchantData.afiliation_number, req.body.device?.serial);
      // Sets track2 from fetched data.
      req.body.tk2 = checkOutData.card_info.track2;
      // Populates cardInformation with fetched details.
      req.body.cardInformation = {
        card_number: checkOutData.card_info.card_number,
        bin: checkOutData.card_info.bin,
        last4: checkOutData.card_info.last4,
        expiration_year: checkOutData.card_info.expiration_year,
        expiration_month: checkOutData.card_info.expiration_month
      }
      // Updates last4.
      last4 = checkOutData.card_info.last4;
      dd('===========================');
    }catch(err) {
      // Logs error stack.
      dd(err.stack, 'error');
      // Prepares data for rejection.
      const dataObject = { guid, id_operation, msgType, typeTran, tknQ2, dftCpt, binDataInfo, checkOutData, reverseCode, node_dest }
      // Rejects with code 'M2'.
      return await rechazarTx(req, dataObject, res, 'M2');
    }
  }
  // Processes track2 if present in cardInformation.
  if (req.body.cardInformation !== null && req.body.cardInformation !== undefined) {
    if (req.body.cardInformation.track2 !== undefined && req.body.cardInformation.track2 !== null) {
      // Decrypts track2 using 3DES with global.mk key, pads, and replaces characters.
      const track2_under_local_key = helpers.padRight((await helpersSec.decrypt3des(req.body.cardInformation.track2, global.mk)), 48, ' ').replace(/f/g, ' ').replace(/d/g, '=');
      // Sets tk2 to decrypted value.
      req.body.tk2 = track2_under_local_key;
      // Extracts card number from track2.
      req.body.cardInformation.card_number = track2_under_local_key.split('=')[0];
    }
  }
  // Processes BIN data if cardInformation present.
  if (req.body.cardInformation) {
    // Extracts first 8 digits as BIN.
    let bin = String(req.body.cardInformation.card_number).slice(0,8);
    // Finds matching BIN object; falls back to 6 digits if not found.
    let binObject = binData.find(binInfo => binInfo.bin === bin);
    if(!binObject){
      bin = bin.slice(0,6);
      binObject = binData.find(binInfo => binInfo.bin === bin);
    }
    // Sets binDataInfo; uses international fallback if not found. Alert: binData is undefined here; assuming it's global or required elsewhere.
    binDataInfo = binObject ? binObject : getBinDataInfoInt(req.body.cardInformation.bin);
  }
 
  // Initializes raw ISO response.
  var data_res_iso_raw = '';
  // Sets device from body or empty object.
  var device = req.body.device ? req.body.device : {};
  // Determines processor ID, preferring BIN over merchant.
  var id_processor = binDataInfo.id_processor ? binDataInfo.id_processor : req.merchantData.id_processor;
  // Determines FIID similarly.
  var fiid = binDataInfo.id_processor ? binDataInfo.processor : req.merchantData.procesador.fiid;
 
  // Initializes txStatus.
  req.txStatus = {};
 
  // Validates MSI if chargePlan with months present.
  if (req.body.chargePlan && req.body.chargePlan.months)
    validateMSI(req.merchantData, req);
  else
    // Otherwise validates amount.
    validateAmount(req.merchantData, req);
 
  // Rejects if validation error.
  if (req.txStatus.error) {
    const dataObject = { guid, id_operation, msgType, typeTran, tknQ2, dftCpt, binDataInfo, checkOutData, reverseCode, node_dest }
    return await rechazarTx(req, dataObject, res, req.txStatus.code);
  }
  // Routes to upstream based on params.
  var upstream = routing(tknQ2, {id_processor, fiid}, id_operation, req.dataInit);
  // Defines method to send JSON response.
  req.sendJsonReponse = async function(jsonObject, code){
    let stringifiedData = typeof jsonObject == 'string' ? jsonObject : JSON.stringify(jsonObject, null, 3);
    // delete req.session.dataInit; // Commented out; alert: potential session cleanup, but unused here.
    // Sets response headers.
    res.writeHead(code, {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(stringifiedData, 'utf8'),
    });
    // Logs response URL.
    dd(("Response: " + req.protocol + "://" + req.get("host") + req.originalUrl).yellow);
    // Logs JSON response verbosely.
    dd(("\n\nJSON Response: \n================================================================================================\n"
      + stringifiedData
      + "\n================================================================================================\n"), 'verbose');
    // Writes response.
    res.write(stringifiedData);
  };
  // Method to send reply to client.
  req.sendReply = async function (data_res_iso, code, errors) {
    // Handles errors param.
    if (!errors)
      errors = [];
    else
      if (!Array.isArray(errors)) errors = [errors];
    // Defaults code to 200.
    if (!code) code = 200;
    // Processes if not raw mode.
    if (!req.isRawMode) {
      // Prepares dataSend object.
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
      // If ISO response present.
      if (data_res_iso) {
       
        // Translates ISO to JSON using Translator.
        var jsonAggregator = new Translator.isoToJson(data_res_iso, req.originalUrl, binDataInfo, respCodeData, guid);
        // Stringifies JSON. Alert: respCodeData undefined; assuming global.
        data_res_json = JSON.stringify(jsonAggregator.getJsonDestTran(req.body.reference), null, 4);
        // dataSend.name_merchant = headers['commerce-name'].split(',')[0]; // Commented; using merchantData instead.
        // Sets terminal ID from ISO.
        dataSend.terminal_id = data_res_iso[41];
        // Extracts original reference.
        dataSend.reference_number_ant = data_res_iso[90] ? data_res_iso[90].substr(4, 16) : null;
        // Overrides for specific tran types.
        if(typeTran === "20" || typeTran === "02"){
          dataSend.reference_number_ant = req.params.id ? req.params.id : null;
        }
        // Overrides auth for certain msgTypes.
        if(msgType === 220 || msgType == 420){
          data_res_iso[38] = data_req_iso_de.getFields()[38];
        }
        // Sets data125 based on BIN type; defaults to '00', 'C0' for credit, 'P0' for debit.
        // dataSend.data125 = data_res_iso[125]; //Con esto se obtine el campo de la respuesta, pero hace falta el catálogo para realizar un match correcto
        dataSend.data125 = '00';
        if(binDataInfo.type == "CREDITO" || binDataInfo.type == "CRÉDITO"){
          dataSend.data125 = 'C0';
        }else if(binDataInfo.type == "DEBITO" || binDataInfo.type == "DÉBITO"){
          dataSend.data125 = 'P0';
        }
        // Checks response code; generates error if not '00'.
        const resp_code = data_res_iso[39];
        if (resp_code != '00')
          generateErrorMsg({ resp_code: resp_code, trace_number: data_res_iso[11] })
        // Saves ISO message to DB.
        await helpers.saveIsoMessage(id_operation, parseInt(data_res_iso[0]), data_res_iso[11], data_res_iso[37], data_res_iso[4],
          data_res_iso[39], data_res_iso[38], binDataInfo.bin, last4, dftCpt, data_res_iso[22], reverseCode, data_res_iso[13], data_res_iso[12],
          data_res_iso[17], data_req_iso_de.fields[63], data_res_iso[63], data_req_iso_de.fields[43], node_dest, dataSend, data_req_iso_de.fields[35] );
      }
      else {
        // Prepares autoReverseInfo if no ISO response.
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
            console.log('[tx.service.ninja.js] 🔧 Converted amount from dollars to cents:', {
                original: data_req_iso_de.fields[4],
                converted: amountForStorage
            });
        }
        
        // Generates rejection JSON; '91' for timeout, else '06'.
        const data_res = jsonRechazo(null, guid, data_req_iso_de.fields[11], errors[0].includes("timeout") ? '91':'06', req.body.reference);
        // Saves rejection to DB.
        await helpers.saveIsoMessage(id_operation, errorMsgType, data_req_iso_de.fields[11], data_req_iso_de.fields[37], amountForStorage,
        data_res.resp_code, '', binDataInfo.bin, last4, dftCpt, data_req_iso_de.fields[22], reverseCode, data_req_iso_de.fields[13], data_req_iso_de.fields[12],
        data_req_iso_de.fields[17], data_req_iso_de.fields[63], '', data_req_iso_de.fields[43], node_dest, dataSend);
        // Stringifies rejection.
        data_res_json = JSON.stringify(data_res);
      }
      // Appends newline.
      data_res_json += "\n";
    }
    // Sends the JSON response.
    req.sendJsonReponse(data_res_json, code);
  };
  // Method triggered by client host to reply.
  req.reply = async function (p, data_qe, rq, node) {
    // Handles raw mode for ISO.
    if (this.isRawMode)
      var data_res_iso = p.getRawMessage().toString("hex");
    else {
      // Prepares outgoing data.
      var data_res_iso = prepareObjectDataOut(p.getFields());
      // Sets raw ISO.
      data_res_iso_raw = p.rawData.toString().toUpperCase();
      // Sets node dest.
      node_dest = node;
    }
    // Extracts original reference from ISO.
    // SE BUSCA EL NUMERO DE REF ANTERIOR
    const reference_number_ant = (data_res_iso[90]) ? data_res_iso[90].substr(4, 12) : null;
    // Fetches original tx if reference present and sets auth if missing.
    if (reference_number_ant) {
      const originTx = await db.isoMessage.findOne({ where: { reference_number: reference_number_ant } });
      if (!data_res_iso[38] && originTx)
        data_res_iso[38] = originTx.authorization;
    }
    //
    // Sends reply.
    await this.sendReply(data_res_iso);
    return true;
  };
  // Handles queue timeout.
  req.queueTimeout = function () {
    dd(`Client ${req.originalUrl} gateway timeout`);
    // Sets timeout state. Alert: req.timeoutState undefined; assuming set elsewhere.
    req.timeoutState.hasTimedOut = true;
    // Sends timeout reply.
    this.sendReply("", 504, "Gateway timeout");
  };
  // Ends client connection.
  req.end = function () {
    req.client.end();
  };
  // Checks if request closed.
  req.isClosed = function () {
    return !this.client.writable;
  };
  // Preserves original card num and CVV.
  var org_crd_num = "";
  var org_cvv = "";
  org_crd_num = (req.body.cardInformation) ? req.body.cardInformation.card_number : "";
  org_cvv = (req.body.cardInformation) ? req.body.cardInformation.cvv : "";
  // Logs request URL.
  dd(("Request: " + req.protocol + "://" + req.get("host") + req.originalUrl).yellow);
  // Logs JSON request verbosely with safe logging.
  dd(("\n\nJSON Request: \n================================================================================================\n"
    + JSON.stringify(req.headers, null, 4) + "\n"
    + JSON.stringify(helpers.safeLog(req.body), null, 4)
    + "\n================================================================================================\n"), 'verbose');
  // Restores original card num and CVV if present.
  if (req.body.cardInformation) req.body.cardInformation.card_number = org_crd_num;
  if (req.body.cardInformation) req.body.cardInformation.cvv = org_cvv;
  // Checks for content-length header; rejects if missing.
  if (!req.headers.hasOwnProperty("content-length"))
    await req.sendReply("", 400, "Bad request");
  // Prepares incoming data; catches errors.
  try {
    var data_req_json = prepareObjectDataIn(req.body);
  } catch (ex) {
    // Sends bad request on error.
    await req.sendReply("", 400, [ex.toString()]);
    return;
  }
  // Processes headers if present.
  if (req.headers["commerce-id"] && req.headers["commerce-name"]) {
    // Extracts commerce details.
    var commerce_id = req.headers["commerce-id"];
    var commerce_name = req.headers["commerce-name"].toUpperCase();
    var system_fiid = req.headers["system-fiid"];
    var mcc = req.headers["mcc"];
    // Initializes error array.
    var errReturn = [];
    // Sets entry time.
    var entry_time = new Date();
    // Attaches req to JSON data.
    data_req_json.req = req;
    // Sets 3DS information from locals or body.
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
    // Modifies affiliation for payment link if applicable.
    // MODIFICA LA AFILIACION SI VIENE DE LINK DE PAGO
    if (req.body.link_pago && req.merchantData.afiliation_link) {
      commerce_id = req.merchantData.afiliation_link;
      req.headers["commerce-id"] = commerce_id;
      req.merchantData.id_bnrg_channel = req.merchantData.id_medio_link;
    }
   
    // Re-attaches req.
    data_req_json.req = req;
    // Creates ISO aggregator from JSON.
    var isoAggregator = new Translator.jsonToIso(data_req_json, commerce_id, commerce_name, system_fiid, mcc, msgType, typeTran, binDataInfo, checkOutData, tknQ2, dftCpt);
    // Gets ISO request DE.
    var data_req_iso_de = isoAggregator.getISOReqTranDE();
    // Gets raw ISO dest tran.
    var data_req_iso_raw = isoAggregator.getISODestTran(); //Utilizar isoAggregator.destpacket
    // Defaults error JSON.
    var data_res_json = JSON.stringify({ errors: ["Client has gone"] });
    // Handles if upstream is string (API mode).
    if ('string' === typeof upstream) {
      console.log("UPSTREAM IS STRING (BR)");
      // Requires specific API module.
      const api = require(`./../extras/${upstream}`);
      // Prepares ref and limits.
      const ref = `Request: ${req.protocol}://${req.get("host")}${req.originalUrl}`;
      const limitAmount = [req.merchantData.min, req.merchantData.max]
      // Calls API with params.
      const result = await api(guid, req.merchantData.apiKey, req.merchantData.url_merchant, req.body, binDataInfo, ref, limitAmount)
      // If OK, processes response.
      if (result.ok) {
        // Requires ISO message module.
        const isoMSG = require(`./../extras/iso8583_${upstream}`);
        // Prepares dataSend.
        const dataSend = {
          name_merchant: req.merchantData.id_merchant, terminal_id: '', reference_number_ant: null, data125: null, device,
          folio: req.body.reference, body: req.body, merchant_data: req.merchantData
        }
        // Sets from ISO DE.
        dataSend.terminal_id = data_req_iso_de[41];
        dataSend.reference_number_ant = data_req_iso_de[90] ? data_req_iso_de[90].substr(4, 16) : null;
        dataSend.data125 = data_req_iso_de[125];
        // Creates new message.
        const newMsg = isoMSG(req.body, result.dataRes, id_operation, msgType, data_req_iso_de, node_dest, dftCpt);
        // Saves to DB.
        await helpers.saveIsoMessage(newMsg[0], newMsg[1], newMsg[2], newMsg[3], newMsg[4], newMsg[5], newMsg[6], newMsg[7], newMsg[8], newMsg[9], newMsg[10], newMsg[11], newMsg[12], newMsg[13], newMsg[14], newMsg[15], newMsg[16], newMsg[17], newMsg[18], dataSend);
        // Sets exit time and logs API.
        var exit_time = new Date();
        helpers.saveIsoApiLog(guid, req.originalUrl, req.method, data_req_json, JSON.stringify(result.out), entry_time.toISOString(), exit_time.toISOString());
      }
      // Sends response.
      return res.status(result.ok ? 200 : 400).json(result.out);
    }
    else {
        // Logs sending to queue.
        console.log('++++++++++++++++++++ sending data to QUEUE');
        // Sends data to upstream; rejects on failure.
        // Detection of payload sending to switch/authorizer:
        // Here is where the payload (data_req_iso_raw, which is the prepared ISO 8583 message) is sent to the switch/authorizer.
        // How: By calling upstream.sendData(req, data_req_iso_raw, null, errReturn, req), where upstream is a client object (e.g., tcpClient1Prosa) selected by routing.
        // Why: To forward the transaction request to the external payment processor/authorizer (e.g., PROSA, AMEX) for approval/processing.
        // Where: To the specific upstream client, which could be a TCP/TLS/HTTP connection to the processor's endpoint, as defined in dataInit (e.g., dataInit.tcpClient1Prosa).
        // This is the key point where the message leaves the system towards the authorizer.
        if (!upstream?.sendData(req, data_req_iso_raw, null, errReturn, req)) {
          await req.sendReply("", 500, !errReturn.length ? "Failed to queue message" : errReturn);
        }
    }
  }
  // Event listener for client close; logs and saves API log.
  // 'Close' event is triggered on connection close
  req.client.on("close", function () {
    var exit_time = new Date();
    console.log(' ======================== Entra en close =======================');
    dd((`Client ${req.originalUrl} <close> event`).yellow);
    data_req_json.headers = req.headers;
    helpers.saveIsoApiLog(guid, req.originalUrl, req.method, data_req_json, data_res_json, entry_time.toISOString(), exit_time.toISOString());
    // Notifies upstream if queued.
    if (req.queueMessageId)
      upstream.hasGone(req.queueMessageId);
  });
  // Error listeners.
  // 'Error' event is triggered on req errors
  req.on("error", err => dd("Client <error> " + err));
  res.on("error", err => dd("Client res <error> " + err));
  req.client.on("error", err => dd("Client socket <error> " + err));
  // Timeout listeners.
  // 'Timeout' event is triggered on req timeout
  req.on("timeout", function () {
    this.sendReply("", 408, "Request timeout");
  });
  // 'Timeout' event is triggered on req timeout
  res.on("timeout", () => req.sendReply("", 504, "Gateway timeout"));
  // Denies if noMore flag set.
  // If deny mode is on
  if (parent.noMore)
    req.sendReply("", 503, "Service Temporarily Unavailable");
  return false;
}
// Prepares incoming data by converting hex fields to Buffers.
function prepareObjectDataIn(data_req) {
  for (var i in hexFields) {
    if (data_req.hasOwnProperty(hexFields[i]))
      data_req[hexFields[i]] = Buffer.from(data_req[hexFields[i]], "hex");
  }
  return data_req;
}
// Prepares outgoing data by converting Buffers to hex strings.
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
  // Generates a random hex string part for GUID; unused in visible code.
  return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
}
//
function routing(tknQ2, processor, id_operation, dataInit) {
  // Extracts processor details.
  let {id_processor, fiid} = processor;
 
  // Routes based on tknQ2, id_processor, fiid, id_operation.
  try {
    let upstream = {};
    
    dd('+++++++ seleccionando upstream');
    // Logs for specific combinations; redundant with assignments below.
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
    // Assigns upstream from dataInit based on conditions.
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
    // Special case for operation 3 with certain FIIDs.
    if(id_operation == 3 && (['MBBL'].includes(fiid)) ) {
      upstream = dataInit.tcpClient1Prosa;
      dd('dataInit.tcpClient1' + fiid);
    }
    // If no upstream object, sets string for API.
    if (0 === Object.keys(upstream).length) {
      if (tknQ2 === '09' && id_processor === 5)
        upstream = 'api_banorte';
      if (tknQ2 === '09' && id_processor === 6)
        upstream = 'api_PayCIPS';
    }
    return upstream;
  } catch (err) {
    // Logs error.
    dd(err.stack, 'error');
    return undefined;
  }
}
//
function getBinDataInfoInt(bin) {
  // Determines international BIN info based on first digit.
  let binDataInfo = bin ? { "id_bin": 0, "id_processor": null, "processor": "Definido por comercio", "bin": bin, "bank": "INTERNACIONAL", "product": "INTERNACIONAL", "type": "GENERAL", "brand": "GENERAL" } : {};
  if (bin.substring(0, 1) === '3') binDataInfo = { "id_bin": 0, "id_processor": null, "processor": "Definido por comercio", "bin": bin, "bank": "INTERNACIONAL", "product": "INTERNACIONAL", "type": "GENERAL", "brand": "AMEX" };
  if (bin.substring(0, 1) === '4') binDataInfo = { "id_bin": 0, "id_processor": null, "processor": "Definido por comercio", "bin": bin, "bank": "INTERNACIONAL", "product": "INTERNACIONAL", "type": "GENERAL", "brand": "VISA" };
  if (bin.substring(0, 1) === '5' || bin.substring(0, 1) === '6') binDataInfo = { "id_bin": 0, "id_processor": null, "processor": "Definido por comercio", "bin": bin, "bank": "INTERNACIONAL", "product": "INTERNACIONAL", "type": "GENERAL", "brand": "MASTERCARD" };
  return binDataInfo;
}
// Validates MSI plans.
function validateMSI(merchant, { body, txStatus }) {
  dd('Valida MSI');
  try {
    // Parses MSI from merchant.
    const msi = JSON.parse(merchant.MSI || '[]');
    // Checks if array and non-empty.
    if (Array.isArray(msi) && msi.length > 0) {
      // Handles object plans.
      if (typeof msi[0] === 'object') {
        // Finds matching plan.
        const selectedMSI = msi.find(plan => parseInt(plan.type) === parseInt(body.chargePlan.months));
        if (selectedMSI) {
          // Checks min amount.
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
    // Catches parse/error.
    console.error(error);
    txStatus.error = true;
    txStatus.text = 'Error al procesar MSI.';
  }
  // Sets code if error.
  if(txStatus.error){
    txStatus.code = 57;
  }
}
// Validates transaction amount against merchant limits.
function validateAmount(merchant, { originalUrl, body, txStatus }) {
  // Skips for postauth.
  if (!originalUrl.includes('/postauth')) {
    // 🚨 DEPRECATED: This service should use TransactionContext
    // parseFloat allows floats and bypasses strict cents-only validation
    // Use tx.service.pro.js with TransactionContext instead
    console.warn('[tx.service.ninja.js] ⚠️  LEGACY VALIDATION - Use TransactionContext in tx.service.pro.js');
    const amount = Number.parseFloat(body.amount);
    const min = Number.parseFloat(merchant.min);
    const max = Number.parseFloat(merchant.max);
    // Checks range.
    if ((min && min > amount) || (max && max < amount)) {
      txStatus.error = true;
      txStatus.text = 'Monto fuera de rango.';
      txStatus.code = "61";
    } else {
      txStatus = {};
    }
  }
}
// Recovers address data from DB.
async function recoverIsoAddressData( idDireccion ){
  // Queries DB for address details with joins.
  return await pool.query(
    ` select dd.*,
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
    left join ciso_country c on c.id_country = dd.id_country
    left join ciso_state e on e.id_state = dd.id_state
    where dd.id = ${idDireccion}`
 );
}
// Getter for timeout.
output.hasTimeout = function () {
  return hastimeOut;
}
// Setter for timeout.
output.setTimeout = function (newValue) {
  hastimeOut = newValue;
}
//////
module.exports = output;
