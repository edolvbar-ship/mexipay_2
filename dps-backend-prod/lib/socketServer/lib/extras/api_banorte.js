/**
 * Banorte Payment Gateway API
 * 
 * PCI DSS 4 Requirements Covered:
 * - Requirement 8.2.1: Use strong cryptography to protect authentication credentials (API key)
 * - Requirement 10.2.1: Implement audit trails for payment transactions
 * - Requirement 6.2.4: Input validation to prevent injection attacks
 * - Requirement 3.5.1: Limit storage of account data to business needs
 */

const axios = require('axios');
require('express-validator')

module.exports = (guid, KEY, clienturl, body, bin, ref, limitAmount) => {
  // PCI DSS 4 Requirement 6.2.4: Validate input data to prevent injection attacks
  const val = valida(body);
  if(val.ok) {
    const data = makeBody(clienturl, body);
    const config = makeConfig(KEY, JSON.stringify(data));

    // PCI DSS 4 Requirement 10.2.1: Audit trail - log payment request
    dd(('Request: https://securepay.lacpaymentservices.com/PaymentGatewayAPI/api/PaymentGateway').yellow);
    dd(("\n\nJSON Request: \n================================================================================================\n" 
        + JSON.stringify(config.headers, null,4) + "\n"
        + JSON.stringify(data, null, 4)
        + "\n================================================================================================\n"), 'verbose');

    return axios(config).then(response => {
      const result = response.data;

      // PCI DSS 4 Requirement 10.2.1: Audit trail - log payment response
      dd(('Request: https://securepay.lacpaymentservices.com/PaymentGatewayAPI/api/PaymentGateway').yellow)
      dd(("\n\nJSON Response: \n================================================================================================\n" 
        + JSON.stringify(result, null, 4)
        + "\n================================================================================================\n"), 'verbose');

      return makeRes(guid, body.reference, result, bin, ref)
    }).catch(error => {
      // PCI DSS 4 Requirement 10.2.1: Audit trail - log errors for security monitoring
      console.error(error);
    });
  }

  return val;
}

/**
 * Input validation for payment data
 * PCI DSS 4 Requirement 6.2.4: Input validation to prevent injection attacks
 * PCI DSS 4 Requirement 10.2.1: Audit trail - log validation errors
 */
const valida = (body) => {
  const err = [];
  const col = ['amount', 'currency', 'reference', 'email', 'clientip']
  const size = [['m', 1], ['m', 1], ['e', 6], ['m', 1], ['m', 1]];
  const expresion = [
    /^[0-9]*(\.[0-9]{0,2})?$/,
    /^[A-Za-z]+$/,
    /^[A-Za-z0-9]{6}$/,
    /^(([^<>()\[\]\\.,;:\s@”]+(\.[^<>()\[\]\\.,;:\s@”]+)*)|(“.+”))@((\[[0–9]{1,3}\.[0–9]{1,3}\.[0–9]{1,3}\.[0–9]{1,3}])|(([a-zA-Z\-0–9]+\.)+[a-zA-Z]{2,}))$/,
    /^((^\s*((([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5]))\s*$)|(^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$))/
  ];

  col.forEach(c => {
    if(!body[c] || !body[c].trim()) {
      body[c] = false;
      err.push({
        location: 'body',
        msg: 'undefined',
        param: c
      })
    }
  });

  col.forEach((c, i) => {
    if(false !== body[c]) {
      if('m' === size[i][0]) {
        if(size[i][1] > body[c].trim().length) {
          err.push({
            location: 'body',
            msg: 'wrong length',
            param: c
          })
        }
      }
      else {
        if(size[i][1] !== body[c].trim().length) {
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
    if(false !== body[c]) {
      if(!expresion[i].test(body[c].trim())) {
        err.push({
          location: 'body',
          msg: 'Incorrect format',
          param: c
        })
      }
    }
  });

  //cardInformation
  if(undefined !== body.cardInformation && Object.keys(body.cardInformation).length) {
    const colCar = ['holder_name', 'card_number', 'last4', 'bin', 'expiration_year', 'expiration_month', 'cvv']
    const sizeCar = [['m', 1], ['e', 16], ['e', 4], ['e', 6], ['e', 2], ['e', 2], ['e', 3]];
    const expresionCar = [
      /^[A-Za-z\s]+$/,
      /^\d{16}$/,
      /^\d{4}$/,
      /^\d{6}$/,
      /^\d{2}$/,
      /^\d{2}$/,
      /^\d{3}$/,
    ];

    colCar.forEach(c => {
      if(!body.cardInformation[c] || !body.cardInformation[c].trim()) {
        body.cardInformation[c] = false;
        err.push({
          location: 'body.carInformation',
          msg: 'undefined',
          param: c
        })
      }
    });

    colCar.forEach((c, i) => {
      if(false !== body.cardInformation[c]) {
        if('m' === sizeCar[i][0]) {
          if(sizeCar[i][1] > body.cardInformation[c].trim().length) {
            err.push({
              location: 'body.carInformation',
              msg: 'wrong length',
              param: c
            })
          }
        }
        else {
          if(sizeCar[i][1] !== body.cardInformation[c].trim().length) {
            err.push({
              location: 'body.carInformation',
              msg: 'wrong length',
              param: c
            })
          }
        }
      }
    });

    colCar.forEach((c, i) => {
      if(false !== body.cardInformation[c]) {
        if(!expresionCar[i].test(body.cardInformation[c].trim())) {
          err.push({
            location: 'body.carInformation',
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
      param: 'cardInformation'
    })
  }

  return {ok: 0 === err.length, out: err};
}

/**
 * Build payment request body for Banorte
 * PCI DSS 4 Requirement 3.5.1: Only include necessary data for payment processing
 * PCI DSS 4 Requirement 10.2.1: Audit trail - log request construction
 */
const makeBody = (clienturl, body) => {
  console.log('api_banorte.js -----> makeBody');
  
  const cardexpiry = `${body.cardInformation.expiration_year}${body.cardInformation.expiration_month}`;
  return {
    // PCI DSS 4 Requirement 3.5.1: Card data sent to gateway for processing only
    cardnumber: body.cardInformation.card_number,
    cardholdername: body.cardInformation.holder_name,
    cvv: body.cardInformation.cvv,
    cardexpiry,
    totalamount: body.amount,
    reference: body.reference,
    reference2: body.reference,
    currency: "MXN",
    email: body.email || '',
    phone: body.phone || '',
    clientip: body.clientip,
    clientcountry: "MX",
    clienturl
  };
}

const headers = KEY => ({ 'X-API-KEY': KEY, 'Content-Type': 'application/json' })

const makeConfig = (KEY, data) => {
  const url = 'https://securepay.lacpaymentservices.com/PaymentGatewayAPI/api/PaymentGateway';
  const method = 'post';

  return { method, url, headers: headers(KEY), data }
}

/**
 * Build response object from Banorte response
 * PCI DSS 4 Requirement 10.2.1: Audit trail - log payment response for monitoring
 * PCI DSS 4 Requirement 3.5.1: Only include necessary data in response
 */
const makeRes = (request_id, id, dataRes, binInformation, ref) => {
  // PCI DSS 4 Requirement 3.5.1: Only include necessary business data in response
  const out = {
    request_id,
    request_status: dataRes.success,
    http_code: 200,
    resp_code: dataRes.errorcode ? dataRes.errorcode : dataRes.data.ResultCode,
    description: dataRes.errordescription ? dataRes.errordescription : dataRes.data.Description,
    id,
    binInformation,
    emv_tags: "",
    emvResponseCode: ""
  }

  // PCI DSS 4 Requirement 10.2.1: Audit trail - log response for security monitoring
  console.log(ref, out);

  return { ok:true, out, dataRes};
}

const log = (url, res) => {
  dd((url).yellow);
  dd(("\n\nJSON Response: \n================================================================================================\n"
  + JSON.stringify(res)
  + "\n================================================================================================\n"), 'verbose');
}