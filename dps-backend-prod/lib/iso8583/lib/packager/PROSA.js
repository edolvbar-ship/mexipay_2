/* eslint-disable no-prototype-builtins */
/* eslint-disable no-param-reassign */
//
// This is NOT an universal solution for given system type. Some parameters or their representation may
// appear different on different system installations/configurations. You might need to tweak and modify this file
// to fit the exact system you try to talk to.
//
// lib/iso8583/lib/packager/PROSA.js

const moment = require('moment');
const { timestamp } = require('winston/lib/winston/common');

exports.headerLength;
exports.lengthHeaderLength;
exports.lengthHeaderType;

exports.options = {
  // Packets older than given amount of time will be treated as outdated. This is to prevent some virtualization systems freeze problems
  expirationLimitSeconds: 30,

  // The following errors should be treated as system or critical
  sysErrors: [5, 120, 902, 903, 907, 910, 912],

  // The values of the following fields should be padded automatically
  padFields: [0, 3, 4, 7, 11, 12, 13, 17, 18, 22, 37, 39, 41, 42, 43, 49, 70],

  // Herder POS mensaje ISO PROSA
  messageHeader: {
    '08': 'ISO006000050',
    '01': 'ISO026000050',
    '02': 'ISO026000050',
    '04': 'ISO026000050',
  },
  // Reference of obligatory fields for different MTIs
// Reference of obligatory fields for different MTIs (Message Type Indicators)
// ISO 8583 standard for PROSA (Mexican payment processor)
obligatoryFields: {
  // ═══════════════════════════════════════════════════════════════════════════════
  // 0200 - Financial Transaction Request (Purchase/Sale from POS)
  // ═══════════════════════════════════════════════════════════════════════════════
  // Sent by terminal to request authorization for a financial transaction
  '0200': [
    0,   // Message Type Indicator (0200)
    1,   // Bitmap - indicates which data fields are present
    3,   // Processing Code - type of transaction (purchase, cash advance, etc.)
    4,   // Transaction Amount - amount in minor units (centavos)
    7,   // Transmission Date/Time - MMDDhhmmss
    11,  // Systems Trace Audit Number (STAN) - unique transaction identifier
    12,  // Local Transaction Time - hhmmss
    13,  // Local Transaction Date - MMDD
    17,  // Capture Date - MMDD (date of capture/settlement)
    18,  // Merchant Type (MCC) - Merchant Category Code
    22,  // Point of Service Entry Mode - how card data was captured
    32,  // Acquiring Institution ID Code - acquirer identification
    37,  // Retrieval Reference Number - unique reference for retrieval
    41,  // Card Acceptor Terminal ID - terminal identification
    43,  // Card Acceptor Name/Location - merchant name and address
    48,  // Retailer Data - additional retailer-specific data
    49,  // Transaction Currency Code - ISO currency code (484 = MXN)
    60,  // Terminal Data - terminal capability information
    61,  // Response Code Data - additional response information
    63,  // Additional Data - private use field for extra data
    100, // Receiving Institution ID Code - destination institution
    120, // Terminal Address/Branch - terminal location details
    121, // Authorization Indicators - authorization-related flags
    125, // POS Settlement Data 3 - settlement information
    126  // POS Preauth and Chargeback Data - preauthorization data
  ],

  // ═══════════════════════════════════════════════════════════════════════════════
  // 0210 - Financial Transaction Response
  // ═══════════════════════════════════════════════════════════════════════════════
  // Response from issuer/processor to 0200 request (approval/decline)
  '0210': [
    0,   // Message Type Indicator (0210)
    1,   // Bitmap
    3,   // Processing Code - echoed from request
    4,   // Transaction Amount - echoed or adjusted amount
    7,   // Transmission Date/Time
    11,  // STAN - echoed from request
    12,  // Local Transaction Time
    13,  // Local Transaction Date
    17,  // Capture Date
    18,  // Merchant Type (MCC)
    22,  // Point of Service Entry Mode
    32,  // Acquiring Institution ID Code
    37,  // Retrieval Reference Number
    38,  // Authorization ID Response - auth code if approved
    39,  // Response Code - approval/decline code (00=approved)
    41,  // Card Acceptor Terminal ID
    48,  // Retailer Data
    49,  // Transaction Currency Code
    60,  // Terminal Data
    61,  // Response Code Data
    63,  // Additional Data
    100, // Receiving Institution ID Code
    120, // Terminal Address/Branch
    121, // Authorization Indicators
    125  // POS Settlement Data 3
    // Note: No field 43 (merchant name) or 126 in response
  ],

  // ═══════════════════════════════════════════════════════════════════════════════
  // 0220 - Financial Transaction Advice
  // ═══════════════════════════════════════════════════════════════════════════════
  // Sent to notify that a transaction has been completed (post-authorization)
  // Used for offline transactions or transaction completion notification
  '0220': [
    0,   // Message Type Indicator (0220)
    1,   // Bitmap
    3,   // Processing Code
    4,   // Transaction Amount
    7,   // Transmission Date/Time
    11,  // STAN
    12,  // Local Transaction Time
    13,  // Local Transaction Date
    17,  // Capture Date
    22,  // Point of Service Entry Mode
    32,  // Acquiring Institution ID Code
    37,  // Retrieval Reference Number
    38,  // Authorization ID Response - from original auth
    39,  // Response Code - from original authorization
    41,  // Card Acceptor Terminal ID
    43,  // Card Acceptor Name/Location
    48,  // Retailer Data
    49,  // Transaction Currency Code
    60,  // Terminal Data
    61,  // Response Code Data
    63,  // Additional Data
    100, // Receiving Institution ID Code
    120, // Terminal Address/Branch
    121, // Authorization Indicators
    125, // POS Settlement Data 3
    126  // POS Preauth and Chargeback Data
    // Note: No field 18 (MCC) in advice
  ],

  // ═══════════════════════════════════════════════════════════════════════════════
  // 0230 - Financial Transaction Advice Response
  // ═══════════════════════════════════════════════════════════════════════════════
  // Acknowledgment response to 0220 advice message
  '0230': [
    0,   // Message Type Indicator (0230)
    3,   // Processing Code
    4,   // Transaction Amount
    7,   // Transmission Date/Time
    11,  // STAN
    22,  // Point of Service Entry Mode
    32,  // Acquiring Institution ID Code
    37,  // Retrieval Reference Number
    39,  // Response Code - acknowledgment code
    41,  // Card Acceptor Terminal ID
    49,  // Transaction Currency Code
    61,  // Response Code Data
    120  // Terminal Address/Branch
    // Minimal fields - just acknowledgment of advice receipt
    // Note: No bitmap (1), no auth code (38), simplified response
  ],

  // ═══════════════════════════════════════════════════════════════════════════════
  // 0420 - Reversal Advice
  // ═══════════════════════════════════════════════════════════════════════════════
  // Request to reverse a previously completed transaction
  // Used when original transaction needs to be cancelled/voided
  '0420': [
    0,   // Message Type Indicator (0420)
    1,   // Bitmap
    3,   // Processing Code
    4,   // Transaction Amount - amount to reverse
    7,   // Transmission Date/Time
    11,  // STAN - new STAN for reversal
    12,  // Local Transaction Time
    13,  // Local Transaction Date
    17,  // Capture Date
    22,  // Point of Service Entry Mode
    32,  // Acquiring Institution ID Code
    37,  // Retrieval Reference Number
    38,  // Authorization ID Response - from original transaction
    39,  // Response Code - from original transaction
    41,  // Card Acceptor Terminal ID
    43,  // Card Acceptor Name/Location
    48,  // Retailer Data
    49,  // Transaction Currency Code
    60,  // Terminal Data
    61,  // Response Code Data
    63,  // Additional Data
    90,  // Original Data Elements - CRITICAL: contains original MTI, STAN, date/time
    100, // Receiving Institution ID Code
    120, // Terminal Address/Branch
    121, // Authorization Indicators
    123, // POS Invoice Data - invoice details for the reversal
    125, // POS Settlement Data 3
    126  // POS Preauth and Chargeback Data
    // Note: Field 90 is critical - links reversal to original transaction
  ],

  // ═══════════════════════════════════════════════════════════════════════════════
  // 0430 - Reversal Advice Response
  // ═══════════════════════════════════════════════════════════════════════════════
  // Response to reversal advice (0420) - confirms reversal processing
  '0430': [
    0,   // Message Type Indicator (0430)
    1,   // Bitmap
    3,   // Processing Code
    4,   // Transaction Amount
    7,   // Transmission Date/Time
    11,  // STAN
    22,  // Point of Service Entry Mode
    32,  // Acquiring Institution ID Code
    37,  // Retrieval Reference Number
    39,  // Response Code - reversal result (00=reversed successfully)
    41,  // Card Acceptor Terminal ID
    49,  // Transaction Currency Code
    61,  // Response Code Data
    90,  // Original Data Elements - echoed from request
    120, // Terminal Address/Branch
    121, // Authorization Indicators
    126  // POS Preauth and Chargeback Data
    // Simplified response - confirms reversal processed
  ],

  // ═══════════════════════════════════════════════════════════════════════════════
  // 0800 - Network Management Request
  // ═══════════════════════════════════════════════════════════════════════════════
  // Administrative message for network operations (sign-on, echo test, key exchange)
  '0800': [
    0,   // Message Type Indicator (0800)
    1,   // Bitmap
    7,   // Transmission Date/Time
    11,  // STAN
    70   // Network Management Information Code:
         //   001 = Sign-on
         //   002 = Sign-off
         //   301 = Echo test
         //   161 = Key exchange
  ],

  // ═══════════════════════════════════════════════════════════════════════════════
  // 0810 - Network Management Response
  // ═══════════════════════════════════════════════════════════════════════════════
  // Response to network management request
  '0810': [
    0,   // Message Type Indicator (0810)
    1,   // Bitmap
    7,   // Transmission Date/Time
    11,  // STAN - echoed from request
    39,  // Response Code - result of network operation (00=success)
    70   // Network Management Information Code - echoed from request
  ],
},
  
  cardDataInputModes: {
    '01': 'Manual',
    '06': 'Manual',
    '02': 'Magnetic stripe read',
    '05': 'Integrated circuit card read; CVV data reliable',
    '07': 'Proximity transaction originated using ICC data rules',
    '08': 'Magnetic stripe even though it is ICC capable',
    91: 'Proximity transaction originated using magnetic stripe data rules; CVV check is possible',
  },
  
  cardholderAuthMethods: {
    0: 'Not Authenticated',
    1: 'PIN',
    2: 'Signature Based',
    6: 'Signature Based',
    9: 'Terminal accept Off-line PINs (for EMV cards)',
  },

  // System error messages reference by code
  errors: {
    '000': 'Successful Transaction',
    '001': 'Approve with ID. If transaction was Success, but MCC these is in next list  6010, 4829, 6051, 7995, 7511 – then reason code changes on 001',
    '002': 'ATM performed a partial dispense',
    '003': 'Successful Transaction',
    '005': 'System Error',
    '020': 'Successful transaction; used to indicate a negative balance in Field 4 on a Balance Inquiry',
    '095': 'Reconcile Error',
    100: 'Do Not Honor Transaction',
    101: 'Expired Card',
    103: 'Call Issuer',
    104: 'Card is Restricted',
    105: 'Call Security',
    106: 'Excessive Pin Failures',
    107: 'Call Issuer',
    109: 'Invalid Merchant ID',
    110: 'Cannot Process Amount',
    111: 'Invalid Account - Retry',
    116: 'Insufficient Funds - Retry',
    117: 'Incorrect Pin',
    118: 'Forced Post, no Account on File',
    119: 'Transaction Not Permitted by Law',
    120: 'Not Permitted',
    121: 'Withdrawal Limit Exceeded - Retry',
    123: 'Limit Reached for Total Number of Transactions in Cycle',
    125: 'Bad Card',
    126: 'Pin Processing Error',
    127: 'Pin Processing Error',
    128: 'Pin Processing Error',
    200: 'Invalid Сard',
    201: 'Card Expired',
    202: 'Invalid Card',
    203: 'Call Security',
    204: 'Account Restricted',
    205: 'Call Security',
    206: 'Invalid Pin',
    208: 'Lost Card',
    209: 'Stolen Card',
    902: 'Invalid Transaction - Retry',
    903: 'Transaction Needs to Be Entered Again',
    904: 'The Message Received Was not Within Standards',
    905: 'Issuing Institution is Unknown',
    907: 'Issuer inoperative',
    908: 'Issuing Institution is Unknown',
    909: 'System Malfunction',
    910: 'Issuer Inoperative',
    911: 'SmartVista FE Has Knowledge of Any Attempt to Either Authorize or Deny the Transaction',
    912: 'Timeout Waiting for Response',
    913: 'Duplicate Transaction Received',
    914: 'Could not Find the Original Transaction',
    915: 'Amount Being Reversed is Greater than Original, or no Amount Being Reversed',
    920: 'Pin Processing Error',
    923: 'Request in Progress',
  },
};

exports.format = {

  0: {
    length: 4,
    name: 'Message Type Indicator',
    type: 'ans',
    alias: '',
    /*
    To have any field-specific logic of your own executed before packing the message, use 'beforePack method

    beforePack: function(fieldValue) {
      return fieldValue;
    } */
  },
  1: {
    length: 32,
    name: 'P-001 Bitmap',
    type: 'bitmap-a',
    alias: '',
  },
  2: {
    length: 19,
    name: '[P-002] Primary Account Number',
    type: 'll-n',
    alias: '',
  },
  3: {
    length: 6,
    name: 'P-003 Processing Code',
    type: 'n',
    alias: '',
  },
  4: {
    length: 12,
    name: 'P-004 Transaction Amount',
    type: 'n',
    alias: '',
  },
  7: {
    length: 10,
    name: 'P-007 Transmission Data an Time',
    type: 'n',
    alias: '',
  },
  11: {
    length: 6,
    name: 'P-011 Systems Trace Audit Number',
    type: 'n',
    alias: 'stan',
  },
  12: {
    length: 6,
    name: 'P-012 Local Transaction Time',
    type: 'n',
    alias: '',
  },
  13: {
    length: 4,
    name: 'P-013 Local Transaction Date',
    type: 'n',
    alias: '',
  },
  17: {
    length: 4,
    name: 'P-017 Capture Date',
    type: 'n',
    alias: '',
  },
  18: {
    length: 4,
    name: 'P-018 Merchant Type',
    type: 'n',
    alias: '',
  },
  22: {
    length: 3,
    name: 'P-022 Point of Service Entry Mode',
    type: 'n',
    alias: '',
  },
  25: {
    length: 2,
    name: 'P-025 Point of Service Condition Code',
    type: 'n',
    alias: '',
  },
  32: {
    length: 99,
    name: 'P-032 Acquiring Institution ID Code',
    type: 'll-n',
    alias: '',
  },
//  35: {
////    length: 37,
//    length: 99,
//    name: 'P-035 Track 2 Data',
////    type: 'll-bin-an',
//    type: 'll-n',
//    alias: '',
//  },
// lib/iso8583/lib/packager/PROSA.js
// Update these fields in the format section:

35: {
  length: 37,  // Maximum length for Track 2 Data (including length indicator)
  name: 'P-035 Track 2 Data',
  type: 'll-n',  // 🔴 CHANGED BACK to 'll-n' (this exists in your system)
  alias: '',
},
  37: {
    length: 12,
    name: 'P-037 Retrieval Reference Number',
    type: 'ans',
    alias: '',
  },

  38: {
    length: 6,
    name: 'P-038 Authorization ID Response',
    type: 'ans',
    alias: '',
  },
  39: {
    length: 2,
    name: 'P-039 Response Code',
    type: 'ans',
    alias: '',
  },
  41: {
    length: 16,
    name: 'P-041 Card Acceptor Terminal ID',
    type: 'ans',
    alias: 'tarminalId',
  },
  42: {
    length: 15,
    name: 'P-042 Card Acceptor ID Code',
    type: 'ans',
    alias: '',
  },
  43: {
    length: 40,
    name: 'P-043 Card Acceptor Name / Location',
    type: 'ans',
    alias: '',
  },
  44: {
    length: 4,
    name: 'P-044 Additional Response Data',
    type: 'ans',
    alias: '',
  },
  45: {
    length: 76,
    name: 'P-045 Track1 Data',
    type: 'ans',
    alias: '',
  },
//  48: {
//    length: 999,
//    name: 'P-048 Retailer Data',
//    type: 'lll-n',
//    alias: '',
//  },


  // lib/iso8583/lib/packager/PROSA.js
  48: {
    length: 27,
    name: 'P-048 Retailer Data',
    type: 'lll-n',  // ✅ 3-DIGIT LENGTH INDICATOR
    alias: '',
    beforePack: function(fieldValue) {
      const data = String(fieldValue || '');
      console.log('[PROSA] Field 48 packing:', {
        dataLength: data.length,
        expected: 27,
        withLengthIndicator: `${data.length.toString().padStart(3, '0')}${data}`
      });
      return data;
    }
  },
  49: {
    length: 3,
    name: 'P-049 Transaction Currency Code',
    type: 'n',
    alias: '',
  },
  54: {
    length: 999,
    name: 'P-054 Additionals Amounts',
    type: 'lll-n',
    alias: '',
  },
//  60: {
//    length: 999,
//    name: 'P-060 Terminal Data',
//    type: 'lll-n',
//    alias: '',
//  },

    60: {
        name: 'P-060 Private Additional Data',
        type: 'lll-n',  // 3-digit LI + alphanumeric
        pack: function(value, data) {
          // Build from transaction data
          const stan = data.transaction?.stan?.toString().padStart(6, '0') || '000001';
          const terminal = data.terminal?.id || 'P468LDI1';
          const additional = data.transaction?.additional_data || '0000000';

          const privateData = stan + terminal + additional;

          // Auto-add length indicator
          const length = privateData.length.toString().padStart(3, '0');
          return length + privateData;
        },
        unpack: function(value) {
          return value.substring(3);
        }
      },
  61: {
    length: 999,
    name: 'P-061 Response Code Data',
    type: 'lll-n',
    alias: '',
  },
  62: {
    length: 13,
    name: 'P-062 Postal Code',
    type: 'lll-n',
    alias: '',
  },
  63: {
    length: 999,
    name: 'P-063 Additional Data',
    type: 'lll-n',
    alias: '',
  },
  70: {
    length: 3,
    name: 'S-070 Network Management Information Code',
    type: 'n',
    alias: '',
  },
  90: {
    length: 42,
    name: 'S-090 Original Data Elements',
    type: 'ans',
    alias: '',
  },
  95: {
    length: 42,
    name: 'S-095 Replacement Amounts',
    type: 'n',
    alias: '',
  },
  100: {
    length: 99,
    name: 'S-100 Receiving Institution ID Code',
    type: 'll-n',
    alias: '',
  },
  102: {
    length: 99,
    name: 'S-102 Account ID 1',
    type: 'll-n',
    alias: '',
  },
  120: {
    length: 999,
    name: 'S-120 Terminal Address-Branch',
    type: 'lll-n',
    alias: '',
  },
  121: {
    length: 999,
    name: 'S-121 Authorization Indicators',
    type: 'lll-n',
    alias: '',
  },
  122: {
    length: 999,
    name: 'S-122 Card Issuer ID Code',
    type: 'lll-n',
    alias: '',
  },
  123: {
    length: 999,
    name: 'S-123 Pos Invoice Data',
    type: 'lll-n',
    alias: '',
  },
  124: {
    length: 999,
    name: 'S-124 Pos Settlement Data 2',
    type: 'lll-n',
    alias: '',
  },
  125: {
    length: 999,
    name: 'S-125 Pos Settlement Data 3',
    type: 'lll-n',
    alias: '',
  },
  126: {
    length: 999,
    name: 'S-126 Pos Preauth and Chrgeback Data',
    type: 'lll-n',
    alias: '',
  },
};

exports.validators = {
  isValidMessage(data) {
    return data.length > 16;
  },

  isExpiredPacket(packet, expirationLimitSeconds) {
    // 150630200039
    // YYMMDDHHmmss
    const transactionTime = packet.getField(12);
    if (!transactionTime) return false;

    const now = moment(new Date(), 'HHmmss');
    const then = moment(transactionTime, 'HHmmss');

    const diff = now.diff(then, 'seconds');

    if (Math.abs(diff) > expirationLimitSeconds) {
      return true;
    }
    return false;
  },
};

// Here we read header values
exports.headerReaders = {
  default(message, headerType, headerIndex, headerLength) {
    return this.unpack(message, headerType, headerIndex, headerLength);
  },

  unpack(message, type, index, length) {
    return require(`../packer/${type}`).unpack(message.slice(index, index + length), { length }).data;
  },
};

// Here we generate header values
exports.headerGenerators = {
  length(headerValue, headerType, headerLength, context) {
    return this.pack(context.length, headerType, headerLength);
  },

  headerLength(headerValue, headerType, headerLength, context) {
    return this.pack(context.headerLength, headerType, headerLength);
  },

  default(headerValue, headerType, headerLength) {
    return this.pack(headerValue, headerType, headerLength);
  },

  pack(value, type, length) {
    return Buffer.from(require(`../packer/${type}`).pack(value, { length }).msg);
  },
};

exports.processors = {
  splitByHeader(message) {
    const result = [];
    let index = 0;
    const length = 0;
    let valNumHeader = 0;
    const headersData = {};

    while (1) {
      global.headerFormat.forEach((header) => {
        if (exports.headerReaders.hasOwnProperty(header.name)) {
          headersData[header.name] = exports.headerReaders[header.name](message, header.type, index, header.length);
          index += header.length;
          valNumHeader = parseInt(headersData.length, 16);
        } else if (exports.headerReaders.hasOwnProperty('default')) {
          headersData[header.name] = exports.headerReaders.default(message, header.type, index, header.length);
          index += header.length;
          valNumHeader = parseInt(headersData.length, 16);
        }
      });

      if (!valNumHeader > 0) break;
      
      result.push(message.slice(index, index + valNumHeader));

      index += valNumHeader;

      if (index >= message.length) break;
    }

    return result;
  },

  readHeaderOptions() {
    length = 0;

    global.headerFormat.forEach((header) => {
      if (header.name == 'length') {
        exports.lengthHeaderType = header.type;
        exports.lengthHeaderLength = header.length;
      }

      length += header.length;
    });

    exports.headerLength = length;
  },

  getHeaderLength() {
    if (typeof exports.headerLength === 'undefined') {
      this.readHeaderOptions();
    }

    return exports.headerLength;
  },

  getLengthHeaderType() {
    if (typeof exports.lengthHeaderType === 'undefined') {
      this.readHeaderOptions();
    }

    return exports.lengthHeaderType;
  },

  getLengthHeaderLength() {
    if (typeof exports.lengthHeaderLength === 'undefined') {
      this.readHeaderOptions();
    }

    return exports.lengthHeaderLength;
  },

  // This method is triggered for every packet before it is being packed
  beforePack(data) {
    return data;
  },
};

exports.generators = {
  getHeader(lengthVal) {
    let result = Buffer.from('');
    const headerLength = exports.processors.getHeaderLength();

    if (global.c.lengthIncludeHeader) lengthVal += headerLength;

    // Convertimos el valor de lenghtVal de decimal a hexadecimal para el estandar PROSA
    const lengthValHex = lengthVal.toString(16);
    
    const context = { length: lengthValHex, headerLength };

    global.headerFormat.forEach((header) => {
      if (exports.headerGenerators.hasOwnProperty(header.name)) {
        const val = exports.headerGenerators[header.name]('', header.type, header.length, context);
        result = Buffer.concat([result, val]);
      } else if (exports.headerGenerators.hasOwnProperty('default')) {
        const val = exports.headerGenerators.default(header.default, header.type, header.length, context);
        result = Buffer.concat([result, val]);
      }
    });

    return result;
  },
};
