var iso8583Packet = require("../../iso8583-packet");
var net = require("net");
var moment = require("moment");
var helpers = require("../../helpers");
const agregator = process.env.AGREGATOR_NAME

class packTranIso {
  // data banregio
  // reqHttp 
  // msgIsoReq 
  constructor(data, reqHttp, msgIsoReq) {
    this.commerce_id    = reqHttp.headers['commerce-id'];
    this.commerce_name  = reqHttp.headers['commerce-name'];
    this.mcc            = msgIsoReq[18];
    this.typeTran       = msgIsoReq[3].substring(0, 2);
    this.reverseMsgType = msgIsoReq[0];
    this.reverseSecNum  = msgIsoReq[37];
    this.reverseAuthNum     = msgIsoReq[38];
    this.revereseEntryMode  = msgIsoReq[22];
    this.revereseTranDate   = msgIsoReq[13];
    this.revereseTranTime   = msgIsoReq[12];
    this.revereseCptDate    = msgIsoReq[17];
    this.revereseTknData63  = msgIsoReq[63];
    this.isoType            = (reqHttp.merchantData.id_esquema > 2)? 'AGRS' : agregator;
    this.rsa = data.rsa;
    this.rsa_name = data.rsa_name;
    this.check_value = data.check_value;
    this.crc32 = data.crc32;
    this.cardInformation = data.cardInformation;
    this.amount = msgIsoReq[4];
    this.entry_mode = msgIsoReq[22];
    this.authentication = data.authentication;
    this.reverseCode = data.reverseCode;
    this.chargePlan = data.chargePlan;
    this.currency = data.currency;
    this.forcedTransaction = data.forcedTransaction;
    this.authCollectorIndicator = data.authCollectorIndicator;
    this.fraudPropentionFlag = data.fraudPropentionFlag;
    this.cavvValidationResult = data.cavvValidationResult;
    this.contract = data.contract;
    this.tokenB2 = "";
    this.tokenB3 = "";
    this.tokenB4 = "";
    this.cvm_rslts = "";
    this.msg_type = msgIsoReq[0];
    this.mpos_tmk_enc = data.mpos_tmk_enc;
    this.mpos_tmk_Kcv = data.mpos_tmk_Kcv;
    this.mpos_tmk_crc32 = data.mpos_tmk_crc32;
    this.merchant = reqHttp.merchantData;
    this.system_fiid = this.merchant.banco_adq.fiid;



    var tran_year = this.padLeft(new Date().getUTCFullYear(), 2, "0");
    var tran_month = this.padLeft(new Date().getUTCMonth() + 1, 2, "0");


    if (this.cardInformation && this.cardInformation.emv_tags) {
      var emv63 = require("../../emv-packet").unpack55t063(
        this.cardInformation.emv_tags
      );
      this.tokenB2 = emv63.tokenB2;
      this.tokenB3 = emv63.tokenB3;
      this.tokenB4 = emv63.tokenB4;
      this.cvm_rslts = emv63.cvm_rslts;
    }


    var fld03 = msgIsoReq[3];

    var fld04 = msgIsoReq[4];
    
    var fld07 = helpers.fechaUTC();

    var fld11 = msgIsoReq[11];

    // Prioritize merchant's actual MCC over incoming MCC, with fallback to static values
    var fld18;
    console.log('[interfaceResponseToIsoTranslator] Debug MCC selection:');
    console.log('  - this.merchant exists:', !!this.merchant);
    console.log('  - this.merchant.isoMcc exists:', !!(this.merchant && this.merchant.isoMcc));
    console.log('  - this.merchant.isoMcc.mcc exists:', !!(this.merchant && this.merchant.isoMcc && this.merchant.isoMcc.mcc));
    console.log('  - this.mcc exists:', !!this.mcc);
    console.log('  - this.isoType:', this.isoType);
    
    if (this.merchant && this.merchant.isoMcc && this.merchant.isoMcc.mcc) {
      // Use merchant's actual MCC
      fld18 = this.merchant.isoMcc.mcc.padStart(4, '0');
      console.log('[interfaceResponseToIsoTranslator] Using merchant MCC:', fld18, 'for merchant:', this.merchant.name_merchant);
    } else if (this.mcc) {
      // Use incoming MCC if merchant MCC not available
      fld18 = this.mcc;
      console.log('[interfaceResponseToIsoTranslator] Using incoming MCC:', fld18);
    } else {
      // Use fallback values
      fld18 = (this.isoType == "AGRS") ? "5399" : "5694";
      console.log('[interfaceResponseToIsoTranslator] Using fallback MCC:', fld18, 'for isoType:', this.isoType);
    }
    
    console.log('[interfaceResponseToIsoTranslator] Final fld18:', fld18);

    var fld22 = this.entry_mode;

    var fld32 = (this.system_fiid && this.system_fiid != agregator) ? this.padLeft(this.system_fiid.substring(this.system_fiid.length - 3), 11, "0") : "99999999999";

    var fld35 = (((this.tknQ2 == "09" || this.tknQ2 == "08" || this.tknQ2 == "02") && this.cardInformation) ? ((this.cardInformation.card_number) 
              + "=" 
              + ((this.cardInformation.expiration_year) ? this.cardInformation.expiration_year : tran_year.substring(2, 4)) 
              + ((this.cardInformation.expiration_month) ? this.cardInformation.expiration_month : tran_month)) : '');

              // console.log('****** ,',[data.get , data.mpos_tmk_Kcv,data.codigo_aut]) 
    // BANREGIO
    if (typeof data.get === 'function') {
      var fld37 = (data.get('BNRG_REFERENCIA')) ? data.get('BNRG_REFERENCIA') : '';
      var fld38 = (data.get('BNRG_CODIGO_AUT')) ? data.get('BNRG_CODIGO_AUT') : '';
        if (data.get('BNRG_ID_MEDIO')) {
          var fld39 = (data.get('BNRG_CODIGO_EMISOR') && data.get('BNRG_CODIGO_EMISOR')) ? data.get('BNRG_CODIGO_EMISOR') : '05';
        } else {
          var fld39 = '06'; 
        }
    }
    // NORMAL 
    else if (data.mpos_tmk_Kcv) {
      var fld37 = msgIsoReq[37];  
      var fld38 = helpers.randomString(6, 1);
      var fld39 = (msgIsoReq[4] == '000000000000' && msgIsoReq[3] == '000000') ? "00" : "05";
    } 
    else if(data.codigo_aut){
      var fld37 = msgIsoReq[37];  
      var fld38 = helpers.randomString(6, 1);
      var fld39 = "00";
    }
    else {
      var fld37 = msgIsoReq[37];  
      var fld38 = '';
      var fld39 = (msgIsoReq[4] == '000000000000' && msgIsoReq[3] == '000000') ? "72" : "05";
    }

    var fld41 = msgIsoReq[41];

    const aux = (this.merchant.id_esquema == 4 || this.merchant.id_esquema == 3) ?  process.env.AGREGATOR_NAME + "*" : '';
    var fld43 = this.padRight((aux + this.commerce_name), 22, " ") + "CDMX MEXICO  " + "000" + "MX";

    var fld48 = this.padRight(this.commerce_id, 19, " ") + "    " + "    ";

    var fld60 = (this.system_fiid ? this.system_fiid : agregator) + (this.isoType == "AGRS" ? "AGRS" : agregator) + "+000" + "0000";

    var fld63 = msgIsoReq[63] + ((msgIsoReq[4] == '000000000000' && msgIsoReq[3] == '000000' && (data.mpos_tmk_Kcv)) ? this.buildTkn(
      "EX",
        this.mpos_tmk_enc +
        helpers.randomString(15, 1) + "00001" +
        this.mpos_tmk_Kcv +
        "00" +
        this.mpos_tmk_crc32
        + this.buildTkn("ER", "00")) : "");

    var fld90 = msgIsoReq[90] ? msgIsoReq[90] : '';

    var card_type = '00';
    // const tipoCuenta = data.get('BNRG_TIPO_CUENTA');

    if(typeof data.get === 'function' && data.get('BNRG_TIPO_CUENTA')){
      switch (data.get('BNRG_TIPO_CUENTA')) {
        case 'CREDITO':
          card_type = 'C0';
        break;
        case 'DEBITO':
          card_type = 'P0';
        break;
        default:
          card_type = '00';
        break;
      }
    }

    var fld125 = this.padRight(card_type, 12, " ") ;
  
    var p = this.getPacket(this.msg_type, fld03, fld04, fld07, fld11, fld18, fld22, fld32, fld35, fld37, 
                           fld38, fld39, fld41, fld43,  fld48, fld60, fld63, fld90, fld125);
    
    this.reqPacket = p;
    this.destPacket = p.getMessage();
  }

  getISOReqTranDE() {
    return this.reqPacket;
  }

  getISODestTran() {
    return this.destPacket;
  }
}

packTranIso.prototype.getPacket = function (msg_type, fld03, fld04, fld07, fld11, fld18, fld22, fld32, fld35,
                                              fld37, fld38, fld39, fld41, fld43, fld48, fld60, fld63, fld90, fld125) {
  var p = {};
  var now = moment(new Date());

  // Echo
  if (msg_type == "0800") {
    p[0] = "0810"; // Message Type
    p[7] = fld07; // Data & Time, Transmission
    p[11] = fld11; // System Trace Audit Number
    p[70] = "301"; // Terminal Id
    // Purchase
  } else if (msg_type == "0200") {
    p[0] = "0210"; // Message type
    p[3] = fld03; // Processing Code
    p[4] = fld04; // Amount, Transaction
    p[7] = fld07; // Data & Time, Transmission
    p[11] = fld11; // System Trace Audit Number
    p[12] = now.format("HHmmss"); // Time, Local Transaction
    p[13] = now.format("MMDD"); // Date, Local Transaction
    p[17] = now.format("MMDD"); // Date, Capture Date
    p[18] = fld18; // Merchant type
    p[22] = fld22; // Pos Entry Mode
    p[32] = fld32; // Acquirer Institution Id
    if (fld35) p[35] = fld35; // Track 2 Data
    p[37] = fld37; // Refernce sequuence number
    p[38] = fld38; // Auth Number
    p[39] = fld39; // Auth Code
    p[41] = fld41; // Card Acceptor Terminal Identification
    p[42] = "000000000000000"; // Merchant Id
    p[43] = fld43; // Card acceptor name location
    p[48] = fld48; // Add data private
    p[49] = 484; // Currency code, transaction
    p[60] = fld60; // Terminal data
    p[61] = "        00000000000"; // Card Issuer and Authorizer Data
    p[63] = fld63; // Aditional Data
    p[100] = "00000000000"; // Receiving Institution Identification Code
    p[120] =  agregator + "    MEXICO DF            "; // Key management
    p[121] = "000000000000000000  "; // Application File and Table Information
    p[125] = fld125; //  Account Indicator/Statement Print Data
    p[126] = "00000000000000000000000000000000000000"; // Aditional data
  } else if (msg_type == "0220") {
    p[0] = "0230"; // Message type
    p[3] = fld03; // Processing Code
    p[4] = fld04; // Amount, Transaction
    p[7] = fld07; // Data & Time, Transmission
    p[11] = fld11; // System Trace Audit Number
    p[12] = now.format("HHmmss"); // Time, Local Transaction
    p[13] = now.format("MMDD"); // Date, Local Transaction
    p[17] = now.format("MMDD"); // Date, Capture Date
    p[22] = fld22; // Pos Entry Mode
    p[32] = fld32; // Acquirer Institution Id
    if (fld35) p[35] = fld35; // Track 2 Data
    p[37] = fld37; // Refernce sequuence number
    p[38] = fld38; // Auth Number
    p[39] = fld39; // Auth Code
    p[41] = fld41; // Card Acceptor Terminal Identification
    p[42] = "000000000000000"; // Merchant Id
    p[43] = fld43; // Card acceptor name location
    p[48] = fld48; // Add data private
    p[49] = 484; // Currency code, transaction
    p[60] = fld60; // Terminal data
    p[61] = "        00000000000"; // Card Issuer and Authorizer Data
    p[63] = fld63; // Aditional Data
    p[90] = (fld90) ? fld90 : ''; // Aditional Data
    p[100] = "00"; // Receiving Institution Identification Code
    p[120] = agregator + "    MEXICO DF            "; // Key management
    p[121] = "000000000000000000  "; // Application File and Table Information
    p[123] = "                    "; // Application File and Table Information
    p[125] = fld125; //  Account Indicator/Statement Print Data
    p[126] = "00000000000000000000000000000000000000"; // Aditional data
    // Reverse
  } else if (msg_type == "0420") {
    p[0] = "0430"; // Message type
    p[3] = fld03; // Processing Code
    p[4] = fld04; // Amount, Transaction
    p[7] = fld07; // Data & Time, Transmission
    p[11] = fld11; // System Trace Audit Number
    p[12] = now.format("HHmmss"); // Time, Local Transaction
    p[13] = now.format("MMDD"); // Date, Local Transaction
    p[17] = this.revereseCptDate; // Date, Capture Date
    p[18] = fld18; // Merchant type
    p[22] = fld22; // Pos Entry Mode
    p[32] = fld32; // Acquirer Institution Id
    if (fld35) p[35] = fld35; // Track 2 Data
    p[37] = fld37; // Refernce sequuence number
    p[38] = fld38; // Auth Number
    p[39] = fld39; // Auth Code
    p[41] = fld41; // Card Acceptor Terminal Identification
    p[42] = "000000000000000"; // Merchant Id
    p[43] = fld43; // Card acceptor name location
    p[48] = fld48; // Add data private
    p[49] = 484; // Currency code, transaction
    p[60] = fld60; // Terminal data
    p[61] = "        00000000000"; // Card Issuer and Authorizer Data
    p[63] = this.revereseTknData63; // Aditional Data
    p[90] = (fld90) ? fld90 : ''; // Aditional Data
    p[100] = "00"; // Receiving Institution Identification Code
    p[120] = agregator + "    MEXICO DF            "; // Key management
    p[121] = "000000000000000000  "; // Application File and Table Information
    p[123] = "                    "; // Application File and Table Information
    p[125] = fld125; //  Account Indicator/Statement Print Data
    p[126] = "00000000000000000000000000000000000000"; // Aditional data
  }

  return new iso8583Packet(p);
};

packTranIso.prototype.padRight = function (num, size, padWith) {
  var s = num + "";
  while (s.length < size) s = s + padWith;
  return s;
};

packTranIso.prototype.padLeft = function (num, size, padWith) {
  var s = "" + num;
  while (s.length < size) s = padWith + s;
  return s;
};

packTranIso.prototype.getTokenC4 = function (tknQ2, cvm_rslts){

  var tknC4 = '';
  if (tknQ2 == '03') tknC4 = '00000002108' + ((cvm_rslts.substring(0,2) == '01' || cvm_rslts.substring(0,2) == '44') ? '2' : '1');
  if (tknQ2 == '09') tknC4 = '102510003600';
  if (tknQ2 == '08') tknC4 = '103310003600';
  
  return tknC4;
}

packTranIso.prototype.buildTkn = function (tknName, tknValue) {
  if (tknValue.length !== 0) {
    var s =
      "! " +
      tknName +
      packTranIso.prototype.padLeft(tknValue.length, 5, "0") +
      " " +
      tknValue;
  } else {
    s = "";
  }
  return s;
};

module.exports = packTranIso;
