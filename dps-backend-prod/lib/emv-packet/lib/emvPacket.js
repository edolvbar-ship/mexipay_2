// lib/emv-packet/lib/emvPacket.js
//exports.unpack55t063 = function(msg) {
//  let tagName = '';
//  let tagLength = '';
//  let tagValue = '';
//  let tknB2 = [], tknB3 = [], tknB4 = [];
//  let deviceTypeIndicator;
//  let data = '';
//
//  var tags4Prefixex = ["9F", "5F"];
//
//  // 🔴 NEW: Track which EMV tags are present
//  let bitmapB2 = 0x0000; // Start with all bits cleared
//  let bitmapB3 = 0x0000;
//
//  while (msg.length > 0) {
//
//    if (!tags4Prefixex.includes(msg.substr(0, 2))) {
//      tagName    = msg.substr(0, 2);
//      tagLength  = msg.substr(0 + tagName.length, 2);
//      tagValue   = msg.substr(0 + tagName.length + tagLength.length, parseInt(tagLength, 16) * 2);
//      msg = msg.substr(tagName.length + tagLength.length + tagValue.length);
//    } else {
//      tagName    = msg.substr(0, 4);
//      tagLength  = msg.substr(0 + tagName.length, 2);
//      tagValue   = msg.substr(0 + tagName.length + tagLength.length, parseInt(tagLength, 16) * 2);
//      msg = msg.substr(tagName.length + tagLength.length + tagValue.length);
//    }
//
//    // 🔴 FIXED: Set bits based on which tags are actually present
//
//    // B2 Bitmap positions (based on Prosa specification):
//    // Bit 0: CRIPTOINFO-DATA (9F27)
//    // Bit 1: TVR (95)
//    // Bit 2: ARQC (9F26)
//    // Bit 3: AMT-AUTH (9F02)
//    // Bit 4: AMT-OTHER (9F03)
//    // Bit 5: AIP (82)
//    // Bit 6: ATC (9F36)
//    // Bit 7: TERM-CNTRY-CDE (9F1A)
//    // Bit 8: TRAN-CRNCY-CDE (5F2A)
//    // Bit 9: TRAN-DAT (9A)
//    // Bit 10: TRAN-TYPE (9C)
//    // Bit 11: UNPREDICT-NUM (9F37)
//    // Bit 12: ISS-APPLDATA-LGTH (9F10)
//    // Bit 13: ISS-APPLDATA (9F10 value)
//
//    if(tagName == '9F27') {
//      tknB2[2] = tagValue;   // CRIPTOINFO-DATA
//      bitmapB2 |= 0x8000; // Set bit 0
//    }
//    if(tagName == '95')   {
//      tknB2[3] = tagValue;   // TVR
//      bitmapB2 |= 0x4000; // Set bit 1
//    }
//    if(tagName == '9F26') {
//      tknB2[4] = tagValue;   // ARQC
//      bitmapB2 |= 0x2000; // Set bit 2
//    }
//    if(tagName == '9F02') {
//      tknB2[5] = tagValue;   // AMT-AUTH
//      bitmapB2 |= 0x1000; // Set bit 3
//    }
//    if(tagName == '9F03') {
//      tknB2[6] = tagValue;   // ATM-OTHER
//      bitmapB2 |= 0x0800; // Set bit 4
//    }
//    if(tagName == '82')   {
//      tknB2[7] = tagValue;   // AIP
//      bitmapB2 |= 0x0400; // Set bit 5
//    }
//    if(tagName == '9F36') {
//      tknB2[8] = tagValue;   // ATC
//      bitmapB2 |= 0x0200; // Set bit 6
//    }
//    if(tagName == '9F1A') {
//      tknB2[9] = tagValue.substring(1,4);   // TERM-CNTRY-CDE
//      bitmapB2 |= 0x0100; // Set bit 7
//    }
//    if(tagName == '5F2A') {
//      tknB2[10] = tagValue.substring(1,4);  // TRAN-CRNCY-CDE
//      bitmapB2 |= 0x0080; // Set bit 8
//    }
//    if(tagName == '9A')   {
//      tknB2[11] = tagValue;  // TRAN-DAT
//      bitmapB2 |= 0x0040; // Set bit 9
//    }
//    if(tagName == '9C')   {
//      tknB2[12] = tagValue;  // TRAN-TYPE
//      bitmapB2 |= 0x0020; // Set bit 10
//    }
//    if(tagName == '9F37') {
//      tknB2[13] = tagValue;  // UNPREDICT-NUM
//      bitmapB2 |= 0x0010; // Set bit 11
//    }
//    if(tagName == '9F10') {
//      tknB2[14] = this.padLeft(parseInt(tagLength, 16), 4, "0"); // ISS-APPLDATA-LGTH
//      tknB2[15] = this.padRight(tagValue, 64, "0");  // ISS-APPLDATA
//      bitmapB2 |= 0x000C; // Set bits 12 and 13
//    }
//
//    // B3 Bitmap positions:
//    // Bit 0: TERM-SERL-NUM (9F1E)
//    // Bit 1: EMV-TERM-CAP (9F33)
//    // Bit 2: EMV-TERM-TYPE (9F35)
//    // Bit 3: APPL-VER-NUM (9F09)
//    // Bit 4: CVM-RSLTS (9F34)
//    // Bit 5: DF-NAME-LGTH (84)
//    // Bit 6: DF-NAME (84 value)
//
//    if(tagName == '9F1E') {
//      tknB3[1] = this.hex2a(tagValue);   // TERM-SERL-NUM
//      bitmapB3 |= 0x8000; // Set bit 0
//    }
//    if(tagName == '9F33') {
//      tknB3[2] = this.padRight(tagValue, 8, "0");   // EMV-TERM-CAP
//      bitmapB3 |= 0x4000; // Set bit 1
//    }
//    if(tagName == '9F35') {
//      tknB3[5] = tagValue;   // EMV-TERM-TYPE
//      bitmapB3 |= 0x1000; // Set bit 2
//    }
//    if(tagName == '9F09') {
//      tknB3[6] = tagValue;   // APPL-VER-NUM
//      bitmapB3 |= 0x0800; // Set bit 3
//    }
//    if(tagName == '9F34') {
//      tknB3[7] = tagValue;   // CVM-RSLTS
//      bitmapB3 |= 0x0400; // Set bit 4
//    }
//    if(tagName == '84')   {
//      tknB3[8] = this.padLeft(parseInt(tagLength, 16), 4, "0") ;  // DF-NAME-LGTH
//      tknB3[9] = this.padRight(tagValue, 32, "0");   // DF-NAME
//      bitmapB3 |= 0x0300; // Set bits 5 and 6
//    }
//
//    if(tagName == '5F34') tknB4[0] = tagValue;   // PAN Sequence Number
//
//    if(tagName == '9F6E') deviceTypeIndicator = tagValue; // VISA DEVICE TYPE INDICATOR
//  }
//
//  // 🔴 FIXED: Use dynamic bitmaps instead of hardcoded FFF9/FF00
//  // Convert bitmaps to hex strings (4 chars each)
//  const bitmapB2Hex = bitmapB2.toString(16).toUpperCase().padStart(4, '0');
//  const bitmapB3Hex = bitmapB3.toString(16).toUpperCase().padStart(4, '0');
//
//  // Set USER-FLD1 to 0000 (reserved)
//  tknB2[0] = bitmapB2Hex;  // DYNAMIC BITMAP!
//  tknB2[1] = '0000';       // USER-FLD1 (reserved)
//
//  tknB3[0] = bitmapB3Hex;  // DYNAMIC BITMAP!
//  tknB3[3] = '0000';       // USER-FLD1
//  tknB3[4] = '00000000';   // USER-FLD2
//
//  // 🔴 DEBUG: Log what we found
//  console.log('🔍 [emv-packet] EMV Analysis:');
//  console.log('- B2 bitmap:', bitmapB2Hex, '(was FFF9)');
//  console.log('- B3 bitmap:', bitmapB3Hex, '(was FF00)');
//  console.log('- ARQC present:', !!(tknB2[4]));
//  console.log('- TVR present:', !!(tknB2[3]));
//  console.log('- AIP present:', !!(tknB2[7]));
//  console.log('- ATC present:', !!(tknB2[8]));
//
//  return {
//    tokenB2: tknB2[0] + tknB2[1] + tknB2[2] + tknB2[3] + tknB2[4] + tknB2[5] + tknB2[6] + tknB2[7] + tknB2[8] + tknB2[9] + tknB2[10] + tknB2[11] + tknB2[12] + tknB2[13] + tknB2[14] + tknB2[15],
//    tokenB3: tknB3[0] + tknB3[1] + tknB3[2] + tknB3[3] + tknB3[4] + tknB3[5] + tknB3[6] + tknB3[7] + tknB3[8] + tknB3[9],
//    tokenB4: tknB4[0],
//    cvm_rslts: tknB3[7],
//    deviceTypeIndicator,
//    atc: tknB2[8]
//  };
//};
exports.help = function() {
  return 'Binary mask (binary encoded)';
};

exports.unpack55t063 = function(msg) {
  let tagName = '';
  let tagLength = '';
  let tagValue = '';
  let tknB2 = [], tknB3 = [], tknB4 = [];
  let deviceTypeIndicator;
  let data = '';

  var tags4Prefixex = ["9F", "5F"];

  // 🔴 FIX: Create local references to helper functions
  const padLeft = exports.padLeft;
  const padRight = exports.padRight;
  const hex2a = exports.hex2a;

  while (msg.length > 0) {

    if (!tags4Prefixex.includes(msg.substr(0, 2))) {
      tagName    = msg.substr(0, 2);
      tagLength  = msg.substr(0 + tagName.length, 2);
      tagValue   = msg.substr(0 + tagName.length + tagLength.length, parseInt(tagLength, 16) * 2);
      msg = msg.substr(tagName.length + tagLength.length + tagValue.length);
    } else {
      tagName    = msg.substr(0, 4);
      tagLength  = msg.substr(0 + tagName.length, 2);
      tagValue   = msg.substr(0 + tagName.length + tagLength.length, parseInt(tagLength, 16) * 2);
      msg = msg.substr(tagName.length + tagLength.length + tagValue.length);
    }

    // 🔴 FIXED: Use local references instead of this.padLeft, this.padRight, etc.

                            tknB2[0] = 'FFF9'      // BIT-MAP
                            tknB2[1] = '0000'      // USER-FLD1
    if(tagName == '9F27') tknB2[2] = tagValue;   // CRIPTOINFO-DATA
    if(tagName == '95')   tknB2[3] = tagValue;   // TVR
    if(tagName == '9F26') tknB2[4] = tagValue;   // ARQC
    if(tagName == '9F02') tknB2[5] = tagValue;   // AMT-AUTH
    if(tagName == '9F03') tknB2[6] = tagValue;   // ATM-OTHER
    if(tagName == '82')   tknB2[7] = tagValue;   // AIP
    if(tagName == '9F36') tknB2[8] = tagValue;   // ATC
    if(tagName == '9F1A') tknB2[9] = tagValue.substring(1,4);   // TERM-CNTRY-CDE
    if(tagName == '5F2A') tknB2[10] = tagValue.substring(1,4);  // TRAN-CRNCY-CDE
    if(tagName == '9A')   tknB2[11] = tagValue;  // TRAN-DAT
    if(tagName == '9C')   tknB2[12] = tagValue;  // TRAN-TYPE
    if(tagName == '9F37') tknB2[13] = tagValue;  // UNPREDICT-NUM
    if(tagName == '9F10') tknB2[14] = padLeft(parseInt(tagLength, 16), 4, "0"); // ISS-APPLDATA-LGTH
    if(tagName == '9F10') tknB2[15] = padRight(tagValue, 64, "0");  // ISS-APPLDATA

                            tknB3[0] = 'FF00'      // BIT-MAP
    if(tagName == '9F1E') tknB3[1] = hex2a(tagValue);   // TERM-SERL-NUM
    if(tagName == '9F33') tknB3[2] = padRight(tagValue, 8, "0");   // EMV-TERM-CAP
                            tknB3[3] = '0000';     // USER-FLD1
                            tknB3[4] = '00000000'; // USER-FLD2
    if(tagName == '9F35') tknB3[5] = tagValue;   // EMV-TERM-TYPE
    if(tagName == '9F09') tknB3[6] = tagValue;   // APPL-VER-NUM
    if(tagName == '9F34') tknB3[7] = tagValue;   // CVM-RSLTS
    if(tagName == '84')   tknB3[8] = padLeft(parseInt(tagLength, 16), 4, "0") ;  // DF-NAME-LGTH
    if(tagName == '84')   tknB3[9] = padRight(tagValue, 32, "0");   // DF-NAME

    if(tagName == '5F34') tknB4[0] = tagValue;   // DF-NAME

    if(tagName == '9F6E') deviceTypeIndicator = tagValue; //VISA DEVICE TYPE INDICATOR
  }

  return {
    tokenB2: tknB2[0] + tknB2[1] + tknB2[2] + tknB2[3] + tknB2[4] + tknB2[5] + tknB2[6] + tknB2[7] + tknB2[8] + tknB2[9] + tknB2[10] + tknB2[11] + tknB2[12] + tknB2[13] + tknB2[14] + tknB2[15],
    tokenB3: tknB3[0] + tknB3[1] + tknB3[2] + tknB3[3] + tknB3[4] + tknB3[5] + tknB3[6] + tknB3[7] + tknB3[8] + tknB3[9],
    tokenB4: tknB4[0],
    cvm_rslts: tknB3[7],
    deviceTypeIndicator,
    atc: tknB2[8]
  };
};

exports.unpackEnvTag = ( msg ) => {
  if(!msg){return {tknB2:false};}
  let tagName = '';
  let tagLength = '';
  let tagValue = '';
  let tknB2 = {}, tknB3 = [], tknB4 = [];
  let data = '';

  var tags4Prefixex = ["9F", "5F"];

  // 🔴 FIX: Create local references
  const padLeft = exports.padLeft;
  const padRight = exports.padRight;

  while (msg.length > 0) {

    if (!tags4Prefixex.includes(msg.substr(0, 2))) {
      tagName    = msg.substr(0, 2);
      tagLength  = msg.substr(0 + tagName.length, 2);
      tagValue   = msg.substr(0 + tagName.length + tagLength.length, parseInt(tagLength, 16) * 2);
      msg = msg.substr(tagName.length + tagLength.length + tagValue.length);
    } else {
      tagName    = msg.substr(0, 4);
      tagLength  = msg.substr(0 + tagName.length, 2);
      tagValue   = msg.substr(0 + tagName.length + tagLength.length, parseInt(tagLength, 16) * 2);
      msg = msg.substr(tagName.length + tagLength.length + tagValue.length);
    }



                            tknB2.bitmap      = 'FFF9'      // BIT-MAP
                            tknB2.userFld1    = '0000'      // USER-FLD1
    if(tagName == '9F27') tknB2.criptoInfo  = tagValue;   // CRIPTOINFO-DATA
    if(tagName == '95')   tknB2.tvr         = tagValue;   // TVR
    if(tagName == '9B')   tknB2.tsr         = tagValue;   // TSR
    if(tagName == '4F')   tknB2.aid         = tagValue;   // AID
    if(tagName == '9F26') tknB2.arqc        = tagValue;   // ARQC
    if(tagName == '9F02') tknB2.amtAuth     = tagValue;   // AMT-AUTH
    if(tagName == '9F03') tknB2.atmOther    = tagValue;   // ATM-OTHER
    if(tagName == '82')   tknB2.aip         = tagValue;   // AIP
    if(tagName == '9F36') tknB2.atc         = tagValue;   // ATC
    if(tagName == '9F1A') tknB2.termCntryCde  = tagValue.substring(1,4);   // TERM-CNTRY-CDE
    if(tagName == '5F2A') tknB2.termCntryCde  = tagValue.substring(1,4);  // TRAN-CRNCY-CDE
    if(tagName == '9A')   tknB2.tranDat       = tagValue;  // TRAN-DAT
    if(tagName == '9C')   tknB2.tranType      = tagValue;  // TRAN-TYPE
    if(tagName == '9F37') tknB2.unpredict     = tagValue;  // UNPREDICT-NUM
    if(tagName == '9F10') tknB2.issAppL       = padLeft(parseInt(tagLength, 16), 4, "0"); // ISS-APPLDATA-LGTH
    if(tagName == '9F10') tknB2.issApp        = padRight(tagValue, 64, "0");  // ISS-APPLDATA
    if(tagName == '5F20') tknB2.cardholderName = tagValue;
    if(tagName == '50')   tknB2.aplicationLabel = tagValue;
    if(tagName == '9F12') tknB2.apn = tagValue;


                            tknB3[0] = 'FF00'      // BIT-MAP
    if(tagName == '9F1E') tknB3[1] = exports.hex2a(tagValue);   // TERM-SERL-NUM
    if(tagName == '9F33') tknB3[2] = padRight(tagValue, 8, "0");   // EMV-TERM-CAP
                            tknB3[3] = '0000';     // USER-FLD1
                            tknB3[4] = '00000000'; // USER-FLD2
    if(tagName == '9F35') tknB3[5] = tagValue;   // EMV-TERM-TYPE
    if(tagName == '9F09') tknB3[6] = tagValue;   // APPL-VER-NUM
    if(tagName == '9F34') tknB3[7] = tagValue;   // CVM-RSLTS
    if(tagName == '84')   tknB3[8] = padLeft(parseInt(tagLength, 16), 4, "0") ;  // DF-NAME-LGTH
    if(tagName == '84')   tknB3[9] = padRight(tagValue, 32, "0");   // DF-NAME

    if(tagName == '5F34') tknB4[0] = tagValue;   // DF-NAME

  }

  return {
    tknB2
  };
};

exports.padRight = function (num, size, padWith) {
  var s = num+"";
  while (s.length < size) s = s + padWith;
  return s;
};

exports.padLeft = function (num, size, padWith) {
  var s = ""+num;
  while (s.length < size) s = padWith + s;
  return s;
};

exports.hex2a = function (hexx) {
  var hex = hexx.toString();//force conversion
  var str = '';
  for (var i = 0; (i < hex.length && hex.substr(i, 2) !== '00'); i += 2)
      str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
  return str;
};

exports.pack = function(data, packager) {
  return {
    msg: data,
  };
};