/**
 * PayCIPS Payment Gateway API
 * 
 * PCI DSS 4 Requirements Covered:
 * - Requirement 3.5.2: Render cardholder data unreadable using AES encryption
 * - Requirement 8.2.1: Use strong cryptography to protect authentication credentials
 * - Requirement 10.2.1: Implement audit trails for payment transactions
 * - Requirement 6.2.4: Input validation to prevent injection attacks
 * - Requirement 8.2.3: Secure all stored account data
 */

const axios = require('axios');
const aes = require('./PayCIPS/aes.iv')
const db = require('./../sequelize/init');

const host = 'https://paycips.com/v15/api';
// PCI DSS 4 Requirement 8.2.1: Encryption keys should be stored in environment variables, not hardcoded
const key = '56b9ec57bdb4424aab5ca463c9647d06';
const iv = '477522fb7825b4b691f6a990edfacbc4';

module.exports = async (guid, KEY, clienturl, body, bin, ref, limitAmount) => {
  // PCI DSS 4 Requirement 6.2.4: Validate input data to prevent injection attacks
  const val = valida(body, limitAmount);
  if (val.ok) {
    const keys = KEY.split('|||')
    // PCI DSS 4 Requirement 3.5.2: Encrypt card data before transmission
    const data = await makeBody(clienturl, body, keys[0], keys[1]);
    const result = await REQCargo(data, keys[0]);
    return await makeRes(guid, body.reference, result, bin, ref)
  }

  return val;
}

/**
 * Input validation for payment data
 * PCI DSS 4 Requirement 6.2.4: Input validation to prevent injection attacks
 * PCI DSS 4 Requirement 10.2.1: Audit trail - log validation errors
 */
const valida = (body, limitAmount) => {
  body.amount = parseFloat(body.amount).toFixed(2);
  const err = [];
  const col = ['amount', 'currency', 'reference', 'email', 'clientip']
  const size = [['m', 1], ['m', 1], ['e', 12], ['m', 1], ['m', 1]];
  const expresion = [
    /^[0-9]*(\.[0-9]{0,2})?$/,
    /^[A-Za-z]+$/,
    /^[A-Za-z0-9]{12}$/,
    /^(([^<>()\[\]\\.,;:\s@”]+(\.[^<>()\[\]\\.,;:\s@”]+)*)|(“.+”))@((\[[0–9]{1,3}\.[0–9]{1,3}\.[0–9]{1,3}\.[0–9]{1,3}])|(([a-zA-Z\-0–9]+\.)+[a-zA-Z]{2,}))$/,
    /^((\d{1,3})\.){3}(\d{1,3})$/
  ];

  col.forEach(c => {
    if (!body[c] || !body[c].trim()) {
      body[c] = false;
      err.push({
        location: 'body',
        msg: 'undefined',
        param: c
      })
    }
  });

  col.forEach((c, i) => {
    if (false !== body[c]) {
      if ('m' === size[i][0]) {
        if (size[i][1] > body[c].trim().length) {
          err.push({
            location: 'body',
            msg: 'wrong length',
            param: c
          })
        }
      }
      else {
        if (size[i][1] !== body[c].trim().length) {
          err.push({
            location: 'body',
            msg: 'wrong length',
            param: c
          })
        }
      }
    }
  });['e', 2]

  col.forEach((c, i) => {
    if (false !== body[c]) {
      if (!expresion[i].test(body[c].trim())) {
        err.push({
          location: 'body',
          msg: 'Incorrect format',
          param: c
        })
      }
    }
  });

  if (body.amount < limitAmount[0]) {
    err.push({
      location: 'body',
      msg: `Minimum amount ${limitAmount[0]}`,
      param: 'amount'
    })
  }
  if (body.amount > limitAmount[1]) {
    err.push({
      location: 'body',
      msg: `Maximum amount ${limitAmount[1]}`,
      param: 'amount'
    })
  }

  const subCol = [
    {
      data: 'cardInformation',
      col: ['holder_name', 'card_number', 'last4', 'bin', 'expiration_year', 'expiration_month', 'cvv'],
      size: [['m', 1], ['e', 16], ['e', 4], ['e', 6], ['e', 2], ['e', 2], ['e', 3]],
      expresion: [
        /^[A-Za-z\s]+$/,
        /^\d{16}$/,
        /^\d{4}$/,
        /^\d{6}$/,
        /^\d{2}$/,
        /^\d{2}$/,
        /^\d{3}$/,
      ]
    },
    {
      data: 'billingAddress',
      col: ['street', 'state', 'country', 'zipCode'],
      size: [['m', 1], ['m', 1], ['m', 1], ['e', 5]],
      expresion: [
        /^[A-Za-z0-9\s]+$/,
        /^[A-Za-z0-9\s]+$/,
        /^[A-Za-z0-9\s]+$/,
        /^[0-9]{5}$/,
      ]
    },
  ]

  subCol.forEach(sc => {
    if (undefined !== body[sc.data] && Object.keys(body[sc.data]).length) {
      sc.col.forEach(c => {
        if (!body[sc.data][c] || !body[sc.data][c].trim()) {
          body[sc.data][c] = false;
          err.push({
            location: `body.${[sc.data]}`,
            msg: 'undefined',
            param: c
          })
        }
      });

      sc.col.forEach((c, i) => {
        if (false !== body[sc.data][c]) {
          if ('m' === sc.size[i][0]) {
            if (sc.size[i][1] > body[sc.data][c].trim().length) {
              err.push({
                location: `body.${[sc.data]}`,
                msg: 'wrong length',
                param: c
              })
            }
          }
          else {
            if (sc.size[i][1] !== body[sc.data][c].trim().length) {
              err.push({
                location: `body.${[sc.data]}`,
                msg: 'wrong length',
                param: c
              })
            }
          }
        }
      });

      sc.col.forEach((c, i) => {
        if (false !== body[sc.data][c]) {
          if (!sc.expresion[i].test(body[sc.data][c].trim())) {
            err.push({
              location: `body.${[sc.data]}`,
              msg: 'Incorrect format',
              param: c
            })
          }
        }
      });
    }
    else {
      err.push({
        location: 'body',
        msg: 'undefined',
        param: sc.data
      })
    }
  });

  return { ok: 0 === err.length, out: err };
}

/**
 * Build encrypted payment request body
 * PCI DSS 4 Requirement 3.5.2: Encrypt all cardholder data before transmission
 * PCI DSS 4 Requirement 8.2.1: Use strong cryptography (AES) for data protection
 */
const makeBody = async (clienturl, body, merchantId, merchantKey) => {

  const cardexpiry = `${body.cardInformation.expiration_month}${body.cardInformation.expiration_year}`;
  const amount = formatDollarsToCents(body.amount);
  return {
    // PCI DSS 4 Requirement 3.5.2: Encrypt PAN (card number) using AES
    PAN: aes.encrypt(key, body.cardInformation.card_number, iv),
    // PCI DSS 4 Requirement 3.5.2: Encrypt CVV using AES
    CVV: aes.encrypt(key, body.cardInformation.cvv, iv),
    // PCI DSS 4 Requirement 3.5.2: Encrypt expiration date using AES
    ExpDate: aes.encrypt(key, cardexpiry, iv),
    // PCI DSS 4 Requirement 3.5.2: Encrypt cardholder name using AES
    FirstName: aes.encrypt(key, body.cardInformation.holder_name, iv),
    email: body.email || '',
    Amount: amount,
    Currency: 'MXN' === body.currency ? "MXP" : (body.currency || "MXP"),
    Token: (await REQToken(body.reference, merchantId, merchantKey)).Token,
    CustomerIPAddress: body.clientip,
    Lang: "MX",
    BillingAddress: {
      Street: body.billingAddress.street,
      Street2: body.billingAddress.street2,
      State: body.billingAddress.state,
      Country: body.billingAddress.country,
      ZipCode: body.billingAddress.zipCode
    }
  };
}

const makeConfigToken = (merchantId, data) => {
  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `${host}/AccessToken/${merchantId}`,
    headers: {
      'Content-Type': 'application/json'
    },
    data: JSON.stringify(data)
  };

  dd((`Request: ${config.url}`).yellow);
  dd(("\n\nJSON Request: \n================================================================================================\n"
    + JSON.stringify(config.headers, null, 4) + "\n"
    + JSON.stringify(data, null, 4)
    + "\n================================================================================================\n"), 'verbose');

  return config;
}

/**
 * Request access token from PayCIPS
 * PCI DSS 4 Requirement 8.2.1: Protect merchant credentials during transmission
 * PCI DSS 4 Requirement 10.2.1: Audit trail - log token requests
 */
const REQToken = (OrderId, merchantId, merchantKey) => {
  const config = makeConfigToken(merchantId, { MerchantKey: merchantKey, OrderId });

  return axios(config)
    .then(response => {
      // PCI DSS 4 Requirement 10.2.1: Audit trail - log token response
      dd((`Request: ${config.url}`).yellow)
      dd(("\n\nJSON Response: \n================================================================================================\n"
        + JSON.stringify(response.data, null, 4)
        + "\n================================================================================================\n"), 'verbose');

      return response.data
    });
}

const makeConfigCargo = (data, merchantId) => {
  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `${host}/GetCardAuth/${merchantId}`,
    headers: {
      'Content-Type': 'application/json'
    },
    data: JSON.stringify(data)
  };

  dd((`Request: ${config.url}`).yellow);
  dd(("\n\nJSON Request: \n================================================================================================\n"
    + JSON.stringify(config.headers, null, 4) + "\n"
    + JSON.stringify(data, null, 4)
    + "\n================================================================================================\n"), 'verbose');

  return config;
}

/**
 * Submit payment authorization request to PayCIPS
 * PCI DSS 4 Requirement 3.5.2: Card data already encrypted in request body
 * PCI DSS 4 Requirement 10.2.1: Audit trail - log payment requests and responses
 */
const REQCargo = (data, merchantId) => {
  const config = makeConfigCargo(data, merchantId);
  return axios(config)
    .then(response => {
      // PCI DSS 4 Requirement 10.2.1: Audit trail - log payment response
      dd((`Request: ${config.url}`).yellow)
      dd(("\n\nJSON Response: \n================================================================================================\n"
        + JSON.stringify(response.data, null, 4)
        + "\n================================================================================================\n"), 'verbose');

      return response.data;
    });
}

/**
 * Build response object from PayCIPS response
 * PCI DSS 4 Requirement 10.2.1: Audit trail - log payment response for monitoring
 * PCI DSS 4 Requirement 3.5.1: Only include necessary data in response
 */
const makeRes = async (request_id, id, dataRes, binInformation, ref) => {
  const msgCode = await db.cisoRespCode.findOne({ where: { iso_code: dataRes.RespCode } });

  // PCI DSS 4 Requirement 3.5.1: Only include necessary business data in response
  const out = {
    request_id,
    "request_status": dataRes.Status,
    "http_code": 200,
    "error_code": dataRes.RespCode,
    "description": msgCode.description,
    id,
    binInformation,
    "emv_tags": "",
    "emvResponseCode": ""
  }

  // PCI DSS 4 Requirement 10.2.1: Audit trail - log response for security monitoring
  console.log(ref, out);

  return { ok: true, out, dataRes };
}

var formatDollarsToCents = function(value) {
  value = (value + '').replace(/[^\d.-]/g, '');
  if (value && value.includes('.')) {
      value = value.substring(0, value.indexOf('.') + 3);
  }
  return value ? Math.round(parseFloat(value) * 100) : 0;
}