/**
 * 3D Secure (3DS) Service
 * Handles 3D Secure authentication for card transactions
 *
 * PCI DSS 4.0 Requirements Covered:
 * - Req 8.3: Implements multi-factor authentication through 3DS protocol
 * - Req 4.2: Ensures secure transmission of cardholder data via encrypted 3DS sessions
 * - Req 3.4: Protects cardholder data through additional authentication layer
 * - Req 6.5.10: Implements strong authentication for card-not-present transactions
 * - Req 10.2: Logs all 3DS authentication attempts and outcomes
 * - Req 11.3.1: Implements fraud detection and prevention mechanisms
 */

const axios = require('axios');
const { Op } = require('sequelize');

const db = require("../sequelize/init");
const TransactionContext = require('./TransactionContext');

const urlSeccion = process.env.DS_URL + '/api/threeds/v2/sessions';
const urlStatus = process.env.DS_URL + '/api/threeds/v2/transactions';

const { v4: uuidv4 } = require('uuid');

/**
 * Request 3DS transaction status from authentication server
 * PCI DSS 4.0: Req 10.2 - Logs authentication status checks
 * @param {string} transactionID - Unique 3DS transaction identifier
 * @param {string} authToken - Authorization token for 3DS server
 * @returns {Promise} Transaction status response
 */
const reqStatus = (transactionID, authToken) => {
  console.log('--> 3ds req status')
  return axios.get(`${urlStatus}/${transactionID}`, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`
    }
  }).then(response => {
    if (response.message === 'Unauthenticated.')
      return res.status(403).end('No valid token');
    return response.data;
  }).catch(err => {
    console.log(err);
    return err.response.data;
  });
};

/**
 * Request new 3DS authentication session
 * PCI DSS 4.0: Req 8.3 - Initiates multi-factor authentication session
 * @param {object} requestBody - 3DS session request payload
 * @param {string} authToken - Authorization token for 3DS server
 * @returns {Promise} 3DS session creation response
 */
const reqSeccion = (requestBody, authToken) => {
  return axios.post(urlSeccion, requestBody, {
    headers: { Authorization: `Bearer ${authToken}` }
  }).then(response => {
    console.log(response.data);
    return response.data;
  }).catch(err => {
    console.log(err);
    return err.response.data;
  });
};

/**
 * Middleware to handle 3DS session creation
 * PCI DSS 4.0: Req 8.3 - Enforces multi-factor authentication for card transactions
 * Req 3.4 - Protects cardholder data through additional authentication
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 */
module.exports.seccion = async (req, res, next) => {

  try {
    console.log('JJ--> 3ds seccion')

    const infoBin = await db.cisoBin.findOne({ where: { bin: req.body.cardInformation.bin }, raw: true });

    if (!req.merchantData['3DS']){
      console.log( `++ merchant has 3DS off: [${req.merchantData['3DS']}]` )
      return next();
    }

    if (infoBin && !infoBin['3DS']) {
      console.log( `++ BIN ha 3DS off` )
      return res.status(403).end('No valid bin');
    }

    const data = await db.tresds.findOne({ where: { referencia_tx: req.body.reference, transStatus: { [Op.in]: ['Y', 'A'] } }, raw: true });

    var url = `${req.protocol}://${req.headers.host}/gateway/v1/ext/ecommerce/very/charge/${req.body.reference}`;

      if (!!data) {
        try {
          if ( !is3dsResponseSet( res ) ) {
            console.log("3DS data is not present, recovering from server.");
            // recover merchant data from DB
            const merchantDataRow = await db.merchant.findOne({
              where: {
                name_merchant: data["commerce-name"],
                afiliation_number: data["commerce-id"],
              },
              raw: true,
            });

            //recover 3DS transaction status from 3DS server
            const transStatus = await reqStatus(
              data.transactionID,
              merchantDataRow["3DS_KEY"]
            ).then(async (status) => {
              console.log("Impirme el estatus", status);
              return status;
            });

            //save the 3DS response in the request
            set3dsResponse( res , transStatus);
          } else {
            console.log("3DS data is present from previuos request.");
          }
        } catch (e) {
          console.log(e);
        }

        return next();
      }

    if (req.body.url)
      url = `${req.body.url}reference=${req.body.reference}`;

    if (req.body.urlRedirect)
      url = `${req.body.urlRedirect}?id=${req.body.reference}`;

    const dataSeccion = {
      reference: req.body.reference,
      cardholderName: req.body.cardInformation.holder_name,
      acctNumber: req.body.cardInformation.card_number,
      cardExpiryDate: `${req.body.cardInformation.expiration_year}${req.body.cardInformation.expiration_month}`,
      // ✅ USE TRANSACTION CONTEXT TO VALIDATE AND GET AMOUNT IN CENTS
      purchaseAmount: (() => {
        try {
          const txnContext = new TransactionContext(req, req.body.reference, '0200', 'VENTA', '1', req.body.reference);
          // 3DS service expects amount in cents for consistency
          return txnContext.amount.cents;
        } catch (error) {
          console.error('[3ds.service.js] ❌ Amount validation failed:', error.message);
          throw error;
        }
      })(),
      redirectURI: url,
      purchaseCurrency: req.body.currency ? req.body.currency : 'MXN',
      email: req.body.email,
      billAddrCity: req.body.billingAddress?.state,
      billAddrCountry: req.body.billingAddress?.country,
      billAddrLine1: req.body.billingAddress?.street,
      billAddrPostCode: req.body.billingAddress?.zip,
    };

    const resultInfo = await reqSeccion(dataSeccion, req.merchantData['3DS_KEY']).then(async result => {
      if(result.errors){
        return false;
      }
      await db.tresds.update({
        body: { data: '' },
        'system-fiid': '',
        mcc: '',
        'X-Time': '',
        'X-Auth': '',
      }, { where: { referencia_tx: req.body.reference } })
      await db.tresds.destroy({ where: { referencia_tx: req.body.reference } })

      if (result.message === 'Unauthenticated.')
        return false;

      return db.tresds.create({
        referencia_tx: req.body.reference,
        sessionToken: result.sessionToken,
        url: result.redirectURL,
        transactionID: result.transactionID,
        body: req.body,
        'commerce-name': req.headers['commerce-name'],
        'system-fiid': req.headers['system-fiid'],
        mcc: req.headers.mcc,
        'commerce-id': req.headers['commerce-id'],
        'X-Time': req.headers['x-time'],
        'X-Auth': req.headers['x-auth'],
      })
    })

    return resultInfo ? res.json({
      reference: resultInfo.referencia_tx,
      url: resultInfo.url
    }) : res.status(403).end('No valid token');
  } catch (error) {
    return res.json({
      request_id: uuidv4(),
      request_status: true,
      http_code: 200,
      resp_code: "05",
      description: error,
      id: req.params.referencia,
      emv_tags: "",
      emvResponseCode: ""
    });
  }

}

/**
 * Middleware to verify 3DS authentication status via link callback
 * PCI DSS 4.0: Req 10.2 - Logs authentication verification attempts
 * Req 8.3 - Validates multi-factor authentication completion
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 */
module.exports.statusLink = async (req, res, next) => {
  console.log('NN+statusLink --> 3ds status link')
  try {
    console.log(`N+statusLink --> params`, req.params)
    const referencia = req.params.reference || req.params.referencia || '';
    console.log(`statusLink --> referencia: ${referencia}`)
    const data = await db.tresds.findOne({ where: { referencia_tx: referencia }, raw: true });
    console.log(`statusLink --> tresds`, data)
    if (data) {
      console.log(`statusLink --> commerce-id(afiliation_number): ${data['commerce-id']}`)
      console.log(`statusLink --> commerce-name: ${data['commerce-name']}`)
      const merchant = await db.merchant.findOne({ where: { name_merchant: data['commerce-name'], afiliation_number: data['commerce-id'] }, raw: true })
      console.log(`statusLink --> merchant`, merchant);

      let transStatus;
      if(data.sessionToken){
        transStatus = await reqStatus(data.transactionID, merchant['3DS_KEY']).then(async status => {
          console.log('Impirme el estatus', status)
          return status;
        });
      }else{
        dd('Skiping 3ds request processor will fullfil the request...');
        transStatus = {
          transStatus: 'Y'
        };
      }

      await save3dsResponseToDB( transStatus, referencia );

      
      console.log(`+statusLink --> transStatus(code):`, transStatus.transStatus)

      if ('Y' === transStatus.transStatus || 'A' === transStatus.transStatus) {
        console.log(`statusLink --> Aprovada`);

        prepareNextCall( req, res , data , transStatus , referencia );

        const dataClean = {
          body: {},
          'X-Auth': '',
          'X-Time': ''
        };
        await db.tresds.update(dataClean, { where: { referencia_tx: referencia } })

        return next();
      }
    }

    return res.json({
      request_id: uuidv4(),
      request_status: true,
      http_code: 200,
      resp_code: "05",
      description: "Rechazada por 3DS",
      id: referencia,
      emv_tags: "",
      emvResponseCode: ""
    });
  } catch (error) {
    console.log(error);
    return res.json({
      request_id: uuidv4(),
      request_status: true,
      http_code: 200,
      resp_code: "05",
      description: "Rechazada por 3DS",
      id: referencia,
      emv_tags: "",
      emvResponseCode: ""
    });
  }

}

/**
 * Middleware to check 3DS authentication status
 * PCI DSS 4.0: Req 8.3 - Validates multi-factor authentication status
 * Req 10.2 - Logs authentication status checks
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 */
module.exports.status = async (req, res, next) => {
  console.log('NN++--> 3ds status')

  try {
    const referencia = req.params.referencia != undefined ? req.params.referencia : req.body.reference;
    var cvv = '';
    if (req.body.cvv == undefined || req.body.cvv == '' || referencia == undefined) {
      return res.json({
        request_id: uuidv4(),
        request_status: true,
        http_code: 200,
        resp_code: "05",
        description: "Rechazada por 3DS",
        id: referencia,
        emv_tags: "",
        emvResponseCode: ""
      });
    }
    cvv = req.body.cvv;
    const data = await db.tresds.findOne({ where: { referencia_tx: referencia }, raw: true });
    if (data) {
      console.log(`status --> commerce-id(afiliation_number): ${data['commerce-id']}`)
      console.log(`status --> commerce-name: ${data['commerce-name']}`)
      const merchant = await db.merchant.findOne({ where: { name_merchant: data['commerce-name'], afiliation_number: data['commerce-id'] }, raw: true })
      console.log(`status --> merchant`, merchant);

      let transStatus;
      if(data.sessionToken){
        transStatus = await reqStatus(data.transactionID, merchant['3DS_KEY']).then(async status => {
          console.log('Impirme el estatus', status)
          return status;
        });
      }else{
        dd('Skiping 3ds request processor will fullfil the request...');
        transStatus = {
          transStatus: 'Y'
        };
      }


      await save3dsResponseToDB( transStatus, referencia );

      console.log(`status --> transStatus`, transStatus)
      console.log(`status --> transStatus(code):`, transStatus.transStatus)

      if ('Y' === transStatus.transStatus || 'A' === transStatus.transStatus) {
        console.log(`statusLink --> Aprovada`)
        req.body.cvv = cvv;
        prepareNextCall( req, res ,data, transStatus, referencia );

        const dataClean = {
          body: {},
          'X-Auth': '',
          'X-Time': ''
        };
        await db.tresds.update(dataClean, { where: { referencia_tx: referencia } })
        return next();
      }
    }

    return res.json({
      request_id: uuidv4(),
      request_status: true,
      http_code: 200,
      resp_code: "05",
      description: "Rechazada por 3DS",
      id: referencia,
      emv_tags: "",
      emvResponseCode: ""
    });
  } catch (error) {
    console.log(error);
    return res.json({
      request_id: uuidv4(),
      request_status: true,
      http_code: 200,
      resp_code: "05",
      description: "Rechazada por 3DS",
      emv_tags: "",
      emvResponseCode: ""
    });
  }

}



/**
 * Prepares request for next middleware call after 3DS authentication
 * PCI DSS 4.0: Req 3.4 - Handles secure transmission of authenticated transaction data
 * @param {object} request - Express request object
 * @param {object} response - Express response object
 * @param {object} data - 3DS transaction data from database
 * @param {object} status3ds - 3DS authentication status
 * @param {string} referencia - Transaction reference
 */
function prepareNextCall(request, response ,data ,status3ds, referencia){

  request.body = data.body;

  request.body.eci = parseInt(status3ds.eci);
  request.body.acsTransID = status3ds.acsTransID;
  request.body.dsTransID = status3ds.dsTransID;
  request.body.threeDSServerTransID = status3ds.threeDSServerTransID;
  request.body.authenticationValue = status3ds.authenticationValue;

  set3dsResponse( response, status3ds );

  const headers = {
    'Content-Type': 'application/json',
    'commerce-name': data['commerce-name'],
    'commerce-id': data['commerce-id'],
    'X-Auth': data['X-Auth'],
    'X-Time': data['X-Time'],
    mcc: data.mcc,
  }

  request.app.set(`newHeaders_${referencia}`, JSON.stringify(headers));

}

function set3dsResponse( response, status3ds  ){
  response.locals.response3ds = status3ds;
}

function is3dsResponseSet ( response ){
  return !! response.locals.response3ds ;
}

async function save3dsResponseToDB( status3ds, referencia) {
  const data3DS = {
    body: {},
    'X-Auth': '',
    'X-Time': '',
    transStatus: status3ds.transStatus,
    eci: status3ds.eci,
    acsTransID: status3ds.acsTransID,
    dsTransID: status3ds.dsTransID,
    threeDSServerTransID: status3ds.threeDSServerTransID,
    authenticationValue: status3ds.authenticationValue
  };
  await db.tresds.update(data3DS, { where: { referencia_tx: referencia } })
}
