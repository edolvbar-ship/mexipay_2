/**
 * @file Ecommerce payment link and affiliate/payout processing routes.
 * Integrates SeliaWebService for payment processing, payment link validation, payouts, and ISO3166 lookups.
 * PCI DSS 4.0: Req 3.4 / 3.5.1 (CHD protection), Req 4.2.1 (secure transmission), Req 8.2.1 / 8.3.2 (authentication/TKA), Req 10.2.1 (audit logging), Req 11.3.1 (secure processing).
 */
const express = require('express');
const router = express.Router();
const db = require('../../../sequelize/init');
const { default: axios } = require('axios');
const crypto = require('crypto');
const { generateTKA } = require('../../../lib/tka');
const SeliaWebService = require('../../../services/seliaWebService');
const TransactionObjectService = require('../../../services/transactionObjectService');
const sandboxCardHandler = require('../../../services/sandboxCardHandler');
const paymentValidator = require('../../../services/paymentValidator');
const helpers = require("../../../lib/helpers");
const { getTransactionTypeCode } = require("../../../helpers/transactionTypes");

/** Initializes the Selia web service for payment processing. */
const seliaService = new SeliaWebService({
    host: process.env.SELIA_HOST,
    port: process.env.SELIA_PORT,
    aesKey: process.env.SELIA_AES_KEY,
    // companyId: process.env.SELIA_COMPANY_ECOMMERCE_ID, // REMOVE THIS LINE
    username: process.env.SELIA_USERNAME,
    password: process.env.SELIA_PASSWORD,
    debug: process.env.SELIA_DEBUG === 'true',
    db: db
});

/** Initializes the transaction object (S3) service. */
const txnObjectService = new TransactionObjectService();

/**
 * Returns the current local time in HHMMSS format.
 * @returns {string} Local time string.
 */
const horaLocalBnrg = function () {
    const d = new Date();
    return (`0${d.getHours()}`).substr(-2)
        + (`0${d.getMinutes()}`).substr(-2)
        + (`0${d.getSeconds()}`).substr(-2);
};

/**
 * Returns the current local date in MMDD format.
 * @returns {string} Local date string.
 */
const fechaLocalBnrg = function () {
    const d = new Date();
    return (`0${d.getMonth() + 1}`).substr(-2)
        + (`0${d.getDate()}`).substr(-2);
};

/**
 * Detects the card brand from a card number.
 * @param {string} cardNumber - Primary Account Number.
 * @returns {string} 2-char card nature code for iso_message.card_type (varchar(2)): 'C' (credit), 'D' (debit), 'G' (generic).
 */
function getCardType(cardNumber) {
    const firstDigit = cardNumber.charAt(0);
    const firstTwoDigits = cardNumber.substring(0, 2);

    if (firstDigit === '4') return 'C';
    if (firstTwoDigits >= '51' && firstTwoDigits <= '55') return 'C';
    if (firstTwoDigits === '34' || firstTwoDigits === '37') return 'C';
    if (firstTwoDigits === '36' || firstTwoDigits === '38' || (firstTwoDigits >= '30' && firstTwoDigits <= '35')) return 'C';
    if (firstTwoDigits === '60' || firstTwoDigits === '62' || firstTwoDigits === '64' || firstTwoDigits === '65') return 'D';
    return 'G';
}

/**
 * Formats a card expiration date as Selia YYMM.
 * @param {string|number} expMonth - Expiration month.
 * @param {string|number} expYear - Expiration year.
 * @returns {string} YYMM expiration string.
 */
function formatSeliaExpiration(expMonth, expYear) {
    // Ensure month is 2 digits
    const month = expMonth.toString().padStart(2, '0');
    // Get last 2 digits of year
    const year = expYear.toString().slice(-2);
    return `${year}${month}`;
}

// ==================== AFFILIATE PAYMENT PROCESSING ====================
/**
 * Processes direct affiliate payments using Selia.
 * PCI DSS 4.0: Req 3.4 / 3.5.1 (CHD protection), Req 4.2.1 (secure transmission), Req 10.2.1 (audit logging).
 */

router.post('/affiliate/payment', async (req, res) => {
    const logPrefix = '🤝 AFFILIATE_PAYMENT';
    console.log(`${logPrefix} 🔍 INICIANDO PAGO AFILIADO DIRECTO`);

    try {
        const {
            affiliate_code,
            order_id,
            amount,
            currency = "MXN",
            description = "",
            card,
            customer,
            billing_address
        } = req.body;

        console.log(`${logPrefix} Datos recibidos:`, { affiliate_code, order_id, amount });

        // Validación completa del payload
        const payloadValidation = paymentValidator.validateAffiliatePaymentPayload(req.body);
        if (!payloadValidation.valid) {
            console.log(`${logPrefix} ❌ VALIDACIÓN FALLIDA:`, payloadValidation.error);
            return res.status(payloadValidation.status).json({
                success: false,
                error: payloadValidation.error,
                order_id: order_id,
                status: 'rejected',
                timestamp: new Date().toISOString()
            });
        }
        console.log(`${logPrefix} ✅ VALIDACIÓN DE PAYLOAD COMPLETADA`);

        // 1. Validar merchant
        const merchant = await db.merchant.findOne({
            where: { id_merchant: parseInt(affiliate_code) }
        });

        if (!merchant) {
            console.log(`${logPrefix} ❌ Merchant no encontrado para affiliate_code:`, affiliate_code);
            return res.status(401).json({
                success: false,
                error: "Merchant/afiliado no encontrado"
            });
        }

        console.log(`${logPrefix} ✅ Merchant encontrado:`, merchant.name_merchant);

        // 2. Crear link de pago interno
        const paymentToken = require('uuid').v4();
        const PAYLOAD = {
            token: paymentToken,
            id_user: 0,
            id_merchant: merchant.id_merchant,
            concepto: description || `Pago afiliado - Orden ${order_id}`,
            monto: parseFloat(amount),
            expire_date: new Date(Date.now() + 24 * 60 * 60 * 1000),
            status: 1,
            info_adicional: JSON.stringify({
                affiliate_code: affiliate_code,
                order_id: order_id,
                customer: customer,
                billing_address: billing_address,
                source: 'affiliate_api_direct',
                created_at: new Date().toISOString()
            }),
            selia_transaction_id: null,
            selia_authorization_code: null,
            selia_response_code: null,
            selia_response_data: null,
            processor_type: 'selia'
        };

        console.log(`${logPrefix} 📦 Creando link de pago:`, PAYLOAD);
        const paymentLink = await db.linksPago.create(PAYLOAD);

        console.log(`${logPrefix} ✅ Link de pago interno creado:`, paymentToken);

        // 3. Preparar datos para Selia con formato de expiración específico
        const cleanCard = card.number.replace(/\D/g, '');

        // 3.5. Validate card against environment (dev test cards vs prod)
        const cardValidation = sandboxCardHandler.validateCardForEnvironment(cleanCard);
        if (!cardValidation.allowed) {
            console.log(`${logPrefix} ❌ CARD VALIDATION FAILED:`, cardValidation);
            return res.status(403).json({
                success: false,
                error: {
                    code: cardValidation.code,
                    message: cardValidation.error
                },
                order_id: order_id,
                status: 'rejected',
                timestamp: new Date().toISOString()
            });
        }

        const paymentData = {
            affiliate_code: affiliate_code,
            merchantId: merchant.id_merchant, // ADDED: Pass merchantId so SeliaWebService can fetch selia_id
            cardNumber: cleanCard,
            amount: Math.round(parseFloat(amount) * 100).toString(),
            cvv: card.cvv,
            expiration: formatSeliaExpiration(card.exp_month, card.exp_year),
            transactionType: getTransactionTypeCode('charge'), // 301 for charge
            entryMode: '81',
            sandboxTest: !cardValidation.useDummy && sandboxCardHandler.isDevMode()
        };

        console.log(`${logPrefix} 📦 Enviando a Selia:`, {
            merchantId: merchant.id_merchant,
            card: `${cleanCard.substring(0, 6)}...${cleanCard.substring(cleanCard.length - 4)}`,
            amount: paymentData.amount,
            expiration: paymentData.expiration,
            exp_month: card.exp_month,
            exp_year: card.exp_year
        });
        console.log(paymentData)

        // 4. Get valid id_operation from ciso_operation table - FIXED: use 'code' column
        console.log(`${logPrefix} 🔍 BUSCANDO OPERACIÓN VÁLIDA EN ciso_operation...`);
        const validOperation = await db.cisoOperation.findOne({
            where: {
                // Use ISO message type '0200' for charges, not Selia transaction type '301'
                code: '0200' // Sale operation (ISO 8583 message type)
            },
            raw: true
        });

        if (!validOperation) {
            console.log(`${logPrefix} ⚠️ No se encontró operación 0200, buscando cualquier operación válida...`);
            // Fallback: get any valid operation
            const anyOperation = await db.cisoOperation.findOne({
                raw: true
            });

            if (!anyOperation) {
                console.log(`${logPrefix} ❌ No se encontraron operaciones válidas en ciso_operation`);
                throw new Error('No valid operations found in ciso_operation table');
            }

            console.log(`${logPrefix} ✅ Usando operación:`, anyOperation.id_operation, anyOperation.name);
            var id_operation = anyOperation.id_operation;
        } else {
            console.log(`${logPrefix} ✅ Operación encontrada:`, validOperation.id_operation, validOperation.name);
            var id_operation = validOperation.id_operation;
        }

        // 5. Crear registro ISO antes de procesar
        const now = new Date();
        const trace_number = `aff${paymentLink.id}${Date.now().toString().substr(-6)}`.substring(0, 10);
        const reference_number = `ref${paymentLink.id}${Date.now().toString().substr(-6)}`.substring(0, 12);

        console.log(`${logPrefix} 🏗️ CONSTRUYENDO REGISTRO ISO`);
        const isoMessageRecord = {
            id_operation: id_operation, // Use valid id_operation from ciso_operation
            msg_type: '0200',
            trace_number: trace_number,
            reference_number: reference_number,
            amount: Math.round(parseFloat(amount) * 100), // Almacenar en centavos
            resp_code: '99', // Código por defecto antes del procesamiento
            authorization: null,
            bin: cleanCard.substring(0, 6),
            last4: cleanCard.substring(cleanCard.length - 4),
            draft_capture: '0',
            entry_mode: paymentData.entryMode,
            reverse_code: null,
            tran_date: fechaLocalBnrg(),
            tran_time: horaLocalBnrg(),
            capture_date: null,
            tkn_data_63_rq: JSON.stringify({
                processor: 'selia',
                card_number: `${cleanCard.substring(0, 6)}...${cleanCard.substring(cleanCard.length - 4)}`,
                amount: paymentData.amount,
                transaction_type: paymentData.transactionType,
                affiliate_code: affiliate_code,
                order_id: order_id,
                expiration_original: `${card.exp_month}/${card.exp_year}`,
                expiration_selia: paymentData.expiration
            }),
            tkn_data_63_rp: JSON.stringify({
                processor: 'selia',
                transaction_id: null,
                authorization_code: null,
                response_code: null,
                response_message: null,
                success: null
            }),
            card_acceptor: merchant.name_merchant,
            node: 'selia_gateway',
            name_merchant: merchant.id_merchant.toString(),
            terminal: '001',
            reference_number_ant: '',
            folio: order_id,
            card_type: getCardType(cleanCard),
            more_info: JSON.stringify({
                processor: 'selia',
                order_id: order_id,
                payment_token: paymentToken,
                customer: customer,
                billing_address: billing_address,
                selia_transaction_id: null,
                response_message: null,
                stored_at: now.toISOString(),
                source: 'affiliate_api_direct',
                status: 'processing',
                expiration_selia_format: paymentData.expiration,
                affiliate_trace_id: `aff_${paymentLink.id}_${Date.now()}`
            }),
            track2: null,
            creation_date: now,
            estatus_f: 1
        };

        console.log(`${logPrefix} ⏳ ALMACENANDO REGISTRO ISO ANTES DE PROCESAR...`);
        const queryStartTime = Date.now();

        const isoMessage = await db.isoMessage.create(isoMessageRecord);
        const queryTime = Date.now() - queryStartTime;
        console.log(`${logPrefix} ✅ MENSAJE ISO ALMACENADO EXITOSAMENTE (${queryTime}ms) - ID: ${isoMessage.id_message}`);

        // 6. Procesar con Selia - The service will fetch merchant's selia_id automatically
        let seliaResult;
        if (cardValidation.useDummy) {
            console.log(`${logPrefix} 🧪 SANDBOX MODE: Processing dummy transaction for test card`);
            seliaResult = sandboxCardHandler.processDummyPayment(paymentData);
            console.log(`${logPrefix} 🧪 Dummy transaction result:`, {
                success: seliaResult.success,
                scenario: seliaResult._scenario,
                responseCode: seliaResult.responseCode,
                responseMessage: seliaResult.responseMessage
            });
        } else {
            seliaResult = await seliaService.processPayment(paymentData);
        }

        // Extract the correct bank authorization code (field 50) at processing time
        const bankAuthorizationCode = seliaService.extractBankAuthorizationCode(seliaResult);

        console.log(`${logPrefix} 📥 Respuesta de Selia:`, {
            success: seliaResult.success,
            transactionId: seliaResult.transactionId,
            authorizationCode: seliaResult.authorizationCode, // Field 8 (transaction ID)
            bankAuthorizationCode: bankAuthorizationCode, // Field 50 (bank auth)
            responseCode: seliaResult.responseCode,
            responseMessage: seliaResult.responseMessage
        });
        console.log(seliaResult)

        // 6.5. Store complete transaction object in S3 (single file approach)
        console.log(`${logPrefix} 📦 Storing transaction object in S3...`);
        const txnObject = {
            log: {
                transactionId: isoMessage.id_message,
                merchantId: paymentLink.id_merchant,
                affiliateCode: affiliate_code,
                orderId: order_id,
                source: 'affiliate_api_direct',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            lifecycle: {
                charge: {
                    timestamp: new Date().toISOString(),
                    request: {
                        paymentData: paymentData
                    },
                    response: {
                        seliaResult: seliaResult,
                        bankAuthorizationCode: bankAuthorizationCode
                    },
                    rawRequest: null, // Will be populated by Selia service
                    rawResponse: seliaResult.rawResponse,
                    parsedFields: seliaResult.parsedFields
                }
            }
        };

        let s3Key = null;
        try {
            s3Key = await txnObjectService.storeTransactionObject(
                isoMessage.id_message.toString(),
                paymentLink.id_merchant.toString(),
                txnObject
            );
            
            console.log(`${logPrefix} ✅ Transaction object stored in S3: ${s3Key}`);
        } catch (s3Error) {
            console.log(`${logPrefix} ⚠️ Failed to store in S3, continuing with database only: ${s3Error.message}`);
        }

        // 7. Actualizar el registro ISO con el resultado
        console.log(`${logPrefix} ⏳ ACTUALIZANDO REGISTRO ISO CON RESULTADO...`);
        const updateStartTime = Date.now();

        await db.isoMessage.update(
            {
                resp_code: seliaResult.responseCode || '99',
                authorization: bankAuthorizationCode, // Use bank authorization code (field 50) instead of transaction ID (field 8)
                tkn_data_63_rp: JSON.stringify({
                    '8': seliaResult.parsedFields?.['8'] || null,  // Transaction ID
                    '50': seliaResult.parsedFields?.['50'] || null, // Authorization code
                    'processor': 'selia',
                    'success': seliaResult.success,
                    'response_code': seliaResult.responseCode
                }), // Store only essential fields to avoid truncation
                more_info: JSON.stringify({
                    processor: 'selia',
                    order_id: order_id,
                    payment_token: paymentToken,
                    customer: customer,
                    billing_address: billing_address,
                    selia_transaction_id: seliaResult.transactionId,
                    response_message: seliaResult.responseMessage,
                    stored_at: now.toISOString(),
                    updated_at: new Date().toISOString(),
                    source: 'affiliate_api_direct',
                    status: seliaResult.success ? 'approved' : 'declined',
                    expiration_selia_format: paymentData.expiration,
                    affiliate_trace_id: `aff_${paymentLink.id}_${Date.now()}`,
                    full_card: cleanCard, // Store full card number for cancel/refund operations
                    s3_key: s3Key // Store S3 key for complete transaction object
                })
            },
            { where: { id_message: isoMessage.id_message } } // Update by primary key
        );

        const updateTime = Date.now() - updateStartTime;
        console.log(`${logPrefix} ✅ REGISTRO ISO ACTUALIZADO EXITOSAMENTE (${updateTime}ms)`);

        // 8. Verificar si el código de respuesta existe en la tabla selia_error_code
        const responseCode = parseInt(seliaResult.responseCode);
        let errorMessage = seliaResult.parsedFields?.['16'] || seliaResult.responseMessage || 'Error desconocido';

        // Check if model exists, if not skip the error code registration
        try {
            const existingError = await db.selia_error_code.findOne({
                where: { codigo: responseCode }
            });

            if (!existingError && responseCode) {
                try {
                    await db.selia_error_code.create({
                        codigo: responseCode,
                        descripcion: errorMessage,
                        created_at: new Date(),
                        updated_at: new Date()
                    });
                    console.log(`✅ Código de error ${responseCode} registrado automáticamente`);
                } catch (error) {
                    console.error(`⚠️ Error al registrar código ${responseCode}:`, error.message);
                }
            }
        } catch (modelError) {
            console.error('⚠️ Error al acceder al modelo selia_error_code:', modelError.message);
        }

        // 9. Actualizar el link de pago con el resultado
        const inf = {
            tx: {
                authorization: bankAuthorizationCode, // Use bank authorization code (field 50)
                referencia: seliaResult.transactionId,
                trace_number: seliaResult.transactionId,
                processor: 'selia',
                response_code: seliaResult.responseCode,
                response_message: errorMessage,
                iso_message_id: isoMessage?.id_message
            },
            affiliate_data: {
                affiliate_code: affiliate_code,
                order_id: order_id,
                customer: customer,
                billing_address: billing_address
            },
            processed_at: new Date().toISOString()
        };

        try {
            await db.linksPago.update(
                {
                    status: seliaResult.success ? 2 : 3,
                    selia_transaction_id: seliaResult.transactionId,
                    selia_authorization_code: bankAuthorizationCode, // Use bank authorization code (field 50)
                    selia_response_code: responseCode,
                    selia_response_data: JSON.stringify(seliaResult),
                    processor_type: 'selia',
                    info_adicional: JSON.stringify(inf),
                    updated_at: new Date()
                },
                {
                    where: { token: paymentToken }
                }
            );
        } catch (updateError) {
            console.error('⚠️ Error al actualizar el link de pago:', updateError.message);
            // Try to update with minimal data to avoid losing the payment result
            try {
                await db.linksPago.update(
                    {
                        status: 3,
                        selia_transaction_id: seliaResult.transactionId,
                        selia_authorization_code: bankAuthorizationCode, // Use bank authorization code (field 50)
                        selia_response_code: null,
                        selia_response_data: JSON.stringify({
                            ...seliaResult,
                            error: 'Error al actualizar base de datos',
                            original_code: responseCode,
                            error_message: errorMessage,
                            db_error: updateError.message
                        }),
                        processor_type: 'selia',
                        info_adicional: JSON.stringify(inf),
                        updated_at: new Date()
                    },
                    { where: { token: paymentToken } }
                );
            } catch (fallbackError) {
                console.error('⚠️ Error crítico: No se pudo actualizar el link de pago:', fallbackError.message);
            }
            
            // Don't throw the payment decline as a system error
            // Instead, continue to the normal success/failure response logic
        }

        console.log(`${logPrefix} ✅ Link de pago actualizado con resultado`);

        // 10. Retornar respuesta estandarizada para afiliados
        if (seliaResult.success) {
            const response = {
                success: true,
                transaction_id: `dps_${paymentLink.id}`,
                iso_message_id: isoMessage.id_message,
                order_id: order_id,
                authorization_code: bankAuthorizationCode, // Use bank authorization code (field 50)
                amount: amount,
                currency: currency,
                status: 'approved',
                timestamp: new Date().toISOString(),
                selia_transaction_id: seliaResult.transactionId
            };

            console.log(`${logPrefix} ✅ Pago exitoso, retornando:`, response);
            return res.json(response);
        } else {
            const response = {
                success: false,
                error: {
                    code: mapSeliaErrorCode(seliaResult.responseCode),
                    message: seliaResult.responseMessage
                },
                order_id: order_id,
                iso_message_id: isoMessage.id_message,
                status: 'declined',
                timestamp: new Date().toISOString()
            };

            console.log(`${logPrefix} ❌ Pago declinado, retornando:`, response);
            return res.json(response);
        }

    } catch (error) {
        console.error(`${logPrefix} 💥 ERROR EN PAGO AFILIADO:`, error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'internal_error',
                message: error.message
            }
        });
    }
});

/**
 * Maps a Selia response code to a friendly error code.
 * @param {string} seliaCode - Selia response code.
 * @returns {string} Friendly error code.
 */
function mapSeliaErrorCode(seliaCode) {
    const errorMap = {
        '1': 'card_declined',
        '5': 'card_declined',
        '6': 'invalid_data',
        '14': 'invalid_card',
        '51': 'insufficient_funds',
        '54': 'expired_card',
        '56': 'card_not_registered',
        '96': 'processor_error',
        '05': 'declined'
    };
    return errorMap[seliaCode] || 'declined';
}



/**
 * Validates a payment link by token and returns link details.
 * PCI DSS 4.0: Req 7.1.1 (access control), Req 10.2.1 (audit logging).
 */
router.get('/payment-link', async (req, res) => {
    console.log('=== PAYMENT LINK VALIDATION ===');
    console.log('Token received:', req.query.token);

    if(!req.query.token) {
        return res.status(400).json({
            statusCode: 1,
            description: 'Token requerido'
        });
    }

    try {
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

        if(!reg) {
            console.log('Link not found for token:', req.query.token);
            return res.json({
                statusCode: 1,
                description: 'Link inválido'
            });
        }

        if (reg.expire_date && new Date(reg.expire_date) < new Date()) {
            console.log('Link expired for token:', req.query.token);
            return res.json({
                statusCode: 3,
                description: 'Link caducado'
            });
        }

        if (reg.status > 1) {
            console.log('Link already processed for token:', req.query.token);
            return res.json({
                statusCode: 4,
                description: 'Link ya procesado'
            });
        }

        const bitmap = await helpers.decript_bitmap_profile(reg.merchant.profile_trans.hex_value);
        const hasPartial = bitmap.indicadores.includes(1);

        let allowedPlans = JSON.parse(reg.merchant.MSI) || [];
        allowedPlans = allowedPlans.filter(obj => parseFloat(obj.min_mount) <= parseFloat(reg.monto) );
        allowedPlans = allowedPlans.map(obj => helpersText.padLeft(obj.type,2,'0'));

        console.log('Link validated successfully for token:', req.query.token);
        return res.json({
            statusCode: 0,
            data: {...reg.get({plain: true}), hasPartial, allowedPlans}
        });

    } catch (error) {
        console.error('Error validating payment link:', error);
        return res.status(500).json({
            statusCode: 99,
            description: 'Error interno del servidor'
        });
    }
});


// ==================== PAYOUT PROCESSING ====================
/**
 * Processes a payout/disbursement transaction via the ecommerce charge endpoint.
 * PCI DSS 4.0: Req 3.4 / 3.5.1 (CHD protection), Req 4.2.1 (secure transmission), Req 10.2.1 (audit logging).
 */
router.post('/payment/payout', async (req, res) => {
    let form_data = null;

    try {
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
    };

    let chargePlan;
    if(form_data.dataPayment.chargePlan){
        chargePlan = {
            first_payment: "00",
            months: form_data.dataPayment.chargePlan,
            type: "03"
        };
    }

    const tarjeta = form_data.tarjeta.split('-').join('');

    // Validate card against environment (dev test cards vs prod)
    const cardValidation = sandboxCardHandler.validateCardForEnvironment(tarjeta);
    if (!cardValidation.allowed) {
        console.log('❌ CARD VALIDATION FAILED (payment/payout):', cardValidation);
        return res.status(403).json({
            error: true,
            error_code: cardValidation.code,
            description: cardValidation.error,
            authorization: null
        });
    }

    const baseUrl = process.env.FRONT_URL || 'https://drakops.com.mx';

    const body = {
        "isoType": "AGRS",
        "amount": form_data.dataPayment.monto,
        'concepto': form_data.dataPayment.concepto || '',
        'url_comercio': form_data.dataPayment.url_comercio || '',
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
        "link_pago": (form_data.linkPago == 2),
        url: form_data.dataPayment.token ? `${baseUrl}/payment?token=${form_data.dataPayment.token}&` : `${baseUrl}/api/pay?`,
    };

    try {
        const response = await axios.post(`${req.protocol}://${req.get('host')}/gateway/v1/ecommerce/charge`, body, { headers });

        if (response.data.url)
            return res.json({ url: response.data.url });

        if (response.data.resp_code != '00') {
            return res.json(response.data);
        }

        let inf = form_data.dataPayment.info_adicional;
        inf = inf ? JSON.parse(inf) : {};
        inf.tx = {
            authorization: response.data.authorization,
            referencia: response.data.id,
            trace_number: response.data.trace_id
        };

        if (body.link_pago) {
            await db.linksPago.update({
                status: response.data.resp_code == '00' ? 2 : 3,
                info_adicional: JSON.stringify(inf)
            }, { where: { id: form_data.dataPayment.id } });
        }

        return res.json(response.data);
    } catch (error) {
        if(error.response?.status == 504){
            return res.json({
                error: true,
                resp_code: error.response.data.resp_code | error.response.data.error_code,
                description: error.response.data.description,
                data: error.response.data.response,
                authorization: null
            });
        }

        return res.json({
            error: true,
            resp_code: '05',
            description: 'Rechazada por 3DS',
            data: error,
            authorization: null
        });
    }
});

// ==================== PAYMENT2 ROUTE ====================
/**
 * Alternative payment endpoint that supports 3DS lookup by reference.
 */
router.post('/payment2', async (req, res) => {
    if(req.body.reference != undefined && req.body.reference != ''){
        const response = await db.tresds.findOne({ where: { referencia_tx: req.body.reference }, raw: true });
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

    return res.json({ response });
});

// ==================== SEND DATA TX ====================
/**
 * Echoes back the request body for transaction data testing.
 */
router.post('/sendDataTx', (req, res) => {
    res.json(req.body);
});

// ==================== SELIA PAYMENT PROCESSING ====================
/**
 * Processes a payment directly through the Selia service.
 * PCI DSS 4.0: Req 3.4 / 3.5.1 (CHD protection), Req 4.2.1 (secure transmission), Req 10.2.1 (audit logging).
 */
router.post('/payment/selia', async (req, res) => {
    let form_data = null;

    try {
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
            console.log('❌ PAYMENT VALIDATION FAILED (payment/selia):', fieldValidation.error);
            return res.status(fieldValidation.status).json({
                error: true,
                error_code: fieldValidation.error.code,
                description: fieldValidation.error.message,
                authorization: null
            });
        }

        const cleanCard = tarjeta.split('-').join('');

        // Validate card against environment (dev test cards vs prod)
        const cardValidation = sandboxCardHandler.validateCardForEnvironment(cleanCard);
        if (!cardValidation.allowed) {
            console.log('❌ CARD VALIDATION FAILED (payment/selia):', cardValidation);
            return res.status(403).json({
                error: true,
                error_code: cardValidation.code,
                description: cardValidation.error,
                authorization: null
            });
        }

        // Get merchant ID from payment data or link
        let merchantId;
        if (dataPayment.token) {
            const link = await db.linksPago.findOne({
                where: { token: dataPayment.token },
                attributes: ['id_merchant']
            });
            merchantId = link?.id_merchant;
        } else if (dataPayment.id_merchant) {
            merchantId = dataPayment.id_merchant;
        }

        // FIXED: Robust parsing for both MM/YY and YY/MM input formats
        let expMonth, expYear;
        const parts = venci.split('/');
        
        // Detect format: if first part > 12, it's YY/MM, otherwise MM/YY
        if (parseInt(parts[0]) > 12) {
            // YY/MM format (e.g., "28/07")
            expYear = parts[0];
            expMonth = parts[1];
        } else {
            // MM/YY format (e.g., "07/28") 
            expMonth = parts[0];
            expYear = parts[1];
        }
        
        const paymentData = {
            cardNumber: cleanCard,
            amount: Math.round(dataPayment.monto * 100).toString(),
            cvv: cvv,
            expiration: formatSeliaExpiration(expMonth, expYear),
            transactionType: '301',
            entryMode: '81',
            merchantId: merchantId, // ADDED: Pass merchantId
            sandboxTest: !cardValidation.useDummy && sandboxCardHandler.isDevMode()
        };

        console.log('📦 Enviando a Selia (payment/selia):', {
            merchantId: merchantId,
            card: `${cleanCard.substring(0, 6)}...${cleanCard.substring(cleanCard.length - 4)}`,
            amount: paymentData.amount,
            expiration: paymentData.expiration,
            exp_month: expMonth,
            exp_year: expYear,
            original_input: venci
        });

        let seliaResult;
        if (cardValidation.useDummy) {
            console.log('🧪 SANDBOX MODE (payment/selia): Processing dummy transaction for test card');
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

        // Extract the correct bank authorization code (field 50) at processing time
        const bankAuthorizationCode = cardValidation.useDummy
            ? (seliaResult.parsedFields?.['50'] || null)
            : seliaService.extractBankAuthorizationCode(seliaResult);

        console.log('📦 Respuesta de Selia (payment/selia):', {
            merchantId: merchantId,
            success: seliaResult.success,
            transactionId: seliaResult.transactionId,
            authorizationCode: seliaResult.authorizationCode, // Field 8 (transaction ID)
            bankAuthorizationCode: bankAuthorizationCode, // Field 50 (bank auth)
            responseCode: seliaResult.responseCode,
            responseMessage: seliaResult.responseMessage
        });

        if (dataPayment.token) {
            const inf = dataPayment.info_adicional ? JSON.parse(dataPayment.info_adicional) : {};
            inf.tx = {
                authorization: bankAuthorizationCode, // Use bank authorization code (field 50)
                referencia: seliaResult.transactionId,
                trace_number: seliaResult.transactionId,
                processor: 'selia'
            };

            await db.linksPago.update(
                {
                    status: seliaResult.success ? 2 : 3,
                    selia_transaction_id: seliaResult.transactionId,
                    selia_authorization_code: bankAuthorizationCode, // Use bank authorization code (field 50)
                    selia_response_code: parseInt(seliaResult.responseCode),
                    selia_response_data: JSON.stringify(seliaResult),
                    processor_type: 'selia',
                    info_adicional: JSON.stringify(inf),
                    updated_at: new Date()
                },
                { where: { token: dataPayment.token } }
            );
        }

        if (seliaResult.success) {
            return res.json({
                error: false,
                resp_code: '00',
                description: seliaResult.responseMessage,
                authorization: bankAuthorizationCode, // Use bank authorization code (field 50)
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
                description: seliaResult.responseMessage,
                authorization: null,
                data: {
                    processor: 'selia',
                    raw_response: seliaResult.rawResponse,
                    selia_response_code: seliaResult.responseCode
                }
            });
        }
    } catch (error) {
        return res.status(500).json({
            error: true,
            resp_code: '06',
            description: `Error procesando pago: ${error.message}`,
            authorization: null
        });
    }
});

// ==================== PUBLIC DATA ====================
/**
 * Returns the ISO 3166 country code list.
 */
router.get('/iso3166', async (_req, res) => {
    const iso = await db.ciso3166.findAll({
        attributes: ['country', 'alpha2', 'alpha3'],
        raw: true
    });
    return res.status(200).json({ iso });
});

// ==================== HELPER FUNCTIONS ====================
/**
 * Generates a SHA256 hash of a string.
 * @param {string} chain - Input string.
 * @returns {string} Hex digest.
 */
function generateSHA256(chain) {
    const hash = crypto.createHash('sha256');
    hash.update(chain);
    return hash.digest('hex');
}

/**
 * Formats an amount string as a decimal value.
 * @param {string} numberStr - Amount string in cents/integer form.
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
    var hex = hexx.toString();
    var str = '';
    for (var i = 0; i < hex.length; i += 2)
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    return str;
}

module.exports = router;