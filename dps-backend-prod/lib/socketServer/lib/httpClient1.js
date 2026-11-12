/**
 * PCI DSS 4.0 Requirements Coverage:
 * 
 * 1.1 - Network Security Controls:
 * - HTTP client for Banregio API communication
 * - Connection via fetch/axios (lines 357, 430, 589)
 * 
 * 2.2.1 - Custom Software Development:
 * - Input validation via hex checking (lines 533-545)
 * - Parameter validation (lines 54-59)
 * - Error handling with fallback responses (lines 363-465)
 * 
 * 3.3 - End-User Access to Cardholder Data:
 * - Safe logging of card data (lines 519-531)
 * - CVV masking in logs (line 522)
 * - Track2 masking in logs (line 524)
 * - EMV tags safe logging (line 527)
 * 
 * 4.1 - Use Strong Cryptography:
 * - 3DES encryption for track2 (line 261)
 * - AES encryption for track2 (line 264)
 * - RSA decryption for transport key (line 337)
 * - CRC32 for integrity verification (lines 153, 388, 401)
 * - Security concern: Plaintext credentials in memory
 * 
 * 6.2.3 - Protect Remote Access:
 * - Merchant-specific URL configuration (line 419)
 * - Headers for authentication (lines 560-567)
 * 
 * 8.2.1 - Identification and Authentication:
 * - Commerce-id header (line 206, 562)
 * - X-auth header (line 563)
 * - X-time header (line 564)
 * 
 * 8.3.1 - Access Control:
 * - Merchant-specific configuration
 * - No role-based access control at this layer
 * 
 * 10.2.1 - Audit Trail:
 * - Request/response logging (lines 329-334, 346-351, 424-429, 434-439)
 * - Transaction type logging
 * - Error logging (lines 457-462)
 * 
 * 10.2.2 - Audit Log Retention:
 * - Logs sent to console - retention depends on log management
 * 
 * 10.2.3 - Audit Trail Review:
 * - All API calls logged with headers and responses
 * - Error conditions logged
 * 
 * 11.3.1 - Periodic Testing:
 * - No built-in health checks
 * 
 * 12.3.1 - Vulnerability Management:
 * - Fetch/axios libraries - ensure regular updates
 * - Input validation for hex strings
 * - Error handling prevents information disclosure
 */

// Import required modules for ISO8583 processing and HTTP communication
var iso8583 = require("../../../lib/iso8583");
var iso8583Queue = require("../../../lib/iso8583-queue");
var helpers = require("../../../lib/helpers");
var iso8583Packet = require("../../../lib/iso8583-packet");
var EventEmitter = require("events").EventEmitter;
const fetch = require('node-fetch');  // HTTP client for API requests
const { URLSearchParams } = require("url");  // URL parameter handling
const Translator = require("../../Translator/index.js");  // Data transformation
const helpersSec = require("../lib/lib/helpers");  // Security helper functions
//const cybersource = require('../lib/services/cybersecure.service');
const axios = require('axios').default;  // Alternative HTTP client
const regex = /[^A-Fa-f0-9]/g;  // Regex for hex validation
const { hasTimeout, setTimeout } = require("../../socketServer/lib/services/tx.service");  // Timeout management

// Global variables for tracking state
var flags = {};
var queue = null;
var lastMsg = new Date();
var rq = "";
var node = "";
var reqHttp = {};

var REQ = null;

// ISOClient constructor - creates an HTTP client for Banregio API integration
// options: configuration object containing queue and timeout settings
function ISOClient(options) {
  // Load Banregio-specific logic for ISO8583 processing
  var httpBnrgLogic = require("../../iso8583/lib/logic/BANREGIO.js");
  this.logic = new httpBnrgLogic(this);

  // Initialize the ISO8583 message queue
  queue = new iso8583Queue(options);
  queue.parent = this;
  options.queue = queue;

  // Initialize statistics server if configured
  if (options.statServerPort1) {
    var iso8583StatServer = require("../../../lib/iso8583-statserver");
    this.statServer = new iso8583StatServer(options.statServerPort1);
  }

  // Notifies the ISOClient queue that a client has disconnected
  this.hasGone = function (queueMessageId) {
    var qe = queue.confirm(queueMessageId);

    // Client queue item exists - handle the disconnection
    if (qe) {
      dd((`Warning: client ${qe.senderName} [queue id ${queueMessageId}] terminated activity`).yellow);
      // Trigger auto-reversal for pending transactions if enabled
      if (!global.c.noAutoReversal)
        this.logic.hasGone(qe, node);
    // Client queue item does not exist - log warning
    }
    else
      dd((`Client with queue id ${queueMessageId} terminated activity. No queue item was found`).yellow);
    processQueue(options);
  };

  // Adds data to the queue for HTTP processing
  this.sendData = function (sender, data, params, errReturn, req = {}) {

    dd('**************************+Sending data in httpClient1 ');

    // Initialize params if not provided
    if (!params) params = {};

    lastMsg = new Date();
    reqHttp = sender;
    REQ = req;

    try {
      // Add the message to the queue
      var item = queue.addMessage(sender, data, params, errReturn);
      if (!item) return false;
      dd(`New queue item ${item["id"]}`);

      // Associate the queue message ID with the sender for tracking
      if (!sender.hasOwnProperty("queueMessageId") || !sender.queueMessageId || params.hasOwnProperty("updateQueueMessageId")) sender.queueMessageId = item["id"];
    } catch (ex) {
      dd(("Error adding message to queue: " + ex + "\n" + ex.stack).red);
      sender.end();
    }

    // Pass the packet through the statistics server if configured
    if (this.statServer) this.statServer.process(item.packet);

    // Process the queue immediately or after a delay if specified
    if (params.hasOwnProperty("delayTime") && params.delayTime) {
      setTimeout(
        function () {
          this.processQueue({ queue: options.queue }, sender);
        }.bind(this),
        params.delayTime
      );
    } else {
      processQueue(options, sender);
    }

    return true;
  };

  // Event listener for termination signal - graceful shutdown
  this.on(
    "terminate",
    function () {
      if (queue.isEmpty()) {
        dd("Warning: quitting...");
        global.flushAndQuit();
      } else {
        dd("Waiting for the queue to empty");

        this.on("emptyQueue", function () {
          dd("Warning: quitting...");
          global.flushAndQuit();
        });
      }
    }.bind(this)
  );
}

// Queue processor - handles ISO8583 messages and converts them to Banregio API requests
processQueue = async function (options, Req = null) {
  var countPending = queue.getPendingCount();
  var countTotal = queue.getCount();
  reqHttp = (Req) ? Req : reqHttp;
  queue = (options.queue) ? options.queue : queue;
  // dd("**  A-01 Se procesa con el req:[ " + JSON.stringify(reqHttp) + ' ]');
  // dd("**  A-02 Se procesa con el queue:[ " + JSON.stringify(queue) + ' ]');
  dd("Processing queue [pending " + countPending + " / total " + countTotal + "]");
  if (countTotal > 0)
    dd("Queue keys dump: " + queue.getKeys().join(), "verbose");

  if (!countTotal) {
    dd("The queue is empty");
    return;
  }

  var messages = queue.fetchToProcess();
  
  if (messages.length == 0) { dd("The queue is empty"); return; }

  // Use application buffering with Nagle disabled for performance
  var buf = [];

  // Process each message in the queue
  for (var i in messages) {
    var message = messages[i];
    if (message.comment) dd(message.comment);
    dd("Upstreaming data for " + message.senderName);

    // Log the message content safely
    if (global.c["dangerous"]) {
      dd("[" + helpers.safeLog(message.packet.getRawMessage({ header: global.c["useHeader"], }), ["isoMessage"]) + "]", "verbose");
      dd("[" + helpers.safeLog(message.packet.getRawMessage({ header: global.c["useHeader"], }), ["hex"]) + "]", "verbose");
    } else {
      dd("[" + helpers.safeLog(message.packet.getRawMessage({ header: global.c["useHeader"], }), ["isoMessage"]).substring(0, 14) + "...]", "verbose");
    }

    buf.push(message.packet.getRawMessage({ header: global.c["useHeader"], }));
  }

  // Initialize URL parameters for Banregio API
  const params = new URLSearchParams();
  // Generate random hex string for key encryption
  const ran_str_hex = await helpers.randomStringHex().toUpperCase();
  // Calculate CRC32 for integrity verification
  const crc32_ran_str = await helpersSec.calcCrc32(ran_str_hex);

  // Determine transaction type based on ISO8583 message type
  if (message && (message.packet.messageTypeId == "0200" || message.packet.messageTypeId == "0220")) {
    if (reqHttp.body.entry_mode) var BNRG_MODO_ENTRADA = reqHttp.body.entry_mode.toUpperCase();
    const draftCapture = message.packet.fields[125].substring(10, 12);

    // Sale transaction (00)
    if (message.packet.fields[3].substring(0, 2) == "00") {
      var BNRG_CMD_TRANS = "VENTA"
        + ((reqHttp.body.chargePlan) ? "_PROMO" : "")
        + ((message.packet.messageTypeId == "0220") ? "_FORZADA" : "");
      if (reqHttp.body.amount) params.append("BNRG_MONTO_TRANS", reqHttp.body.amount);
    }

    // Pre-authorization transaction
    if (draftCapture == "00") {
      var BNRG_CMD_TRANS = "PREAUTORIZACION";
    }

    // Cancellation transaction (02)
    if (message.packet.fields[3].substring(0, 2) == "02") {
      var BNRG_CMD_TRANS = "CANCELACION";
    }

    // Refund transaction (20)
    if (message.packet.fields[3].substring(0, 2) == "20") {
      var BNRG_CMD_TRANS = "DEVOLUCION";
      if (reqHttp.body.amount) params.append("BNRG_MONTO_TRANS", reqHttp.body.amount);
    }
    // Post-authorization transaction
    if (reqHttp.originalUrl.includes('/postauth')) {
      var BNRG_CMD_TRANS = "POSTAUTORIZACION";
    }

    // Master key encryption initialization
    if (message.packet.fields[3] == "000000" && message.packet.fields[4] == "000000000000") {
      var BNRG_CMD_TRANS = "CIFRADO_LLAVE_MAESTRA";
      var local_random_key = ran_str_hex + await helpers.padRight(reqHttp.body.device.serial, 32, "0");
      params.append("BNRG_CRIPTOGRAMA", local_random_key + crc32_ran_str);
      // Validate serial number is hex
      if (checkHex(reqHttp.body.device.serial)) {
        local_random_key = ran_str_hex + await helpers.padRight(reqHttp.body.device.serial, 32, "0");
      } else {
        // Replace non-hex characters with 'F'
        const serialhex = reqHttp.body.device.serial.replace(regex, 'F');
        local_random_key = ran_str_hex + await helpers.padRight(serialhex, 32, "0");
      }
    }
  }

  // Reversal transaction (0420)
  if (message && message.packet.messageTypeId == "0420") {
    rq = Buffer.concat(buf);
    var BNRG_CMD_TRANS = "REVERSA";
    var BNRG_CAUSA_REV = "02";
  }

  // Set merchant affiliation parameters based on schema type
  switch (reqHttp.merchantData.id_esquema) {
    case 1: // Direct affiliation
      params.append("BNRG_ID_AFILIACION", reqHttp.headers["commerce-id"]); //Validar con Banregio
      break;
    case 2: // Sub-affiliation with ID
      params.append("BNRG_SUBAFILIACION_NOMBRE", reqHttp.merchantData.name_merchant);
      params.append("BNRG_SUBAFILIACION_ID", reqHttp.merchantData.afiliation_number); //Validar con Banregio
      break;
    case 3: // Sub-affiliation without ID
      params.append('BNRG_SUBAFILIACION_NOMBRE', reqHttp.merchantData.name_merchant); //Validar con Banregio
      break;
    case 4: // Sub-affiliation with entry mode
      params.append('BNRG_SUBAFILIACION_NOMBRE', reqHttp.merchantData.name_merchant); //Validar con Banregio
      // if(BNRG_MODO_ENTRADA && BNRG_MODO_ENTRADA == 'MANUAL'){
      //   params.append('BNRG_SUBAFILImerchantACION_NOMBRE',reqHttp.merchantData.name_merchant ); //Validar con Banregio
      // }
      break;
  }

  // Add transaction command
  params.append("BNRG_CMD_TRANS", BNRG_CMD_TRANS);
  // Add client reference for periodic transactions
  if(reqHttp.body.periodic && reqHttp.body.client_reference){
    params.append('BNRG_REF_CLIENTE2',reqHttp.body.client_reference);
  }
  params.append("BNRG_ID_MEDIO", reqHttp.merchantData.id_bnrg_channel);
  // params.append("BNRG_FOLIO", await helpers.randomString(12, 1)); // CAMBIO DE FOLIO A PETICION 
  if (reqHttp.originalUrl != '/gateway/v1/initKeys')
    params.append("BNRG_FOLIO", reqHttp.body.reference);

  // Add local date and time
  params.append("BNRG_HORA_LOCAL", await helpers.horaLocalBnrg());
  params.append("BNRG_FECHA_LOCAL", await helpers.fechaLocalBnrg());
  // Normalize entry mode name
  if (BNRG_MODO_ENTRADA && BNRG_MODO_ENTRADA == 'MAGNETIC_STRIPE') BNRG_MODO_ENTRADA = 'BANDA';
  if (BNRG_MODO_ENTRADA) params.append("BNRG_MODO_ENTRADA", BNRG_MODO_ENTRADA);
  if (BNRG_CAUSA_REV) params.append("BNRG_CAUSA_REV", BNRG_CAUSA_REV);
  if (reqHttp.params.id) params.append("BNRG_REF_TRANS_PREVIA", reqHttp.params.id);
  params.append("BNRG_MODO_TRANS", reqHttp.merchantData.modo_transac?.bnrg_modo_trans);
  
  // Handle card data for sale/pre-authorization transactions
  if (BNRG_CMD_TRANS == "VENTA" || BNRG_CMD_TRANS == "VENTA_PROMO" || BNRG_CMD_TRANS == "VENTA_FORZADA" || BNRG_CMD_TRANS == "PREAUTORIZACION") {
    // Manual entry mode - send card number, CVV, and expiration
    if (BNRG_MODO_ENTRADA == "MANUAL") {
      params.append("BNRG_NUMERO_TARJETA", reqHttp.body.cardInformation.card_number);
      if(!reqHttp.body.periodic){
        params.append("BNRG_CODIGO_SEGURIDAD", reqHttp.body.cardInformation.cvv);
      }
      params.append("BNRG_FECHA_EXP", reqHttp.body.cardInformation.expiration_month + reqHttp.body.cardInformation.expiration_year);
      // Add 3DS authentication data if present
      if (reqHttp.body.threeDSServerTransID != null || reqHttp.body.threeDSServerTransID != undefined) {
        params.append('BNRG_3DS_VERSION', 2);
        params.append('BNRG_3DS_PROTOCOLO', 'A');
        params.append('BNRG_3DS_DSXID', reqHttp.body.dsTransID);
        params.append('BNRG_3DS_UCAF', reqHttp.body.authenticationValue);
        params.append('BNRG_3DS_ECI', reqHttp.body.eci);
      }
    } else if (
      BNRG_MODO_ENTRADA == "BANDA" ||
      BNRG_MODO_ENTRADA == "FALLBACK" ||
      BNRG_MODO_ENTRADA == "CONTACTLESS_BANDA" ||
      BNRG_MODO_ENTRADA == "CHIP" ||
      BNRG_MODO_ENTRADA == "CONTACTLESS"
    ) {
      // Decrypt track2 using local master key
      var track2_under_local_key = helpers.padRight((await helpersSec.decrypt3des(reqHttp.body.cardInformation.track2, global.mk)), 48, ' ').replace(/f/g, ' ').replace(/d/g, '=');

      // Get Banregio key for this device and encrypt track2
      var bnrg_key_clear_mpos = await helpers.getBnrgKeyMk(reqHttp.body.device.serial);
      var track2_under_bnrg_kmk = bnrg_key_clear_mpos ? await helpersSec.encryptAES(track2_under_local_key, bnrg_key_clear_mpos) : '';
      track2_under_bnrg_kmk ? params.append("BNRG_TRACK2", track2_under_bnrg_kmk) : '';

      // Add track1 and CVV for Amex cards (bin starts with 3)
      if (
        reqHttp.body.cardInformation.track1 &&
        reqHttp.body.cardInformation.bin.substring(0, 1) == "3"
      ) {
        params.append("BNRG_TRACK1", reqHttp.body.cardInformation.track1);
        params.append("BNRG_CODIGO_SEGURIDAD", reqHttp.body.cardInformation.cvv);
      }
      // Add EMV tags if present
      if (reqHttp.body.cardInformation.emv_tags) params.append("BNRG_TAGS_EMV", reqHttp.body.cardInformation.emv_tags);
    }
  }

  // Add promotional payment plan parameters
  if (BNRG_CMD_TRANS == "VENTA_PROMO") {
    params.append("BNRG_PROMO_DIF", reqHttp.body.chargePlan.first_payment);
    params.append("BNRG_PROMO_MESES", reqHttp.body.chargePlan.months);
    params.append("BNRG_PROMO_PLAN", reqHttp.body.chargePlan.type);
  }
  //params.append('BNRG_SUBAFILIACION_NOMBRE',process.env.BNRG_SUBAFILIACION_NOMBRE); //Validar con Banregio

  // Add authorization code for forced sale
  if (BNRG_CMD_TRANS == "VENTA_FORZADA") params.append("BNRG_CODIGO_AUT", message.packet.fields[38]);

  // Helper function to log array elements with formatting
  function logArrayElements(element, index, log = false) {
    var title = index + " [" + element.length + "]";

    if (log)
      dd(("     " + title + Array(50 - title.length).join(".") + element), 'verbose');
    else
      dd(("     " + title + Array(50 - title.length).join(".") + element), 'verbose');

    return logArrayElements;
  }


  var msgIsoReq = message.packet.fields;
  var p = {};

  // Handle key initialization request
  if (reqHttp.originalUrl == '/gateway/v1/initKeys') {
    var device = {}, array_init_keys = [];
    const element_init_keys = new URLSearchParams();

    // Build request parameters from body
    for (var key in reqHttp.body) {
      if (reqHttp.body.hasOwnProperty(key)) {
        let value = reqHttp.body[key];

        if (key != 'device' && key != 'req') element_init_keys.append(key, value);
        array_init_keys.push(value, key);
        // Handle nested device object
        if (key == "device") {
          for (var key in reqHttp.body.device) {
            if (reqHttp.body.device.hasOwnProperty(key)) {
              let value = reqHttp.body.device[key];
              element_init_keys.append('device.' + key, value);
            }
          }
        }
      }
    }

    var obj3 = new logArrayHttpElements();
    obj3.add(element_init_keys);

    dd(("\n\nSend data to : Internal KMS"
      + "\nMethod         : " + reqHttp.method
      + "\nOrgUrl         : " + reqHttp.originalUrl
      + "\n================================================================================================"
      + obj3.str_values
      + "\n================================================================================================\n"), 'verbose');

    // Decrypt transport key using RSA private key
    var CiphertextBlob = Buffer.from(reqHttp.body.rsa, "hex").toString("base64");
    var transportKey = Buffer.from(await helpersSec.decryptStringWithRsaPrivateKey(CiphertextBlob, 'keys/private_mpos.pem'), "ascii").toString().toUpperCase();
    var urlDestinoKeys = reqHttp.merchantData.url_destino.url




    var obj4 = new logArrayHttpElements();
    obj4.add(params);

    dd(("\n\nSend data to : " + urlDestinoKeys
      + "\nMethod         : " + reqHttp.method
      + "\nOrgUrl         : " + JSON.stringify(reqHttp.originalUrl)
      + "\n================================================================================================"
      + obj4.str_values
      + "\n================================================================================================\n"), 'verbose');

    var bnrg_key_encr = "";
    var bnrg_crc_key_encr = "";

    try {
      // Send request to Banregio key management server
      await fetch(urlDestinoKeys, { method: 'POST', body: params }).then(
        (res) => {
          var obj5 = new logArrayHttpElements();
          obj5.add(res.headers);

          dd(("\n\nGot data from: " + res.url
            + "\nStatus: " + res.status
            + "\nText  : " + res.statusText
            + "\n================================================================================================"
            + obj5.str_values
            + "\n================================================================================================\n"), 'verbose');
          const isoInterface = new Translator.interfaceResponseToIso(res.headers, reqHttp, msgIsoReq);
          p = new iso8583Packet(isoInterface.destPacket);
          // Check if request was rejected
          if (res.headers.get('bnrg_codigo_rechazo'))
            transportKey = "";
          else {
            // Extract encrypted master key and CRC
            bnrg_key_encr = res.headers.get('bnrg_llave_maestra').substring(0, 64);
            bnrg_crc_key_encr = res.headers.get('bnrg_llave_maestra').substring(64, 72);
          }
        }
      );
    } catch (error) {
      dd((error), 'verbose');
    }

    // Validate transport key and encrypt master key
    if (transportKey) {
      var transportKeyKcv = await helpersSec.encrypt3des('0000000000000000', transportKey).substring(0, 6).toUpperCase();
      if (transportKeyKcv == reqHttp.body.check_value) {
        var mpos_tmk = global.mk;
        var mpos_tmk_Kcv = await helpersSec.encrypt3des('0000000000000000', mpos_tmk).substring(0, 6).toUpperCase();
        var mpos_tmk_enc = await helpersSec.encrypt3des(mpos_tmk, transportKey).substring(0, 32).toUpperCase();
        var mpos_tmk_crc32 = await helpersSec.calcCrc32(mpos_tmk_enc);

        var res = { mpos_tmk_enc, mpos_tmk_Kcv, mpos_tmk_crc32 };

        dd(("\n\nGot data from: Internal KMS"
          + "\n================================================================================================"
          + "\n     Device_Serial [20].............................." + reqHttp.body.device.serial
          + "\n     Device_Version [10]............................." + reqHttp.body.device.version
          + "\n     Encryted_TMK_Under_Transport_Key [32]..........." + mpos_tmk_enc
          + "\n     TMK_CheckValue [6].............................." + mpos_tmk_Kcv
          + "\n================================================================================================\n"), 'verbose');

        // Decrypt Banregio master key and verify CRC
        var bnrg_mk = await helpersSec.decryptAES(bnrg_key_encr, local_random_key);
        var crc32_bnrg_mk = await helpersSec.calcCrc32(bnrg_mk);
        if (bnrg_crc_key_encr == crc32_bnrg_mk) {
          helpers.saveKeysOp(bnrg_mk, reqHttp.merchantData.id_bnrg_channel, reqHttp.body.device.serial);
        }

      } else {
        dd(("Error de Inicialización! Terminal: " + reqHttp.body.device.serial).red);
        var res = {};
      }

    } else {
      dd(("Error No existe llave de transporte. Terminal: " + reqHttp.body.device.serial).red);
      var res = {};
    }
    var isoInterface = new Translator.interfaceResponseToIso(res, reqHttp, msgIsoReq);
    p = new iso8583Packet(isoInterface.destPacket);

  } else {
    // Handle regular transaction requests
    let urlDestino = reqHttp.merchantData.url_destino?.url ?? '';
    // TODO:: checar URL donde la esta generando y medio
    let dataBody = params;
    var obj = new logArrayHttpElements();
    obj.add(params);
    dd(("\n\nSend data to : " + urlDestino
      + "\nMethod       : " + reqHttp.method
      + "\nOrgUrl       : " + reqHttp.originalUrl
      + "\n================================================================================================"
      + obj.str_values
      + "\n================================================================================================\n"), 'verbose');
      // Send request to Banregio API
      await fetch(urlDestino, { method: "POST", body: dataBody }).then(
        (res) => {
          var obj2 = new logArrayHttpElements();
          obj2.add(res.headers);
          dd(("\n\nGot data from: " + res.url
            + "\nStatus: " + res.status
            + "\nText  : " + res.statusText
            + "\n================================================================================================"
            + obj2.str_values
            + "\n================================================================================================\n"), 'verbose');
          const isoInterface = new Translator.interfaceResponseToIso(res.headers, reqHttp, msgIsoReq);
          p = new iso8583Packet(isoInterface.destPacket);
          dd('hasTimeout 1: ' + reqHttp.timeoutState.hasTimedOut);
          // Handle timeout scenario - send reversal if transaction was approved
          if (reqHttp.timeoutState.hasTimedOut) {
            dd('hasTimeout 2: ' + reqHttp.timeoutState.hasTimedOut);
            reqHttp.timeoutState.hasTimedOut = false;
            if (res.headers.get('bnrg_codigo_emisor') && res.headers.get('bnrg_codigo_emisor') == '00') {
              dd('sending reversal')
              const reference = res.headers.get('bnrg_referencia');
              sendReverso(reqHttp,reference);
            } else {
              dd('not sending reversal')
              return;
            }

          }
        }
      ).catch(err => {
        dd('hasTimeout 3: ' + reqHttp.timeoutState.hasTimedOut);
        dd((`Error en la peticion ${urlDestino}`).yellow);
        dd(("================================================================================================"), 'verbose');
        dd((JSON.stringify(err)), 'verbose');
        dd(("================================================================================================\n"), 'verbose');
        // Create error response on request failure
        var isoInterface = new Translator.interfaceResponseToIso({}, reqHttp, msgIsoReq);
        p = new iso8583Packet(isoInterface.destPacket);
      });
  }

  var qe = null;
  if (!p.parseError) {
    var qe = queue.getActiveByPacket(p);
    const qe_aux = queue.getActiveSenders();
    // No active queue item found - log error
    if (!qe) {
      var lookupFieldsString = global.c["queueMessageKeyFields"].join(",");
      var message = "INTF_HTTPS_BANREGIO_1 error: ISO host sent data with no proper client connected (client lookup fields: " + lookupFieldsString + ")! Ignoring...";
      message += "\n\n" + "ISO host says" + p.pretty();
      dd(message.red);
      if (qe) {
        dropClient(qe.sender);
      } else {
        console.log('sin queue');
        return;
      }
    // Found item with dead sender - log error
    } else if (qe.sender.destroyed) {
      message = "INTF_HTTPS_BANREGIO_1 error: ISO host sent data for closed! Ignoring...";
      message += "\n\n" + "ISO host says" + p.pretty();
      dd(message.red);
    // Confirm queue message and send response
    } else {
      var cResult = queue.confirm(qe.id);
      if (!cResult)
        dd(`Warning: queue::confirm() failed to locate the queue message #${qe.id}`);
    }
    dd(`Parsed data for ${qe.senderName}`);
    dd("\n\n" + ` Header: ${p.rawData.toString().substring(0, 12)}` + "\n" + ` Host  : ${qe.senderName + p.pretty()}`, "verbose");
    await qe.sender.reply(p, qe, rq, node);
  }
  else {
    dd("ISO host: failed to parse ISO host iso8583 packet".red);
    dd(p.parseError, "verbose");
  }

  if (qe) dropClient(qe.sender);
};

// Drops a client connection - closes the connection
dropClient = function (client) {
  client.end();
};

// Constructor for logging HTTP elements with safe data masking
function logArrayHttpElements() {
  this.str_values = "";
}

// Add array elements to log with sensitive data masking
logArrayHttpElements.prototype.add = function (array) {
  array.forEach(function (value, index) {
    var title = index + " [" + value.length + "]";
    // Mask card number
    if (index == "BNRG_NUMERO_TARJETA")
      value = helpers.safeLog(value, ['number']);
    // Mask CVV
    if (index == "BNRG_CODIGO_SEGURIDAD")
      value = "***";
    // Mask track2 completely
    if(index == "BNRG_TRACK2") {
      value = "************************************************";
    }
    // Safe log EMV tags
    if(index == "BNRG_TAGS_EMV") {
      value = helpers.safeLog(value, ['emv_tags']);
    }
    this.str_values += '\n     ' + title + Array(50 - title.length).join('.') + value;
  }, this);
};

// Validate that a string contains only hexadecimal characters
function checkHex(s) {
  let n = s.length;
  for (let i = 0; i < n; i++) {
    let ch = s[i];

    if ((ch < '0' || ch > '9') &&
      (ch < 'A' || ch > 'F')) {
      return false;
    }
  }
  return true;
}

// Replace non-hex characters with 'F'
function changeNonHex(s) {
  let n = s.length;
  for (let i = 0; i < n; i++) {
    let ch = s[i];
    if ((ch < '0' || ch > '9') &&
      (ch < 'A' || ch > 'F')) {
      s[i] = 'F';
    }
  }
  return s;
}

// Send reversal transaction for timeout scenarios
async function sendReverso(reqHttp, reference) {
  const headers = {
    'commerce-name': reqHttp.headers['commerce-name'],
    'commerce-id': reqHttp.headers['commerce-id'],
    'x-auth': reqHttp.headers['x-auth'],
    'x-time': reqHttp.headers['x-time'],
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
  const body = {
    "isoType": "AGRS",
    "amount": reqHttp.body.amount,
    "reference": ('' + Date.now()).substring(0, 12),
    "cardInformation": {
      "holder_name": reqHttp.body.cardInformation.holder_name,
      "card_number": reqHttp.body.cardInformation.card_number,
      "last4": reqHttp.body.cardInformation.last4,
      "bin": reqHttp.body.cardInformation.bin,
      "expiration_year": reqHttp.body.cardInformation.expiration_year,
      "expiration_month": reqHttp.body.cardInformation.expiration_month
    },
    "entry_mode": "manual",
    "authentication": "unknown",
    "tpv": false,
    "periodic": false,
    'billingAddress': reqHttp.body.billingAddress,
    'email': reqHttp.body.email,
    'clientip': reqHttp.body.clientip,
    'draftCapture': "1"
  }
  await axios.post(reqHttp.protocol + '://'+ reqHttp.get('host')+ '/gateway/v1/ecommerce/reverse/' + reference, body,{headers}).then(res => {
     console.log('respuesta de reverso');
   }).catch(error => {
    console.log('error de reverso');
   });
}

// Inherit from EventEmitter to enable event-driven architecture
ISOClient.prototype.__proto__ = EventEmitter.prototype;

// Export the ISOClient constructor for use in other modules
module.exports = ISOClient;
