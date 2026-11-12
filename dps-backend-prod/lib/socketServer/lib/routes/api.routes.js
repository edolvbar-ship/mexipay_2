/**
 * @file Main API routes aggregator for the gateway.
 * Mounts payment links, reports, v2 API, activity, auth, notification, and Selia payment routes.
 * Also contains utility endpoints for ticket email, payment links, ISO3166, payouts, and Selia processing.
 * PCI DSS 4.0: Req 4.2.1 (CHD in transit), Req 8.2.1 (authentication), Req 10.2.1 (audit logging).
 */
const express = require('express');
const path = require('path');
const exphbs = require('express-handlebars');
const { default: axios } = require('axios');
const { check, validationResult } = require('express-validator');
const { getTrans, getTicket } = require('../controllers/reportes.controller');
const db = require('../sequelize/init');
const mailService = require('../services/mail.service');
const { generatePassword } = require('../services/general.service');
const helpers = require('../lib/helpers');
const helpersText = require('../../../helpers/lib/helpers');
const { unpackEnvTag } = require('../../../emv-packet/lib/emvPacket');
const { generateTKA } = require('../lib/tka');
const moment = require('moment');
const apiroutes = require('./api/api.routes');
const router = express.Router();
const crypto = require('crypto');

const app = express();
app.set('views', path.join(__dirname, '..', 'views'));
app.set('view engine', 'hbs');

// Add this to see if the route is being mounted
console.log('🔄 MOUNTING PAYMENT LINKS ROUTES...');
/** Mounts payment link processing routes. */
router.use('/processing/links', require('./processing/links/ecommerce.links.routes'));
console.log('✅ PAYMENT LINKS ROUTES MOUNTED');
// app.js - agregar esta línea
// const affiliatePaymentsRouter = require('./processing/links/affiliatePayments.routes');
// app.use('/api', affiliatePaymentsRouter);

/** Mounts the v2 API route aggregator. */
router.use('/v2', apiroutes);

// Mount reports routes
console.log('🔄 MOUNTING REPORTS ROUTES...');
/** Mounts report generation routes (requires authentication via v2 or parent). */
router.use('/reports', require('./reports.routes'));
console.log('✅ REPORTS ROUTES MOUNTED');

/** Mounts activity log routes. */
const activityRoutes = require('../routes/api/activities/activityRoutes');
router.use('/activities', activityRoutes);


/**
 * POST /api/getTicket
 * Sends a transaction ticket by email.
 * Validates request body, fetches the ISO message, formats the ticket, and sends it via mailService.
 */
router.post('/getTicket',
  check('email', 'Correo no válido').isEmail(),
  check(['trace_id', 'authorization', 'id'], 'Valor no válido').not().isEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { is_rejected: isRejected, id_message: idMessage } = req.body;

    const byId = !!(isRejected && idMessage);

    let tx = (byId) ? await db.isoMessage.findByPk(idMessage,{ attributes: ['id_message'] }) : await db.isoMessage.findOne({
      attributes: ['id_message'],
      where: {
        reference_number: req.body.id,
        authorization: req.body.authorization,
        trace_number: req.body.trace_id
      }
    });

    if (!tx)
      return res.status(404).json({ errors: 'Transaccion no localizada' });

    let TX = await getTrans({ id_message: tx.id_message });

    if (!TX)
      return res.status(404).json({ errors: 'Transaccion no localizada', line: 2 });

    let TxFinal = null;
    for (const key in TX) {
      if (Object.hasOwnProperty.call(TX, key)) {
        const element = JSON.parse(JSON.stringify(TX[key]));
        element.finalMount = parseFloat(formatMount(element.amount)).toFixed(2);
        const date = moment.tz(new Date(element.creation_date), 'America/Mexico_City');
        element.fecha = date.format("DD/MM/YYYY");
        element.F1 = date.format("DD/MM/YYYY");
        element.F2 = date.format("HH:mm:ss");

        if (element.more_info) {
          element.more_info = JSON.parse(element.more_info);

          const monto = parseFloat(formatMount(element.amount));
          const tip = (element.more_info && element.more_info.tip) ? parseFloat(element.more_info.tip) : 0;
          element.amount = '$ ' + (monto - tip).toFixed(2);

          if (element.more_info.tip) {
            element.more_info.tip = tip.toFixed(2);
          }
          element.more_info.object = unpackEnvTag(element.more_info.emv_tags).tknB2;
          if (element.more_info.object) {
            element.more_info.object.arqc_l = '************' + element.more_info.object.arqc.substr(element.more_info.object.arqc.length - 4);
            element.more_info.object.aid = element.more_info.object.aid.substr(0, 17);
            element.more_info.object.nombre = hex2a(element.more_info?.object?.cardholderName ?? '' );
            element.more_info.object.aplicationlabel = element.more_info.object.aplicationlabel;
            element.more_info.object.apn = element.more_info.object.apn;
          }
        } else {
          element.amount = '$ ' + (parseFloat(formatMount(element.amount))).toFixed(2);
        }

        TxFinal = element;
      }
    }

    if (req.body.AID) {
      TxFinal.requestData = req.body;
      TxFinal.requestData.ARQC_l = TxFinal.requestData.ARQC.substr(TxFinal.requestData.ARQC.length - 4);
    }

    req.body.data = JSON.stringify(TxFinal);
    req.api = true;
    let ticket = await getTicket(req, res);
    console.log('ticket -----> ', ticket)
    if (!ticket || ticket.error)
      return res.status(404).json({ errors: 'Error en generar el ticket', data: ticket?.error || 'Err. Desconocido' });

    const appName = process.env.APP_NAME || '';
    return await new Promise((resolve, reject) => {
      app.render('emails/ticket', { layout: false, url: ticket.pathApi, name: ticket.data, baseurl: `${req.protocol}://${req.headers.host}`, appName }, async function (_err, html) {
        let p = path.join(process.cwd(), 'lib', 'socketServer', 'lib', 'public', 'images', 'mail', 'cuenta.png')
        try {
          const response = await mailService.sendEmail({
            emailTo: req.body.email,
            subject: 'Ticket de transacción ' + TxFinal.trace_number,
            html: html,
          });

          console.log('response ----->', response);

          return resolve(response);
        } catch (error) {
          console.error(error)

          return reject({ error: null, msg: error.message });
        }
      });
    }).then(response => {
      if (response.error)
        return res.status(400).json({ error: response.error, msg: response.msg });
      else
        return res.status(200).json({ error: null, response });
    }).catch(err => res.status(400).json({ error: null, err }))
  })



/**
 * GET /api/paymentold
 * Resolves payment-link data by token, reference, or validates a payment button checksum.
 */
router.get('/paymentold', async (req, res) => {
  if(req.query.token){
    const reg = await db.linksPago.findOne({
      attributes: { include: ['concepto', 'created_at', 'id', 'id_merchant', 'id_user', 'monto', 'status'], exclude: ['deleted_at'] },
      where: { token: req.query.token },
      include: [
        {
          model: db.merchant,
          as: 'merchant',
          attributes: { include: ['name_merchant', 'razon_social', 'id_medio_link'] },
          include: ['iso_client_dt', 'profile_trans']
        }
      ]
    });



    if(!reg)
      return res.status(200).json({
        description: 'Link inválido',
        statusCode: 1
      });

    if (reg.expire_date && new Date(reg.expire_date) < new Date())
      return res.status(200).json({
        description: 'Link caducado',
        statusCode: 3
      });

    if (reg.status > 1)
      return res.status(200).json({
        description: 'Link caducado',
        statusCode: 4
      });

      const bitmap = await helpers.decript_bitmap_profile(reg.merchant.profile_trans.hex_value);

      const hasPartial = bitmap.indicadores.includes(1);

      let allowedPlans = JSON.parse(reg.merchant.MSI) || [];
      allowedPlans = allowedPlans.filter(obj => parseFloat(obj.min_mount) <= parseFloat(reg.monto) );
      allowedPlans = allowedPlans.map(obj => helpersText.padLeft(obj.type,2,'0'));

    return res.status(200).json({
      statusCode: 0,
      data: {...reg.get({plain: true}), hasPartial, allowedPlans}
    });
  } else if(req.query.reference) {
    const reference = req.query.reference;
    const evalua = await db.tresds.findOne({ where: { referencia_tx: reference }, raw: true });
    return res.status(200).json({
      statusCode: 0,
      data: evalua
    });
  }  else {

    const data = req.query;

    if (!data.checksum || !data.x_auth || !data.x_time || !data.commerce_id || !data.concepto || !data.monto || !data.url_respuesta || !data.commerce_name){
      dd('---- botón rechazado por falta de información');
      return res.status(200).json({
        description: 'Botón inválido',
        statusCode: 1
      });
    }

    const merchant = await db.merchant.findOne({
      where: { afiliation_number: data.commerce_id, name_merchant: data.name_merchant || data.commerce_name },
      include: ['iso_client_dt', 'profile_trans']
    });

    if(!merchant){
      dd('---- botón rechazado por comercio no encontrado');
      return res.status(200).json({
        description: 'Botón inválido',
        statusCode: 1
      });
    }

    const chain = `commerce_id=${data.commerce_id}monto=${data.monto}.token=${merchant.token_activation}`;

    if (generateSHA256(chain) !== data.checksum) {
      dd('---- botón rechazado por checksum no valido');
      return res.status(200).json({
        description: 'Botón inválido',
        statusCode: 1
      });
    }

    const bitmap = await helpers.decript_bitmap_profile(merchant.profile_trans.hex_value);

    const hasPartial = bitmap.indicadores.includes(1);

    let allowedPlans = JSON.parse(merchant.MSI) || [];
    allowedPlans = allowedPlans.filter(obj => parseFloat(obj.min_mount) <= (parseFloat(data.monto)/100) );
    allowedPlans = allowedPlans.map(obj => helpersText.padLeft(obj.type,2,'0'));


    const reg = {
      id: 0,
      token: '',
      id_user: '',
      id_merchant: merchant.id_merchant,
      concepto: data.concepto,
      monto: parseFloat(data.monto)/100,
      expire_date: '',
      status: 1,
      info_adicional: '',
      created_at: '',
      updated_at: '',
      merchant: merchant,
      hasPartial,
      allowedPlans
    };

    return res.status(200).json({
      statusCode: 0,
      data: reg
    });

  }

});

/**
 * Computes SHA256 hash of a string.
 * Used for payment button checksum validation.
 * @param {string} chain - Input string.
 * @returns {string} Hex SHA256 digest.
 */
function generateSHA256(chain) {
  const hash = crypto.createHash('sha256');
  hash.update(chain);
  return hash.digest('hex');
}

// router.post('/payment', async (req, res) => {
//   const data = await req.session.paymentData;
//   req.session.paymentData = null;
//   return res.json({ message: "obteniendo datos", data });
// })

/**
 * GET /api/iso3166
 * Returns the list of countries from the ciso3166 table.
 */
router.get('/iso3166', async (_req, res) => {
  const iso = await db.ciso3166.findAll({
    attributes: ['country', 'alpha2', 'alpha3'],
    raw: true
  });

  return res.status(200).json({ iso });
})

/**
 * POST /api/payment/payout
 * Processes a card-not-present payment through the gateway charge endpoint.
 * Decodes base64 form data, builds an ISO request, and forwards it to /gateway/v1/ecommerce/charge.
 */
router.post('/payment/payout', async (req, res) => {
  let form_data = null;
  console.log('entra en payout');
  try {
    form_data = new Buffer.from(req.body.data, 'base64').toString()
    form_data = (typeof form_data == 'string') ? JSON.parse(form_data) : form_data;
  } catch (error) {
    return res.status(400).json({
      error: true,
      error_code: '00-1',
      description: 'Datos mal formados, favor de recargar la pagina',
      data: { error, data: req.body.data },
      authorization: null
    });
  }
  // CREA LA CABECERA
  const ts = `${Date.now()}`;
  let merchant = await db.merchant.findOne({ where: { id_merchant: form_data.dataPayment.id_merchant } });
  let tka = await generateTKA(merchant.token_activation, ts, merchant.afiliation_number);
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'commerce-id': merchant.afiliation_number,
    'commerce-name': merchant.name_merchant,
    'X-Time': ts,
    'X-Auth': tka
  }
  let chargePlan;
  if(form_data.dataPayment.chargePlan){
    chargePlan = {
      first_payment: "00",
      months: form_data.dataPayment.chargePlan,
      type: "03"
    };
  }
  // CREA EL BODY
  const tarjeta = form_data.tarjeta.split('-').join('');

  const baseUrl = process.env.FRONT_URL || 'https://drakops.com.mx';
  const body = {
    "isoType": "AGRS",
    "amount": form_data.dataPayment.monto,
    'concepto': (form_data.dataPayment.concepto != undefined && form_data.dataPayment.concepto != '') ? form_data.dataPayment.concepto : '',
    'url_comercio': (form_data.dataPayment.url_comercio != undefined && form_data.dataPayment.url_comercio != '') ? form_data.dataPayment.url_comercio : '',
    'currency': "MXN",
    "reference": ('' + Date.now()).substring(0, 10),
    "cardInformation": {
      "holder_name": form_data.nombre,
      "card_number": tarjeta,
      "last4": tarjeta.substr(tarjeta.length - 4),
      "bin": tarjeta.substr(0, 6),
      "expiration_year": form_data.venci.split('/')[1],
      "expiration_month": form_data.venci.split('/')[0],
      "cvv": form_data.cvv
    },
    chargePlan,
    "entry_mode": "manual",
    "authentication": "unknown",
    "draftCapture": "1",
    "tpv": false,
    "periodic": false,
    'billingAddress': {
      'street': form_data.calle,
      'street2': '',
      'state': form_data.ciudad,
      'country': form_data.pais,
      'zip': form_data.cp,
    },
    'email': form_data.email,
    "link_pago": (form_data.linkPago == 2) ? true : false,
    url: form_data.dataPayment.token ? `${baseUrl}/payment?token=${form_data.dataPayment.token}&` : `${baseUrl}/api/pay?`,
  }

  await axios.post(`${req.protocol}://${req.get('host')}/gateway/v1/ecommerce/charge`, body, { headers }).then(async response => {
    console.log('====================entra en charge==============')
    console.log(response.data);
    if (response.data.url)
      return res.json({ url: response.data.url })

    if (response.data.resp_code != '00') {
      return res.json(response.data);
    }
    let inf = form_data.dataPayment.info_adicional;
    inf = inf ? JSON.parse(inf) : {};
    inf.tx = {};
    inf.tx.authorization = response.data.authorization;
    inf.tx.referencia = response.data.id;
    inf.tx.trace_number = response.data.trace_id;
    if (body.link_pago == true ) {
      await db.linksPago.update({ status: response.data.resp_code == '00' ? 2 : 3, info_adicional: JSON.stringify(inf) }, { where: { id: form_data.dataPayment.id } }).then(result =>{
        console.log(result);
      }).catch(error => {
        console.log(error)
      })
    }
    return res.json(response.data);
  }).catch(error => {
    if(error.response?.status == 504){
      return res.json({
        error: true,
        resp_code: error.response.data.resp_code | error.response.data.error_code,
        description: error.response.data.description,
        data: error.response.data.response,
        authorization: null
      })
    }
    dd(error.stack, 'error');
    return res.json({
      error: true,
      resp_code: '05',
      description: 'Rechazada por 3DS',
      data: error,
      authorization: null
    })
  })
});


/**
 * POST /api/payment2
 * Returns 3DS transaction data or merchant ISO client information.
 */
router.post('/payment2', async (req, res) => {
  console.log('api.routes payment2')
  if(req.body.reference != undefined && req.body.reference != ''){
    const response = await db.tresds.findOne({ where: { referencia_tx: req.body.reference }, raw: true });
    console.log('api.routes payment2 (reference)', response)
    console.log('api.routes payment2 (reference)', `commerce-name: ${response['commerce-name']}`)
    console.log('api.routes payment2 (reference)', `commerce-id (folio): ${response['commerce-id']}`)
    const comercio = await db.merchant.findOne({
      include: [
        {
          model: db.isoClient,
          attributes: ['name'],
          as: 'iso_client_dt'
        }
      ],
      where: {
        name_merchant: response['commerce-name'],
        afiliation_number: response['commerce-id']
      },
      raw: true
    });

    console.log('api.routes payment2 (reference)', comercio['iso_client_dt.name'])

    return res.json({ response: Object.assign(response, { cliente:comercio['iso_client_dt.name'] }) });
  }

  const response = await db.merchant.findOne({
    where: { name_merchant: req.body.name_merchant },
    include: [
      {
        model: db.isoClient,
        attributes: ['name'],
        as: 'iso_client_dt'
      }
    ],
    raw: true
  });

  console.log('api.routes payment2 (no reference)', response['iso_client_dt.name'])

  console.log('api.routes payment2 (no reference)', response)

  return res.json({ response });
});


/**
 * POST /api/sendDataTx
 * Echoes the request body back (used for transaction data pass-through).
 */
router.post('/sendDataTx', (req, res) => {
  res.json(req.body);
})

// APIS EXTERNAS
/** Mounts external authentication routes. */
router.use('/auth', require('./api_auth.routes'));

/**
 * Formats an integer amount string into a decimal string (e.g., 12345 -> 123.45).
 * @param {string} numberStr - Amount string where the last two digits are decimals.
 * @returns {string} Formatted decimal amount.
 */
function formatMount(numberStr) {
  const num = [parseInt(numberStr.substr(0, 10)), numberStr.substr(-2)];
  return num[0] + '.' + num[1];
}

/**
 * Converts a hex string to an ASCII string.
 * @param {string} hexx - Hex string.
 * @returns {string} ASCII representation.
 */
function hex2a(hexx) {
  var hex = hexx.toString();//force conversion
  var str = '';
  for (var i = 0; i < hex.length; i += 2)
    str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
  return str;
}

/** Mounts notification routes (SMS, WhatsApp). */
router.use('/notifications', require('./api_notifications.routes'));

const SeliaWebService = require('../services/seliaWebService');
const sandboxCardHandler = require('../services/sandboxCardHandler');
const paymentValidator = require('../services/paymentValidator');

/** Selia payment processor service instance. */
// Initialize Selia service with sequelize for error code lookup
const seliaService = new SeliaWebService({
    host: process.env.SELIA_HOST,
    port: process.env.SELIA_PORT,
    aesKey: process.env.SELIA_AES_KEY,
    companyId: process.env.SELIA_COMPANY_ECOMMERCE_ID,
    username: process.env.SELIA_USERNAME,
    password: process.env.SELIA_PASSWORD,
    debug: process.env.SELIA_DEBUG === 'true',
    db: db // Add sequelize for error code lookup
});

const { getTransactionTypeCode } = require('../helpers/transactionTypes');

/**
 * POST /api/payment/selia
 * Processes a card payment through the Selia processor.
 * Supports payment-link validation and stores the transaction result.
 */
router.post('/payment/selia', async (req, res) => {
    console.log('=== SELIA PAYMENT PROCESSING ===');

    let form_data = null;
    try {
        // Parse the incoming data (same format as your existing payout)
        form_data = Buffer.from(req.body.data, 'base64').toString();
        form_data = (typeof form_data == 'string') ? JSON.parse(form_data) : form_data;
    } catch (error) {
        return res.status(400).json({
            error: true,
            error_code: '00-1',
            description: 'Datos mal formados, favor de recargar la pagina',
            data: { error, data: req.body.data },
            authorization: null
        });
    }

    try {
        const { dataPayment, tarjeta, nombre, venci, cvv, email, calle, ciudad, pais, cp } = form_data;

        // Validate payment link if token exists
        if (dataPayment.token) {
            const link = await db.linksPago.findOne({
                where: { token: dataPayment.token, status: 1 }
            });

            if (!link) {
                return res.status(404).json({
                    error: true,
                    error_code: '04',
                    description: 'Link no encontrado o ya procesado'
                });
            }

            // Check expiration
            if (link.expire_date && new Date(link.expire_date) < new Date()) {
                return res.status(400).json({
                    error: true,
                    error_code: '03',
                    description: 'El link de pago ha expirado'
                });
            }
        }

        // Validación completa de campos de pago
        const fieldValidation = paymentValidator.validateFlatPaymentFields({
            tarjeta, venci, cvv,
            monto: dataPayment.monto
        });
        if (!fieldValidation.valid) {
            console.log('❌ PAYMENT VALIDATION FAILED (api/payment/selia):', fieldValidation.error);
            return res.status(fieldValidation.status).json({
                error: true,
                error_code: fieldValidation.error.code,
                description: fieldValidation.error.message,
                authorization: null
            });
        }

        // Prepare Selia payment data
        const cleanCard = tarjeta.split('-').join('');

        // Validate card against environment (dev test cards vs prod)
        const cardValidation = sandboxCardHandler.validateCardForEnvironment(cleanCard);
        if (!cardValidation.allowed) {
            console.log('❌ CARD VALIDATION FAILED (api/payment/selia):', cardValidation);
            return res.status(403).json({
                error: true,
                error_code: cardValidation.code,
                description: cardValidation.error,
                authorization: null
            });
        }

        const paymentData = {
            cardNumber: cleanCard,
            amount: Math.round(dataPayment.monto * 100).toString(), // Convert to cents
            cvv: cvv,
            expiration: `${venci.split('/')[0]}${venci.split('/')[1].slice(-2)}`, // MMYY format
            transactionType: getTransactionTypeCode('charge'), // 501 for charge
            entryMode: '1', // Manual entry
            sandboxTest: !cardValidation.useDummy && sandboxCardHandler.isDevMode()
        };

        console.log('Processing Selia payment:', {
            amount: paymentData.amount,
            card: `${cleanCard.substring(0, 6)}...${cleanCard.substring(cleanCard.length - 4)}`
        });

        // Process with Selia
        let seliaResult;
        if (cardValidation.useDummy) {
            console.log('🧪 SANDBOX MODE (api/payment/selia): Processing dummy transaction for test card');
            seliaResult = sandboxCardHandler.processDummyPayment(paymentData);
            console.log('🧪 Dummy transaction result:', {
                success: seliaResult.success,
                scenario: seliaResult._scenario,
                responseCode: seliaResult.responseCode,
                responseMessage: seliaResult.responseMessage
            });
        } else {
            seliaResult = await seliaService.processPayment(paymentData);
        }

        // Update link status if it's a link payment
        if (dataPayment.token) {
            const inf = dataPayment.info_adicional ? JSON.parse(dataPayment.info_adicional) : {};
            inf.tx = {
                authorization: seliaResult.authorizationCode,
                referencia: seliaResult.transactionId,
                trace_number: seliaResult.transactionId, // Using transactionId as trace
                processor: 'selia'
            };

            await db.linksPago.update(
                {
                    status: seliaResult.success ? 2 : 3, // 2 = approved, 3 = declined
                    selia_transaction_id: seliaResult.transactionId,
                    selia_authorization_code: seliaResult.authorizationCode,
                    selia_response_code: parseInt(seliaResult.responseCode), // Store the error code for foreign key
                    selia_response_data: JSON.stringify(seliaResult),
                    processor_type: 'selia', // Set processor type
                    info_adicional: JSON.stringify(inf),
                    updated_at: new Date()
                },
                { where: { token: dataPayment.token } }
            );

            // Log the transaction with error details if available
            if (seliaResult.responseCode && seliaResult.responseCode !== '0') {
                console.log('Selia payment declined:', {
                    token: dataPayment.token,
                    responseCode: seliaResult.responseCode,
                    responseMessage: seliaResult.responseMessage,
                    transactionId: seliaResult.transactionId
                });
            }
        }

        // Return standardized response (matching your existing format)
        if (seliaResult.success) {
            return res.json({
                error: false,
                resp_code: '00',
                description: seliaResult.responseMessage, // Now from Selia error codes catalogue
                authorization: seliaResult.authorizationCode,
                trace_id: seliaResult.transactionId,
                id: seliaResult.transactionId,
                data: {
                    processor: 'selia',
                    raw_response: seliaResult.rawResponse,
                    selia_response_code: seliaResult.responseCode
                }
            });
        } else {
            return res.json({
                error: true,
                resp_code: seliaResult.responseCode || '05',
                description: seliaResult.responseMessage, // Now from Selia error codes catalogue
                authorization: null,
                data: {
                    processor: 'selia',
                    raw_response: seliaResult.rawResponse,
                    selia_response_code: seliaResult.responseCode
                }
            });
        }

    } catch (error) {
        console.error('Selia payment error:', error);
        return res.status(500).json({
            error: true,
            resp_code: '06',
            description: `Error procesando pago: ${error.message}`,
            authorization: null
        });
    }
});

/**
 * POST /api/payment/selia/query
 * Queries the status/details of a Selia transaction by transactionId.
 */
router.post('/payment/selia/query', async (req, res) => {
    try {
        const { transactionId } = req.body;

        if (!transactionId) {
            return res.status(400).json({
                error: true,
                description: 'Transaction ID is required'
            });
        }

        const queryResult = await seliaService.queryTransaction(transactionId);

        return res.json({
            error: !queryResult.success,
            resp_code: queryResult.responseCode,
            description: queryResult.responseMessage, // Now from Selia error codes catalogue
            transaction_id: queryResult.transactionId,
            authorization: queryResult.authorizationCode,
            data: queryResult.parsedFields
        });

    } catch (error) {
        console.error('Selia query error:', error);
        return res.status(500).json({
            error: true,
            description: `Error consultando transacción: ${error.message}`
        });
    }
});

/**
 * GET /api/payment/:token/details
 * Returns payment link details including Selia response and error information.
 */
router.get('/payment/:token/details', async (req, res) => {
    try {
        const { token } = req.params;

        const payment = await db.linksPago.findOne({
            where: { token: token },
            include: [{
                model: db.seliaErrorCode,
                as: 'selia_error_detail',
                required: false
            }]
        });

        if (!payment) {
            return res.status(404).json({
                error: true,
                description: 'Pago no encontrado'
            });
        }

        // Build response with error details if available
        const response = {
            token: payment.token,
            amount: payment.monto,
            status: payment.status,
            created_at: payment.created_at,
            processor_type: payment.processor_type,
            selia_transaction_id: payment.selia_transaction_id,
            selia_authorization_code: payment.selia_authorization_code
        };

        // Add error details if payment failed and we have error code info
        if (payment.status === 3 && payment.selia_error_detail) {
            response.error_details = {
                code: payment.selia_response_code,
                message: payment.selia_error_detail.mensaje_terminal,
                type: payment.selia_error_detail.type,
                description: payment.selia_error_detail.descripcion
            };
        }

        // Add raw response data if available
        if (payment.selia_response_data) {
            try {
                response.raw_response = JSON.parse(payment.selia_response_data);
            } catch (e) {
                response.raw_response = payment.selia_response_data;
            }
        }

        return res.json({
            error: false,
            data: response
        });

    } catch (error) {
        console.error('Payment details error:', error);
        return res.status(500).json({
            error: true,
            description: `Error obteniendo detalles del pago: ${error.message}`
        });
    }
});

/**
 * POST /api/payment/selia/reverse
 * Reverses a Selia transaction within the allowed reversal window (24 hours).
 */
router.post('/payment/selia/reverse', async (req, res) => {
    try {
        const { transactionId, amount, token } = req.body;

        if (!transactionId) {
            return res.status(400).json({
                error: true,
                description: 'Transaction ID is required'
            });
        }

        // If token is provided, verify the payment exists and is reversible
        if (token) {
            const payment = await db.linksPago.findOne({
                where: {
                    token: token,
                    processor_type: 'selia'
                }
            });

            if (!payment) {
                return res.status(404).json({
                    error: true,
                    description: 'Pago no encontrado'
                });
            }

            // Check if payment can be reversed (typically within 24 hours)
            const paymentAge = new Date() - new Date(payment.created_at);
            const maxReversalTime = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

            if (paymentAge > maxReversalTime) {
                return res.status(400).json({
                    error: true,
                    description: 'El pago no puede ser reversado después de 24 horas'
                });
            }
        }

        const reversalResult = await seliaService.reverseTransaction(transactionId, amount);

        // Update payment status if token provided
        if (token && reversalResult.success) {
            await db.linksPago.update(
                {
                    status: 4, // 4 = reversed/refunded
                    selia_response_data: JSON.stringify(reversalResult),
                    updated_at: new Date()
                },
                { where: { token: token } }
            );
        }

        return res.json({
            error: !reversalResult.success,
            resp_code: reversalResult.responseCode,
            description: reversalResult.responseMessage, // Now from Selia error codes catalogue
            transaction_id: reversalResult.transactionId,
            authorization: reversalResult.authorizationCode,
            data: {
                original_transaction_id: transactionId,
                reversal_amount: amount
            }
        });

    } catch (error) {
        console.error('Selia reversal error:', error);
        return res.status(500).json({
            error: true,
            description: `Error reversando transacción: ${error.message}`
        });
    }
});

module.exports = router;