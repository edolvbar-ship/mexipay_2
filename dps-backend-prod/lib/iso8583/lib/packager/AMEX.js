//
// This is NOT an universal solution for given system type. Some parameters or their representation may
// appear different on different system installations/configurations. You might need to tweak and modify this file
// to fit the exact system you try to talk to.
//

var moment  = require('moment');
const { timestamp } = require('winston/lib/winston/common');

exports.headerLength;
exports.lengthHeaderLength;
exports.lengthHeaderType;

exports.options = {
  // Nombre de Logic
  packager: 'AMEX',
  
  // Packets older than given amount of time will be treated as outdated. This is to prevent some virtualization systems freeze problems
  expirationLimitSeconds: 30,

  // The following errors should be treated as system or critical
  sysErrors: [5, 120, 902, 903, 907, 910, 912],

  // The values of the following fields should be padded automatically
  padFields: [0, 3, 4, 7, 11, 12, 13, 17, 18, 22, 37, 39, 41, 42, 43, 49, 70],

  // Reference of obligatory fields for different MTIs
  obligatoryFields: {
    '1200': [0, 1, 3, 4, 7, 11, 12, 13, 17, 18, 22, 32, 37,         41, 43, 48, 49, 60, 61, 63,       100, 120, 121,      125, 126],
    '1210': [0, 1, 3, 4, 7, 11, 12, 13, 17, 18, 22, 32, 37, 38, 39, 41,     48, 49, 60, 61, 63,       100, 120, 121,      125],
    '1220': [0, 1, 3, 4, 7, 11, 12, 13, 17,     22, 32, 37, 38, 39, 41, 43, 48, 49, 60, 61, 63,       100, 120, 121,      125, 126],
    '1230': [0,    3, 4, 7, 11,                 22, 32, 37,     39, 41,         49, 60, 61, 63,            120],
    '1420': [0, 1, 3, 4, 7, 11, 12, 13, 17,     22, 32, 37, 38, 39, 41, 43, 48, 49, 60, 61, 63,   90, 100, 120, 121, 123, 125, 126],
    '1430': [0, 1, 3, 4, 7, 11,                 22, 32, 37,     39, 41,         49, 60, 61, 63,   90,      120, 121,           126],
    '1800': [0, 1,       7, 11,                                                                 70],
    '1810': [0, 1,       7, 11,                                 39,                             70]
  },
  
  cardDataInputModes: {
    '01': 'Manual',
    '06': 'Manual',
    '02': 'Magnetic stripe read',
    '05': 'Integrated circuit card read; CVV data reliable',
    '07': 'Proximity transaction originated using ICC data rules',
    '08': 'Magnetic stripe even though it is ICC capable',
    '91': 'Proximity transaction originated using magnetic stripe data rules; CVV check is possible'
  },
  
  cardholderAuthMethods: {
    0: 'Not Authenticated',
    1: 'PIN',
    2: 'Signature Based',
    6: 'Signature Based',
    9: 'Terminal accept Off-line PINs (for EMV cards)'
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
    '100': 'Do Not Honor Transaction',
    '101': 'Expired Card',
    '103': 'Call Issuer',
    '104': 'Card is Restricted',
    '105': 'Call Security',
    '106': 'Excessive Pin Failures',
    '107': 'Call Issuer',
    '109': 'Invalid Merchant ID',
    '110': 'Cannot Process Amount',
    '111': 'Invalid Account - Retry',
    '116': 'Insufficient Funds - Retry',
    '117': 'Incorrect Pin',
    '118': 'Forced Post, no Account on File',
    '119': 'Transaction Not Permitted by Law',
    '120': 'Not Permitted',
    '121': 'Withdrawal Limit Exceeded - Retry',
    '123': 'Limit Reached for Total Number of Transactions in Cycle',
    '125': 'Bad Card',
    '126': 'Pin Processing Error',
    '127': 'Pin Processing Error',
    '128': 'Pin Processing Error',
    '200': 'Invalid Сard',
    '201': 'Card Expired',
    '202': 'Invalid Card',
    '203': 'Call Security',
    '204': 'Account Restricted',
    '205': 'Call Security',
    '206': 'Invalid Pin',
    '208': 'Lost Card',
    '209': 'Stolen Card',
    '902': 'Invalid Transaction - Retry',
    '903': 'Transaction Needs to Be Entered Again',
    '904': 'The Message Received Was not Within Standards',
    '905': 'Issuing Institution is Unknown',
    '907': 'Issuer inoperative',
    '908': 'Issuing Institution is Unknown',
    '909': 'System Malfunction',
    '910': 'Issuer Inoperative',
    '911': 'SmartVista FE Has Knowledge of Any Attempt to Either Authorize or Deny the Transaction',
    '912': 'Timeout Waiting for Response',
    '913': 'Duplicate Transaction Received',
    '914': 'Could not Find the Original Transaction',
    '915': 'Amount Being Reversed is Greater than Original, or no Amount Being Reversed',
    '920': 'Pin Processing Error',
    '923': 'Request in Progress'
  }
};

exports.format = {

  '0': {
    length: 4,
    name:   'Message Type Indicator',
    type:   'ans',
    alias:  ''
    /*
    To have any field-specific logic of your own executed before packing the message, use 'beforePack method

    beforePack: function(fieldValue) {
      return fieldValue;
    }*/
  },
  '1': {
    length: 32,
    name:   'P-001 Bitmap',
    type:   'bitmap-a',
    alias:  ''
  },
  '2': {
    length: 19,
    name:   '[P-002] Primary Account Number',
    type:   'll-n',
    alias:  ''
  },
  '3': {
    length: 6,
    name:   'P-003 Processing Code',
    type:   'n',
    alias:  ''
  },
  '4': {
    length: 12,
    name:   'P-004 Transaction Amount',
    type:   'n',
    alias:  ''
  },
  '7': {
    length: 10,
    name:   'P-007 Transmission Data an Time',
    type:   'n',
    alias:  ''
  },
  '11': {
    length: 6,
    name:   'P-011 Systems Trace Audit Number',
    type:   'n',
    alias:  'stan'
  },
  '12': {
    length: 6,
    name:   'P-012 Local Transaction Time',
    type:   'n',
    alias:  ''
  },
  '13': {
    length: 4,
    name:   'P-013 Local Transaction Date',
    type:   'n',
    alias:  ''
  },
  '17': {
    length: 4,
    name:   'P-017 Capture Date',
    type:   'n',
    alias:  ''
  },
  '18': {
    length: 4,
    name:   'P-018 Merchant Type',
    type:   'n',
    alias:  ''
  },
  '22': {
    length: 3,
    name:   'P-022 Point of Service Entry Mode',
    type:   'n',
    alias:  ''
  },
  '25': {
    length: 2,
    name:   'P-025 Point of Service Condition Code',
    type:   'n',
    alias:  ''
  },
  '32': {
    length: 99,
    name:   'P-032 Acquiring Institution ID Code',
    type:   'll-n',
    alias:  ''
  },
  '35': {
    length: 99,
    name:   'P-035 Track 2 Data',
    type:   'll-n',
    alias:  ''
  },
  '37': {
    length: 12,
    name:   'P-037 Retrieval Reference Number',
    type:   'ans',
    alias:  '',
  },
  '38': {
    length: 6,
    name:   'P-038 Authorization ID Response',
    type:   'ans',
    alias:  ''
  },
  '39': {
    length: 2,
    name:   'P-039 Response Code',
    type:   'ans',
    alias:  ''
  },
  '41': {
    length: 16,
    name:   'P-041 Card Acceptor Terminal ID',
    type:   'ans',
    alias:  'tarminalId'
  },
  '42': {
    length: 15,
    name:   'P-042 Card Acceptor ID Code',
    type:   'ans',
    alias:  ''
  },
  '43': {
    length: 40,
    name:   'P-043 Card Acceptor Name / Location',
    type:   'ans',
    alias:  ''
  },
  '44': {
    length: 4,
    name:   'P-044 Additional Response Data',
    type:   'ans',
    alias:  ''
  },
  '45': {
    length: 76,
    name:   'P-045 Track1 Data',
    type:   'ans',
    alias:  ''
  },
  '48': {
    length: 999,
    name:   'P-048 Retailer Data',
    type:   'lll-n',
    alias:  ''
  },
  '49': {
    length: 3,
    name:   'P-049 Transaction Currency Code',
    type:   'n',
    alias:  ''
  },
  '54': {
    length: 999,
    name:   'P-054 Additionals Amounts',
    type:   'lll-n',
    alias:  ''
  },
  '60': {
    length: 999,
    name:   'P-060 Terminal Data',
    type:   'lll-n',
    alias:  ''
  },
  '61': {
    length: 999,
    name:   'P-061 Response Code Data',
    type:   'lll-n',
    alias:  ''
  },
  '62': {
    length: 13,
    name:   'P-062 Postal Code',
    type:   'lll-n',
    alias:  ''
  },
  '63': {
    length: 999,
    name:   'P-063 Additional Data',
    type:   'lll-n',
    alias:  ''
  },
  '70': {
    length: 3,
    name:   'S-070 Network Management Information Code',
    type:   'n',
    alias:  ''
  },
  '90': {
    length: 42,
    name:   'S-090 Original Data Elements',
    type:   'ans',
    alias:  ''
  },
  '95': {
    length: 42,
    name:   'S-095 Replacement Amounts',
    type:   'n',
    alias:  ''
  },
  '100': {
    length: 99,
    name:   'S-100 Receiving Institution ID Code',
    type:   'll-n',
    alias:  ''
  },
  '102': {
    length: 99,
    name:   'S-102 Account ID 1',
    type:   'll-n',
    alias:  ''
  },
  '120': {
    length: 999,
    name:   'S-120 Terminal Address-Branch',
    type:   'lll-n',
    alias:  ''
  },
  '121': {
    length: 999,
    name:   'S-121 Authorization Indicators',
    type:   'lll-n',
    alias:  ''
  },
  '122': {
    length: 999,
    name:   'S-122 Card Issuer ID Code',
    type:   'lll-n',
    alias:  ''
  },
  '123': {
    length: 999,
    name:   'S-123 Pos Invoice Data',
    type:   'lll-n',
    alias:  ''
  },
  '124': {
    length: 999,
    name:   'S-124 Pos Settlement Data 2',
    type:   'lll-n',
    alias:  ''
  },
  '125': {
    length: 999,
    name:   'S-125 Pos Settlement Data 3',
    type:   'lll-n',
    alias:  ''
  },
  '126': {
    length: 999,
    name:   'S-126 Pos Preauth and Chrgeback Data',
    type:   'lll-n',
    alias:  ''
  }
};

exports.validators = {
  isValidMessage: function(data) {
    return data.length > 16;
  },

  isExpiredPacket: function(packet, expirationLimitSeconds) {
    // 150630200039
    // YYMMDDHHmmss
    var transactionTime = packet.getField(12);
    if (!transactionTime) return false;

    var now = moment(new Date(), "HHmmss");
    var then = moment(transactionTime, "HHmmss");

    var diff = now.diff(then, 'seconds');

    if (Math.abs(diff) > expirationLimitSeconds) {
      return true;
    } else {
      return false;
    }
  }
};

// Here we read header values
exports.headerReaders = {
  'default': function(message, headerType, headerIndex, headerLength) {
    return this.unpack(message, headerType, headerIndex, headerLength);
  },

  'unpack': function(message, type, index, length) {
    return require('../packer/' + type).unpack(message.slice(index, index + length), {length: length}).data;
  }
};

// Here we generate header values
exports.headerGenerators = {
  'length': function(headerValue, headerType, headerLength, context) {
    return this.pack(context.length, headerType, headerLength);
  },

  'headerLength': function(headerValue, headerType, headerLength, context) {
    return this.pack(context.headerLength, headerType, headerLength);
  },

  'default': function(headerValue, headerType, headerLength) {
    return this.pack(headerValue, headerType, headerLength);
  },

  'pack': function(value, type, length) {
    return Buffer.from(require('../packer/' + type).pack(value, {length: length}).msg);
  }
};

exports.processors = {
  splitByHeader: function(message) {
    var result = [];
    var index = 0;
    var length = 0;
    var valNumHeader = 0;
    var headersData = {};

    while (1) {
      global.headerFormat.forEach(function(header) {
        if (exports.headerReaders.hasOwnProperty(header.name)) {
          headersData[header.name] = exports.headerReaders[header.name](message, header.type, index, header.length);
          index += header.length;
          valNumHeader = parseInt(headersData['length'], 16);
        } else if (exports.headerReaders.hasOwnProperty('default')) {
          headersData[header.name] = exports.headerReaders.default(message, header.type, index, header.length);
          index += header.length;
          valNumHeader = parseInt(headersData['length'], 16);
        }
      }.bind(this));

      if (!valNumHeader > 0) break;
      
      result.push(message.slice(index, index + valNumHeader));

      index += valNumHeader;

      if (index >= message.length) break;
    }

    return result;
  },

  readHeaderOptions: function() {
    length = 0;

    global.headerFormat.forEach(function(header) {
      if (header.name == 'length') {
        exports.lengthHeaderType = header.type;
        exports.lengthHeaderLength = header.length;
      }

      length += header.length;
    });

    exports.headerLength = length;
  },

  getHeaderLength: function() {
    if (typeof exports.headerLength == 'undefined') {
      this.readHeaderOptions();
    }

    return exports.headerLength;
  },

  getLengthHeaderType: function() {
    if (typeof exports.lengthHeaderType == 'undefined') {
      this.readHeaderOptions();
    }

    return exports.lengthHeaderType;
  },

  getLengthHeaderLength: function() {
    if (typeof exports.lengthHeaderLength == 'undefined') {
      this.readHeaderOptions();
    }

    return exports.lengthHeaderLength;
  },

  // This method is triggered for every packet before it is being packed
  beforePack: function(data) {
    return data;
  }
};

exports.generators = {
  getHeader: function(lengthVal) {
    var result = Buffer.from('');
    var headerLength = exports.processors.getHeaderLength();

    if (global.c.lengthIncludeHeader) lengthVal += headerLength;

    //Convertimos el valor de lenghtVal de decimal a hexadecimal para el estandar PROSA
    var lengthValHex = lengthVal.toString(16);
    
    var context = {length: lengthValHex, headerLength: headerLength};

    global.headerFormat.forEach(function(header) {
      if (exports.headerGenerators.hasOwnProperty(header.name)) {
        val = exports.headerGenerators[header.name]('', header.type, header.length, context);
      } else if (exports.headerGenerators.hasOwnProperty('default')) {
        val = exports.headerGenerators.default(header.default, header.type, header.length, context);
      }

      result = Buffer.concat([result, val]);
    }.bind(this));

    return result;
  }
};
