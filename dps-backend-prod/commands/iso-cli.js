#!/usr/bin/env node

require('dotenv').config();

const IsoSeliaService = require('../lib/socketServer/lib/services/isoSeliaService');
const helpers = require('../lib/helpers/lib/helpers');
let db = require('../lib/socketServer/lib/sequelize/init');
db = db.seq;

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

const config = process.env.SELIA_ISO_MODE === 'DEV' ? {
    host: process.env.SELIA_ISO_DEV_HOST ,
    port: parseInt(process.env.SELIA_ISO_DEV_PORT) ,
    companyId:  parseInt(process.env.SELIA_COMPANY_TPV_ID) || 10990,
    username: process.env.SELIA_ISO_USERNAME || 'crytest99w3D',
    password: process.env.SELIA_ISO_PASSWORD || 'tac',
    aesKey: process.env.SELIA_AES_KEY || 'W0ten03L3rvxC851',
    timeout: parseInt(process.env.SELIA_TIMEOUT) || 30000,
    debug: (process.env.SELIA_DEBUG === 'true'),
    db: db,
    helpers: helpers
} : {  // <-- Fixed the else part to be a proper object
    host: process.env.SELIA_ISO_HOST || '152.0.2.121',
    port: parseInt(process.env.SELIA_ISO_PORT) || 5001,
    companyId: parseInt(process.env.SELIA_COMPANY_TPV_ID) || 10990,
    username: process.env.SELIA_ISO_USERNAME || 'crytest99w3D',
    password: process.env.SELIA_ISO_PASSWORD || 'tac',
    aesKey: process.env.SELIA_AES_KEY || 'W0ten03L3rvxC851',
    timeout: parseInt(process.env.SELIA_TIMEOUT) || 30000,
    debug:(process.env.SELIA_DEBUG === 'true'),
    db: db,
    helpers: helpers
    };

    console.log('[isoSeliaService] 🔧 Selia Service Config:', {
    mode: process.env.SELIA_ISO_MODE,
    host: config.host,
    port: config.port,
    companyId: config.companyId,
    username: config.username,
    password: '***',
    aesKey: '***',
    timeout: config.timeout,
    debug: config.debug,
    hasDb: !!config.db,
    hasHelpers: !!config.helpers
    });

// Initialize service
const seliaService = new IsoSeliaService(config);

/**
 * Build ISO8583 message for status inquiry using ONLY real DB data + parsed tkn_data_63_rq
 * Returns { isoMessage, txData } for wrapper use
 */
seliaService.buildStatusInquiryIsoMessage = async function(inquiryInfo) {
    console.log('🔨 Building ISO8583 message - 100% DYNAMIC from DB');

    const { folioMexipay } = inquiryInfo;
    if (!folioMexipay) throw new Error('folioMexipay is required');

    // 1. OBTENER DATOS COMPLETOS DE LA TRANSACCIÓN
    const tx = await this.getCompleteTransactionData(folioMexipay);

    if (!tx) {
        throw new Error(`No transaction found for ${folioMexipay}`);
    }

    // 2. VALIDAR DATOS MÍNIMOS
    const requiredFields = ['bin', 'last4', 'amount', 'tran_date', 'tran_time',
                           'trace_number', 'originador', 'nodo', 'name_merchant'];

    const missingFields = requiredFields.filter(field => !tx[field]);
    if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // 3. CONSTRUIR DATOS DINÁMICAMENTE
    const pan = this.buildPAN(tx.bin, tx.last4, tx.tkn_data_63_rq);
    const stan = this.extractSTAN(tx.trace_number);
    const amountCents = this.convertToCents(tx.amount);

    // Fechas dinámicas (usar las de la transacción original)
    const transmissionDT = this.buildTransmissionDateTime(tx.tran_date, tx.tran_time);
    const localDate = tx.tran_date;
    const localTime = tx.tran_time.substring(0, 6);

    // 4. CONSTRUIR CAMPOS DINÁMICOS
    const fields = {};

    // Campo 2: PAN (LL-n) - DINÁMICO
    fields[2] = pan.length.toString().padStart(2, '0') + pan;

    // Campo 3: Processing Code - DINÁMICO (consultar tipo original)
    fields[3] = this.getProcessingCode(tx.processing_code || '000000');

    // Campo 4: Amount - DINÁMICO
    fields[4] = amountCents.toString().padStart(12, '0');

    // Campo 7: Transmission DT - DINÁMICO
    fields[7] = transmissionDT;

    // Campo 11: STAN - DINÁMICO
    fields[11] = stan;

    // Campo 12: Local Time - DINÁMICO
    fields[12] = localTime.padEnd(6, '0');

    // Campo 13: Local Date - DINÁMICO
    fields[13] = localDate;

    // Campo 17: Capture Date - DINÁMICO (usar fecha de captura si existe)
    fields[17] = tx.capture_date || localDate;

    // Campo 18: Merchant Type - DINÁMICO (de DB o default según merchant)
    fields[18] = this.getMerchantTypeCode(tx.mcc_code || tx.merchant_type || '5411');

    // Campo 22: POS Entry Mode - DINÁMICO (de DB o inferir)
    fields[22] = this.getPOSEntryMode(tx.pos_entry_mode || '051');

    // Campo 25: POS Condition - DINÁMICO
    fields[25] = this.getPOSConditionCode(tx.pos_condition || '00');

    // Campo 32: Acquiring Institution - DINÁMICO
    fields[32] = this.buildAcquiringInstitution(tx.acquiring_institution || '01');

    // Campo 35: Track 2 Data - DINÁMICO (si existe en DB)
    if (tx.track2_data) {
        fields[35] = this.buildTrack2Data(tx.track2_data);
    } else {
        // Construir dinámicamente si no existe
        const expDate = tx.card_expiry || '2512'; // YYMM
        const track2 = `${pan}=${expDate}101`;
        fields[35] = track2.length.toString().padStart(2, '0') + track2;
    }

    // Campo 37: RRN - DINÁMICO
    fields[37] = (tx.reference_number || folioMexipay || '').padEnd(12, ' ').substring(0, 12);

    // Campo 41: Terminal ID - DINÁMICO
    fields[41] = (tx.nodo || '').padEnd(16, ' ').substring(0, 16);

    // Campo 42: Merchant ID - DINÁMICO
    fields[42] = (tx.originador || '').padEnd(15, ' ').substring(0, 15);

    // Campo 43: Merchant Name/Location - DINÁMICO
    fields[43] = this.buildMerchantNameLocation(tx);

    // Campo 48: Retailer Data - DINÁMICO (si existe en DB)
    if (tx.retailer_data) {
        fields[48] = this.buildLLLField(tx.retailer_data);
    }

    // Campo 49: Currency - DINÁMICO
    fields[49] = tx.currency_code || '484';

    // Campo 60: Terminal Data - DINÁMICO (si existe)
    if (tx.terminal_data) {
        fields[60] = this.buildLLLField(tx.terminal_data);
    }

    // Campo 61: Response Data - DINÁMICO (para status inquiry)
    fields[61] = this.buildResponseDataForInquiry();

    // Campo 63: Additional Data - DINÁMICO (si existe en DB)
    if (tx.tkn_data_63_rq) {
        fields[63] = this.buildAdditionalData(tx.tkn_data_63_rq);
    }

    // Campos 100+ si existen en DB
    if (tx.receiving_institution) {
        fields[100] = this.buildLLField(tx.receiving_institution);
    }

    // 5. CONSTRUIR BITMAP DINÁMICO
    const presentFields = Object.keys(fields).map(Number).sort((a, b) => a - b);
    const bitmap = this.buildBitmap(presentFields);

    // 6. CONSTRUIR MENSAJE COMPLETO
    const header = 'ISO026000050';
    const mti = '0200';

    let isoMessage = header + mti + bitmap;

    // Agregar campos en orden numérico
    presentFields.forEach(fieldNum => {
        isoMessage += fields[fieldNum];
    });

    // 7. LOG PARA DEBUG (sin exponer datos sensibles)
    console.log('\n✅ ISO Message built DYNAMICALLY:');
    console.log(`- Reference: ${folioMexipay}`);
    console.log(`- MTI: ${mti}`);
    console.log(`- PAN: ${pan.substring(0, 6)}...${pan.substring(pan.length - 4)}`);
    console.log(`- Amount: ${amountCents / 100} ${fields[49]}`);
    console.log(`- Merchant: ${tx.name_merchant}`);
    console.log(`- Terminal: ${tx.nodo}`);
    console.log(`- Fields included: ${presentFields.length}`);
    console.log(`- Total length: ${isoMessage.length}`);

    return {
        isoMessage,
        txData: {
            pan: pan,
            amount: amountCents / 100,
            merchant: tx.name_merchant,
            terminal: tx.nodo,
            currency: fields[49],
            reference: fields[37].trim()
        }
    };
};

// ============================================================
// FUNCIONES AUXILIARES DINÁMICAS
// ============================================================

seliaService.getCompleteTransactionData = async function(folioMexipay) {
    console.log(`📋 Fetching complete transaction data for: ${folioMexipay}`);

    try {
        const [results] = await this.config.db.query(`
            SELECT
                im.bin,
                im.last4,
                im.amount,
                im.tran_date,
                im.tran_time,
                im.trace_number,
                im.name_merchant AS originador,
                im.terminal AS nodo,
                im.tkn_data_63_rq,
                im.reference_number,
                im.processing_code,
                im.capture_date,
                im.mcc_code,
                im.merchant_type,
                im.pos_entry_mode,
                im.pos_condition,
                im.acquiring_institution,
                im.track2_data,
                im.retailer_data,
                im.currency_code,
                im.terminal_data,
                im.receiving_institution,
                im.card_expiry,
                -- Datos del merchant si existen
                m.merchant_name,
                m.merchant_address,
                m.merchant_city,
                m.merchant_state,
                m.merchant_country
            FROM iso_message im
            LEFT JOIN merchant m ON im.name_merchant = m.id_merchant
            WHERE im.reference_number = :ref OR im.folio = :ref
            ORDER BY im.creation_date DESC
            LIMIT 1
        `, {
            replacements: { ref: folioMexipay },
            type: this.config.db.QueryTypes.SELECT
        });

        const tx = Array.isArray(results) ? results[0] : results;

        if (!tx) {
            console.warn(`⚠️ No transaction found for: ${folioMexipay}`);
            return null;
        }

        console.log(`✅ Found transaction with ${Object.keys(tx).length} fields`);

        // Log campos importantes (sin datos sensibles)
        const safeLog = { ...tx };
        if (safeLog.bin) safeLog.bin = safeLog.bin.substring(0, 6) + '...';
        if (safeLog.last4) safeLog.last4 = '****';
        if (safeLog.tkn_data_63_rq) safeLog.tkn_data_63_rq = '[...encrypted...]';

        console.log('Transaction data:', safeLog);

        return tx;

    } catch (error) {
        console.error(`❌ Database error: ${error.message}`);
        throw error;
    }
};

seliaService.buildPAN = function(bin, last4, tknData63) {
    // Intentar obtener PAN completo de tkn_data_63_rq primero
    if (tknData63 && tknData63.startsWith('& ')) {
        try {
            const hex = tknData63.substring(2).trim();
            const jsonStr = Buffer.from(hex, 'hex').toString('utf-8');
            const parsed = JSON.parse(jsonStr);

            if (parsed.card_number) {
                const fullPan = parsed.card_number.replace(/\./g, '');
                if (fullPan.length >= 16 && fullPan.length <= 19) {
                    console.log(`✅ Using full PAN from tkn_data_63_rq (${fullPan.length} digits)`);
                    return fullPan;
                }
            }
        } catch (error) {
            console.warn(`⚠️ Could not parse PAN from tkn_data_63_rq: ${error.message}`);
        }
    }

    // Fallback: construir desde bin + last4
    if (bin && last4) {
        const pan = bin + '000000' + last4;
        console.log(`✅ Built PAN from BIN+Last4: ${pan.substring(0, 6)}...${pan.substring(pan.length - 4)}`);
        return pan.substring(0, 19); // Max 19 dígitos
    }

    throw new Error('Cannot build PAN: missing BIN and last4');
};

seliaService.extractSTAN = function(traceNumber) {
    if (!traceNumber) return '000001';

    // Extraer solo dígitos
    const digits = traceNumber.replace(/\D/g, '');

    if (digits.length >= 6) {
        return digits.substring(0, 6);
    }

    return digits.padStart(6, '0');
};

seliaService.convertToCents = function(amount) {
    if (!amount) return 0;

    // Convertir string a número
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount)) {
        console.warn(`⚠️ Invalid amount format: ${amount}, using 0`);
        return 0;
    }

    return Math.round(numAmount * 100);
};

seliaService.buildTransmissionDateTime = function(tranDate, tranTime) {
    // Formato: MMDDhhmmss
    // tranDate: DDMM, tranTime: hhmmss

    if (!tranDate || !tranTime) {
        const now = new Date();
        return (
            (now.getMonth() + 1).toString().padStart(2, '0') +
            now.getDate().toString().padStart(2, '0') +
            now.getHours().toString().padStart(2, '0') +
            now.getMinutes().toString().padStart(2, '0') +
            now.getSeconds().toString().padStart(2, '0')
        );
    }

    // Asumir mes actual si no está en tranDate
    const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const day = tranDate.substring(0, 2);
    const time = tranTime.substring(0, 4); // hhmm

    return currentMonth + day + time + '00';
};

seliaService.getProcessingCode = function(originalCode) {
    if (!originalCode || originalCode.length !== 6) {
        return '000000'; // Default: purchase
    }

    // Para status inquiry, mantener primeros 2 dígitos, resto 0
    const transactionType = originalCode.substring(0, 2);
    return transactionType + '0000';
};

seliaService.getMerchantTypeCode = function(mcc) {
    if (!mcc || mcc.length !== 4) {
        return '5411'; // Default: grocery stores
    }

    return mcc;
};

seliaService.getPOSEntryMode = function(entryMode) {
    if (!entryMode || entryMode.length !== 3) {
        return '051'; // Default: chip, encrypted PIN
    }

    return entryMode;
};

seliaService.getPOSConditionCode = function(conditionCode) {
    if (!conditionCode || conditionCode.length !== 2) {
        return '00'; // Default: normal
    }

    return conditionCode;
};

seliaService.buildAcquiringInstitution = function(institutionCode) {
    if (!institutionCode) return '0201'; // Default

    const codeStr = String(institutionCode);
    const length = codeStr.length.toString().padStart(2, '0');
    return length + codeStr;
};

seliaService.buildTrack2Data = function(track2) {
    if (!track2) {
        return '000'; // Empty
    }

    const track2Str = String(track2);
    const length = track2Str.length.toString().padStart(2, '0');
    return length + track2Str;
};

seliaService.buildMerchantNameLocation = function(tx) {
    let merchantInfo = '';

    if (tx.merchant_name) {
        merchantInfo = tx.merchant_name;
    } else if (tx.name_merchant) {
        merchantInfo = `Merchant ${tx.name_merchant}`;
    } else {
        merchantInfo = 'Unknown Merchant';
    }

    // Agregar ubicación si está disponible
    const locationParts = [];
    if (tx.merchant_city) locationParts.push(tx.merchant_city);
    if (tx.merchant_state) locationParts.push(tx.merchant_state);
    if (tx.merchant_country) locationParts.push(tx.merchant_country);

    if (locationParts.length > 0) {
        merchantInfo += ' ' + locationParts.join(', ');
    }

    // Limitar a 40 caracteres y pad
    return merchantInfo.substring(0, 40).padEnd(40, ' ');
};

seliaService.buildLLField = function(data) {
    const dataStr = String(data || '');
    const length = dataStr.length.toString().padStart(2, '0');
    return length + dataStr;
};

seliaService.buildLLLField = function(data) {
    const dataStr = String(data || '');
    const length = dataStr.length.toString().padStart(3, '0');
    return length + dataStr;
};

seliaService.buildResponseDataForInquiry = function() {
    const inquiryData = JSON.stringify({
        type: 'status_inquiry',
        timestamp: new Date().toISOString(),
        source: 'selia_gateway'
    });

    const length = inquiryData.length.toString().padStart(3, '0');
    return length + inquiryData;
};

seliaService.buildAdditionalData = function(tknData63) {
    if (!tknData63) return '000';

    try {
        if (tknData63.startsWith('& ')) {
            // Ya está en hex, usar como está
            const hexData = tknData63.substring(2);
            const length = hexData.length.toString().padStart(3, '0');
            return length + hexData;
        } else {
            // Convertir a hex
            const hexData = Buffer.from(tknData63).toString('hex');
            const length = hexData.length.toString().padStart(3, '0');
            return length + hexData;
        }
    } catch (error) {
        console.warn(`⚠️ Error building additional data: ${error.message}`);
        return '000';
    }
};

seliaService.buildBitmap = function(presentFields) {
    // Separar campos primarios (1-64) y secundarios (65-128)
    const primaryFields = presentFields.filter(f => f >= 1 && f <= 64);
    const secondaryFields = presentFields.filter(f => f > 64 && f <= 128);

    // Bitmap primario
    let primaryBitmap = '0'.repeat(64);
    primaryFields.forEach(field => {
        primaryBitmap = primaryBitmap.substring(0, field - 1) + '1' + primaryBitmap.substring(field);
    });

    // ¿Necesitamos bitmap secundario?
    const needsSecondary = secondaryFields.length > 0;

    if (needsSecondary) {
        // Activar bit 1 del primario
        primaryBitmap = '1' + primaryBitmap.substring(1);

        // Bitmap secundario
        let secondaryBitmap = '0'.repeat(64);
        secondaryFields.forEach(field => {
            const bitPosition = field - 65; // Campo 65 = bit 0
            secondaryBitmap = secondaryBitmap.substring(0, bitPosition) + '1' + secondaryBitmap.substring(bitPosition + 1);
        });

        // Convertir a hex
        const primaryHex = parseInt(primaryBitmap, 2).toString(16).padStart(16, '0').toUpperCase();
        const secondaryHex = parseInt(secondaryBitmap, 2).toString(16).padStart(16, '0').toUpperCase();

        return primaryHex + secondaryHex;
    } else {
        // Solo bitmap primario
        const primaryHex = parseInt(primaryBitmap, 2).toString(16).padStart(16, '0').toUpperCase();
        return primaryHex;
    }
};

// Añadir función auxiliar para convertir binario a hex
seliaService.binaryToHex = function(binaryStr) {
    let hex = '';
    for (let i = 0; i < binaryStr.length; i += 4) {
        const chunk = binaryStr.substring(i, i + 4);
        hex += parseInt(chunk, 2).toString(16);
    }
    return hex;
};
/**
 * Build complete Selia status inquiry wrapper – correct hex encryption, mandatory Field 45
 */
seliaService.buildStatusInquiryMessage = async function(inquiryInfo) {
    console.log(`📋 Preparing status inquiry wrapper for ${inquiryInfo.folioMexipay}`);

    const { isoMessage, txData } = await this.buildStatusInquiryIsoMessage(inquiryInfo);

    const encrypted = this.rc4(isoMessage, this.config.aesKey);
    const encryptedIsoMessage = Buffer.from(encrypted).toString('hex').toUpperCase();

    console.log(`✅ Encrypted ISO for Field 611: ${encryptedIsoMessage}... (${encryptedIsoMessage.length} chars)`);

    const timestamp = this.generateProductionTimestamp();

    let message = process.env.SELIA_ISO_MODE === 'PROD' ? `{161:${this.config.companyId};` : `{161:1;`; // empresa
    message += process.env.SELIA_ISO_MODE === 'PROD' ? `1:${this.escapeField(inquiryInfo.originador || txData.originador)};` : `1:1;`; // originador
    message += `2:${this.escapeField(inquiryInfo.nodo || txData.nodo)};`; // Node
    message += `3:${timestamp};`; // Timestamp
    // 🛑 DO NOT REMOVE COMMENTS
    // 📶 LDI will share the catalog to express the transaction type
    message += `7:501;`;
    // 🛑 DO NOT REMOVE COMMENTS
    // 501 - Prosa Venta - constante
    // Sale (Venta): 0
    // Reversal (Reverso): 8
    // Cancellation (Devolución): 3
    // Check-in (Checkin): 200
    // Check-out (Checkout): 201
    // Rent-in (Rentin): 202
    // Rent-out (Rentout): 203
    message += `56:${inquiryInfo.originalTransactionType || '0'};`; // 0 = Venta, 8 = Reverso, 3 = Devolución, 200 = Check-in, 201 = Check-out, 202 = Rent-in, 203 = Rent-out
    message += `19:${this.escapeField(inquiryInfo.folioMexipay)};`; // folio mexipay

    // Mandatory original amount
    const amountStr = txData.amount ? this.validateAmount(txData.amount) : '0';
    const amountCents = parseInt(amountStr.replace(/^0+/, '')); // Remove leading zeros
    message += `45:${String(amountCents).padStart(12, '0')};`; // Amount in cents

    // 🛑 DO NOT REMOVE COMMENTS
    // 📶 Position 35 must include the masked pan
    let maskedPan = txData.pan;

    message += `35:${maskedPan};`;

    // 🛑 DO NOT REMOVE COMMENTS
    // 📶 Position 172 must include the merchant affiliation number
    message += `172:${inquiryInfo.merchantAffiliation};`;

//    message += `611:${encryptedIsoMessage};`;
    message += `611:${isoMessage};`; // ISO message
//    message += `54:${this.escapeField(this.config.username)};`;
//    message += `219:${this.escapeField(this.config.password)};`;

    // 🛑 DO NOT REMOVE COMMENTS
    // 📶 LDI confirms the 356 for the version of the protocol
    message += `356:MxPay251101;`;// Version Mexipay // todo:  may be 456 ?
    message += `}`;

    const redacted = message.replace(this.config.password, '***REDACTED***');
    console.log(`📤 Final status inquiry message (${message.length} chars)`);
    console.log(redacted);

    return message;
};
 /**
  * Query transaction status — strict mode, proper async
  */
 seliaService.queryTransactionStatus = async function(inquiryInfo) {
     const guid = `status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
     console.log(`[${guid}] Initiating strict status inquiry for ${inquiryInfo.folioMexipay}`);

     try {
         const statusMessage = await this.buildStatusInquiryMessage(inquiryInfo);
         const rawResponse = await this.sendToSeliaGateway(statusMessage);
         const parsedResponse = this.parseStatusResponse(rawResponse, inquiryInfo);

         let localStatus = null;
         if (this.config.db && inquiryInfo.folioMexipay) {
             try {
                 const [results] = await this.config.db.query(`
                     SELECT resp_code, authorization, estatus_f, creation_date
                     FROM iso_message
                     WHERE reference_number = :reference OR folio = :reference
                     LIMIT 1
                 `, {
                     replacements: { reference: inquiryInfo.folioMexipay },
                     type: this.config.db.QueryTypes.SELECT
                 });
                 if (results?.length > 0) localStatus = results[0];
             } catch (dbError) {
                 console.warn(`[${guid}] Local DB status lookup failed: ${dbError.message}`);
             }
         }

         return {
             ...parsedResponse,
             inquiryId: guid,
             reference: inquiryInfo.folioMexipay,
             localStatus,
             source: 'selia_gateway',
             timestamp: new Date().toISOString()
         };
     } catch (error) {
         console.error(`[${guid}] Status inquiry FAILED (by design):`, error.message);
         throw error;
     }
 };


/**
 * Parse status inquiry response with detailed logging
 */
seliaService.parseStatusResponse = function(response, inquiryInfo) {
    console.log(`🔍 Parsing status inquiry response for reference: ${inquiryInfo.folioMexipay}`);

    if (!response) {
        console.error(`❌ Empty response received from Selia gateway`);
        return {
            success: false,
            responseCode: '91',
            responseMessage: 'Empty response from Selia gateway',
            isPending: false,
            parsedAt: new Date().toISOString()
        };
    }

    console.log(`📥 Raw response length: ${response.length} characters`);
    console.log(`📥 Raw response preview:`, response.substring(0, 200) + (response.length > 200 ? '...' : ''));

    try {
        const fields = {};
        const cleanResponse = response.replace(/[{}]/g, '');
        const pairs = cleanResponse.split(';');

        pairs.forEach(pair => {
            const [key, value] = pair.split(':');
            if (key && value !== undefined) {
                fields[key.trim()] = value.trim();
            }
        });

        console.log(`📊 Parsed ${Object.keys(fields).length} fields from response:`);

        // Log important fields
        const importantFields = ['14', '39', '54', '38', '19', '37', '7', '56', '25', '611'];
        importantFields.forEach(field => {
            if (fields[field]) {
                if (field === '611') {
                    console.log(`   Field ${field}: ${fields[field].substring(0, 50)}... (${fields[field].length} chars)`);
                } else {
                    console.log(`   Field ${field}: ${fields[field]}`);
                }
            }
        });

        // Determine response code (in order of priority)
        let responseCode = '05'; // Default to "Do Not Honor"
        if (fields['14']) {
            responseCode = fields['14']; // Primary response code field
        } else if (fields['39']) {
            responseCode = fields['39']; // Secondary response code field
        } else if (fields['54']) {
            responseCode = fields['54']; // Transaction type indicator
        }

        console.log(`📊 Determined response code: ${responseCode}`);

        const success = responseCode === '0' || responseCode === '00';

        // Extract transaction status indicators
        const transactionType = fields['7'];
        const transactionStatus = fields['25'] || fields['56'];
        const captureDate = fields['15'] || fields['13'];
        const authCode = fields['38'];
        const transactionId = fields['19'] || fields['37'];

        // Get response message
        const responseMessage = this.getResponseMessage ? this.getResponseMessage(responseCode) : `Code: ${responseCode}`;

        console.log(`📊 Response message: ${responseMessage}`);

        const result = {
            success: success,
            responseCode: responseCode,
            authorizationCode: authCode,
            captureDate: captureDate,
            transactionId: transactionId,
            responseMessage: responseMessage,
            transactionStatus: transactionStatus,
            originalTransactionType: transactionType,
            rawFields: fields,
            isPending: responseCode === '99',
            parsedAt: new Date().toISOString()
        };

        console.log(`✅ Status inquiry parsed successfully:`, {
            success: result.success,
            responseCode: result.responseCode,
            transactionId: result.transactionId,
            isPending: result.isPending
        });

        return result;

    } catch (error) {
        console.error(`❌ Status response parsing error:`, {
            error: error.message,
            stack: error.stack,
            responsePreview: response.substring(0, 200)
        });

        return {
            success: false,
            responseCode: '96',
            responseMessage: `Status response parsing error: ${error.message}`,
            isPending: false,
            parsedAt: new Date().toISOString(),
            errorDetails: error.message
        };
    }
};

// ===== KEEP ALL YOUR EXISTING FUNCTIONS =====

// Display help
function showHelp() {
    console.log(`
📡 Selia ISO8583 Gateway CLI Tool
====================================

Usage: node selia-cli.js <command> [options]

Commands:
  status <reference>          Check transaction status (WITH DATABASE LOOKUP)
  batch-status <file.json>    Batch status check from JSON file
  process <file.json>         Process new transaction from JSON file
  test-connection            Test TCP connection to Selia gateway
  list-pending              List pending transactions from database
  retry-failed              Retry failed transactions

Examples:
  node selia-cli.js status 251211203156
  node selia-cli.js batch-status ./transactions.json
  node selia-cli.js process ./payment.json
  node selia-cli.js test-connection
  node selia-cli.js list-pending
  node selia-cli.js retry-failed --hours=24

Options:
  --originador=ORIG        Override originador (only if not in database)
  --nodo=NODO              Override terminal/nodo (only if not in database)
  --merchant-id=ID         Override merchant ID
  --delay=MSEC             Delay between queries (default: 1000ms)
  --verbose                Show detailed logs
  --output=json            Output in JSON format

IMPORTANT: The status command now automatically looks up originador and nodo from the database!
    `);
}

// Check single transaction status
async function checkStatus(reference, options = {}) {
    console.log(`\n🚀 CHECKING STATUS FOR: ${reference}`);
    console.log('='.repeat(60));

    try {
        // Get transaction from database first
        let transactionDetails = null;
        // Try using model first
        let transaction = null;
        let merchant = null;
        if (config.db) {
            try {
                console.log(`📋 Looking up transaction in database...`);

                if (config.db.models && config.db.models.iso_message) {

                    // get transaction using reference_number or folio
                    const IsoMessage = config.db.models.iso_message;
                    transaction = await IsoMessage.findOne({
                        where: {
                            [config.db.Sequelize.Op.or]: [
                                { reference_number: reference },
                                { folio: reference }
                            ]
                        },
                        raw: true
                    });

                    // get merchant using transactionDetails.card_acceptor
                    const merchantId = transaction.card_acceptor;
                    const Merchant = config.db.models.merchant;
                    merchant = await Merchant.findOne({
                        where: { id_merchant: merchantId }
                    });
                    console.log(`Merchant found: ${merchant}`);
                } else {
                    // Raw query fallback
                    const [transactionResults, merchantResults] = await Promise.all([
                        config.db.query(`
                            SELECT *
                            FROM iso_message
                            WHERE reference_number = :reference OR folio = :reference
                            ORDER BY id_message DESC
                            LIMIT 1
                        `, {
                            replacements: { reference: reference },
                            type: config.db.QueryTypes.SELECT
                        }),
                        config.db.query(`
                            SELECT *
                            FROM merchant
                            WHERE id_merchant = (
                                SELECT name_merchant
                                FROM iso_message
                                WHERE reference_number = :reference OR folio = :reference
                                ORDER BY id_message DESC
                                LIMIT 1
                            )
                        `, {
                            replacements: { reference: reference },
                            type: config.db.QueryTypes.SELECT
                        })
                    ]);

                    if (transactionResults && transactionResults.length > 0) {
                        transaction = transactionResults[0];
                        console.log(`transaction: `, transaction)
                    }

                    if (merchantResults && merchantResults.length > 0) {
                        merchant = merchantResults[0];
                        console.log(`merchant: `, merchant)
                    }
                }

                if (transaction) {


                    transactionDetails = transaction;
                    console.log(`✅ DATABASE RECORD FOUND:`);
                    console.log(`   ID: ${transactionDetails.id_message}`);
                    console.log(`   Reference: ${transactionDetails.reference_number}`);
                    console.log(`   Folio: ${transactionDetails.folio}`);
                    console.log(`   Merchant ID (Field 1): ${transactionDetails.name_merchant}`);
//                    console.log(`   Merchant Affiliation: ${transactionDetails.merchant_por_id.afiliation_number}`);
                    console.log(`   Merchant Affiliation: ${merchant.afiliation_number}`);
                    console.log(`   Terminal Serial (Field 2): ${transactionDetails.terminal}`);
                    console.log(`   Trace: ${transactionDetails.trace_number}`);
                    console.log(`   Amount: ${transactionDetails.amount}`);
                    console.log(`   Date/Time: ${transactionDetails.tran_date} ${transactionDetails.tran_time}`);
                    console.log(`   Status: ${transactionDetails.resp_code}`);
                } else {
                    console.log(`❌ NO TRANSACTION FOUND IN DATABASE FOR: ${reference}`);
                    console.log(`ℹ️ Will use provided/default values`);
                }
            } catch (dbError) {
                console.error(`💥 DATABASE ERROR: ${dbError.message}`);
                if (options.verbose) {
                    console.error(dbError.stack);
                }
            }
        }

        // Prepare inquiry info
        const inquiryInfo = {
            folioMexipay: reference,
            originador: transactionDetails?.name_merchant || options.originador ,
            nodo: transactionDetails?.terminal || options.nodo ,
            traceNumber: options.trace || transactionDetails?.trace_number,
            amount: options.amount || (transactionDetails?.amount ? transactionDetails.amount.replace(/^0+/, '') : null),
            transactionDate: options.date || transactionDetails?.tran_date,
            transactionTime: options.time || transactionDetails?.tran_time,
            merchantId: options.merchantId || transactionDetails?.name_merchant,
            merchantAffiliation: merchant.afiliation_number,
        };

        console.log(`\n📤 SENDING STATUS INQUIRY TO SELIA...`);

        // Query status
        const result = await seliaService.queryTransactionStatus(inquiryInfo);

        // Display results
        console.log('\n' + '='.repeat(70));
        console.log('📊 TRANSACTION STATUS RESULT');
        console.log('='.repeat(70));
        console.log(`Reference:       ${reference}`);
        console.log(`Database Ref:    ${transactionDetails?.reference_number || 'N/A'}`);
        console.log(`Folio:           ${transactionDetails?.folio || 'N/A'}`);
        console.log(`Response Code:   ${result.responseCode}`);
        console.log(`Status:          ${result.responseMessage}`);
        console.log(`Success:         ${result.success ? '✅ YES' : '❌ NO'}`);
        console.log(`Pending:         ${result.isPending ? '⏳ YES' : '❌ NO'}`);

        if (result.authorizationCode) {
            console.log(`Authorization:   ${result.authorizationCode}`);
        }

        if (result.localStatus) {
            console.log(`\n📋 LOCAL DATABASE STATUS:`);
            console.log(`   Code: ${result.localStatus.resp_code}`);
            console.log(`   Auth: ${result.localStatus.authorization || 'N/A'}`);
            console.log(`   Node: ${result.localStatus.node || 'N/A'}`);
            console.log(`   Card Acceptor: ${result.localStatus.card_acceptor || 'N/A'}`);
            console.log(`   Estatus: ${result.localStatus.estatus_f || 'N/A'}`);
        }

        console.log(`\n🆔 Inquiry ID:    ${result.inquiryId}`);
        console.log(`🕒 Timestamp:     ${new Date().toISOString()}`);
        console.log('='.repeat(70));

        return result;

    } catch (error) {
        console.error(`\n💥 FATAL ERROR: ${error.message}`);
        if (options.verbose) {
            console.error(error.stack);
        }
        throw error;
    }
}

// Batch status check from JSON file
async function batchStatusCheck(filePath, options = {}) {
    console.log(`🔍 Batch status check from: ${filePath}`);

    try {
        const fs = require('fs');
        const transactions = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        if (!Array.isArray(transactions)) {
            throw new Error('JSON file must contain an array of transactions');
        }

        console.log(`📋 Processing ${transactions.length} transactions`);

        const delay = parseInt(options.delay) || 1000;
        const results = [];

        for (let i = 0; i < transactions.length; i++) {
            const tx = transactions[i];
            console.log(`\n[${i + 1}/${transactions.length}] Processing: ${tx.reference || tx.folioMexipay}`);

            try {
                const result = await seliaService.queryTransactionStatus({
                    folioMexipay: tx.reference || tx.folioMexipay,
                    originador: tx.originador || options.originador ,
                    nodo: tx.nodo || options.nodo ,
                    traceNumber: tx.trace_number,
                    amount: tx.amount,
                    transactionDate: tx.transactionDate || tx.tran_date,
                    transactionTime: tx.transactionTime || tx.tran_time,
                    merchantId: tx.merchantId || options.merchantId
                });

                results.push({
                    reference: tx.reference || tx.folioMexipay,
                    success: result.success,
                    responseCode: result.responseCode,
                    responseMessage: result.responseMessage,
                    source: result.source,
                    authorization: result.authorizationCode
                });

                const successCount = results.filter(r => r.success).length;
                console.log(`   → ${result.responseCode}: ${result.responseMessage} (${successCount}/${i + 1} successful)`);

                if (i < transactions.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

            } catch (error) {
                console.error(`   → ❌ Failed: ${error.message}`);
                results.push({
                    reference: tx.reference || tx.folioMexipay,
                    success: false,
                    responseCode: 'ERROR',
                    responseMessage: error.message,
                    source: 'error'
                });
            }
        }

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 BATCH STATUS SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total: ${results.length}`);
        console.log(`Successful: ${results.filter(r => r.success).length}`);
        console.log(`Failed: ${results.filter(r => !r.success).length}`);

        const failures = results.filter(r => !r.success);
        if (failures.length > 0) {
            console.log('\n❌ Failed Transactions:');
            failures.forEach(f => {
                console.log(`  ${f.reference}: ${f.responseMessage}`);
            });
        }

        if (options.output === 'json') {
            const outputFile = `batch-results-${Date.now()}.json`;
            fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
            console.log(`\n💾 Results saved to: ${outputFile}`);
        }

        return results;

    } catch (error) {
        console.error(`❌ Batch status check failed:`, error.message);
        throw error;
    }
}

// Process new transaction
async function processTransaction(filePath) {
    console.log(`🔄 Processing transaction from: ${filePath}`);

    try {
        const fs = require('fs');
        const paymentInfo = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        const required = ['originador', 'nodo', 'folioMexipay', 'amount', 'cardNumber', 'cardType', 'cardEmisor'];
        for (const field of required) {
            if (!paymentInfo[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        // Build minimal ISO message
        const isoMessage = `0200${paymentInfo.cardNumber}${String(paymentInfo.amount).padStart(12, '0')}`;

        console.log(`📤 Processing transaction:`, {
            reference: paymentInfo.folioMexipay,
            amount: paymentInfo.amount,
            card: `${paymentInfo.cardNumber.substring(0, 6)}...${paymentInfo.cardNumber.slice(-4)}`
        });

        const result = await seliaService.processISOMessage(
            isoMessage,
            paymentInfo,
            { guid: `cli_${Date.now()}` }
        );

        console.log('\n' + '='.repeat(60));
        console.log('✅ TRANSACTION PROCESSED');
        console.log('='.repeat(60));
        console.log(`Reference: ${paymentInfo.folioMexipay}`);
        console.log(`Status: ${result.success ? 'APPROVED' : 'DECLINED'}`);
        console.log(`Response Code: ${result.responseCode}`);
        console.log(`Message: ${result.responseMessage}`);

        if (result.authorizationCode) {
            console.log(`Authorization: ${result.authorizationCode}`);
        }

        console.log(`Transaction ID: ${result.transactionId}`);
        console.log(`Processing Time: ${result.processingTime}ms`);
        console.log('='.repeat(60));

        return result;

    } catch (error) {
        console.error(`❌ Transaction processing failed:`, error.message);
        throw error;
    }
}

// Test connection to Selia gateway
async function testConnection() {
    console.log('🔌 Testing connection to Selia gateway...');

    try {
        const testMessage = `{161:${config.companyId};1:TEST;2:TEST;3:${seliaService.generateProductionTimestamp()};7:999;56:0;19:TEST${Date.now()};45:100;}`;

        console.log(`📤 Sending test message: ${testMessage.substring(0, 50)}...`);

        const response = await seliaService.sendToSeliaGateway(testMessage);

        console.log('✅ Connection successful!');
        console.log(`📥 Response: ${response.substring(0, 100)}...`);

        return { success: true, response };

    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        return { success: false, error: error.message };
    }
}

// List pending transactions
async function listPendingTransactions(hours = 24) {
    console.log(`📋 Listing transactions pending for ${hours} hours...`);

    try {
        if (!config.db) {
            throw new Error('Database connection not available');
        }

        const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));

        const [results] = await config.db.query(`
            SELECT
                id_message,
                reference_number,
                trace_number,
                amount,
                resp_code,
                tran_date,
                tran_time,
                creation_date,
                name_merchant,
                terminal,
                node,
                card_acceptor
            FROM iso_message
            WHERE (resp_code IS NULL OR resp_code = '' OR resp_code = '99')
              AND creation_date >= ?
            ORDER BY creation_date DESC
            LIMIT 50
        `, [cutoffTime]);

        console.log('\n' + '='.repeat(60));
        console.log(`🕒 PENDING TRANSACTIONS (last ${hours} hours)`);
        console.log('='.repeat(60));

        if (!results || results.length === 0) {
            console.log('No pending transactions found.');
        } else {
            console.log(`Found ${results.length} pending transactions:\n`);

            results.forEach((tx, index) => {
                const amountFormatted = tx.amount ? `$${(parseInt(tx.amount) / 100).toFixed(2)}` : '$0.00';
                const age = Math.round((new Date() - new Date(tx.creation_date)) / (1000 * 60));

                console.log(`${index + 1}. ${tx.reference_number}`);
                console.log(`   Trace: ${tx.trace_number}`);
                console.log(`   Amount: ${amountFormatted}`);
                console.log(`   Merchant ID: ${tx.name_merchant}`);
                console.log(`   Terminal Serial: ${tx.terminal}`);
                console.log(`   Node: ${tx.node}`);
                console.log(`   Card Acceptor: ${tx.card_acceptor}`);
                console.log(`   Date: ${tx.tran_date} ${tx.tran_time}`);
                console.log(`   Age: ${age} minutes ago`);
                console.log(`   Status: ${tx.resp_code || 'NULL'}`);
                console.log('');
            });
        }

        console.log('='.repeat(60));

        return results;

    } catch (error) {
        console.error('❌ Failed to list pending transactions:', error.message);
        throw error;
    }
}

// Retry failed transactions
async function retryFailedTransactions(options = {}) {
    const hours = options.hours || 24;
    console.log(`🔄 Retrying failed transactions from last ${hours} hours...`);

    try {
        if (!config.db) {
            throw new Error('Database connection not available');
        }

        const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));

        const [failedTxs] = await config.db.query(`
            SELECT
                reference_number,
                trace_number,
                amount,
                tran_date,
                tran_time,
                name_merchant,
                terminal,
                node,
                card_acceptor,
                resp_code,
                more_info
            FROM iso_message
            WHERE (resp_code IN ('91', '96', '99', '05', '01') OR resp_code IS NULL)
              AND creation_date >= ?
              AND estatus_f IN (3, 4)
            ORDER BY creation_date DESC
            LIMIT 20
        `, [cutoffTime]);

        if (!failedTxs || failedTxs.length === 0) {
            console.log('No failed transactions found to retry.');
            return [];
        }

        console.log(`Found ${failedTxs.length} failed transactions to retry\n`);

        const results = [];
        const delay = parseInt(options.delay) || 2000;

        for (let i = 0; i < failedTxs.length; i++) {
            const tx = failedTxs[i];

            console.log(`[${i + 1}/${failedTxs.length}] Retrying: ${tx.reference_number}`);

            try {
                let originalInfo = {};
                try {
                    if (tx.more_info) {
                        originalInfo = JSON.parse(tx.more_info);
                    }
                } catch (e) {}

                const inquiryInfo = {
                    folioMexipay: tx.reference_number,
                    originador: tx.name_merchant || '62',
                    nodo: tx.terminal || 'N860W176266',
                    traceNumber: tx.trace_number,
                    amount: tx.amount ? tx.amount.replace(/^0+/, '') : null,
                    transactionDate: tx.tran_date,
                    transactionTime: tx.tran_time,
                    merchantId: tx.name_merchant || 'unknown',
                    retryCount: (originalInfo.retry_count || 0) + 1
                };

                const result = await seliaService.queryTransactionStatus(inquiryInfo);

                results.push({
                    reference: tx.reference_number,
                    previousStatus: tx.resp_code,
                    newStatus: result.responseCode,
                    success: result.success,
                    message: result.responseMessage
                });

                console.log(`   → ${tx.resp_code} → ${result.responseCode}: ${result.success ? '✅' : '❌'} ${result.responseMessage}`);

                await config.db.query(`
                    UPDATE iso_message
                    SET more_info = JSON_SET(
                        COALESCE(more_info, '{}'),
                        '$.retry_count', ?,
                        '$.last_retry', ?
                    )
                    WHERE reference_number = ?
                `, [
                    inquiryInfo.retryCount,
                    new Date().toISOString(),
                    tx.reference_number
                ]);

                if (i < failedTxs.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

            } catch (error) {
                console.error(`   → ❌ Retry failed: ${error.message}`);
                results.push({
                    reference: tx.reference_number,
                    success: false,
                    error: error.message
                });
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('🔄 RETRY SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total retried: ${results.length}`);
        console.log(`Now successful: ${results.filter(r => r.success).length}`);
        console.log(`Still failed: ${results.filter(r => !r.success).length}`);

        return results;

    } catch (error) {
        console.error('❌ Failed to retry transactions:', error.message);
        throw error;
    }
}

// Parse command line options
function parseOptions(args) {
    const options = {};

    for (let i = 1; i < args.length; i++) {
        if (args[i].startsWith('--')) {
            const [key, value] = args[i].substring(2).split('=');
            options[key] = value || true;
        }
    }

    return options;
}

// Main CLI handler
async function main() {
    try {
        switch (command) {
            case 'status':
                if (!args[1]) {
                    console.error('❌ Error: Reference number required');
                    console.log('Usage: node selia-cli.js status <reference> [--options]');
                    process.exit(1);
                }
                await checkStatus(args[1], parseOptions(args));
                break;

            case 'batch-status':
                if (!args[1]) {
                    console.error('❌ Error: JSON file path required');
                    console.log('Usage: node selia-cli.js batch-status <file.json> [--options]');
                    process.exit(1);
                }
                await batchStatusCheck(args[1], parseOptions(args));
                break;

            case 'process':
                if (!args[1]) {
                    console.error('❌ Error: JSON file path required');
                    console.log('Usage: node selia-cli.js process <file.json>');
                    process.exit(1);
                }
                await processTransaction(args[1]);
                break;

            case 'test-connection':
                await testConnection();
                break;

            case 'list-pending':
                const hours = args.find(arg => arg.startsWith('--hours='))?.split('=')[1] || 24;
                await listPendingTransactions(parseInt(hours));
                break;

            case 'retry-failed':
                await retryFailedTransactions(parseOptions(args));
                break;

            case 'help':
            case '--help':
            case '-h':
                showHelp();
                break;

            default:
                console.error(`❌ Unknown command: ${command}`);
                showHelp();
                process.exit(1);
        }

    } catch (error) {
        console.error(`\n💥 CLI Error: ${error.message}`);
        if (process.env.DEBUG === 'true') {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

// Run CLI
if (require.main === module) {
    if (!command || command === 'help' || command === '--help' || command === '-h') {
        showHelp();
    } else {
        main();
    }
}

// Export for programmatic use
module.exports = {
    checkStatus,
    batchStatusCheck,
    processTransaction,
    testConnection,
    listPendingTransactions,
    retryFailedTransactions,
    seliaService
};


 /**
  * RC4 encryption (unchanged)
  */
// seliaService.rc4 = function(input, key) {
//     const bytes = Buffer.from(input, 'ascii');
//     const keyBytes = Buffer.from(key, 'ascii');
//     const s = new Uint8Array(256);
//     const k = new Uint8Array(256);
//     let j = 0;
//     for (let i = 0; i < 256; i++) {
//         s[i] = i;
//         k[i] = keyBytes[i % keyBytes.length];
//     }
//     for (let i = 0; i < 256; i++) {
//         j = (j + s[i] + k[i]) % 256;
//         [s[i], s[j]] = [s[j], s[i]];
//     }
//     let i = 0;
//     j = 0;
//     const output = new Uint8Array(bytes.length);
//     for (let x = 0; x < bytes.length; x++) {
//         i = (i + 1) % 256;
//         j = (j + s[i]) % 256;
//         [s[i], s[j]] = [s[j], s[i]];
//         const t = (s[i] + s[j]) % 256;
//         output[x] = bytes[x] ^ s[t];
//     }
//     return output;
// };
/**
 * Build status inquiry message for Selia with proper transaction type validation
 */
//seliaService.buildStatusInquiryMessage = function(inquiryInfo) {
//    const {
//        originador = 'MEXIPAY01',
//        nodo = 'TERMINAL001',
//        folioMexipay,
//        traceNumber,
//        amount = '0',
//        transactionDate,
//        transactionTime,
//        merchantId = 'unknown',
//        originalTransactionType = '0'
//    } = inquiryInfo;
//
//    // Validate required field
//    if (!folioMexipay) {
//        throw new Error('folioMexipay is required to build status inquiry message');
//    }
//
//    console.log(`📋 Building status inquiry for reference: ${folioMexipay}`, {
//        originador,
//        nodo,
//        traceNumber,
//        amount,
//        originalTransactionType,
//        hasTransactionDate: !!transactionDate,
//        hasTransactionTime: !!transactionTime
//    });
//
//    const timestamp = this.generateProductionTimestamp();
//    console.log(`🕒 Generated timestamp: ${timestamp}`);
//
//    // ===== VALIDATE TRANSACTION TYPE =====
//    const validTransactionTypes = {
//        '0': 'Normal transaction (Venta)',
//        '2': 'Purchase (Compra)',
//        '3': 'Refund/Return (Devolución)',
//        '8': 'Reversal (Reverso)'
//    };
//
//    let transactionType = originalTransactionType;
//
//    if (!validTransactionTypes[transactionType]) {
//        console.warn(`⚠️ Invalid transaction type "${transactionType}", defaulting to "0"`);
//        transactionType = '0';
//    }
//
//    console.log(`✅ Using transaction type: ${transactionType}`);
//
//    // ===== BUILD ISO MESSAGE FOR FIELD 611 =====
//    console.log(`🔨 Building ISO message for Field 611...`);
//
//    // Build the ISO8583 message
//    const isoMessage = this.buildStatusInquiryIsoMessage(inquiryInfo);
//
//    // Encrypt it using RC4
//    const encrypted = this.rc4(isoMessage, this.config.aesKey);
//    const encryptedIsoMessage = Buffer.from(encrypted).toString('hex').toUpperCase();
//
//    console.log(`✅ Built and encrypted ISO message:`, {
//        originalLength: isoMessage.length,
//        encryptedLength: encryptedIsoMessage.length,
//        preview: encryptedIsoMessage.substring(0, 50) + '...'
//    });
//
//    // ===== BUILD THE SELIA MESSAGE =====
//    let message = `{161:${this.config.companyId};`;
//    message += `1:${this.escapeField(originador)};`;
//    message += `2:${this.escapeField(nodo)};`;
//    message += `3:${timestamp};`;
//    message += `7:501;`; // Processing code
//    message += `56:${transactionType};`; // Transaction type
//
//    console.log(`📝 Field 56 set to: ${transactionType}`);
//
//    // Reference number
//    message += `19:${this.escapeField(folioMexipay)};`;
//    console.log(`📝 Field 19 (Reference): ${folioMexipay}`);
//
//    if (traceNumber) {
//        message += `11:${this.escapeField(traceNumber)};`;
//        console.log(`📝 Field 11 (Trace): ${traceNumber}`);
//    }
//
//    if (amount && amount !== '0') {
//        const validatedAmount = this.validateAmount(amount);
//        message += `45:${validatedAmount};`;
//        console.log(`📝 Field 45 (Amount): ${validatedAmount}`);
//    }
//
//    if (transactionDate && transactionTime) {
//        message += `13:${transactionDate};`;
//        message += `12:${transactionTime};`;
//        console.log(`📝 Field 13/12 (Date/Time): ${transactionDate}/${transactionTime}`);
//    }
//
//    // Add track2 data (Field 35) - required
//    const track2Data = `8324210030060053829=290722100000367251216`;
//    message += `35:${this.escapeField(track2Data)};`;
//    console.log(`📝 Field 35 (Track2): ${track2Data.substring(0, 30)}...`);
//
//    // Add card type (Field 123) - required
//    message += `123:G;`; // General card type
//    console.log(`📝 Field 123 (Card Type): G`);
//
//    // 🔴 CRITICAL: Add Field 611 - Encrypted ISO message
//    message += `611:${encryptedIsoMessage};`;
//    console.log(`📝 Field 611 (Encrypted ISO): ${encryptedIsoMessage.length} chars`);
//
//    // Add card emisor (Field 81)
//    message += `81:VISA;`;
//    console.log(`📝 Field 81 (Card Emisor): VISA`);
//
//    // Authentication fields
//    message += `54:${this.escapeField(this.config.username)};`;
//    message += `219:${this.escapeField(this.config.password)};`;
//
//    // Add version (Field 356)
//    message += `356:MxPay251101;`;
//    console.log(`📝 Field 356 (Version): MxPay251101`);
//
//    message += `}`;
//
//    // Log the complete message (with password redacted)
//    const redactedMessage = message.replace(this.config.password, '***REDACTED***');
//    console.log(`📤 Built status inquiry message:`, redactedMessage);
//    console.log(`📊 Message length: ${message.length} characters`);
//
//    return message;
//};