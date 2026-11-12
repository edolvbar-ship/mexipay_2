/**
 * @file Affiliate payment processing routes.
 * Processes direct affiliate payments through Selia and stores asynchronous ISO transaction records.
 * PCI DSS 4.0: Req 3.4 / 3.5.1 (CHD protection), Req 4.2.1 (secure transmission), Req 10.2.1 (audit logging), Req 11.3.1 (secure processing).
 */
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

console.log('🔄 CARGANDO RUTAS DE PAGOS AFILIADOS...');

// ==================== CONFIGURACIÓN DE BASE DE DATOS ====================
console.log('🗄️ INICIALIZANDO CONEXIÓN A BASE DE DATOS...');
let db;
try {
    db = require('../lib/socketServer/lib/sequelize/models'); // FIXED PATH
    console.log('✅ BASE DE DATOS INICIALIZADA DESDE ../lib/socketServer/lib/sequelize/models');
} catch (error) {
    console.log('⚠️ Intentando alternativa de conexión a BD...');
    try {
        db = require('../../lib/socketServer/lib/sequelize/models'); // ALTERNATIVE PATH
        console.log('✅ BASE DE DATOS INICIALIZADA DESDE ../../lib/socketServer/lib/sequelize/models');
    } catch (error2) {
        console.error('💥 ERROR CRÍTICO: No se pudo inicializar la base de datos');
        console.error('Error detalles:', error2.message);
    }
}

// ==================== CONFIGURACIÓN DIRECTA DE SELIA ====================
console.log('🔧 INICIALIZANDO SERVICIO SELIA...');
const sandboxCardHandler = require('../lib/socketServer/lib/services/sandboxCardHandler');
const paymentValidator = require('../lib/socketServer/lib/services/paymentValidator');
let seliaService;
try {
    const SeliaWebService = require('../lib/socketServer/lib/services/seliaWebService'); // FIXED PATH

    if (!db) {
        console.error('💥 ERROR: Base de datos no disponible para SeliaService');
        throw new Error('Database connection not available');
    }

    seliaService = new SeliaWebService({
        host: process.env.SELIA_HOST,
        port: process.env.SELIA_PORT,
        aesKey: process.env.SELIA_AES_KEY,
        companyId: process.env.SELIA_COMPANY_ECOMMERCE_ID,
        username: process.env.SELIA_USERNAME,
        password: process.env.SELIA_PASSWORD,
        debug: process.env.SELIA_DEBUG === 'true',
        db: db // ✅ AHORA db ESTÁ DISPONIBLE
    });
    console.log('✅ SERVICIO SELIA INICIALIZADO CORRECTAMENTE');
} catch (error) {
    console.error('💥 ERROR INICIALIZANDO SELIA:', error);
}

/**
 * Asynchronously stores a Selia affiliate payment as an ISO transaction record.
 * @param {Object} params - Transaction data.
 * @param {Object} params.merchant - Merchant record.
 * @param {Object} params.seliaResult - Selia response.
 * @param {Object} params.paymentData - Payment payload sent to Selia.
 * @param {number|string} params.amount - Transaction amount.
 * @param {string} params.order_id - Affiliate order identifier.
 * @param {string} params.paymentToken - Internal payment link token.
 * @param {Object} params.card - Card data.
 * @param {Object} params.customer - Customer data.
 * @param {Object} params.billing_address - Billing address.
 * @returns {Promise<void>}
 */
async function storeSeliaTransactionAsync({
    merchant,
    seliaResult,
    paymentData,
    amount,
    order_id,
    paymentToken,
    card,
    customer,
    billing_address
}) {
    const logPrefix = `[AFF-ISO-${paymentToken.substring(0, 8)}]`;
    console.log(`${logPrefix} 🚀 INICIANDO ALMACENAMIENTO ASÍNCRONO ISO`);

    try {
        console.log(`${logPrefix} 📝 PREPARANDO DATOS PARA ISO MESSAGE`);
        const now = new Date();

        // Cargar helpers de forma segura
        let helpers;
        try {
            helpers = require('../lib/socketServer/lib/lib/helpers'); // FIXED PATH
        } catch (error) {
            console.error(`${logPrefix} ❌ Error cargando helpers, usando valores por defecto`);
            // Fallbacks si helpers no está disponible
            helpers = {
                randomString: (length, mode) => Math.random().toString(36).substr(2, length),
                fechaLocalBnrg: () => {
                    const d = new Date();
                    return (`0${d.getDate()}`).substr(-2) + (`0${d.getMonth() + 1}`).substr(-2) + d.getFullYear();
                },
                horaLocalBnrg: () => {
                    const d = new Date();
                    return (`0${d.getHours()}`).substr(-2) + (`0${d.getMinutes()}`).substr(-2) + (`0${d.getSeconds()}`).substr(-2);
                }
            };
        }

        const trace_number = seliaResult.transactionId || helpers.randomString(6, 1);
        const reference_number = seliaResult.transactionId || `SEL${Date.now()}`.substr(0, 12);

        // Mapear respuesta de Selia a formato ISO message
        const id_operation = seliaResult.success ? 4 : 99; // 4 = VENTA, 99 = ERROR
        const msg_type = '0200'; // Transacción financiera

        console.log(`${logPrefix} 🏗️ CONSTRUYENDO REGISTRO ISO`);
        const isoMessageRecord = {
            id_operation,
            msg_type,
            trace_number,
            reference_number,
            amount: Math.round(amount * 100), // Almacenar en centavos
            resp_code: seliaResult.responseCode || '99',
            authorization: seliaResult.authorizationCode,
            bin: paymentData.cardNumber.substring(0, 6),
            last4: paymentData.cardNumber.substring(paymentData.cardNumber.length - 4),
            draft_capture: '0',
            entry_mode: paymentData.entryMode,
            reverse_code: null,
            tran_date: helpers.fechaLocalBnrg(),
            tran_time: helpers.horaLocalBnrg(),
            capture_date: null,
            tkn_data_63_rq: JSON.stringify({
                processor: 'selia',
                card_number: `${paymentData.cardNumber.substring(0, 6)}...${paymentData.cardNumber.substring(paymentData.cardNumber.length - 4)}`,
                amount: paymentData.amount,
                transaction_type: paymentData.transactionType
            }),
            tkn_data_63_rp: JSON.stringify({
                processor: 'selia',
                transaction_id: seliaResult.transactionId,
                authorization_code: seliaResult.authorizationCode,
                response_code: seliaResult.responseCode,
                response_message: seliaResult.responseMessage,
                success: seliaResult.success
            }),
            card_acceptor: merchant.name_merchant,
            node: 'selia_gateway',
            name_merchant: merchant.id,
            terminal: '001',
            reference_number_ant: '',
            folio: order_id,
            card_type: getCardType(paymentData.cardNumber),
            more_info: JSON.stringify({
                processor: 'selia',
                order_id: order_id,
                payment_token: paymentToken,
                customer: customer,
                billing_address: billing_address,
                selia_transaction_id: seliaResult.transactionId,
                response_message: seliaResult.responseMessage,
                stored_at: new Date().toISOString(),
                source: 'affiliate_api_direct'
            }),
            track2: null,
            created_at: now,
            updated_at: now
        };

        CAMBIAR ESTO A sequelize
        console.log(`${logPrefix} 🗄️ PREPARANDO INSERCIÓN EN BASE DE DATOS`);
        let pool;
        try {
            pool = require('../lib/socketServer/lib/database'); // FIXED PATH
        } catch (error) {
            console.error(`${logPrefix} ❌ No se pudo cargar el pool de BD:`, error.message);
            return;
        }

        console.log(`${logPrefix} ⏳ EJECUTANDO QUERY INSERT ASÍNCRONO...`);
        const queryStartTime = Date.now();

        pool.query('INSERT INTO iso_message SET ?', [isoMessageRecord], (error, results) => {
            const queryTime = Date.now() - queryStartTime;

            if (error) {
                console.error(`${logPrefix} 💥 ERROR EN QUERY INSERT (${queryTime}ms):`, error);
            } else {
                console.log(`${logPrefix} ✅ MENSAJE ISO ALMACENADO EXITOSAMENTE (${queryTime}ms)`);
            }
        });

        console.log(`${logPrefix} 🏁 ALMACENAMIENTO ASÍNCRONO INICIADO - CONTINUANDO FLOW PRINCIPAL`);

    } catch (error) {
        console.error(`${logPrefix} 💥 ERROR CRÍTICO PREPARANDO ALMACENAMIENTO ISO:`, error);
    }
}

/**
 * POST /gateway/v1/api/affiliate/payment
 * Processes direct affiliate payments through Selia without intermediate processors.
 * PCI DSS 4.0: Req 3.4 (CHD handling), Req 4.2.1 (secure transmission), Req 10.2.1 (audit logging).
 */
router.post('/gateway/v1/api/affiliate/payment', async (req, res) => {
    const requestId = uuidv4().substring(0, 8);
    const logPrefix = `[AFF-REQ-${requestId}]`;

    console.log(`\n${logPrefix} 🚀 ===== INICIANDO NUEVA SOLICITUD DE PAGO AFILIADO =====`);

    // Verificar que la base de datos esté disponible
    if (!db) {
        console.error(`${logPrefix} 💥 ERROR: Base de datos no disponible`);
        return res.status(500).json({
            success: false,
            error: {
                code: 'database_unavailable',
                message: 'Servicio de base de datos no disponible'
            }
        });
    }

    // Verificar que Selia esté disponible
    if (!seliaService) {
        console.error(`${logPrefix} 💥 ERROR: Servicio Selia no disponible`);
        return res.status(500).json({
            success: false,
            error: {
                code: 'payment_service_unavailable',
                message: 'Servicio de pagos no disponible'
            }
        });
    }

    try {
        console.log(`${logPrefix} 🔍 INICIANDO VALIDACIONES BÁSICAS`);
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

        // 1. Validar merchant (usando affiliate_code como ID de merchant)
        console.log(`${logPrefix} 👨‍💼 BUSCANDO MERCHANT CON ID:`, affiliate_code);
        const merchantSearchStart = Date.now();
        const merchant = await db.merchant.findOne({
            where: { id: parseInt(affiliate_code) }
        });
        const merchantSearchTime = Date.now() - merchantSearchStart;

        if (!merchant) {
            console.error(`${logPrefix} ❌ MERCHANT NO ENCONTRADO:`, affiliate_code);
            return res.status(401).json({
                success: false,
                error: "Merchant/afiliado no encontrado"
            });
        }
        console.log(`${logPrefix} ✅ MERCHANT ENCONTRADO (${merchantSearchTime}ms):`, {
            id: merchant.id,
            name: merchant.name_merchant
        });

        // 2. Crear link de pago interno (para trazabilidad)
        console.log(`${logPrefix} 🔗 CREANDO LINK DE PAGO INTERNO`);
        const paymentToken = uuidv4();
        const linkCreationStart = Date.now();

        const paymentLink = await db.linksPago.create({
            token: paymentToken,
            id_merchant: merchant.id,
            concepto: description || `Pago orden ${order_id}`,
            monto: parseFloat(amount),
            expire_date: new Date(Date.now() + 24 * 60 * 60 * 1000),
            status: 1, // pending
            info_adicional: JSON.stringify({
                affiliate_code: affiliate_code,
                order_id: order_id,
                customer: customer,
                billing_address: billing_address,
                source: 'affiliate_api_direct'
            })
        });
        const linkCreationTime = Date.now() - linkCreationStart;

        console.log(`${logPrefix} ✅ LINK DE PAGO CREADO (${linkCreationTime}ms):`, {
            token: paymentToken,
            linkId: paymentLink.id
        });

        // 3. Procesar DIRECTAMENTE con Selia (igual que /payment/selia)
        console.log(`${logPrefix} 💳 PREPARANDO DATOS PARA SELIA`);
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
            cardNumber: cleanCard,
            amount: Math.round(parseFloat(amount) * 100).toString(), // Convertir a centavos
            cvv: card.cvv,
            expiration: `${card.exp_month}${card.exp_year.slice(-2)}`, // Formato MMyy
            transactionType: '501',
            entryMode: '1',
            sandboxTest: !cardValidation.useDummy && sandboxCardHandler.isDevMode()
        };

        console.log(`${logPrefix} 📦 ENVIANDO A SELIA:`, {
            card: `${cleanCard.substring(0, 6)}...${cleanCard.substring(cleanCard.length - 4)}`,
            amount: paymentData.amount,
            expiration: paymentData.expiration,
            transactionType: paymentData.transactionType
        });

        console.log(`${logPrefix} ⏳ LLAMANDO A seliaService.processPayment...`);
        const seliaCallStart = Date.now();

        let seliaResult;
        try {
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
            const seliaCallTime = Date.now() - seliaCallStart;
            console.log(`${logPrefix} ✅ RESPUESTA DE SELIA RECIBIDA (${seliaCallTime}ms):`, {
                success: seliaResult.success,
                transactionId: seliaResult.transactionId,
                authorizationCode: seliaResult.authorizationCode,
                responseCode: seliaResult.responseCode,
                responseMessage: seliaResult.responseMessage
            });
        } catch (seliaError) {
            const seliaCallTime = Date.now() - seliaCallStart;
            console.error(`${logPrefix} 💥 ERROR CRÍTICO EN LLAMADA A SELIA (${seliaCallTime}ms):`, seliaError);
            throw seliaError;
        }

        // 4. Almacenar transacción como mensaje ISO (ASÍNCRONO - no bloqueante)
        console.log(`${logPrefix} 🗃️ INICIANDO ALMACENAMIENTO ASÍNCRONO ISO`);
        const isoStorageStart = Date.now();

        storeSeliaTransactionAsync({
            merchant,
            seliaResult,
            paymentData,
            amount: parseFloat(amount),
            order_id,
            paymentToken,
            card,
            customer,
            billing_address
        });

        const isoStorageSetupTime = Date.now() - isoStorageStart;
        console.log(`${logPrefix} ✅ ALMACENAMIENTO ASÍNCRONO CONFIGURADO (${isoStorageSetupTime}ms) - CONTINUANDO FLOW PRINCIPAL`);

        // 5. Actualizar el link de pago con el resultado (síncrono - necesario para respuesta)
        console.log(`${logPrefix} 🔄 ACTUALIZANDO LINK DE PAGO CON RESULTADO`);
        const inf = {
            tx: {
                authorization: seliaResult.authorizationCode,
                referencia: seliaResult.transactionId,
                trace_number: seliaResult.transactionId,
                processor: 'selia'
            },
            affiliate_code: affiliate_code,
            order_id: order_id
        };

        const linkUpdateStart = Date.now();
        await db.linksPago.update(
            {
                status: seliaResult.success ? 2 : 3, // 2 = completed, 3 = failed
                selia_transaction_id: seliaResult.transactionId,
                selia_authorization_code: seliaResult.authorizationCode,
                selia_response_code: parseInt(seliaResult.responseCode),
                selia_response_data: JSON.stringify(seliaResult),
                processor_type: 'selia',
                info_adicional: JSON.stringify(inf),
                updated_at: new Date()
            },
            { where: { token: paymentToken } }
        );
        const linkUpdateTime = Date.now() - linkUpdateStart;
        console.log(`${logPrefix} ✅ LINK DE PAGO ACTUALIZADO (${linkUpdateTime}ms)`);

        // 6. Retornar respuesta INMEDIATAMENTE
        console.log(`${logPrefix} 📤 PREPARANDO RESPUESTA FINAL`);
        const totalProcessingTime = Date.now() - req.startTime;

        if (seliaResult.success) {
            const response = {
                success: true,
                transaction_id: `dps_${paymentLink.id}`,
                order_id: order_id,
                authorization_code: seliaResult.authorizationCode,
                amount: amount,
                currency: currency,
                status: 'approved',
                timestamp: new Date().toISOString(),
                selia_transaction_id: seliaResult.transactionId,
                processing_time_ms: totalProcessingTime
            };

            console.log(`${logPrefix} 🎉 PAGO EXITOSO - ENVIANDO RESPUESTA (${totalProcessingTime}ms)`);
            return res.json(response);
        } else {
            const response = {
                success: false,
                error: {
                    code: mapErrorCode(seliaResult.responseCode),
                    message: seliaResult.responseMessage
                },
                order_id: order_id,
                status: 'declined',
                timestamp: new Date().toISOString(),
                processing_time_ms: totalProcessingTime
            };

            console.log(`${logPrefix} ❌ PAGO DECLINADO - ENVIANDO RESPUESTA (${totalProcessingTime}ms)`);
            return res.json(response);
        }

    } catch (error) {
        const totalErrorTime = Date.now() - req.startTime;
        console.error(`${logPrefix} 💥 ERROR CRÍTICO EN PAGO AFILIADO (${totalErrorTime}ms):`, error);

        return res.status(500).json({
            success: false,
            error: {
                code: 'internal_error',
                message: error.message,
                processing_time_ms: totalErrorTime
            }
        });
    }
});

// Middleware para medir tiempo de request
router.use('/gateway/v1/api/affiliate/payment', (req, res, next) => {
    req.startTime = Date.now();
    next();
});

// ==================== FUNCIONES AUXILIARES ====================
/**
 * Mapea códigos de error de Selia
 */
function mapErrorCode(seliaCode) {
    const errorMap = {
        '51': 'insufficient_funds',
        '54': 'expired_card',
        '14': 'invalid_card',
        '96': 'processor_error',
        '05': 'declined'
    };
    return errorMap[seliaCode] || 'declined';
}

/**
 * Determina el tipo de tarjeta basado en el BIN
 */
function getCardType(cardNumber) {
    const firstDigit = cardNumber.substring(0, 1);
    switch (firstDigit) {
        case '3': return 'AMEX';
        case '4': return 'VISA';
        case '5': return 'MASTERCARD';
        default: return 'UNKNOWN';
    }
}

console.log('✅ RUTAS DE PAGOS AFILIADOS CARGADAS CORRECTAMENTE');

module.exports = router;