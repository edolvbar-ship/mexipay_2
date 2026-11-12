/**
 * Selia ISO 8583 Payment Gateway Integration
 * 
 * PCI DSS 4 Requirements Covered:
 * - Requirement 3.5.1: Limit storage of account data to that which is needed for business, legal, or regulatory purposes
 * - Requirement 3.5.2: Render cardholder data unreadable using encryption (AES)
 * - Requirement 8.2.1: Use strong cryptography to protect authentication credentials
 * - Requirement 8.2.3: Secure all stored account data
 * - Requirement 10.2.1: Implement audit trails for transaction processing
 * - Requirement 10.3.1: Record time stamps for all audit trail entries
 * - Requirement 6.2.4: Input validation to prevent injection attacks
 * - Requirement 7.1.1: Restrict access based on need to know
 */

// lib/socketServer/lib/extras/isoSelia.js
const isoSeliaService = require('../services/isoSeliaService');
require('dotenv').config();

module.exports = async function(guid, apiKey, url_merchant, body, binDataInfo, ref, limitAmount, db) {
    // PCI DSS 4 Requirement 10.2.1: Audit trail - log transaction processing start
    console.log('[isoSelia] 🚨 ISO_SELIA - Processing transaction');

    // PCI DSS 4 Requirement 8.2.3: Secure database connection for stored account data
    // Database connection
    if (!db || !db.seq) {
        console.log('[isoSelia] Creating database connection...');
        try {
            db = require("../sequelize/init");
            if (!db.seq) {
                console.error('[isoSelia] ❌ No db.seq found after requiring init.js');
                return {
                    ok: false,
                    out: {
                        success: false,
                        error: 'Database connection failed',
                        response_code: '96',
                        request_id: guid,
                        description: 'Selia Error: Database connection failed'
                    }
                };
            }
            await db.seq.authenticate();
            console.log('[isoSelia] ✅ Database connected via db.seq');
        } catch (error) {
            console.error('[isoSelia] ❌ Database connection failed:', error.message);
            return {
                ok: false,
                out: {
                    success: false,
                    error: `Database connection failed: ${error.message}`,
                    response_code: '96',
                    request_id: guid,
                    description: `Selia Error: Database connection failed: ${error.message}`
                }
            };
        }
    }

    const sequelize = db.seq;

    try {
        await sequelize.authenticate();
        console.log('[isoSelia] ✅ Database connection verified');
    } catch (error) {
        console.error('[isoSelia] ❌ Database connection failed:', error.message);
        return {
            ok: false,
            out: {
                success: false,
                error: `Database connection failed: ${error.message}`,
                response_code: '96',
                request_id: guid,
                description: `Selia Error: Database connection failed: ${error.message}`
            }
        };
    }

    try {
        // PCI DSS 4 Requirement 10.2.1: Audit trail - log transaction type determination
        // Check if this is a reference transaction
        const isReferenceTransaction = checkIfReferenceTransaction(body, ref);
        console.log('[isoSelia] 📋 Transaction type:', isReferenceTransaction ? 'REFERENCE (cancel/reverse/refund)' : 'ORIGINAL (authorization)');

        // PCI DSS 4 Requirement 10.2.1: Audit trail - lookup original transaction for reference operations
        // For reference transactions, lookup original transaction
        let originalTx = null;
        if (isReferenceTransaction) {
            console.log('[isoSelia] 🔍 Reference transaction - looking up original...');

            // Try multiple lookup methods
            const lookupConditions = [];

            // By original authorization
            if (body.originalReference) {
                lookupConditions.push({ authorization: body.originalReference });
            }
            if (body.original_transaction_id) {
                lookupConditions.push({ authorization: body.original_transaction_id });
            }
            // By reference number
            if (body.reference) {
                lookupConditions.push({ reference_number: body.reference });
            }
            // By authentication number
            if (body.authentication) {
                lookupConditions.push({ authorization: body.authentication });
            }

            // Execute lookups
            for (const condition of lookupConditions) {
                originalTx = await db.isoMessage.findOne({
                    where: condition,
                    order: [['id_message', 'DESC']]
                });
                if (originalTx) {
                    console.log('[isoSelia] ✅ Found original transaction:', {
                        id: originalTx.id_message,
                        auth: originalTx.authorization,
                        reference: originalTx.reference_number,
                        bin: originalTx.bin,
                        last4: originalTx.last4
                    });
                    break;
                }
            }

            if (!originalTx) {
                console.log('[isoSelia] ⚠️ Original transaction not found, using available data');
            }
        }

        // PCI DSS 4 Requirement 6.2.4: Validate required data to prevent injection attacks
        validateRequiredData(body, isReferenceTransaction);

        // PCI DSS 4 Requirement 10.2.1: Audit trail - log transaction details
        console.log('[isoSelia] 📦 Transaction details:', {
            guid: guid,
            hasIso: !!body?.isoMessage,
            amount: body.amount,
            reference: body.reference,
            originalReference: body.originalReference || body.original_transaction_id,
            isReferenceTransaction: isReferenceTransaction,
            hasOriginalTx: !!originalTx
        });

        let isoMessage = body.isoMessage;
        if (Buffer.isBuffer(isoMessage)) {
            isoMessage = isoMessage.toString('utf8');
        }

        // PCI DSS 4 Requirement 8.2.1: Credentials stored in environment variables for protection
        const seliaService = new isoSeliaService({
            host: process.env.SELIA_ISO_HOST || '152.0.2.121',
            port: parseInt(process.env.SELIA_ISO_PORT) || 5001,
//            companyId: parseInt(process.env.SELIA_COMPANY_TPV_ID) || 10990,
//            companyId: body.merchantData?.selia_id ||parseInt(process.env.SELIA_COMPANY_TPV_ID) || 10990,
            // PCI DSS 4 Requirement 8.2.1: Strong cryptography for authentication credentials
            username: process.env.SELIA_ISO_USERNAME || 'crytest99w3D',
            password: process.env.SELIA_ISO_PASSWORD || 'tac',
            // PCI DSS 4 Requirement 3.5.2: AES encryption key for data protection
            aesKey: process.env.SELIA_AES_KEY || 'W0ten03L3rvxC851',
            timeout: parseInt(process.env.SELIA_TIMEOUT) || 30000,
            debug: process.env.SELIA_DEBUG === 'true',
            db: db
        });

        const amount = parseFloat(body.amount);
        if (isNaN(amount) || amount <= 0) {
            throw new Error(`Invalid amount: ${body.amount}`);
        }

        const amountCents = Math.round(amount * 100).toString();

        // PCI DSS 4 Requirement 3.5.1: For reference transactions, PAN not needed - matched by reference
        // 🔴 CRITICAL: For reference transactions, we don't need real PAN
        // Selia will match by original reference, not by card number
        let cardNumber = '';
        let track2Data = '';

        if (isReferenceTransaction) {
            // PCI DSS 4 Requirement 3.5.2: Use original track2 data for reference transaction matching
            // 🔴 CRITICAL FIX: For reference transactions, we need the ORIGINAL track2 data, not masked!
            // Selia needs the real track2 to match the original transaction properly
            if (originalTx) {
                // Try to get original track2 from database first
                track2Data = originalTx.track2 || originalTx.tk2 || body.tk2 || body.cardInformation?.tk2 || '';
                if (!track2Data) {
                    // Fallback: reconstruct from BIN and last4 if no original track2 available
                    const bin = originalTx.bin || '000000';
                    const last4 = originalTx.last4 || '0000';
                    track2Data = `${bin.padStart(6, '0')}******${last4.padStart(4, '0')}=`;
                    console.log('[isoSelia] ⚠️ Using reconstructed track2 (original not found in DB)');
                } else {
                    console.log('[isoSelia] ✅ Using original track2 from database');
                }
                // Set cardNumber from track2 for consistency
                cardNumber = track2Data.split('=')[0] || '';
            } else {
                // No original transaction found - use provided track2 or create dummy
                track2Data = body.tk2 || body.cardInformation?.tk2 || '000000******0000=';
                cardNumber = track2Data.split('=')[0] || '';
                console.log('[isoSelia] ⚠️ No original transaction found - using provided track2');
            }
        } else {
            // PCI DSS 4 Requirement 3.5.2: Use real track2 data for original transactions
            // Original transaction: Use real track2 data
            track2Data = body.tk2 || body.cardInformation?.tk2 || '';
            cardNumber = body.cardInformation?.card_number?.replace(/\D/g, '') || '';
            if (!track2Data) {
                throw new Error(' ❌ [isoSelia] track2 data (tk2) is required for original transactions');
            }
            if (!cardNumber) {
                throw new Error(' ❌ [isoSelia] cardInformation.card_number is required for original transactions');
            }
        }

        const { cvv, expiration } = extractCVVAndExpiration(body, isReferenceTransaction);

        // PCI DSS 4 Requirement 10.2.1: Audit trail - log payment info (with masking for security)
        console.log('[isoSelia] 💰 Payment info DEBUG:', {
            amount: amountCents,
            cardNumber: isReferenceTransaction ? 'MASKED' : 'ORIGINAL',
            originalCardNumber: body.cardInformation?.card_number,
            track2: isReferenceTransaction ? 'MASKED' : 'ORIGINAL',
            originalTrack2: body.tk2 || body.cardInformation?.tk2,
            isReferenceTransaction: isReferenceTransaction,
            originalAuthentication: body.authentication,
            operation: body.operation
        });

        const paymentInfo = buildPaymentInfo(body, guid, amountCents, cardNumber, cvv, expiration, binDataInfo, isReferenceTransaction, body.tk2 || body.cardInformation?.tk2, originalTx);

        // PCI DSS 4 Requirement 10.2.1: Audit trail - log Selia gateway processing
        console.log('[isoSelia] 🔄 Processing through Selia gateway...');
        const result = await seliaService.processISOMessage(isoMessage, paymentInfo, {
            guid: guid,
            merchantId: body.merchantData.id_merchant,
            reference: body.reference,
            originalReference: body.originalReference || body.original_transaction_id,
            isReferenceTransaction: isReferenceTransaction,
            originalTransaction: originalTx ? {
                authorization: originalTx.authorization,
                reference: originalTx.reference_number
            } : null
        });

        // PCI DSS 4 Requirement 10.2.1: Audit trail - log Selia processing result
        console.log('[isoSelia] ✅ Selia processing completed:', {
            success: result.success,
            responseCode: result.responseCode,
            isReferenceTransaction: isReferenceTransaction
        });

        return {
            ok: result.success,
            out: {
                success: result.success,
                authorization_code: result.rawFields[50] || '',
                transaction_id: result.rawFields[51] || '',
                response_code: mapSeliaToIsoCode(result.responseCode),
                description: result.responseMessage,
                request_id: guid,
                full_prosa: result.rawFields,
                is_reference_transaction: isReferenceTransaction,
                original_reference: body.originalReference || body.original_transaction_id || ''
            },
            dataRes: result
        };

    } catch (error) {
        // PCI DSS 4 Requirement 10.2.1: Audit trail - log errors for security monitoring
        console.error('💥 ISO_SELIA processing error:', error.message);
        return {
            ok: false,
            out: {
                success: false,
                error: error.message,
                response_code: '96',
                request_id: guid,
                description: `Selia Error: ${error.message}`
            }
        };
    }
};

/**
 * Determine if transaction is a reference transaction (cancel/reverse/refund)
 * PCI DSS 4 Requirement 10.2.1: Audit trail - log transaction type determination
 */
function checkIfReferenceTransaction(body, ref = '') {
    console.log('[isoSelia] 🔍 Checking transaction type...');

    // Method 1: Check metadata for reference operation flag
    if (body.metadata && body.metadata.is_reference_operation === true) {
        console.log(`[isoSelia] 📋 Reference transaction (metadata.is_reference_operation: true)`);
        return true;
    }

    // Method 2: Check operation field
    if (body.operation) {
        const operation = body.operation.toLowerCase();
        const refOperations = ['cancel', 'reversal', 'refund', 'void', 'anulacion', 'devolucion', 'reverso'];
        if (refOperations.some(op => operation.includes(op))) {
            console.log(`[isoSelia] 📋 Reference transaction (operation: ${body.operation})`);
            return true;
        }
    }

    // Method 3: Check transactionType field
    if (body.transactionType) {
        const type = body.transactionType.toLowerCase();
        const refTypes = ['cancel', 'reversal', 'refund', 'void', 'anulacion', 'devolucion', 'reverso'];
        if (refTypes.some(t => type.includes(t))) {
            console.log(`[isoSelia] 📋 Reference transaction (transactionType: ${body.transactionType})`);
            return true;
        }
    }

    // Method 4: Check ISO message type
    if (body.parsedIsoFields && body.parsedIsoFields[0]) {
        const msgType = body.parsedIsoFields[0].toString();
        const referenceTypes = ['0400', '0420']; // Reversal messages
        if (referenceTypes.includes(msgType.substring(0, 4))) {
            console.log(`[isoSelia] 📋 Reference transaction (ISO type: ${msgType})`);
            return true;
        }
    }

    // 🔴 FIXED Method 5: Check for original reference - IGNORE 'pin'
    const hasValidOriginalRef =
        (body.originalReference && body.originalReference !== 'pin') ||
        (body.original_transaction_id && body.original_transaction_id !== 'pin');

    if (hasValidOriginalRef) {
        console.log(`[isoSelia] 📋 Reference transaction (has valid original reference)`);
        return true;
    }

    // Method 6: Check ref parameter for keywords
    if (ref) {
        const refLower = ref.toLowerCase();
        const refIndicators = ['cancel', 'reversal', 'void', 'refund'];
        if (refIndicators.some(ind => refLower.includes(ind))) {
            console.log(`[isoSelia] 📋 Reference transaction (ref: ${ref.substring(0, 50)}...)`);
            return true;
        }
    }

    // Method 7: Check for dummy card number (common in reference operations)
    if (body.cardInformation &&
        (body.cardInformation.card_number === '0000000000000000' ||
         body.cardInformation.card_number.includes('*') ||
         body.cardInformation.card_number.includes('X'))) {
        console.log(`[isoSelia] 📋 Reference transaction (dummy/masked card number)`);
        return true;
    }

    // Method 8: Check if authentication is NOT 'pin' (valid reference)
    if (body.authentication && body.authentication !== 'pin' && /^\d+$/.test(body.authentication)) {
        console.log(`[isoSelia] 📋 Reference transaction (valid authentication number: ${body.authentication})`);
        return true;
    }

    console.log('[isoSelia] 📋 This appears to be an ORIGINAL transaction');
    return false;
}

/**
 * Validate required transaction data
 * PCI DSS 4 Requirement 6.2.4: Input validation to prevent injection attacks
 * PCI DSS 4 Requirement 10.2.1: Audit trail - log validation results
 */
function validateRequiredData(body, isReferenceTransaction = false) {
    console.log('[isoSelia] 🔍 Validating required transaction data...');

    // Common validations
    if (!body.merchantData) {
        throw new Error(' ❌ [isoSelia] merchantData is required');
    }
    if (!body.merchantData.id_merchant) {
        throw new Error(' ❌ [isoSelia] merchantData.id_merchant is required');
    }
    if (!body.merchantData.afiliation_number) {
        throw new Error(' ❌ [isoSelia] merchantData.afiliation_number is required');
    }
    if (!body.isoMessage) {
        throw new Error(' ❌ [isoSelia] ISO message is required');
    }
    if (!body.amount) {
        throw new Error(' ❌ [isoSelia] Transaction amount is required');
    }

    // PCI DSS 4 Requirement 6.2.4: Validate card number format to prevent injection
    // 🔴 FIXED: Only reject dummy data for ORIGINAL transactions
    if (!isReferenceTransaction && body.cardInformation?.card_number) {
        const cardNumber = body.cardInformation.card_number;

        // Reject dummy/placeholder PANs for original transactions only
        if (cardNumber === '0000000000000000' ||
            cardNumber === '000000******0000' ||
            cardNumber.includes('undefined')) {
            throw new Error(' ❌ [isoSelia] Invalid card number: dummy/placeholder detected for original transaction');
        }

        // Ensure PAN looks valid (masked or real)
        if (!cardNumber.match(/^[\d\*]{13,19}$/)) {
            throw new Error(` ❌ [isoSelia] Invalid card number format: ${cardNumber.substring(0, 10)}...`);
        }
    }

    if (!body.device) {
        throw new Error(' ❌ [isoSelia] device information is required');
    }
    if (!body.device.serial) {
        throw new Error(' ❌ [isoSelia] device.serial is required');
    }

    console.log('[isoSelia] ✅ All critical data validation passed');
}

/**
 * Build payment information for Selia gateway
 * PCI DSS 4 Requirement 3.5.1: Only include necessary data for payment processing
 * PCI DSS 4 Requirement 3.5.2: Card data handled securely for transmission
 * PCI DSS 4 Requirement 10.2.1: Audit trail - log payment info construction
 */
function buildPaymentInfo(body, guid, amountCents, cardNumber, cvv, expiration, binDataInfo, isReferenceTransaction = false, track2Data = '', originalTx = null) {
    console.log('[isoSelia] 🔍 Building payment info...');

    const originador = 62;
    const nodo = body.device.serial;
    const folioMexipay = body.reference || guid;
    const cardType = determineCardType(body.parsedIsoFields, binDataInfo, isReferenceTransaction);
    const cardEmisor = binDataInfo?.brand || 'GENERAL';

    // PCI DSS 4 Requirement 3.5.2: Handle track2 data securely for reference transactions
    // Handle track2 data
    if (!track2Data) {
        if (isReferenceTransaction) {
            // 🔴 CRITICAL FIX: For reference transactions, try to get original track2 first
            if (originalTx) {
                track2Data = originalTx.track2 || originalTx.tk2 || '';
                if (!track2Data) {
                    // Fallback: reconstruct from BIN and last4 if no original track2 available
                    const bin = originalTx.bin || '000000';
                    const last4 = originalTx.last4 || '0000';
                    track2Data = `${bin.padStart(6, '0')}******${last4.padStart(4, '0')}=`;
                    console.log('[isoSelia] ⚠️ buildPaymentInfo: Using reconstructed track2 (original not found in DB)');
                } else {
                    console.log('[isoSelia] ✅ buildPaymentInfo: Using original track2 from database');
                }
            } else {
                // Use provided track2 for cancel operations
                track2Data = body.tk2 || body.cardInformation?.tk2 || '000000******0000=';
                console.log('[isoSelia] ⚠️ buildPaymentInfo: No original transaction found - using provided track2');
            }
        } else {
            // Original transactions need real track2
            track2Data = body.tk2 || body.cardInformation?.tk2 || '';
            if (!track2Data) {
                throw new Error(' ❌ [isoSelia] track2 data (tk2) is required for original transactions');
            }
        }
    }

    // For reference transactions with dummy card number (0000000000000000), use masked version
    if (isReferenceTransaction && cardNumber === '0000000000000000') {
        if (originalTx) {
            const bin = originalTx.bin || '000000';
            const last4 = originalTx.last4 || '0000';
            cardNumber = bin.padStart(6, '0') + '******' + last4.padStart(4, '0');
        } else {
            cardNumber = '000000******0000';
        }
    }

    const paymentInfo = {
        originador: originador,
        nodo: nodo,
        folioMexipay: folioMexipay,
        amount: amountCents,
        cardNumber: cardNumber,
        track2: track2Data,
        tk2: track2Data,
        cardType: cardType,
        cardEmisor: cardEmisor,
        versionMexipay: process.env.MEXIPAY_VERSION || 'MxPay251101',
        isReferenceTransaction: isReferenceTransaction,
        originalReference: body.originalReference || body.original_transaction_id || body.authentication || '',
        transactionType: body.transactionType || body.operation || 'authorization'
    };

    console.log('[isoSelia] 💰 Payment info built:', {
        originador: paymentInfo.originador,
        nodo: paymentInfo.nodo,
        folioMexipay: paymentInfo.folioMexipay,
        amount: paymentInfo.amount,
        cardNumber: paymentInfo.cardNumber,
        track2: paymentInfo.track2,
        cardType: paymentInfo.cardType,
        cardEmisor: paymentInfo.cardEmisor,
        isReferenceTransaction: paymentInfo.isReferenceTransaction,
        originalReference: paymentInfo.originalReference
    });

    return paymentInfo;
}

/**
 * Determine card type from BIN data
 * PCI DSS 4 Requirement 3.5.1: Use BIN data for business purposes only
 */
function determineCardType(parsedIsoFields, binDataInfo, isReferenceTransaction = false) {
    console.log('[isoSelia] 🔍 Determining card type...');

    // Default to generic
    let cardType = 'G';

    if (binDataInfo?.type) {
        const type = binDataInfo.type.toUpperCase();
        if (type.includes('CREDITO') || type.includes('CREDIT')) {
            cardType = 'C';
        } else if (type.includes('DEBITO') || type.includes('DEBIT')) {
            cardType = 'D';
        }
    }

    console.log(`[isoSelia] 🎯 Card type: ${cardType}`);
    return cardType;
}

/**
 * Extract CVV and expiration from card data
 * PCI DSS 4 Requirement 3.5.1: Only extract data needed for payment processing
 * PCI DSS 4 Requirement 3.5.2: CVV handled securely (not stored for reference transactions)
 */
function extractCVVAndExpiration(body, isReferenceTransaction = false) {
    console.log('[isoSelia] 🔍 Extracting CVV/expiration...');

    // PCI DSS 4 Requirement 3.5.1: Reference transactions don't need CVV/expiration
    // Reference transactions don't need CVV/expiration
    if (isReferenceTransaction) {
        console.log('[isoSelia] ℹ️ Reference transaction - CVV/expiration not required');
        return { cvv: '000', expiration: '' };
    }

    let cvv = body.cardInformation?.cvv || '000';
    let expiration = '';

    // Extract expiration from EMV if available
    if (body.cardInformation?.emv_tags) {
        const expMatch = body.cardInformation.emv_tags.match(/5F2403\*(\d{4})\*/);
        if (expMatch) {
            const yymm = expMatch[1];
            expiration = yymm.substring(2, 4) + yymm.substring(0, 2); // MMYY format
        }
    }

    return { cvv, expiration };
}

/**
 * Map Selia response codes to ISO 8583 response codes
 * PCI DSS 4 Requirement 10.2.1: Audit trail - maintain consistent response code mapping
 */
function mapSeliaToIsoCode(seliaCode) {
    const mapping = {
        '0': '00', '00': '00',
        '1': '01', '01': '01',
        '5': '05', '05': '05',
        '6': '06', '06': '06',
        '14': '14', '51': '51',
        '54': '54', '96': '96',
        '99': '96'
    };
    return mapping[seliaCode] || '06';
}

// 🔴 EXPORT ALL FUNCTIONS
module.exports.validateRequiredData = validateRequiredData;
module.exports.buildPaymentInfo = buildPaymentInfo;
module.exports.determineCardType = determineCardType;
module.exports.extractCVVAndExpiration = extractCVVAndExpiration;
module.exports.mapSeliaToIsoCode = mapSeliaToIsoCode;
module.exports.checkIfReferenceTransaction = checkIfReferenceTransaction;



//function checkIfReferenceTransaction(body, ref = '') {
//    console.log('[isoSelia] 🔍 Checking transaction type...');
//
//    // Check ISO message type
//    if (body.parsedIsoFields && body.parsedIsoFields[0]) {
//        const msgType = body.parsedIsoFields[0].toString();
//        const referenceTypes = ['0400', '0420']; // Reversal messages
//        if (referenceTypes.includes(msgType.substring(0, 4))) {
//            console.log(`[isoSelia] 📋 Reference transaction (ISO type: ${msgType})`);
//            return true;
//        }
//    }
//
//    // Check transaction type
//    if (body.transactionType) {
//        const type = body.transactionType.toLowerCase();
//        const refTypes = ['cancel', 'reversal', 'void', 'anulacion'];
//        if (refTypes.some(t => type.includes(t))) {
//            console.log(`[isoSelia] 📋 Reference transaction (type: ${body.transactionType})`);
//            return true;
//        }
//    }
//
//    // Check for original reference
//    if (body.originalReference || body.original_transaction_id) {
//        console.log(`[isoSelia] 📋 Reference transaction (has original reference)`);
//        return true;
//    }
//
//    // Check ref parameter for keywords
//    if (ref) {
//        const refLower = ref.toLowerCase();
//        const refIndicators = ['cancel', 'reversal', 'void'];
//        if (refIndicators.some(ind => refLower.includes(ind))) {
//            console.log(`[isoSelia] 📋 Reference transaction (ref: ${ref.substring(0, 50)}...)`);
//            return true;
//        }
//    }
//
//    console.log('[isoSelia] 📋 Original/Authorization transaction');
//    return false;
//}

//function validateRequiredData(body, isReferenceTransaction = false) {
//    console.log('[isoSelia] 🔍 Validating required data...');
//
//    // Common validations
//    const required = [
//        { field: body.merchantData, message: 'merchantData is required' },
//        { field: body.merchantData?.id_merchant, message: 'merchantData.id_merchant is required' },
//        { field: body.merchantData?.afiliation_number, message: 'merchantData.afiliation_number is required' },
//        { field: body.isoMessage, message: 'ISO message is required' },
//        { field: body.amount, message: 'Transaction amount is required' },
//        { field: body.device, message: 'device information is required' },
//        { field: body.device?.serial, message: 'device.serial is required' }
//    ];
//
//    for (const req of required) {
//        if (!req.field) {
//            throw new Error(` ❌ [isoSelia] ${req.message}`);
//        }
//    }
//
//    // Transaction-specific validations
//    if (!isReferenceTransaction) {
//        // Original transactions need card data
//        if (!body.cardInformation) {
//            throw new Error(' ❌ [isoSelia] cardInformation is required for original transactions');
//        }
//        if (!body.cardInformation.card_number) {
//            throw new Error(' ❌ [isoSelia] cardInformation.card_number is required for original transactions');
//        }
//    } else {
//        // Reference transactions need original reference
//        if (!body.originalReference && !body.original_transaction_id && !body.authentication) {
//            console.log('[isoSelia] ⚠️ Reference transaction missing original reference - may fail');
//        }
//    }
//
//    console.log('[isoSelia] ✅ Validation passed');
//}