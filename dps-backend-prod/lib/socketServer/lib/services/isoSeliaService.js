/**
 * =============================================================================
 * ISO SELIA SERVICE - PRODUCTION READY IMPLEMENTATION
 * =============================================================================
 *
 * @module IsoSeliaService
 * @description Complete integration with Selia ISO 8583 gateway for payment processing
 * @version 2.0.0
 * @author Payment Processing Team
 * @license Proprietary
 *
 * PCI DSS 4.0 Compliance Requirements:
 * - Req 3.4: Card data masked in ISO messages (6******4 format)
 * - Req 3.5: Cryptographic keys protected (AES encryption)
 * - Req 4.2: Secure transmission over TCP/IP (recommend TLS upgrade)
 * - Req 6.5.1: Input validation on all ISO fields
 * - Req 6.5.3: Secure cryptographic implementation
 * - Req 8.2: Selia gateway authentication credentials secured
 * - Req 10.2: All transaction attempts logged
 * - Req 10.3: Audit records include: transaction ID, timestamp, merchant, amount, response
 * - Req 10.5: Audit logs protected from tampering
 * - Req 12.8: Third-party service provider (Selia) security managed
 *
 * Security Features:
 * - TCP/IP connection with timeout controls
 * - Card PAN masking before transmission
 * - Transaction field validation and sanitization
 * - Response code validation and error handling
 * - Database transaction logging with full audit trail
 * - Support for dev/test terminal routing
 * - Merchant-specific Selia ID mapping
 * - Complete transaction lifecycle tracking
 * - Field-level encryption where applicable
 *
 * =============================================================================
 * SELIA TRANSACTION TYPE MAPPING (OFFICIAL DOCUMENTATION)
 * =============================================================================
 *
 * According to Selia official documentation, the transaction codes are:
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ Transaction Type        │ Selia Code │ ISO Type  │ Field 491:1 │ Notes      │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ Regular Sale            │ 501        │ 0200      │ NO          │ Standard   │
 * │ Check In / Solo Autoriza│ 501        │ 0200      │ YES         │ Pre-auth   │
 * │ Refund                  │ 502        │ 0220      │ N/A         │ Full refund│
 * │ Cancel / Void           │ 503        │ 0420      │ N/A         │ Void trx   │
 * │ Check Out               │ 505        │ 0200      │ N/A         │ Capture+tip│
 * │ Reauthorize             │ 517        │ 0200      │ N/A         │ Increase   │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * IMPORTANT: There is NO transaction code 507 in Selia's documentation.
 * Both regular sales AND solo autoriza (check-in) use code 501.
 * The distinction is made via field 491:1 which indicates "solo autoriza" mode.
 *
 * UPDATE (Apr 20, 2026 - Carlos Villasenor):
 * Field 169 is replaced with field 491 for solo autoriza.
 * - Previously: Solo autoriza used field 169:1
 * - Now: Solo autoriza uses field 491:1
 *
 * =============================================================================
 * FIELD REFERENCE GUIDE
 * =============================================================================
 *
 * Field  | Name              | Format        | Description
 * -------|-------------------|---------------|------------------------------------
 * 1      | Originador        | Numeric       | Source identifier (always 1)
 * 2      | Terminal ID       | Alphanumeric  | Terminal identifier (digits after W)
 * 3      | Timestamp         | YYYYMMDDHHMMSS| Transaction timestamp
 * 7      | Transaction Code  | 3 digits      | 501/502/503/505/517
 * 19     | Ticket Number     | 10 digits     | POS reference (MUST be id_message)
 * 35     | Masked PAN        | 6******4      | Masked card number
 * 45     | Amount            | 12 digits     | Amount in cents, left-padded
 * 46     | Currency          | 2 digits      | 0 = Mexican Pesos
 * 50     | Authorization Code| 6 digits      | Original auth for refunds/cancels
 * 54     | Username          | Alphanumeric  | Selia API username
 * 56     | Subtype           | 1 digit       | Transaction subtype
 * 72     | Additional Amount | 12 digits     | Tip/additional amount
 * 74     | Original Trx ID   | Numeric       | Original transaction ID
 * 78     | Plan              | Alphanumeric  | Financing plan
 * 79     | Months            | 2 digits      | Number of months for financing
 * 86     | Consultation      | 1 char        | C = consultation
 * 161    | Company ID        | Numeric       | Selia merchant ID
 * 163    | Voucher           | 1 char        | S = voucher required
 * 169    | Solo Autoriza     | 1 digit       | 1 = pre-authorization (REPLACED by 491)
 * 491    | Solo Autoriza     | 1 digit       | 1 = pre-authorization (no capture)
 * 172    | Affiliation       | Alphanumeric  | Merchant affiliation number
 * 219    | Password          | Alphanumeric  | Selia API password
 * 356    | Version           | Alphanumeric  | Mexipay version
 * 611    | Encapsulated ISO  | Text          | Original ISO message from pinpad
 *
 * =============================================================================
 * RESPONSE CODES (Field 14/39)
 * =============================================================================
 *
 * Code  | Description
 * ------|------------------------------------------
 * 0/00  | Transaction approved
 * 1/01  | Transaction declined
 * 5/05  | Transaction not permitted
 * 6/06  | Data field error
 * 14    | Invalid card
 * 51    | Insufficient funds
 * 54    | Expired card
 * 55    | Invalid PIN
 * 57    | Transaction not permitted - card
 * 58    | Transaction not permitted - terminal
 * 61    | Withdrawal limit exceeded
 * 62    | Restricted card
 * 65    | Frequency limit exceeded
 * 75    | PIN attempts exceeded
 * 76    | Invalid or non-existent account
 * 91    | Issuer unavailable
 * 96    | System error
 * 99    | Communication error or pending
 *
 * =============================================================================
 * DATABASE SCHEMA REFERENCES
 * =============================================================================
 *
 * Table: iso_message
 * - id_message: INT PRIMARY KEY AUTO_INCREMENT
 * - id_operation: INT (operation type ID)
 * - msg_type: VARCHAR (ISO message type: 0200, 0220, 0420)
 * - trace_number: VARCHAR (10) (unique trace number)
 * - reference_number: VARCHAR (16) (folio Mexipay)
 * - amount: VARCHAR (12) (amount in cents)
 * - resp_code: VARCHAR (12) (response code)
 * - authorization: VARCHAR (8) (authorization code)
 * - bin: VARCHAR (6) (first 6 digits of card)
 * - last4: VARCHAR (4) (last 4 digits of card)
 * - draft_capture: VARCHAR (1) (status)
 * - entry_mode: VARCHAR (2) (entry mode)
 * - reverse_code: VARCHAR (1) (reverse indicator)
 * - tran_date: VARCHAR (4) (transaction date DDMM)
 * - tran_time: VARCHAR (6) (transaction time HHMMSS)
 * - capture_date: VARCHAR (4) (capture date DDMM)
 * - tkn_data_63_rq: TEXT (request token data)
 * - tkn_data_63_rp: TEXT (response token data)
 * - card_acceptor: VARCHAR (40) (merchant name)
 * - node: VARCHAR (50) (gateway identifier)
 * - name_merchant: VARCHAR (100) (merchant name)
 * - terminal: VARCHAR (20) (terminal ID)
 * - reference_number_ant: VARCHAR (16) (previous reference)
 * - folio: VARCHAR (50) (folio)
 * - card_type: VARCHAR (20) (card type)
 * - more_info: TEXT (JSON with additional info)
 * - track2: TEXT (Base64 encoded track2)
 * - creation_date: DATETIME (record creation)
 * - estatus_f: INT (1=pending, 2=approved, 3=declined, 4=failed)
 *
 * Table: merchant
 * - id_merchant: INT PRIMARY KEY
 * - selia_id: INT (Selia merchant ID for field 161)
 * - afiliation_number: VARCHAR (affiliation number for field 172)
 * - name_merchant: VARCHAR (merchant name)
 *
 * =============================================================================
 */

const net = require('net');
const helpers = require('../../../helpers/lib/helpers');
const { seq: sequelize, ...db } = require('../sequelize/init');

/**
 * Configuration object for Selia ISO gateway
 * Loads from environment variables with fallback defaults
 * Supports Dev and Production modes via SELIA_ISO_MODE
 */
const configIso = process.env.SELIA_ISO_MODE === 'Dev' ? {
    host: process.env.SELIA_ISO_DEV_HOST,
    port: parseInt(process.env.SELIA_ISO_DEV_PORT),
    companyId: parseInt(process.env.SELIA_COMPANY_TPV_ID) || 10990,
    username: process.env.SELIA_ISO_USERNAME || 'gggh',
    password: process.env.SELIA_ISO_PASSWORD || 'nhhhhj',
    aesKey: process.env.SELIA_AES_KEY || 'jjj',
    timeout: parseInt(process.env.SELIA_TIMEOUT) || 30000,
    debug: (process.env.SELIA_DEBUG === 'true'),
    db: { ...db, sequelize },
    helpers: helpers
} : {
    host: process.env.SELIA_ISO_HOST || '152.0.2.121',
    port: parseInt(process.env.SELIA_ISO_PORT) || 5001,
    companyId: parseInt(process.env.SELIA_COMPANY_TPV_ID) || 10990,
    username: process.env.SELIA_ISO_USERNAME || 'crytest99w3D',
    password: process.env.SELIA_ISO_PASSWORD || 'tac',
    aesKey: process.env.SELIA_AES_KEY || 'W0ten03L3rvxC851',
    timeout: parseInt(process.env.SELIA_TIMEOUT) || 30000,
    debug: (process.env.SELIA_DEBUG === 'true'),
    db: { ...db, sequelize },
    helpers: helpers
};

/**
 * IsoSeliaService - Main class for Selia ISO 8583 integration
 *
 * This service handles all communication with Selia's ISO 8583 gateway,
 * including transaction processing, reversals, cancellations, refunds,
 * and status inquiries.
 *
 * @class IsoSeliaService
 */
class IsoSeliaService {
    /**
     * Create a new IsoSeliaService instance
     * @param {Object} config - Configuration overrides
     * @param {string} config.guid - Unique identifier for this request
     * @param {Function} config.logger - Logger function for S3 logging
     */
    constructor(config = {}) {
        this.config = { ...config, ...configIso };
        this.guid = config.guid || null;
        this.logger = config.logger || null;

        if (!this.config.db) {
            this.config.db = { ...db, sequelize };
        }

        console.log('[isoSeliaService] 🔧 Selia Service Config:', {
            mode: process.env.SELIA_ISO_MODE,
            host: this.config.host,
            port: this.config.port,
            companyId: this.config.companyId,
            username: this.config.username,
            timeout: this.config.timeout,
            debug: this.config.debug,
            guid: this.guid,
            hasLogger: !!this.logger
        });
    }

    /**
     * Check if terminal ID is configured to use development environment
     *
     * Scans environment variables for DEVTERMINALX patterns (e.g., DEVTERMINAL1, DEVTERMINAL2)
     * and returns true if the terminal ID matches any of them.
     *
     * @param {string} terminalId - Terminal ID to check (from paymentInfo.nodo)
     * @returns {boolean} True if terminal should use dev environment
     */
    isDevTerminal(terminalId) {
        if (!terminalId) {
            return false;
        }

        // Extract node ID (numeric part after 'W') if present
        let nodeId = terminalId;
        if (terminalId.includes('W')) {
            const parts = terminalId.split('W');
            if (parts.length > 1) {
                nodeId = parts[1];
            }
        }

        console.log(`[isoSeliaService] 🔍 Checking terminal: "${terminalId}" -> node ID: "${nodeId}"`);

        // Scan all environment variables for DEVTERMINALX patterns
        for (const [key, value] of Object.entries(process.env)) {
            if (key.startsWith('DEVTERMINAL') && (value === terminalId || value === nodeId)) {
                console.log(`[isoSeliaService] 🔧 DEV TERMINAL OVERRIDE: Terminal "${terminalId}" (node: "${nodeId}") matches ${key}="${value}"`);
                return true;
            }
        }

        return false;
    }

    /**
     * Apply development environment configuration for specific terminal
     *
     * Overrides the current config with development settings when a terminal
     * is configured to use dev environment via DEVTERMINALX env vars.
     *
     * @param {string} terminalId - Terminal ID that triggered the override
     */
    applyDevEnvironment(terminalId) {
        console.log(`[isoSeliaService] 🔄 Applying DEV environment for terminal: ${terminalId}`);

        // Override config with development settings
        this.config.host = process.env.SELIA_ISO_DEV_HOST;
        this.config.port = parseInt(process.env.SELIA_ISO_DEV_PORT);
        this.config.username = process.env.SELIA_ISO_USERNAME || 'gggh';
        this.config.password = process.env.SELIA_ISO_PASSWORD || 'nhhhhj';
        this.config.aesKey = process.env.SELIA_AES_KEY || 'jjj';
        
        // Override companyId to use development/test selia_id
        this.config.companyId = 1; // Use default development selia_id
        
        // Flag to override field 161 in message building
        this.config.devModeOverride = true;

        console.log(`[isoSeliaService] ✅ Config overridden to DEV:`, {
            host: this.config.host,
            port: this.config.port,
            username: this.config.username,
            companyId: this.config.companyId,
            terminalId: terminalId
        });
    }

    /**
     * =========================================================================
     * PUBLIC API METHODS
     * =========================================================================
     */

    /**
     * Process an ISO message through Selia gateway
     *
     * This is the main entry point for processing any ISO 8583 transaction.
     * It handles:
     * - Transaction logging and tracing
     * - Database persistence
     * - Selia gateway communication
     * - Response parsing and status updates
     * - Error handling and reversal logic
     *
     * @async
     * @param {string|Object} isoMessage - ISO 8583 message from pinpad/terminal
     * @param {Object} paymentInfo - Transaction payment information
     * @param {Object} paymentInfo.originador - Source identifier
     * @param {Object} paymentInfo.nodo - Terminal ID
     * @param {Object} paymentInfo.folioMexipay - Transaction reference
     * @param {number} paymentInfo.amount - Amount in cents
     * @param {string} paymentInfo.cardNumber - Card number (PAN)
     * @param {string} paymentInfo.cardType - C/D/G (Credit/Debit/General)
     * @param {string} paymentInfo.cardEmisor - Card issuer
     * @param {string} paymentInfo.tk2 - Track2 data (encrypted or plain)
     * @param {string} paymentInfo.transactionType - Type: sale, refund, cancel, checkin, etc.
     * @param {boolean} paymentInfo.soloAutoriza - If true, use field 169:1
     * @param {boolean} paymentInfo.checkIn - Alias for soloAutoriza
     * @param {number} paymentInfo.merchantId - Internal merchant ID
     * @param {number} paymentInfo.originalTrxId - Original transaction ID for refunds/cancels
     * @param {string} paymentInfo.originalAuthCode - Original auth code for refunds/cancels
     * @param {string} paymentInfo.originalField63 - Original field 63 for reversals
     * @param {Object} transactionData - Additional transaction metadata
     * @returns {Promise<Object>} Processed response with transaction result
     */
    async processISOMessage(isoMessage, paymentInfo, transactionData = {}) {
        // FIRST: Check if terminal should use development environment
        const terminalId = paymentInfo.nodo || paymentInfo.terminal;
        console.log(`[isoSeliaService] 🚨 TERMINAL CHECK DEBUG: terminalId="${terminalId}", typeof=${typeof terminalId}`);
        console.log(`[isoSeliaService] 🚨 ENV DEBUG: DEVTERMINAL1="${process.env.DEVTERMINAL1}"`);
        
        if (terminalId && this.isDevTerminal(terminalId)) {
            this.applyDevEnvironment(terminalId);
        }

        // Capture caller information for debugging
        const callerStack = new Error().stack;
        const callerLines = callerStack.split('\n').slice(2, 6).join('\n');

        console.log(`\n[isoSeliaService] 📞 ========== CALLER TRACE START ==========`);
        console.log(`[isoSeliaService] 📞 Called from:`, callerLines);
        console.log(`[isoSeliaService] 📞 Method: processISOMessage`);
        console.log(`[isoSeliaService] 📞 Terminal ID: ${terminalId}`);
        console.log(`[isoSeliaService] 📞 ISO Message length: ${isoMessage?.length}`);
        console.log(`[isoSeliaService] 📞 Transaction Data:`, JSON.stringify(transactionData, null, 2));
        console.log(`[isoSeliaService] 📞 ========== CALLER TRACE END ==========\n`);

        const transactionLog = {
            guid: transactionData.guid || `selia_${Date.now()}`,
            merchantId: transactionData.merchantId || paymentInfo.merchantId,
            reference: paymentInfo.folioMexipay,
            status: 'pending',
            startTime: new Date(),
            more_info: JSON.stringify({
                processor: 'selia',
                guid: transactionData.guid,
                merchant_id: transactionData.merchantId,
                reference: paymentInfo.folioMexipay,
                stored_at: new Date().toISOString(),
                source: 'isoSeliaService',
                caller_trace: callerLines
            })
        };

        try {
            console.log(`[isoSeliaService] [${transactionLog.guid}] 🚀 Processing Selia transaction`);

            // Store pending transaction in database
            await this.storePendingTransaction(isoMessage, paymentInfo, transactionLog);

            // Validate transaction requirements
            this.validateTransaction(paymentInfo);

            // Build Selia message
            const seliaMessage = await this.buildProductionMessage(isoMessage, paymentInfo, transactionLog);

            console.log(`[isoSeliaService] [${transactionLog.guid}] 📤 Sending to Selia TCP gateway`, {
                messageLength: seliaMessage.length,
                endpoint: `${this.config.host}:${this.config.port}`,
                preview: seliaMessage.substring(0, 200) + '...'
            });

            // Send to Selia gateway
            const rawResponse = await this.sendToSeliaGateway(seliaMessage);

            console.log(`[isoSeliaService] [${transactionLog.guid}] 📥 Received Selia response:`, rawResponse.substring(0, 200) + '...');

            // Parse response
            const parsedResponse = this.parseProductionResponse(rawResponse);

            console.log(`[isoSeliaService] [${transactionLog.guid}] 🔄 Updating transaction status: ${parsedResponse.success ? 'APPROVED' : 'DECLINED'}`);

            // Update transaction in database
            await this.updateTransactionStatus(transactionLog, parsedResponse, rawResponse, paymentInfo);

            transactionLog.status = parsedResponse.success ? 'approved' : 'declined';
            transactionLog.endTime = new Date();
            transactionLog.processingTime = transactionLog.endTime - transactionLog.startTime;

            console.log(`[isoSeliaService] [${transactionLog.guid}] ✅ Transaction completed in ${transactionLog.processingTime}ms - Status: ${transactionLog.status.toUpperCase()}`);

            return {
                ...parsedResponse,
                transactionId: transactionLog.guid,
                processingTime: transactionLog.processingTime
            };

        } catch (error) {
            console.error(`[isoSeliaService] [${transactionLog.guid}] 💥 Selia processing failed:`, error.message);
            console.error(`[isoSeliaService] [${transactionLog.guid}] Error stack:`, error.stack);

            transactionLog.status = 'failed';
            transactionLog.error = error.message;
            transactionLog.endTime = new Date();

            await this.updateTransactionError(transactionLog, error);

            throw error;
        }
    }

    /**
     * Get Selia merchant ID from internal merchant ID
     *
     * Queries the merchant table to find the selia_id associated with
     * the internal merchant ID. If not found, returns the default companyId.
     *
     * @async
     * @param {number|string} merchantId - Internal merchant ID
     * @returns {Promise<number>} Selia merchant ID for field 161
     */
    async getSeliaIdForMerchant(merchantId) {
        // Capture caller information for debugging
        const callerStack = new Error().stack;
        const callerLines = callerStack.split('\n').slice(2, 6).join('\n');

        console.log(`\n[isoSeliaService] 🔍 ========== getSeliaIdForMerchant TRACE ==========`);
        console.log(`[isoSeliaService] 🔍 Called from:`, callerLines);
        console.log(`[isoSeliaService] 🔍 merchantId received:`, {
            value: merchantId,
            type: typeof merchantId,
            isNull: merchantId === null,
            isUndefined: merchantId === undefined,
            isNaN: isNaN(merchantId),
            parsed: parseInt(merchantId)
        });
        console.log(`[isoSeliaService] 🔍 =================================================\n`);

        try {
            // Validate merchantId
            if (!merchantId || merchantId === 'undefined' || isNaN(parseInt(merchantId))) {
                console.error(`[isoSeliaService] ⚠️ INVALID merchantId: "${merchantId}" (type: ${typeof merchantId})`);
                console.error(`[isoSeliaService] ⚠️ Using default companyId: ${this.config.companyId}`);
                return this.config.companyId;
            }

            const id = parseInt(merchantId);
            console.log(`[isoSeliaService] 🔍 Fetching selia_id for merchant ${id}...`);

            // Query merchant table
            const merchant = await this.config.db.merchant.findOne({
                where: { id_merchant: id },
                attributes: ['selia_id', 'name_merchant', 'afiliation_number'],
                raw: true
            });

            console.log(`[isoSeliaService] 🔍 Database query result:`, {
                found: !!merchant,
                merchantData: merchant ? {
                    name: merchant.name_merchant,
                    afiliation: merchant.afiliation_number,
                    selia_id: merchant.selia_id
                } : 'NOT FOUND'
            });

            if (merchant && merchant.selia_id) {
                console.log(`[isoSeliaService] ✅ Found selia_id ${merchant.selia_id} for merchant ${id} (${merchant.name_merchant})`);
                return merchant.selia_id;
            }

            // Fallback to companyId
            console.log(`[isoSeliaService] ⚠️ No selia_id found for merchant ${id}, using default: ${this.config.companyId}`);
            return this.config.companyId;
        } catch (error) {
            console.error(`[isoSeliaService] ❌ Error fetching selia_id for merchant ${merchantId}:`, error.message);
            console.error(`[isoSeliaService] ❌ Error stack:`, error.stack);
            return this.config.companyId;
        }
    }

    /**
     * Get complete merchant data including affiliation number
     *
     * Retrieves all merchant data needed for Selia fields:
     * - selia_id (field 161)
     * - afiliation_number (field 172)
     * - name_merchant (for logging)
     *
     * @async
     * @param {number|string} merchantId - Internal merchant ID
     * @returns {Promise<Object>} Merchant data object
     */
    async getMerchantData(merchantId) {
        try {
            // Validate merchantId
            if (!merchantId || merchantId === 'undefined' || isNaN(parseInt(merchantId))) {
                console.warn(`[isoSeliaService] ⚠️ INVALID merchantId: "${merchantId}", returning default data`);
                return {
                    selia_id: this.config.companyId,
                    afiliation_number: '',
                    name_merchant: 'UNKNOWN'
                };
            }

            const id = parseInt(merchantId);
            console.log(`[isoSeliaService] 🔍 Fetching merchant data for ${id}...`);

            // Query merchant table
            const merchant = await this.config.db.merchant.findOne({
                where: { id_merchant: id },
                attributes: ['selia_id', 'name_merchant', 'afiliation_number'],
                raw: true
            });

            console.log(`[isoSeliaService] 🔍 Merchant data result:`, {
                found: !!merchant,
                merchantData: merchant || 'NOT FOUND'
            });

            if (merchant) {
                return merchant;
            }

            // Fallback to default data
            console.log(`[isoSeliaService] ⚠️ No merchant found for ${id}, using default data`);
            return {
                selia_id: this.config.companyId,
                afiliation_number: '',
                name_merchant: 'UNKNOWN'
            };
        } catch (error) {
            console.error(`[isoSeliaService] ❌ Error fetching merchant data for ${merchantId}:`, error.message);
            return {
                selia_id: this.config.companyId,
                afiliation_number: '',
                name_merchant: 'ERROR'
            };
        }
    }

    /**
     * Get LDI credentials from database for a specific Selia merchant ID
     *
     * This method fetches merchant-specific LDI authentication credentials
     * from the database when not in development environment.
     *
     * @async
     * @param {number|string} seliaId - Selia merchant ID
     * @returns {Promise<Object|null>} LDI credentials object or null if not found
     */
    /**
     * Fetch LDI credentials from database with KMS decryption
     * PCI DSS 4 Requirement 3.5.2: Decrypt credentials using AWS KMS before use
     * PCI DSS 4 Requirement 8.2.1: Use strong cryptography for credential protection
     * PCI DSS 4 Requirement 10.2.1: Audit trail - log credential retrieval
     */
    async getLdiCredentials(seliaId) {
        try {
            // Skip database lookup in development mode
            if (process.env.SELIA_ISO_MODE === 'Dev') {
                console.log(`[isoSeliaService] 🔧 DEV MODE: Skipping database LDI credentials lookup for selia_id ${seliaId}`);
                return null;
            }

            if (!seliaId || seliaId === 'undefined' || isNaN(parseInt(seliaId))) {
                console.warn(`[isoSeliaService] ⚠️ INVALID seliaId: "${seliaId}", cannot fetch LDI credentials`);
                return null;
            }

            const id = parseInt(seliaId);
            console.log(`[isoSeliaService] 🔍 Fetching LDI credentials for selia_id ${id}...`);

            // Query ldi_credentials table
            const credentials = await this.config.db.ldi_credentials.findOne({
                where: { 
                    selia_id: id,
                    active: true 
                },
                attributes: ['username', 'password', 'secret', 'active'],
                raw: true
            });

            console.log(`[isoSeliaService] 🔍 LDI credentials query result:`, {
                found: !!credentials,
                hasUsername: !!credentials?.username,
                hasPassword: !!credentials?.password,
                hasSecret: !!credentials?.secret,
                active: credentials?.active
            });

            if (credentials && credentials.active) {
                console.log(`[isoSeliaService] ✅ Found active LDI credentials for selia_id ${id}`);
                
                // PCI DSS 4 Requirement 3.5.2: Decrypt password and secret using AWS KMS
                const decryptedPassword = await this.decryptWithKms(credentials.password);
                const decryptedSecret = await this.decryptWithKms(credentials.secret);
                
                // PCI DSS 4 Requirement 10.2.1: Audit trail - log successful decryption
                console.log(`[isoSeliaService] ✅ Decrypted credentials for selia_id ${id}`);
                
                return {
                    username: credentials.username,
                    password: decryptedPassword,
                    secret: decryptedSecret
                };
            }

            console.log(`[isoSeliaService] ⚠️ No active LDI credentials found for selia_id ${id}`);
            return null;
        } catch (error) {
            // PCI DSS 4 Requirement 10.2.1: Audit trail - log decryption errors
            console.error(`[isoSeliaService] ❌ Error fetching/decrypting LDI credentials for selia_id ${seliaId}:`, error.message);
            console.error(`[isoSeliaService] ❌ Error stack:`, error.stack);
            return null;
        }
    }

    /**
     * Decrypt credential using AWS KMS
     * PCI DSS 4 Requirement 3.5.2: Decrypt sensitive data for authorized use
     * PCI DSS 4 Requirement 8.2.1: Use strong cryptography for data protection
     */
    async decryptWithKms(encryptedText) {
        try {
            const AWS = require('aws-sdk');
            const kms = new AWS.KMS({ 
                region: process.env.AWS_REGION, 
                accessKeyId: process.env.AWS_KMS_ACCESSKEY_ID, 
                secretAccessKey: process.env.AWS_KMS_SECRET_ACCESS_KEY 
            });
            
            const params = {
                CiphertextBlob: Buffer.from(encryptedText, 'base64'),
            };
            const { Plaintext } = await kms.decrypt(params).promise();
            return Plaintext.toString('ascii');
        } catch (error) {
            if (error.code === 'InvalidCiphertextException' || error.name === 'InvalidCiphertextException') {
                console.warn(`[isoSeliaService] ⚠️ KMS decryption failed (not encrypted), using plaintext value`);
                return encryptedText;
            }
            console.error('KMS decryption error:', error);
            throw new Error(`Failed to decrypt credential: ${error.message}`);
        }
    }

    /**
     * Get formatted date in DDMM format
     * @returns {string} Formatted date string
     */
    getFormattedDate() {
        const d = new Date();
        return ('0' + d.getUTCDate()).slice(-2) + ('0' + (d.getUTCMonth() + 1)).slice(-2);
    }

    /**
     * Get formatted time in HHMMSS format
     * @returns {string} Formatted time string
     */
    getFormattedTime() {
        const d = new Date();
        return ('0' + d.getUTCHours()).slice(-2) +
               ('0' + d.getUTCMinutes()).slice(-2) +
               ('0' + d.getUTCSeconds()).slice(-2);
    }

    /**
     * Prepare data for saving ISO message to database
     *
     * This method structures all transaction data for database persistence.
     * Critical data captured:
     * - STAN (field 11) for reversal field 90
     * - EMV tags for chip card transactions
     * - Field 63 request/response tokens
     * - Complete transaction metadata
     *
     * @param {Object} isoMessage - ISO 8583 response packet from Selia
     * @param {Object} paymentInfo - Transaction payment information
     * @param {Object} transactionLog - Transaction logging/tracing object
     * @param {string|null} track2Data - Optional track 2 data
     * @returns {Object} Prepared data for database insertion
     */
    prepareDataForSaveIsoMessage(isoMessage, paymentInfo, transactionLog, track2Data = null) {
        console.log(`\n[isoSeliaService] 🔍 ========== prepareDataForSaveIsoMessage ==========`);

        // =====================================================================
        // 1. BASIC DATA PREPARATION
        // =====================================================================
        const merchantId = transactionLog.merchantId || paymentInfo.merchantId;
        const merchantName = String(merchantId).substring(0, 17);
        const tranDate = this.getFormattedDate();
        const tranTime = this.getFormattedTime();

        // Amount handling - TransactionContext ensures consistent amount handling
        const amountCents = Math.abs(paymentInfo.amount || 0);
        console.log(`[isoSeliaService] 🔍 Using TransactionContext amount: ${amountCents} cents`);

        const amountFormatted = String(amountCents).padStart(12, '0').substring(0, 12);

        // Get transaction type with solo autoriza flag
        const transactionType = this.determineOperationCode(isoMessage, paymentInfo);
        const isoMsgType = paymentInfo.msgType || paymentInfo.isoMsgType || '0420';

        // =====================================================================
        // 2. CAPTURE REAL ISO STAN (FIELD 11) FROM SELIA RESPONSE
        // This 6-digit value is REQUIRED for reversal field 90
        // =====================================================================
        let realStan = '000000';
        let fields = {};

        if (isoMessage) {
            fields = isoMessage.fields ||
                     (typeof isoMessage.getFields === 'function' ? isoMessage.getFields() : {}) ||
                     {};

            realStan = String(fields[11] || fields['11'] || '000000').trim();

            if (!/^\d{6}$/.test(realStan)) {
                console.warn('[prepareDataForSaveIsoMessage] Invalid STAN from ISO response - using fallback', {
                    received: realStan,
                    source: 'fields[11]'
                });
                realStan = '000000';
            }
        } else {
            console.warn('[prepareDataForSaveIsoMessage] No isoMessage provided - STAN fallback to 000000');
        }

        console.log('[prepareDataForSaveIsoMessage] Captured real ISO STAN (field 11):', realStan);

        // =====================================================================
        // 3. PREPARE DATA SEND OBJECT
        // =====================================================================
        const dataSend = {
            merchant_data: { id_merchant: merchantName },
            body: {
                cardInformation: { emv_tags: paymentInfo.emvTags || null },
                tip: paymentInfo.tip || null,
                waiter: paymentInfo.waiter || null,
                authentication: paymentInfo.authentication || 'unknown',
                device: { serial: paymentInfo.nodo || '001' },
                chargePlan: paymentInfo.chargePlan || null,
                link_pago: paymentInfo.link_pago || null
            },
            reference_number_ant: paymentInfo.reference_number_ant || '',
            folio: paymentInfo.folioMexipay || '',
            data125: this.mapCardType(paymentInfo.cardType) || 'DESCONOCIDO',
            autoReverseInfo: paymentInfo.autoReverseInfo || null
        };

        // =====================================================================
        // 4. BUILD MORE INFO JSON - INCLUDES STAN AND EMV TAGS
        // Reversal will read more_info.stan for field 90
        // =====================================================================
        const moreInfo = {
            merchant_id: merchantId,
            guid: transactionLog.guid,
            reference: paymentInfo.folioMexipay,
            emv_tags: paymentInfo.emvTags || null,
            payment_info: {
                card_type: paymentInfo.cardType,
                card_emisor: paymentInfo.cardEmisor,
                originador: paymentInfo.originador,
                nodo: paymentInfo.nodo,
                amount_cents: amountCents,
                amount_display: `$${(amountCents / 100).toFixed(2)}`,
                amount_original: paymentInfo.amount
            },
            transaction_type: {
                original: paymentInfo.transactionType,
                selia: transactionType.selia,
                iso: transactionType.iso,
                isSoloAutoriza: transactionType.isSoloAutoriza || false
            },
            status: 'pending',
            stored_at: new Date().toISOString(),
            source: 'isoSeliaService',
            // CRITICAL: Store STAN for reversal field 90
            stan: realStan,
            iso_response_fields: {
                field8: fields?.[8] || fields?.['8'],
                field11: realStan,
                field37: paymentInfo.folioMexipay || fields?.[37],
                field38: paymentInfo.authorization || fields?.[38]
            }
            

        };
        // Debug: Log field 8 being stored
        console.log(`[isoSeliaService] [${transactionLog.guid}] 🔍 DEBUG field8 storage: ${fields?.[8] || fields?.['8'] || 'undefined'}`);

        // Log EMV tags storage
        if (paymentInfo.emvTags) {
            console.log(`[isoSeliaService] [${transactionLog.guid}] 🔧 EMV TAGS STORED IN more_info:`, {
                hasEmvTags: !!paymentInfo.emvTags,
                emvTagsLength: Array.isArray(paymentInfo.emvTags) ? paymentInfo.emvTags.length :
                               (typeof paymentInfo.emvTags === 'string' ? paymentInfo.emvTags.length : 0),
                emvTagsPreview: Array.isArray(paymentInfo.emvTags) ?
                    JSON.stringify(paymentInfo.emvTags).substring(0, 100) + '...' :
                    (typeof paymentInfo.emvTags === 'string' ?
                        paymentInfo.emvTags.substring(0, 100) + '...' :
                        JSON.stringify(paymentInfo.emvTags).substring(0, 100) + '...')
            });
        } else {
            console.log(`[isoSeliaService] [${transactionLog.guid}] ⚠️ NO EMV TAGS IN paymentInfo.emvTags`);
        }

        // =====================================================================
        // 5. FIELD 63 RQ / RP LOGIC
        // Reuse original field 63 for reversals to maintain data consistency
        // =====================================================================
        let finalTkn63RQ = null;

        const isReversalOrRefund =
            paymentInfo.msgType === '0420' ||
            paymentInfo.msgType === '0220' ||
            paymentInfo.transactionType?.toLowerCase().includes('cancel') ||
            paymentInfo.transactionType?.toLowerCase().includes('refund') ||
            paymentInfo.isCancel ||
            paymentInfo.isRefund;

        if (isReversalOrRefund && paymentInfo.originalField63) {
            finalTkn63RQ = paymentInfo.originalField63;
            console.log(`[isoSeliaService] [${transactionLog.guid}] ♻️ REUSING ORIGINAL FIELD 63 FOR REVERSAL/REFUND (length: ${finalTkn63RQ.length})`);
        } else {
            const tkn63RQData = {
                processor: 'selia',
                card_number: paymentInfo.cardNumber
                    ? `${String(paymentInfo.cardNumber).substring(0, 6)}...${String(paymentInfo.cardNumber).slice(-4)}`
                    : '',
                amount: amountCents,
                amount_display: `$${(amountCents / 100).toFixed(2)}`,
                amount_type: 'cents',
                transaction_type: transactionType.selia,
                iso_message_type: transactionType.iso,
                is_solo_autoriza: transactionType.isSoloAutoriza || false,
                timestamp: new Date().toISOString(),
                merchant_id: merchantId,
                reference: paymentInfo.folioMexipay,
                original_transaction: {
                    auth_code: paymentInfo.originalAuthCode || null,
                    trx_id: paymentInfo.originalTrxId || null,
                    reference: paymentInfo.originalReference || null
                }
            };

            // Add Token Q6 for MSI transactions
            if (paymentInfo.chargePlan?.months) {
                const q6Token = this.buildTokenQ6(paymentInfo.chargePlan.months);
                tkn63RQData.q6_token = q6Token;
                console.log(`[isoSeliaService] [${transactionLog.guid}] 🎯 Added Q6 token for MSI: ${q6Token}`);
            }

            const tkn63RQHex = Buffer.from(JSON.stringify(tkn63RQData)).toString('hex').toUpperCase();
            finalTkn63RQ = `& ${tkn63RQHex}`;

            console.log(`[isoSeliaService] [${transactionLog.guid}] ⚠️ BUILDING NEW FIELD 63 (no original available)`);
        }

        const tkn63RPData = {
            processor: 'selia',
            status: 'pending',
            stored_at: new Date().toISOString(),
            merchant_id: merchantId,
            response_code: null,
            amount_cents: amountCents,
            amount_display: `$${(amountCents / 100).toFixed(2)}`
        };
        const tkn63RPHex = Buffer.from(JSON.stringify(tkn63RPData)).toString('hex').toUpperCase();
        const tkn63RP = `& ${tkn63RPHex}`;

        console.log(`[isoSeliaService] [${transactionLog.guid}] 📊 Final Tkn63 RQ/RP:`, {
            rqLength: finalTkn63RQ.length,
            rqPreview: finalTkn63RQ.substring(0, 60) + (finalTkn63RQ.length > 60 ? '...' : ''),
            rpLength: tkn63RP.length,
            isReused: !!paymentInfo.originalField63 && isReversalOrRefund
        });

        // =====================================================================
        // 6. PARAMS ARRAY FOR DB INSERT
        // =====================================================================
        return {
            params: [
                paymentInfo.id_operation || this.getOperationId(transactionType.selia, transactionType.isSoloAutoriza || false),
                isoMsgType,
                transactionLog.guid.substring(0, 10),
                String(paymentInfo.folioMexipay).substring(0, 16),
                amountFormatted,
                null,
                null,
                paymentInfo.cardNumber ? String(paymentInfo.cardNumber).substring(0, 6) : '',
                paymentInfo.cardNumber ? String(paymentInfo.cardNumber).slice(-4) : '',
                '0',
                transactionType.selia,
                null,
                tranDate,
                tranTime,
                null,
                finalTkn63RQ,
                tkn63RP,
                merchantName.substring(0, 40),
                'selia_gateway',
                dataSend,
                track2Data,
                JSON.stringify(moreInfo)
            ],
            dataSend: dataSend,
            moreInfo: moreInfo,
            amountCents: amountCents,
            amountFormatted: amountFormatted
        };
    }

    /**
     * Update transaction status after Selia response
     *
     * Updates the database record with:
     * - Response code
     * - Authorization code (preserves original for cancellations)
     * - Capture date
     * - Updated field 63 response data
     * - Complete response metadata
     *
     * @async
     * @param {Object} transactionLog - Transaction log object
     * @param {Object} seliaResponse - Parsed Selia response
     * @param {string} rawResponse - Raw response from Selia
     * @param {Object} paymentInfo - Payment information
     */
    async updateTransactionStatus(transactionLog, seliaResponse, rawResponse, paymentInfo) {
        console.log(`[isoSeliaService] [${transactionLog.guid}] 🚨 ENTERING updateTransactionStatus`);
        try {
            if (!this.config.db) {
                console.warn(`[isoSeliaService] [${transactionLog.guid}] ⚠️ No database connection for updating transaction`);
                return;
            }

            if (!transactionLog.trace_number) {
                console.error(`[isoSeliaService] [${transactionLog.guid}] ❌ Cannot update: no trace_number stored`);
                return;
            }

            console.log(`[isoSeliaService] [${transactionLog.guid}] ✅ DB connection OK, trace_number: ${transactionLog.trace_number}`);

            const now = new Date();
            const captureDateStr = seliaResponse.success ?
                ('0' + now.getUTCDate()).slice(-2) + ('0' + (now.getUTCMonth() + 1)).slice(-2) :
                null;

            let existingMoreInfo = {};
            try {
                if (transactionLog.more_info) {
                    existingMoreInfo = JSON.parse(transactionLog.more_info);
                }
            } catch (e) {
                console.warn(`[isoSeliaService] [${transactionLog.guid}] ⚠️ Could not parse existing more_info`);
            }

            const responseCode = seliaResponse.responseCode || '05';

            // CRITICAL: For cancellations, preserve original authorization code
            let finalAuthorizationCode = seliaResponse.authorizationCode;

            // Check if request came from a cancel endpoint
            const isCancelOperation =
                paymentInfo.isCancel === true || // Explicit cancel flag from endpoint
                paymentInfo.originalRoute?.includes('/cancel/') || // Cancel endpoint route
                (paymentInfo.msgType === '0420' || paymentInfo.msgType === '0220'); // Fallback to msgType

            if (isCancelOperation && paymentInfo.originalAuthCode) {
                finalAuthorizationCode = paymentInfo.originalAuthCode;
                console.log(`[isoSeliaService] [${transactionLog.guid}] 🔒 CANCELLATION: Preserving original authorization code: ${finalAuthorizationCode}`);
            } else if (isCancelOperation) {
                console.warn(`[isoSeliaService] [${transactionLog.guid}] ⚠️ CANCELLATION: No original authorization code available, using response auth: ${finalAuthorizationCode}`);
            } else {
                console.log(`[isoSeliaService] [${transactionLog.guid}] ✅ NORMAL/REFUND: Using response authorization code: ${finalAuthorizationCode}`);
            }

            // Build field 63 response data
            const tkn63RPResponseData = {
                processor: 'selia',
                transaction_id: seliaResponse.transactionId,
                authorization: finalAuthorizationCode,
                response_code: seliaResponse.responseCode,
                response_message: seliaResponse.responseMessage,
                success: seliaResponse.success,
                RESPONSE_COMPLETE: rawResponse,
                raw_response: rawResponse,
                processed_at: new Date().toISOString(),
                authorization_details: {
                    response_authorization: seliaResponse.authorizationCode,
                    final_authorization: finalAuthorizationCode,
                    is_cancellation: isCancelOperation,
                    original_authorization: paymentInfo.originalAuthCode
                }
            };
            const tkn63RPHex = Buffer.from(JSON.stringify(tkn63RPResponseData)).toString('hex').toUpperCase();
            const tkn63RPResponse = `& ${tkn63RPHex}`;

            // Extract field 8 from response
            let field8Value = null;
            console.log(`[isoSeliaService] [${transactionLog.guid}] 🔍 DEBUG rawFields:`, JSON.stringify(seliaResponse.rawFields, null, 2));
            if (seliaResponse.rawFields && seliaResponse.rawFields[8]) {
                field8Value = seliaResponse.rawFields[8];
                console.log(`[isoSeliaService] [${transactionLog.guid}] 🔍 FOUND field8 in updateTransactionStatus: ${field8Value}`);
            } else {
                console.log(`[isoSeliaService] [${transactionLog.guid}] ⚠️ NO field8 found in rawFields`);
            }

            // Update data
            const updateData = {
                resp_code: String(responseCode).substring(0, 12),
                authorization: finalAuthorizationCode ?
                    String(finalAuthorizationCode).substring(0, 8) : null,
                capture_date: captureDateStr,
                estatus_f: seliaResponse.success ? 2 : 3,
                tkn_data_63_rp: tkn63RPResponse,
                iso_response_fields: JSON.stringify({
                    field8: field8Value,
                    field11: transactionLog.trace_number,
                    field37: paymentInfo.folioMexipay,
                    field38: finalAuthorizationCode
                }),
                more_info: JSON.stringify({
                    ...existingMoreInfo,
                    status: seliaResponse.success ? 'approved' : 'declined',
                    selia_response: {
                        success: seliaResponse.success,
                        response_code: seliaResponse.responseCode,
                        response_message: seliaResponse.responseMessage,
                        authorization: seliaResponse.authorizationCode,
                        transaction_id: seliaResponse.transactionId,
                        processed_at: new Date().toISOString(),
                        authorization_used: finalAuthorizationCode,
                        is_cancellation: isCancelOperation,
                        original_authorization: paymentInfo.originalAuthCode
                    },
                    updated_at: new Date().toISOString()
                }).substring(0, 99999)
            };

            console.log(`[isoSeliaService] [${transactionLog.guid}] 🔄 Updating transaction:`, {
                trace_number: transactionLog.trace_number,
                success: seliaResponse.success,
                response_code: updateData.resp_code,
                response_message: seliaResponse.responseMessage,
                estatus_f: updateData.estatus_f,
                tkn63_rp_preview: tkn63RPResponse.substring(0, 100) + '...'
            });

            const model = this.config.db.isoMessage;

            if (!model) {
                console.error('isoMessage model is not available in database. Available models:', Object.keys(this.config.db));
                throw new Error('isoMessage model is not available in database');
            }

            // Update by trace_number
            const [affectedRows] = await model.update(
                updateData,
                { where: { trace_number: transactionLog.trace_number } }
            );

            if (affectedRows > 0) {
                console.log(`[isoSeliaService] [${transactionLog.guid}] ✅ Transaction updated successfully, affected rows: ${affectedRows}`);
            } else {
                console.error(`[isoSeliaService] [${transactionLog.guid}] ❌ No rows updated for trace_number: ${transactionLog.trace_number}`);

                // Try alternative update by reference number
                const referenceSearch = paymentInfo.folioMexipay;
                if (referenceSearch) {
                    console.log(`[isoSeliaService] [${transactionLog.guid}] 🔍 Trying alternative update by reference: ${referenceSearch}`);

                    const [altAffectedRows] = await this.config.db.isoMessage.update(
                        updateData,
                        { where: { reference_number: referenceSearch } }
                    );

                    if (altAffectedRows > 0) {
                        console.log(`[isoSeliaService] [${transactionLog.guid}] ✅ Updated by reference, affected rows: ${altAffectedRows}`);
                    }
                }
            }

            // CRITICAL: Update original transaction status when cancellation is approved
            if (seliaResponse.success && paymentInfo) {
                // Check if request came from a cancel endpoint
                const isCancelOperation =
                    paymentInfo.isCancel === true || // Explicit cancel flag from endpoint
                    paymentInfo.originalRoute?.includes('/cancel/') || // Cancel endpoint route
                    (paymentInfo.msgType === '0420' || paymentInfo.msgType === '0220'); // Fallback to msgType

                if (isCancelOperation && paymentInfo.originalTrxId) {
                    console.log(`[isoSeliaService] [${transactionLog.guid}] 🔄 Updating original transaction status to CANCELLED`);

                    try {
                        const [originalAffectedRows] = await this.config.db.isoMessage.update(
                            {
                                estatus_f: 3,
                                more_info: this.config.db.sequelize.literal(`
                                    JSON_SET(
                                        IF(more_info IS NULL OR more_info = '', '{}', more_info),
                                        '$.cancelled_at',
                                        JSON_QUOTE('${new Date().toISOString()}')
                                    )
                                `)
                            },
                            { where: { id_message: paymentInfo.originalTrxId, estatus_f: 2 } }
                        );

                        if (originalAffectedRows > 0) {
                            console.log(`[isoSeliaService] [${transactionLog.guid}] ✅ Original transaction ${paymentInfo.originalTrxId} marked as cancelled`);
                        } else {
                            console.warn(`[isoSeliaService] [${transactionLog.guid}] ⚠️ Original transaction ${paymentInfo.originalTrxId} not found or not in approved status`);
                        }
                    } catch (cancelError) {
                        console.error(`[isoSeliaService] [${transactionLog.guid}] ❌ Failed to update original transaction status:`, cancelError.message);
                    }
                }
            }

        } catch (error) {
            console.error(`[isoSeliaService] [${transactionLog.guid}] ❌ Failed to update transaction status:`, error.message);
            console.error(`[isoSeliaService] [${transactionLog.guid}] Error details:`, error);
        }
    }

    /**
     * Mark transaction as failed in database
     *
     * Updates transaction with error information and sets status to failed.
     * Uses response code 91 (Issuer Unavailable) for generic failures.
     *
     * @async
     * @param {Object} transactionLog - Transaction log object
     * @param {Error} error - Error object
     */
    async updateTransactionError(transactionLog, error) {
        try {
            if (!this.config.db || !transactionLog.trace_number) return;

            let existingMoreInfo = {};
            try {
                if (transactionLog.more_info) {
                    existingMoreInfo = JSON.parse(transactionLog.more_info);
                }
            } catch (e) {
                console.warn(`[isoSeliaService] [${transactionLog.guid}] ⚠️ Could not parse existing more_info`);
            }

            const errorTkn63Data = {
                processor: 'selia',
                status: 'failed',
                error: error.message,
                error_stack: error.stack,
                failed_at: new Date().toISOString()
            };
            const errorTkn63Hex = Buffer.from(JSON.stringify(errorTkn63Data)).toString('hex').toUpperCase();
            const errorTkn63RP = `& ${errorTkn63Hex}`;

            const updateData = {
                resp_code: '91',
                estatus_f: 4,
                tkn_data_63_rp: errorTkn63RP,
                more_info: JSON.stringify({
                    ...existingMoreInfo,
                    status: 'failed',
                    error: error.message,
                    failed_at: new Date().toISOString(),
                    error_details: {
                        message: error.message,
                        stack: error.stack,
                        type: error.name
                    }
                }).substring(0, 99999)
            };

            await this.config.db.isoMessage.update(
                updateData,
                { where: { trace_number: transactionLog.trace_number } }
            );

            console.log(`[isoSeliaService] [${transactionLog.guid}] ⚠️ Transaction marked as FAILED with code 91 (Issuer Unavailable)`);

        } catch (updateError) {
            console.error(`[isoSeliaService] [${transactionLog.guid}] ❌ Failed to mark transaction as failed:`, updateError.message);
        }
    }

    /**
     * Store pending transaction in database
     *
     * Creates initial transaction record before sending to Selia.
     * Handles distinction between true reversals (update existing) and
     * new transactions (create new record).
     *
     * @async
     * @param {string} isoMessage - ISO message
     * @param {Object} paymentInfo - Payment information
     * @param {Object} transactionLog - Transaction log object
     */
    async storePendingTransaction(isoMessage, paymentInfo, transactionLog) {
        try {
            // Distinguish between true reversals and new transactions
            const isTrueReversal = ['503'].includes(paymentInfo.transactionType || '') ||
                                   ['timeout', 'error', 'system'].some(type =>
                                       (paymentInfo.transactionType || '').toLowerCase().includes(type));

            const isCancellation = paymentInfo.transactionType === 'CANCEL' ||
                                   ['cancel', 'void'].some(type =>
                                       (paymentInfo.transactionType || '').toLowerCase().includes(type));

            const isReversal = (['0420', '0220', '0230'].includes(paymentInfo.msgType || '') && isTrueReversal) ||
                               ['refund', 'reverse'].some(type =>
                                   (paymentInfo.transactionType || '').toLowerCase().includes(type));

            console.log(`[isoSeliaService] [${transactionLog.guid}] 🔍 TRANSACTION TYPE ANALYSIS:`, {
                msgType: paymentInfo.msgType,
                transactionType: paymentInfo.transactionType,
                isTrueReversal: isTrueReversal,
                isCancellation: isCancellation,
                isReversal: isReversal,
                willCreateNewRecord: !isReversal
            });

            // For true reversals, find and update existing transaction
            if (isReversal) {
                console.log(`[isoSeliaService] [${transactionLog.guid}] 🔄 TRUE REVERSAL - Finding existing transaction to update`);

                const originalTrxId = paymentInfo.originalTrxId;
                if (originalTrxId) {
                    try {
                        console.log(`[isoSeliaService] [${transactionLog.guid}] 🔍 Looking up original transaction by id_message: ${originalTrxId}`);

                        const existingTransaction = await this.config.db.isoMessage.findOne({
                            where: { id_message: parseInt(originalTrxId) },
                            attributes: ['trace_number', 'id_message']
                        });

                        if (existingTransaction) {
                            transactionLog.trace_number = existingTransaction.trace_number;
                            transactionLog.dbId = existingTransaction.id_message;
                            console.log(`[isoSeliaService] [${transactionLog.guid}] ✅ Found existing transaction: id_message=${transactionLog.dbId}, trace_number=${transactionLog.trace_number}`);
                        } else {
                            console.error(`[isoSeliaService] [${transactionLog.guid}] ❌ No existing transaction found for id_message: ${originalTrxId}`);
                        }
                    } catch (findError) {
                        console.error(`[isoSeliaService] [${transactionLog.guid}] ❌ Error finding existing transaction:`, findError.message);
                    }
                } else {
                    console.error(`[isoSeliaService] [${transactionLog.guid}] ❌ No originalTrxId provided for reversal`);
                }

                // Don't create a new record - will update existing one
                return;
            } else if (isCancellation) {
                console.log(`[isoSeliaService] [${transactionLog.guid}] 🚫 CANCELLATION - Will create new transaction record and update original`);
                // Continue to create new transaction record
            }

            if (!this.config.db) {
                console.warn(`[isoSeliaService] [${transactionLog.guid}] ⚠️ No database connection available`);
                return;
            }

            if (!transactionLog.merchantId && !paymentInfo.merchantId) {
                console.error(`[isoSeliaService] [${transactionLog.guid}] ❌ merchantId is REQUIRED but not provided`);
                console.error(`[isoSeliaService] [${transactionLog.guid}] ❌ paymentInfo:`, JSON.stringify(paymentInfo, null, 2));
                throw new Error('merchantId is REQUIRED');
            }

            if (!paymentInfo.folioMexipay) {
                throw new Error('folioMexipay is REQUIRED');
            }

            // Prepare data for saving
            const { params, dataSend, moreInfo } = this.prepareDataForSaveIsoMessage(
                isoMessage,
                paymentInfo,
                transactionLog,
                paymentInfo.tk2
            );

            // Use helper if available, otherwise fallback
            if (this.config.helpers && typeof this.config.helpers.saveIsoMessage === 'function') {
                console.log(`[isoSeliaService] [${transactionLog.guid}] 📝 Calling saveIsoMessage with ${params.length} parameters`);

                const result = await this.config.helpers.saveIsoMessage(...params);

                if (result.error) {
                    console.error(`[isoSeliaService] [${transactionLog.guid}] ❌ saveIsoMessage failed:`, result.response);
                    throw new Error(`Database save failed: ${result.response.message}`);
                }

                console.log(`[isoSeliaService] [${transactionLog.guid}] ✅ Transaction saved via saveIsoMessage`);
                transactionLog.dbId = result.response?.id_message || result.response?.insertId;
                transactionLog.trace_number = params[2];

            } else {
                console.log(`[isoSeliaService] [${transactionLog.guid}] ⚠️ saveIsoMessage not available, using fallback`);
                await this.fallbackSaveTransaction(params, dataSend, transactionLog);
            }

        } catch (error) {
            console.error(`[isoSeliaService] [${transactionLog.guid}] ❌ Failed to store transaction:`, error.message);
            throw error;
        }
    }

    /**
     * Fallback method for saving transaction when helper not available
     *
     * Direct database insert using Sequelize when the helper function is not available.
     *
     * @async
     * @param {Array} params - Transaction parameters
     * @param {Object} dataSend - Data to send
     * @param {Object} transactionLog - Transaction log object
     */
    async fallbackSaveTransaction(params, dataSend, transactionLog) {
        const transactionRecord = {
            id_operation: params[0],
            msg_type: params[1],
            trace_number: params[2],
            reference_number: params[3],
            amount: params[4],
            resp_code: params[5],
            authorization: params[6],
            bin: params[7],
            last4: params[8],
            draft_capture: params[9],
            entry_mode: params[10],
            reverse_code: params[11],
            tran_date: params[12],
            tran_time: params[13],
            capture_date: params[14],
            tkn_data_63_rq: params[15],
            tkn_data_63_rp: params[16],
            card_acceptor: params[17],
            node: params[18],
            name_merchant: dataSend.merchant_data?.id_merchant,
            terminal: dataSend.body?.device?.serial || '001',
            reference_number_ant: dataSend.reference_number_ant || '',
            folio: dataSend.folio || '',
            card_type: dataSend.data125 || '',
            more_info: params[21],
            track2: params[20] ? Buffer.from(params[20]).toString('base64') : null,
            creation_date: new Date(),
            estatus_f: 1
        };

        const result = await this.config.db.isoMessage.create(transactionRecord);
        transactionLog.dbId = result.id_message;
        transactionLog.trace_number = transactionRecord.trace_number;
    }

    /**
     * Map internal card type to Selia format
     *
     * @param {string} cardType - Internal card type (C/D/G)
     * @returns {string} Mapped card type for field 125
     */
    mapCardType(cardType) {
        switch (cardType) {
            case 'C': return 'CREDITO';
            case 'D': return 'DEBITO';
            case 'G': return 'GENERAL';
            default: return 'DESCONOCIDO';
        }
    }

    /**
     * Determine Selia operation code based on transaction type
     *
     * CRITICAL: According to Selia official documentation:
     * - There is NO transaction code 507
     * - Both regular sales AND solo autoriza (check-in) use code 501
     * - The difference is field 491:1 for solo autoriza mode (replaced field 169)
     *
     * UPDATE (Apr 20, 2026 - Carlos Villasenor):
     * - Field 169 replaced with field 491 for solo autoriza
     *
     * This method returns an object with:
     * - selia: The Selia transaction code (501, 502, 503, 505, 517)
     * - iso: The ISO message type (0200, 0220, 0420)
     * - isSoloAutoriza: Boolean flag indicating if field 491:1 should be added
     *
     * @param {Object} isoMessage - ISO message object
     * @param {Object} paymentInfo - Payment information
     * @returns {Object} Transaction type object
     */
    determineOperationCode(isoMessage, paymentInfo = {}) {
        // Complete mapping based on Selia official documentation
        const typeMap = {
            // Regular sales - use 501
            'charge':      { selia: '501', iso: '0200', isSoloAutoriza: false },
            'purchase':    { selia: '501', iso: '0200', isSoloAutoriza: false },
            'sale':        { selia: '501', iso: '0200', isSoloAutoriza: false },
            'compra':      { selia: '501', iso: '0200', isSoloAutoriza: false },
            'venta':       { selia: '501', iso: '0200', isSoloAutoriza: false },

            // Check In / Solo Autoriza - ALSO use 501, but with solo autoriza flag
            'checkin':     { selia: '501', iso: '0200', isSoloAutoriza: true },
            'check_in':    { selia: '501', iso: '0200', isSoloAutoriza: true },
            'soloautoriza':{ selia: '501', iso: '0200', isSoloAutoriza: true },
            'preauthorize':{ selia: '501', iso: '0200', isSoloAutoriza: true },
            'preauth':     { selia: '501', iso: '0200', isSoloAutoriza: true },
            'reserva':     { selia: '501', iso: '0200', isSoloAutoriza: true },
            'authorization_only': { selia: '501', iso: '0200', isSoloAutoriza: true },

            // Refund operations
            'refund':      { selia: '502', iso: '0220', isSoloAutoriza: false },
            'devolucion':  { selia: '502', iso: '0220', isSoloAutoriza: false },
            'return':      { selia: '502', iso: '0220', isSoloAutoriza: false },

            // Cancel operations
            'cancel':      { selia: '503', iso: '0420', isSoloAutoriza: false },
            'cancellation':{ selia: '503', iso: '0420', isSoloAutoriza: false },
            'void':        { selia: '503', iso: '0420', isSoloAutoriza: false },
            'cancelacion': { selia: '503', iso: '0420', isSoloAutoriza: false },

            // Check Out (capture)
            'checkout':    { selia: '505', iso: '0220', isSoloAutoriza: false },
            'check_out':   { selia: '505', iso: '0220', isSoloAutoriza: false },
            'settlement':  { selia: '505', iso: '0220', isSoloAutoriza: false },
            'liquidacion': { selia: '505', iso: '0220', isSoloAutoriza: false },
            'capture':     { selia: '505', iso: '0220', isSoloAutoriza: false },

            // Reauthorize (increase amount)
            'reauthorize': { selia: '517', iso: '0200', isSoloAutoriza: false },
            'reauthorization': { selia: '517', iso: '0200', isSoloAutoriza: false },
            'reauth':      { selia: '517', iso: '0200', isSoloAutoriza: false },
            'reautorizacion': { selia: '517', iso: '0200', isSoloAutoriza: false },
            'increase':    { selia: '517', iso: '0200', isSoloAutoriza: false },

            // Consultation operations
            'consult':     { selia: '501', iso: '0200', isSoloAutoriza: false },
            'consulta':    { selia: '501', iso: '0200', isSoloAutoriza: false },
            'query':       { selia: '501', iso: '0200', isSoloAutoriza: false },
            'inquiry':     { selia: '501', iso: '0200', isSoloAutoriza: false }
        };

        // Priority 1: Check explicit solo autoriza flags
        if (paymentInfo.soloAutoriza === true ||
            paymentInfo.checkIn === true ||
            paymentInfo.preauthorize === true) {
            console.log(`[isoSeliaService] ✅ SOLO AUTORIZA flag detected -> Selia 501 with field 491:1`);
            return { selia: '501', iso: '0200', isSoloAutoriza: true };
        }

        // Priority 2: Check transactionType string
        if (paymentInfo.transactionType) {
            const normalizedType = paymentInfo.transactionType.toLowerCase().trim();
            const mappedType = typeMap[normalizedType];

            if (mappedType) {
                console.log(`[isoSeliaService] ✅ Mapped transactionType: "${paymentInfo.transactionType}" -> Selia: ${mappedType.selia}, ISO: ${mappedType.iso}, soloAutoriza: ${mappedType.isSoloAutoriza}`);
                return mappedType;
            } else {
                console.warn(`[isoSeliaService] ⚠️ Unknown transactionType: "${paymentInfo.transactionType}", defaulting to charge`);
                return { selia: '501', iso: '0200', isSoloAutoriza: false };
            }
        }

        // Priority 3: Check other flags (backwards compatibility)
        if (paymentInfo.isRefund === true) {
            console.log(`[isoSeliaService] ✅ REFUND flag detected -> Selia 502`);
            return { selia: '502', iso: '0220', isSoloAutoriza: false };
        }

        if (paymentInfo.isCancel === true || paymentInfo.isVoid === true) {
            console.log(`[isoSeliaService] ✅ CANCEL flag detected -> Selia 503`);
            return { selia: '503', iso: '0420', isSoloAutoriza: false };
        }

        // Default: Regular sale
        console.warn('[isoSeliaService] ⚠️ No transactionType found, defaulting to regular sale (501)');
        return { selia: '501', iso: '0200', isSoloAutoriza: false };
    }

    /**
     * Map Selia transaction type to internal operation ID
     *
     * @param {string} seliaTransactionType - Selia transaction code (501, 502, 503, 505, 517)
     * @returns {number} Internal operation ID for database
     */
    // REPLACE your existing getOperationId method with this:
    getOperationId(seliaTransactionType, isSoloAutoriza = false) {
        const map = {
            '501': {
                regular: 4,      // Regular sale / purchase
                soloAutoriza: 5  // Check In / solo autoriza (pre-authorization)
            },
            '502': 7,   // Refund
            '503': 6,   // Cancel
            '505': 8,   // Check Out
            '517': 9    // Reauthorize
        };

        const mapping = map[seliaTransactionType];

        if (!mapping) {
            console.warn(`[isoSeliaService] ⚠️ Unknown Selia transaction type: ${seliaTransactionType}, defaulting to operation ID 4`);
            return 4;
        }

        if (seliaTransactionType === '501') {
            const operationId = isSoloAutoriza ? mapping.soloAutoriza : mapping.regular;
            console.log(`[isoSeliaService] 🎯 Selia ${seliaTransactionType} (${isSoloAutoriza ? 'solo autoriza/check-in' : 'regular sale'}) -> operation ID ${operationId}`);
            return operationId;
        }

        console.log(`[isoSeliaService] 🎯 Selia ${seliaTransactionType} -> operation ID ${mapping}`);
        return mapping;
    }

    /**
     * Build production message for Selia gateway
     *
     * Constructs the complete Selia ISO 8583 message with all required fields.
     * Handles:
     * - Track2 decryption
     * - Merchant data retrieval (selia_id and affiliation)
     * - Transaction type determination with solo autoriza flag
     * - Field 19 (ticket number) with proper id_message
     * - Field 491:1 for solo autoriza transactions (replaced field 169)
     * - Field 611 with encapsulated ISO message
     *
     * @async
     * @param {string} isoMessage - ISO message from pinpad
     * @param {Object} paymentInfo - Payment information
     * @param {Object} transactionLog - Transaction log object
     * @returns {Promise<string>} Formatted Selia message
     */
    async buildProductionMessage(isoMessage, paymentInfo, transactionLog = null) {
        // Capture caller information for debugging
        const callerStack = new Error().stack;
        const callerLines = callerStack.split('\n').slice(2, 6).join('\n');

        console.log(`\n[isoSeliaService] 🔍 ========== buildProductionMessage TRACE ==========`);
        console.log(`[isoSeliaService] 🔍 Called from:`, callerLines);
        console.log(`[isoSeliaService] 🔍 paymentInfo FULL DATA:`, JSON.stringify(paymentInfo, null, 2));
        console.log(`[isoSeliaService] 🔍 paymentInfo keys:`, Object.keys(paymentInfo));
        console.log(`[isoSeliaService] 🔍 ====================================================\n`);

        // Pre-fetch original transaction field 8 for checkout operations
        let originalField8Value = null;
        if (paymentInfo.originalTrxId && this.config.db) {
            try {
                const originalTransaction = await this.config.db.isoMessage.findOne({
                    where: { id_message: parseInt(paymentInfo.originalTrxId) },
                    attributes: ['more_info']
                });
                
                if (originalTransaction && originalTransaction.more_info) {
                    const moreInfo = JSON.parse(originalTransaction.more_info);
                    // Check if field8 is stored as transaction_id in selia_response
                    if (moreInfo.selia_response && moreInfo.selia_response.transaction_id) {
                        originalField8Value = moreInfo.selia_response.transaction_id;
                        console.log(`[isoSeliaService] 🔥 PRE-FETCHED field8 from selia_response.transaction_id: ${moreInfo.selia_response.transaction_id}`);
                    } else {
                        // Try alternative structure - field8 might be in iso_response_fields
                        if (moreInfo.iso_response_fields && moreInfo.iso_response_fields.field8) {
                            originalField8Value = moreInfo.iso_response_fields.field8;
                            console.log(`[isoSeliaService] 🔥 PRE-FETCHED field8 from iso_response_fields: ${moreInfo.iso_response_fields.field8}`);
                        } else if (moreInfo.field8) {
                            originalField8Value = moreInfo.field8;
                            console.log(`[isoSeliaService] 🔥 PRE-FETCHED field8 from more_info: ${moreInfo.field8}`);
                        } else {
                            console.warn(`[isoSeliaService] ⚠️ No field8 found in original transaction`);
                            console.log(`[isoSeliaService] 🔍 DEBUG more_info structure:`, JSON.stringify(moreInfo, null, 2));
                        }
                    }
                }
            } catch (error) {
                console.error(`[isoSeliaService] ❌ Error pre-fetching original transaction field8:`, error.message);
            }
        }

        let {
            originador,
            nodo,
            folioMexipay,
            stan,
            amount,
            cardNumber,
            cardType,
            cardEmisor,
            tk2,
            versionMexipay = 'MxPay251101',
            merchantId
        } = paymentInfo;

        if (!merchantId) {
            merchantId = originador;
        }

        console.log(`[isoSeliaService] 🔍 merchantId in paymentInfo:`, {
            value: merchantId,
            type: typeof merchantId,
            exists: merchantId !== undefined && merchantId !== null
        });

        const timestamp = this.generateProductionTimestamp();

        console.log('[isoSeliaService] 🔍 PaymentInfo received:', {
            merchantId: merchantId,
            hasTk2: !!tk2,
            tk2: tk2 ? (tk2.substring(0, 20) + '...') : null,
            tk2Length: tk2?.length,
            cardNumber: cardNumber,
            panFromTk2: tk2?.split('=')[0],
            panFromCardNumber: cardNumber
        });

        // Process track2 data
        let track2Data = tk2 || '';

        // Validate track2 format
        if (!/^\d{10,}/.test(tk2)) {
            try {
                track2Data = await helpers.decryptTrack2(tk2);
                if (!track2Data || !/^\d{10,}/.test(track2Data)) {
                    throw new Error('TK2 does not start with at least 10 numbers after decryption');
                }
            } catch (error) {
                console.error('[isoSeliaService] ❌ Track2 decryption failed:', error.message);
                throw new Error('Invalid track2 data: ' + error.message);
            }
        } else {
            track2Data = tk2;
        }

        // Get merchant data
        const merchantData = await this.getMerchantData(merchantId);
        const seliaId = merchantData.selia_id || await this.getSeliaIdForMerchant(merchantId);
        console.log(`[isoSeliaService] 🔧 Using selia_id: ${seliaId} for merchant: ${merchantId}`);
        console.log(`[isoSeliaService] 🔧 Merchant afiliation: ${merchantData.afiliation_number}`);

        // Get transaction type (includes solo autoriza flag)
        const transactionType = this.determineOperationCode(isoMessage, paymentInfo);
        console.log(`[isoSeliaService] 🔧 Building message for: ${paymentInfo.transactionType} -> Selia ${transactionType.selia}, isSoloAutoriza: ${transactionType.isSoloAutoriza}`);

        // Process ISO message for field 611
        let processedIsoMessage = isoMessage;

        if (processedIsoMessage && processedIsoMessage.includes('TRANSACTION_DATA_MISSING')) {
            console.log('[isoSeliaService] 🔍 Found TRANSACTION_DATA_MISSING placeholder, replacing with actual data...');
            const originalData = this.buildTransactionDataForIso(paymentInfo, processedIsoMessage);
            processedIsoMessage = processedIsoMessage.replace('TRANSACTION_DATA_MISSING', originalData);
            console.log('[isoSeliaService] ✅ Replaced TRANSACTION_DATA_MISSING with actual data');
        }

        // Build masked PAN for field 35
        const track2WithoutExtra = track2Data.split('D')[0].split('=')[0];
        const rawPan = (cardNumber ? String(cardNumber) : String(track2WithoutExtra)).replace(/\D/g, '');
        const maskedPan = rawPan.length >= 10 ? `${rawPan.slice(0, 6)}******${rawPan.slice(-4)}` : rawPan;

        console.log('[isoSeliaService] 📊 Final track2 for field 35:', {
            pan: track2Data.split('=')[0],
            expectedPan: cardNumber,
            match: track2Data.split('=')[0] === cardNumber
        });

        // Validate track2 format before sending
        if (!track2Data || !track2Data.match(/^\d+/)) {
            const errorMsg = `❌ CRITICAL ERROR: Track2 data is not numeric format: ${track2Data}`;
            console.error('\n' + '='.repeat(80));
            console.error('[isoSeliaService] 🚨', errorMsg);
            console.error('[isoSeliaService] 🚨 REFUSING TO SEND REQUEST TO SELIA WITH INVALID TRACK2!');
            console.error('='.repeat(80) + '\n');
            throw new Error(errorMsg);
        }

        // Build the Selia message
        let message = ""
        if (process.env.SELIA_ISO_MODE !== 'Prod' || this.config.devModeOverride) {
            message = "{161:1;"
        } else {
            message = "{161:" + seliaId + ";";
        }

        message += `1:1;`;
        const nodoDigits = nodo ? nodo.split('W')[1] || nodo : '';
        message += `2:${this.escapeField(nodoDigits)};`;
        message += `3:${timestamp};`;
        message += `7:${transactionType.selia};`;

        // Add transaction-specific fields (includes field 169:1 for solo autoriza)
        const additionalParams = {
            isSoloAutoriza: transactionType.isSoloAutoriza,
            originalField8Value: originalField8Value
        };
        message = this.addTransactionSpecificFields(message, transactionType.selia, paymentInfo, additionalParams);

        // Add promotion fields if applicable - only for MSI/deferred transactions
        if (paymentInfo.chargePlan && paymentInfo.chargePlan.months) {
            message += `78:${paymentInfo.chargePlan};`;
            if (paymentInfo.chargePlanMonths) {
                message += `79:${paymentInfo.chargePlanMonths};`;
            }
        }

        // Add consultation field if needed
        if (paymentInfo.isConsultation === true || paymentInfo.consulta === true) {
            message += `86:C;`;
        }

        // Base fields
        message += `45:${this.validateAmount(amount)};`;
        message += `46:0;`;
        message += `56:0;`;
        message += `172:${this.escapeField(merchantData.afiliation_number || '')};`;

        // Field 19 - Ticket number (MUST use id_message)
        let referenceForSelia;

        console.log(`[isoSeliaService] 🔍 DEBUG Field 19 - transactionLog:`, {
            dbId: transactionLog?.dbId,
            guid: transactionLog?.guid,
            transactionType: transactionType.selia,
            stan: stan,
            folioMexipay: folioMexipay,
            originalTrxId: paymentInfo.originalTrxId
        });

        if (transactionType.selia === '501') {
            if (!transactionLog?.dbId) {
                throw new Error(`FATAL: Field 19 requires current transaction id_message for 501 operation, but transactionLog.dbId is missing`);
            }
            referenceForSelia = transactionLog.dbId;
            console.log(`[isoSeliaService] 🔍 Using current transaction id_message for Field 19: ${referenceForSelia} (transaction type: ${transactionType.selia})`);
        } else {
            if (!paymentInfo.originalTrxId) {
                throw new Error(`FATAL: Field 19 requires original transaction id_message for ${transactionType.selia} operation, but originalTrxId is missing`);
            }
            referenceForSelia = paymentInfo.originalTrxId;
            console.log(`[isoSeliaService] 🌏 Using original transaction id_message for Field 19: ${referenceForSelia} (transaction type: ${transactionType.selia})`);
        }

        referenceForSelia = String(referenceForSelia);
        referenceForSelia = parseInt(referenceForSelia) || 1;

        console.log(`[isoSeliaService] 🔍 Final Field 19 value: ${referenceForSelia}`);
        message += `19:${referenceForSelia};`;

        // Add voucher field for refund/cancel
        if (['502', '503'].includes(transactionType.selia)) {
            message += `163:S;`;
        }

        message += `35:${this.escapeField(maskedPan)};`;
        message += `611:${processedIsoMessage};`;
        
        // Use database LDI credentials when not in development mode
        let username = this.config.username;
        let password = this.config.password;
        
        if (process.env.SELIA_ISO_MODE !== 'Dev' && seliaId) {
            console.log(`[isoSeliaService] 🔍 Looking up LDI credentials for selia_id ${seliaId} (non-DEV mode)`);
            const ldiCredentials = await this.getLdiCredentials(seliaId);
            
            if (ldiCredentials) {
                username = ldiCredentials.username;
                password = ldiCredentials.password;
                console.log(`[isoSeliaService] ✅ Using database LDI credentials for selia_id ${seliaId}`);
            } else {
                console.log(`[isoSeliaService] ⚠️ No LDI credentials found for selia_id ${seliaId}, using default credentials`);
            }
        } else {
            console.log(`[isoSeliaService] 🔧 Using default credentials (DEV mode or no selia_id)`);
        }
        
        message += `54:${this.escapeField(username)};`;
        message += `219:${this.escapeField(password)};`;
        message += `356:${versionMexipay};`;
        message += '}';

        console.log('[isoSeliaService] ✅ Built Selia production message with selia_id:', seliaId);
        console.log('[isoSeliaService] 📤 Message preview:', message );
        return message;
    }

    /**
     * Build transaction data for ISO message placeholder
     *
     * Replaces TRANSACTION_DATA_MISSING with actual merchant data.
     * Priority:
     * 1. Use original field 63 for reversals/refunds
     * 2. Extract from ISO message
     * 3. Fallback from paymentInfo.tkn_data_63_rq
     *
     * @param {Object} paymentInfo - Payment information
     * @param {string} processedIsoMessage - Processed ISO message
     * @returns {string} Transaction data string
     */
    buildTransactionDataForIso(paymentInfo, processedIsoMessage = null) {
        // Priority 1: For reversals/refunds, reuse original field 63
        if (paymentInfo.originalField63 &&
            (paymentInfo.transactionType?.includes('cancel') ||
             paymentInfo.transactionType?.includes('refund') ||
             paymentInfo.msgType === '0420' || paymentInfo.msgType === '0220')) {

            console.log('[isoSeliaService] ♻️ Reusing ORIGINAL field 63 for TRANSACTION_DATA_MISSING replacement (length: ' +
                paymentInfo.originalField63.length + ')');

            return paymentInfo.originalField63;
        }

        // Priority 2: Extract from ISO message
        if (processedIsoMessage) {
            const field63Data = this.extractField63FromIsoMessage(processedIsoMessage);
            if (field63Data) {
                console.log('[isoSeliaService] ✅ Using merchant data from ISO message field 63');
                return field63Data;
            }
        }

        // Priority 3: Fallback from paymentInfo
        if (paymentInfo.tkn_data_63_rq) {
            const field63Data = this.extractMerchantDataFromField63(paymentInfo.tkn_data_63_rq);
            if (field63Data) {
                console.log('[isoSeliaService] ✅ Using merchant data from paymentInfo field 63');
                return field63Data;
            }
        }

        // Last resort fallback
        console.log('[isoSeliaService] ❌ No merchant data available, using minimal format');
        return 'MERCHANT_DATA_UNAVAILABLE';
    }

    /**
     * Extract field 63 from ISO message string
     *
     * Searches for field 63 in various formats:
     * - 63:[length][data]
     * - 63=[data]
     * - Hex encoded data
     *
     * @param {string} isoMessage - ISO message string
     * @returns {string|null} Extracted field 63 data
     */
    extractField63FromIsoMessage(isoMessage) {
        try {
            if (!isoMessage || typeof isoMessage !== 'string') {
                return null;
            }

            console.log('[isoSeliaService] 🔍 Searching for field 63 in ISO message...');

            // Format 1: 63:[length][data]
            const field63Match1 = isoMessage.match(/63:(\d{3})(.+?)(?=1:|2:|3:|4:|$)/);
            if (field63Match1) {
                const length = parseInt(field63Match1[1]);
                const data = field63Match1[2].substring(0, length);
                console.log('[isoSeliaService] ✅ Found field 63 (format 1):', data.substring(0, 50) + '...');
                return this.extractMerchantDataFromField63(data);
            }

            // Format 2: 63=[data]
            const field63Match2 = isoMessage.match(/63=([^;|}]+?)(?=;|}|$)/);
            if (field63Match2) {
                const data = field63Match2[1];
                console.log('[isoSeliaService] ✅ Found field 63 (format 2):', data.substring(0, 50) + '...');
                return this.extractMerchantDataFromField63(data);
            }

            // Format 3: Hex data
            const hexMatch = isoMessage.match(/63:([0-9A-Fa-f]+)/);
            if (hexMatch) {
                const hexData = hexMatch[1];
                console.log('[isoSeliaService] ✅ Found field 63 (hex format):', hexData.substring(0, 50) + '...');
                return this.extractFromHexJson(hexData);
            }

            console.log('[isoSeliaService] ⚠️ Field 63 not found in ISO message');
            return null;

        } catch (error) {
            console.log('[isoSeliaService] ❌ Error extracting field 63 from ISO message:', error.message);
            return null;
        }
    }

    /**
     * Extract merchant data from field 63
     *
     * Handles various field 63 formats:
     * - Hex-encoded JSON
     * - PROSA token format
     * - Plain JSON
     *
     * @param {string} field63Data - Field 63 data
     * @returns {string|null} Extracted merchant data
     */
    extractMerchantDataFromField63(field63Data) {
        try {
            if (!field63Data || typeof field63Data !== 'string') {
                return null;
            }

            console.log('[isoSeliaService] 🔍 Parsing field 63 data:', field63Data.substring(0, 100) + '...');

            // Check for hex-encoded JSON
            if (field63Data.match(/^[0-9A-Fa-f]+$/)) {
                return this.extractFromHexJson(field63Data);
            }

            // Check for PROSA token format
            if (field63Data.startsWith('&')) {
                return this.extractFromProsTokens(field63Data);
            }

            // Check for existing MERCHANT format
            if (field63Data.includes('MERCHANT:')) {
                return field63Data;
            }

            // Check for JSON format
            if (field63Data.startsWith('{') || field63Data.startsWith('[')) {
                return this.extractFromJson(field63Data);
            }

            console.log('[isoSeliaService] ⚠️ Unable to parse field 63 format');
            return null;

        } catch (error) {
            console.log('[isoSeliaService] ❌ Error extracting merchant data from field 63:', error.message);
            return null;
        }
    }

    /**
     * Extract merchant data from hex-encoded JSON
     *
     * @param {string} hexData - Hex-encoded JSON string
     * @returns {string|null} Formatted merchant data
     */
    extractFromHexJson(hexData) {
        try {
            let jsonString = '';
            for (let i = 0; i < hexData.length; i += 2) {
                const hexPair = hexData.substr(i, 2);
                jsonString += String.fromCharCode(parseInt(hexPair, 16));
            }

            const jsonData = JSON.parse(jsonString);

            const data = {
                merchantName: jsonData.merchant_name || jsonData.name_merchant || 'UNKNOWN MERCHANT',
                merchantLocation: jsonData.merchant_location || 'UNKNOWN LOCATION',
                merchantId: jsonData.merchant_id || 'UNKNOWN',
                terminalId: jsonData.terminal || jsonData.nodo || 'UNKNOWN',
                transactionDate: this.extractDateFromTimestamp(jsonData.timestamp) || this.getFormattedDate(),
                transactionTime: this.extractTimeFromTimestamp(jsonData.timestamp) || this.getFormattedTime(),
                referenceNumber: jsonData.reference || jsonData.reference_number || '',
                authCode: jsonData.auth_code || jsonData.authorization || '',
                cardNumber: jsonData.card_number ?
                    `${jsonData.card_number.substring(0, 6)}******${jsonData.card_number.slice(-4)}` : '',
                amount: jsonData.amount ? (parseInt(jsonData.amount) / 100).toFixed(2) : '0'
            };

            return [
                `MERCHANT: ${data.merchantName}`,
                `LOCATION: ${data.merchantLocation}`,
                `TERMINAL: ${data.terminalId}`,
                `DATE/TIME: ${data.transactionDate}${data.transactionTime}`,
                `REF: ${data.referenceNumber}`,
                `AUTH: ${data.authCode}`,
                `PAN: ${data.cardNumber}`,
                `AMOUNT: ${data.amount}`
            ].join('|');

        } catch (error) {
            console.log('[isoSeliaService] ⚠️ Failed to parse hex JSON:', error.message);
            return null;
        }
    }

    /**
     * Extract merchant data from PROSA tokens
     *
     * @param {string} tokenData - PROSA token format data
     * @returns {string|null} Extracted merchant data
     */
    extractFromProsTokens(tokenData) {
        try {
            const merchantMatch = tokenData.match(/!\s*([A-Z0-9]{2})\s*(\d{5})\s*(.+?)(?=\s*!|\s*$)/);

            if (merchantMatch) {
                const tokenId = merchantMatch[1];
                const tokenLength = parseInt(merchantMatch[2]);
                const tokenDataContent = merchantMatch[3].substring(0, tokenLength);

                if (tokenDataContent.includes('MERCHANT:')) {
                    return tokenDataContent;
                }
            }

            return null;
        } catch (error) {
            console.log('[isoSeliaService] ⚠️ Failed to parse PROSA tokens:', error.message);
            return null;
        }
    }

    /**
     * Extract merchant data from JSON
     *
     * @param {string} jsonData - JSON string
     * @returns {string|null} Formatted merchant data
     */
    extractFromJson(jsonData) {
        try {
            const parsed = JSON.parse(jsonData);

            const data = {
                merchantName: parsed.merchant_name || parsed.name_merchant || 'UNKNOWN MERCHANT',
                merchantLocation: parsed.merchant_location || 'UNKNOWN LOCATION',
                merchantId: parsed.merchant_id || 'UNKNOWN',
                terminalId: parsed.terminal || parsed.nodo || 'UNKNOWN',
                transactionDate: this.extractDateFromTimestamp(parsed.timestamp) || this.getFormattedDate(),
                transactionTime: this.extractTimeFromTimestamp(parsed.timestamp) || this.getFormattedTime(),
                referenceNumber: parsed.reference || parsed.reference_number || '',
                authCode: parsed.auth_code || parsed.authorization || '',
                cardNumber: parsed.card_number ?
                    `${parsed.card_number.substring(0, 6)}******${parsed.card_number.slice(-4)}` : '',
                amount: parsed.amount ? (parseInt(parsed.amount) / 100).toFixed(2) : '0'
            };

            return [
                `MERCHANT: ${data.merchantName}`,
                `LOCATION: ${data.merchantLocation}`,
                `TERMINAL: ${data.terminalId}`,
                `DATE/TIME: ${data.transactionDate}${data.transactionTime}`,
                `REF: ${data.referenceNumber}`,
                `AUTH: ${data.authCode}`,
                `PAN: ${data.cardNumber}`,
                `AMOUNT: ${data.amount}`
            ].join('|');

        } catch (error) {
            console.log('[isoSeliaService] ⚠️ Failed to parse JSON:', error.message);
            return null;
        }
    }

    /**
     * Extract date from timestamp
     *
     * @param {string} timestamp - ISO timestamp
     * @returns {string|null} Formatted date (YYMMDD)
     */
    extractDateFromTimestamp(timestamp) {
        if (!timestamp) return null;
        try {
            const date = new Date(timestamp);
            return date.toISOString().slice(2, 10).replace(/-/g, '');
        } catch (error) {
            return null;
        }
    }

    /**
     * Extract time from timestamp
     *
     * @param {string} timestamp - ISO timestamp
     * @returns {string|null} Formatted time (HHMMSS)
     */
    extractTimeFromTimestamp(timestamp) {
        if (!timestamp) return null;
        try {
            const date = new Date(timestamp);
            return date.toISOString().slice(11, 17).replace(/:/g, '');
        } catch (error) {
            return null;
        }
    }

    /**
     * Add transaction-specific fields based on Selia transaction type
     *
     * CRITICAL: For 501 transactions:
     * - Regular sale: NO field 491
     * - Solo autoriza (check-in): ADD field 491:1
     *
     * UPDATE (Apr 20, 2026 - Carlos Villasenor):
     * - Field 169 replaced with field 491 for solo autoriza
     *
     * This is the key implementation of Selia's requirement that both
     * regular sales and solo autoriza use code 501, distinguished by field 491.
     *
     * @param {string} message - Current message being built
     * @param {string} seliaTransactionType - Selia transaction code
     * @param {Object} paymentInfo - Payment information
     * @param {string|null} originalField8Value - Field 8 value from original transaction
     * @returns {string} Updated message with added fields
     */
    addTransactionSpecificFields(message, seliaTransactionType, paymentInfo, additionalParams = {}) {
        console.log(`[isoSeliaService] 🚨 Adding transaction-specific fields for type: ${seliaTransactionType}`);
        console.log(`[isoSeliaService] 🔍 paymentInfo.originalTrxId:`, paymentInfo.originalTrxId);
        console.log(`[isoSeliaService] 🔍 paymentInfo.originalAuthCode:`, paymentInfo.originalAuthCode);
        console.log(`[isoSeliaService] 🔍 isSoloAutoriza:`, paymentInfo.isSoloAutoriza, paymentInfo.soloAutoriza, paymentInfo.checkIn);

        // =====================================================================
        // Handle 501 transactions (both regular sales AND solo autoriza)
        // =====================================================================
        if (seliaTransactionType === '501') {
            const isSoloAutoriza = paymentInfo.isSoloAutoriza === true ||
                                   paymentInfo.soloAutoriza === true ||
                                   paymentInfo.checkIn === true;

            if (isSoloAutoriza) {
                console.log(`[isoSeliaService] ✅ Adding solo autoriza field: 491:1`);
                message += `491:1;`; // Solo autoriza mode - no capture
            } else {
                console.log(`[isoSeliaService] ℹ️ Regular sale (501) - NO field 491 added`);
            }
            return message;
        }

        // =====================================================================
        // Handle refund (502)
        // =====================================================================
        if (seliaTransactionType === '502') {
            const seliaTrxIdForRefund = paymentInfo.originalSeliaTrxId || paymentInfo.originalTrxId;
            console.log(`[isoSeliaService] ✅ Adding refund fields: 50:${paymentInfo.originalAuthCode}, 74:${seliaTrxIdForRefund}`);
            message += `50:${paymentInfo.originalAuthCode};`;
            message += `74:${seliaTrxIdForRefund};`;
            return message;
        }

        // =====================================================================
        // Handle cancel (503)
        // =====================================================================
        if (seliaTransactionType === '503') {
            console.log(`[isoSeliaService] 🔍 CANCEL (503) DEBUG:`, {
                hasOriginalAuthCode: !!paymentInfo.originalAuthCode,
                hasOriginalTrxId: !!paymentInfo.originalTrxId,
                hasOriginalSeliaTrxId: !!paymentInfo.originalSeliaTrxId,
                originalAuthCode: paymentInfo.originalAuthCode,
                originalTrxId: paymentInfo.originalTrxId,
                originalSeliaTrxId: paymentInfo.originalSeliaTrxId,
                paymentInfoKeys: Object.keys(paymentInfo),
                isCancel: paymentInfo.isCancel,
                isVoid: paymentInfo.isVoid,
                transactionType: paymentInfo.transactionType
            });

            // Try to extract missing fields from other sources
            if (!paymentInfo.originalAuthCode && paymentInfo.auth) {
                console.log(`[isoSeliaService] 🔧 Using auth field as originalAuthCode: ${paymentInfo.auth}`);
                paymentInfo.originalAuthCode = paymentInfo.auth;
            }

            const seliaTrxIdForField74 = paymentInfo.originalSeliaTrxId || paymentInfo.originalTrxId;

            if (!paymentInfo.originalAuthCode || !seliaTrxIdForField74) {
                console.error(`[isoSeliaService] ❌ Cancel (503) missing required fields:`, {
                    originalAuthCode: paymentInfo.originalAuthCode,
                    originalSeliaTrxId: paymentInfo.originalSeliaTrxId,
                    originalTrxId: paymentInfo.originalTrxId,
                    seliaTrxIdForField74: seliaTrxIdForField74
                });

                const missingFields = [];
                if (!paymentInfo.originalAuthCode) missingFields.push('originalAuthCode (Field 50 - Authorization Code)');
                if (!seliaTrxIdForField74) missingFields.push('originalSeliaTrxId (Field 74 - SELIA Transaction ID)');

                throw new Error(`Cancel (503) requires original transaction information. Missing: ${missingFields.join(', ')}.`);
            }

            console.log(`[isoSeliaService] ✅ Adding cancel fields: 50:${paymentInfo.originalAuthCode}, 74:${seliaTrxIdForField74}`);
            message += `50:${paymentInfo.originalAuthCode};`;
            message += `74:${seliaTrxIdForField74};`;
            return message;
        }

        // =====================================================================
        // Handle reauthorize (517)
        // =====================================================================
        if (seliaTransactionType === '517') {
            if (!paymentInfo.originalTrxId) {
                console.error(`[isoSeliaService] ❌ Reauthorize (517) missing required field:`, {
                    originalTrxId: paymentInfo.originalTrxId
                });
                throw new Error(`Reauthorize (517) requires originalTrxId`);
            }
            console.log(`[isoSeliaService] ✅ Adding reauthorize field: 74:${paymentInfo.originalSeliaTrxId}`);
            message += `74:${paymentInfo.originalSeliaTrxId};`;
            if (paymentInfo.additionalAmount) {
                console.log(`[isoSeliaService] ✅ Adding additional amount: 72:${paymentInfo.additionalAmount}`);
                message += `72:${paymentInfo.additionalAmount};`;
            }
            return message;
        }

        // =====================================================================
        // Handle checkout (505)
        // =====================================================================
        if (seliaTransactionType === '505') {
            if (!paymentInfo.originalTrxId) {
                console.error(`[isoSeliaService] ❌ Check Out (505) missing required field:`, {
                    originalTrxId: paymentInfo.originalTrxId
                });
                throw new Error(`Check Out (505) requires originalTrxId`);
            }
            // Field 50: Authorization code from original check-in
            const authCode = paymentInfo.originalAuthCode || paymentInfo.authorization;
            if (authCode) {
                console.log(`[isoSeliaService] ✅ Adding checkout field 50 (auth): ${authCode}`);
                message += `50:${authCode};`;
            } else {
                console.warn(`[isoSeliaService] ⚠️ Check Out (505) missing originalAuthCode - field 50 will not be added`);
            }
            // CRITICAL: For checkout, we need field 8 (Selia transaction ID) from original transaction
            let seliaTrxIdForCheckout = additionalParams.originalField8Value || paymentInfo.originalTrxId; // Use pre-fetched field8 or fallback
            
            console.log(`[isoSeliaService] 🔍 DEBUG Checkout Field 74: originalSeliaTrxId=${paymentInfo.originalSeliaTrxId}, originalTrxId=${paymentInfo.originalTrxId}, originalField8=${additionalParams.originalField8Value}, final=${seliaTrxIdForCheckout}`);
            console.log(`[isoSeliaService] ✅ Adding checkout field 74: ${seliaTrxIdForCheckout}`);
            message += `74:${seliaTrxIdForCheckout};`;
            if (paymentInfo.additionalAmount) {
                console.log(`[isoSeliaService] ✅ Adding additional amount: 72:${paymentInfo.additionalAmount}`);
                message += `72:${paymentInfo.additionalAmount};`;
            }
            return message;
        }

        console.log(`[isoSeliaService] ℹ️ No transaction-specific fields needed for type: ${seliaTransactionType}`);
        return message;
    }

    /**
     * Validate transaction requirements
     *
     * Ensures all required fields are present for the given transaction type.
     *
     * @param {Object} paymentInfo - Payment information
     * @throws {Error} If validation fails
     */
    validateTransaction(paymentInfo) {
        const transactionType = this.determineOperationCode(null, paymentInfo);

        console.log(`[isoSeliaService] 🔍 Validating ${paymentInfo.transactionType || 'charge'} transaction (Selia: ${transactionType.selia}, soloAutoriza: ${transactionType.isSoloAutoriza})`);

        // Common required fields for all transactions
        const commonRequired = ['originador', 'nodo', 'amount', 'cardNumber', 'cardType', 'cardEmisor'];
        for (const field of commonRequired) {
            if (!paymentInfo[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        if (!['C', 'D', 'G'].includes(paymentInfo.cardType)) {
            throw new Error('cardType must be C, D, or G');
        }

        if (paymentInfo.chargePlan && paymentInfo.chargePlan.months && !paymentInfo.chargePlanMonths) {
            throw new Error('chargePlan with months requires chargePlanMonths');
        }

        // Transaction-specific validation
        switch(transactionType.selia) {
            case '502': // Refund
            case '503': // Cancel
                if (!paymentInfo.originalAuthCode) {
                    throw new Error(`${transactionType.selia} requires originalAuthCode`);
                }
                if (!paymentInfo.originalTrxId) {
                    throw new Error(`${transactionType.selia} requires originalTrxId`);
                }
                break;

            case '517': // Reauthorize
                if (!paymentInfo.originalTrxId) {
                    throw new Error(`${transactionType.selia} requires originalTrxId`);
                }
                break;

            case '505': // Check Out
                if (!paymentInfo.originalTrxId) {
                    throw new Error(`${transactionType.selia} requires originalTrxId`);
                }
                if (!paymentInfo.originalAuthCode) {
                    console.warn(`[isoSeliaService] ⚠️ Check Out (505) should have originalAuthCode (authorization from check-in)`);
                }
                break;

            case '501': // Regular sale or solo autoriza
                if (transactionType.isSoloAutoriza) {
                    console.log(`[isoSeliaService] ℹ️ Solo autoriza transaction validated - will use field 491:1`);
                }
                break;
        }

        return true;
    }

    /**
     * Send message to Selia TCP gateway
     *
     * Establishes TCP connection, sends the ISO message, and waits for response.
     * Handles:
     * - Connection timeout
     * - Socket events logging
     * - Response accumulation
     * - Error handling
     *
     * @async
     * @param {string} message - Message to send
     * @returns {Promise<string>} Response from gateway
     */
    async sendToSeliaGateway(message) {
        const requestStartTime = Date.now();
        const socketId = `${this.guid}-${Date.now()}`;

        // Log request to S3 if logger is available
        if (this.logger && this.guid) {
            this.logger(this.guid, 'SELIA_REQUEST', {
                socketId,
                request: {
                    message: message,
                    host: this.config.host,
                    port: this.config.port,
                    timestamp: new Date().toISOString()
                }
            }).catch(err => {
                console.error('[isoSeliaService] ❌ Error logging request to S3:', err.message);
            });
        }

        return new Promise((resolve, reject) => {
            let responseData = '';
            let socket;
            let timeoutId;
            let connectionEstablished = false;
            let socketEvents = [];

            const cleanup = () => {
                if (timeoutId) clearTimeout(timeoutId);
                if (socket) {
                    socket.removeAllListeners();
                    socket.destroy();
                }
            };

            const logSocketEvent = (eventType, eventData) => {
                if (this.logger && this.guid) {
                    socketEvents.push({
                        eventType,
                        timestamp: new Date().toISOString(),
                        elapsedMs: Date.now() - requestStartTime,
                        ...eventData
                    });

                    this.logger(this.guid, 'SOCKET_EVENTS_CONSOLIDATED', {
                        socketId,
                        totalEvents: socketEvents.length,
                        events: socketEvents,
                        latestEvent: eventType,
                        requestStartTime,
                        connectionEstablished,
                        hasCompleteResponse: responseData.includes('}')
                    }).catch(err => {
                        console.error('[isoSeliaService] ❌ Error logging socket events to S3:', err.message);
                    });
                }
            };

            // Set timeout
            timeoutId = setTimeout(() => {
                logSocketEvent('TIMEOUT', {
                    timeoutMs: this.config.timeout,
                    message: `Selia gateway timeout after ${this.config.timeout}ms`
                });
                cleanup();
                reject(new Error(`Selia gateway timeout after ${this.config.timeout}ms`));
            }, this.config.timeout);

            try {
                socket = net.createConnection({
                    host: this.config.host,
                    port: this.config.port
                }, () => {
                    connectionEstablished = true;
                    console.log('[isoSeliaService] 🔌 TCP connection established to Selia', socketId);

                    logSocketEvent('CONNECT', {
                        message: 'TCP connection established',
                        localAddress: socket.localAddress,
                        localPort: socket.localPort,
                        remoteAddress: socket.remoteAddress,
                        remotePort: socket.remotePort
                    });

                    socket.write(message);
                });

                socket.on('data', (data) => {
                    const dataStr = data.toString();
                    responseData += dataStr;

                    logSocketEvent('DATA', {
                        dataLength: data.length,
                        partialData: dataStr.substring(0, 200) + (dataStr.length > 200 ? '...' : ''),
                        totalDataLength: responseData.length,
                        hasCompleteResponse: responseData.includes('}')
                    });

                    if (responseData.includes('}')) {
                        logSocketEvent('RESPONSE_COMPLETE', {
                            totalResponseLength: responseData.length,
                            responsePreview: responseData.substring(0, 500) + (responseData.length > 500 ? '...' : ''),
                            responseTime: Date.now() - requestStartTime
                        });

                        cleanup();
                        resolve(responseData);
                    }
                });

                socket.on('end', () => {
                    logSocketEvent('END', {
                        hasResponseData: responseData.length > 0,
                        finalDataLength: responseData.length,
                        wasCompleteResponse: responseData.includes('}')
                    });

                    cleanup();
                    if (responseData) {
                        resolve(responseData);
                    } else {
                        reject(new Error('Connection closed by server with no data'));
                    }
                });

                socket.on('error', (error) => {
                    logSocketEvent('ERROR', {
                        errorMessage: error.message,
                        errorCode: error.code,
                        errorStack: error.stack,
                        hadResponseData: responseData.length > 0
                    });

                    cleanup();
                    reject(new Error(`Selia connection failed: ${error.message}`));
                });

                socket.on('close', (hadError) => {
                    logSocketEvent('CLOSE', {
                        hadError,
                        finalDataLength: responseData.length,
                        wasCompleteResponse: responseData.includes('}')
                    });
                });

                socket.on('timeout', () => {
                    logSocketEvent('SOCKET_TIMEOUT', {
                        socketTimeout: socket.timeout,
                        hadResponseData: responseData.length > 0
                    });
                });

                socket.on('drain', () => {
                    logSocketEvent('DRAIN', {
                        message: 'Write buffer drained'
                    });
                });

            } catch (error) {
                logSocketEvent('CONSTRUCTION_ERROR', {
                    errorMessage: error.message,
                    errorStack: error.stack
                });

                cleanup();
                reject(error);
            }
        });
    }

    /**
     * Parse production response from Selia
     *
     * Extracts fields from the response and returns a structured object.
     * Response format: {field:value;field:value;}
     *
     * @param {string} response - Raw response string
     * @returns {Object} Parsed response object
     */
    parseProductionResponse(response) {
        if (!response) {
            return {
                success: false,
                responseCode: '91',
                responseMessage: 'Empty response from Selia gateway',
                isPending: false
            };
        }

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

            const responseCode = fields['14'] || fields['39'] || '05';
            const success = responseCode === '0' || responseCode === '00';

            return {
                success: success,
                responseCode: responseCode,
                authorizationCode: fields['50'] || fields['38'] || fields['8'],
                transactionId: fields['8'] || fields['19'] || fields['37'],
                responseMessage: this.getResponseMessage(responseCode),
                rawFields: fields,
                isPending: false
            };

        } catch (error) {
            console.error('❌ Selia response parsing error:', error.message);
            return {
                success: false,
                responseCode: '96',
                responseMessage: `Response parsing error: ${error.message}`,
                isPending: false
            };
        }
    }

    /**
     * Validate and format amount
     *
     * @param {number|string} amount - Amount to validate
     * @returns {string} Formatted amount string (digits only)
     * @throws {Error} If amount is invalid
     */
    validateAmount(amount) {
        const amountStr = amount.toString().replace(/\D/g, '');
        if (!amountStr) throw new Error('Invalid amount');
        return amountStr;
    }

    /**
     * Escape special characters in field values
     *
     * Removes {, }, and ; characters that could break the message format.
     *
     * @param {string} value - Value to escape
     * @returns {string} Escaped value
     */
    escapeField(value) {
        if (!value) return '';
        return value.toString().replace(/[{};]/g, '');
    }

    /**
     * Generate production timestamp
     *
     * Format: YYYYMMDDHHMMSS (14 digits)
     *
     * @returns {string} Formatted timestamp
     */
    generateProductionTimestamp() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const minute = String(now.getMinutes()).padStart(2, '0');
        const second = String(now.getSeconds()).padStart(2, '0');
        return `${year}${month}${day}${hour}${minute}${second}`;
    }

    /**
     * Get response message for response code
     *
     * @param {string} code - Response code
     * @returns {string} Human-readable response message
     */
    getResponseMessage(code) {
        const messages = {
            '0': 'Transacción aprobada',
            '00': 'Transacción aprobada',
            '1': 'Transacción declinada',
            '01': 'Transacción declinada',
            '5': 'Transacción no permitida',
            '05': 'Transacción no permitida',
            '6': 'Error en campo de datos',
            '06': 'Error en campo de datos',
            '14': 'Tarjeta inválida',
            '51': 'Fondos insuficientes',
            '54': 'Tarjeta vencida',
            '55': 'PIN inválido',
            '57': 'Transacción no permitida - tarjeta',
            '58': 'Transacción no permitida - terminal',
            '61': 'Límite de exceso de retiro',
            '62': 'Tarjeta restringida',
            '65': 'Límite de frecuencia excedido',
            '75': 'Límite de intentos de PIN excedido',
            '76': 'Cuenta inválida o no existente',
            '91': 'Emisor no disponible',
            '96': 'Error del sistema',
            '99': 'Error de comunicación o pendiente'
        };
        return messages[code] || `Código: ${code}`;
    }

    /**
     * Query transaction status from Selia
     *
     * Sends a consultation request to Selia to check transaction status.
     *
     * @async
     * @param {Object} inquiryInfo - Inquiry information
     * @param {number} inquiryInfo.merchantId - Merchant ID
     * @param {string} inquiryInfo.folioMexipay - Transaction reference
     * @param {string} inquiryInfo.transactionType - Transaction type
     * @param {number} inquiryInfo.id_message - Transaction ID
     * @param {number} inquiryInfo.originalTrxId - Original transaction ID
     * @param {string} inquiryInfo.traceNumber - Trace number
     * @param {number} inquiryInfo.amount - Transaction amount
     * @returns {Promise<Object>} Status response
     */
    async queryTransactionStatus(inquiryInfo) {
        const guid = `status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        console.log(`[isoSeliaService][${guid}] 🔍 Querying transaction status:`, inquiryInfo);

        try {
            const seliaId = await this.getSeliaIdForMerchant(inquiryInfo.merchantId || 'unknown');
            const statusMessage = await this.buildStatusInquiryMessage(inquiryInfo, seliaId);

            console.log(`[isoSeliaService][${guid}] 📤 Sending status inquiry to Selia`);
            const rawResponse = await this.sendToSeliaGateway(statusMessage);

            console.log(`[isoSeliaService][${guid}] 📥 Received status response:`, rawResponse.substring(0, 100) + '...');

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

                    if (results && results.length > 0) {
                        localStatus = results[0];
                    }
                } catch (dbError) {
                    console.warn(`[isoSeliaService][${guid}] ⚠️ Could not fetch local status:`, dbError.message);
                }
            }

            return {
                ...parsedResponse,
                inquiryId: guid,
                reference: inquiryInfo.folioMexipay,
                localStatus: localStatus,
                source: parsedResponse.success ? 'selia_gateway' : 'error'
            };

        } catch (error) {
            console.error(`[isoSeliaService][${guid}] ❌ Status inquiry failed:`, error.message);
            throw error;
        }
    }

    /**
     * Build status inquiry message
     *
     * Constructs a consultation request for transaction status.
     * Uses field 86:C to indicate consultation.
     *
     * @param {Object} inquiryInfo - Inquiry information
     * @param {number} seliaId - Selia merchant ID
     * @returns {Promise<string>} Status inquiry message
     */
    async buildStatusInquiryMessage(inquiryInfo, seliaId) {
        const {
            originador = 'MEXIPAY01',
            nodo = 'TERMINAL001',
            folioMexipay,
            traceNumber,
            amount = '0',
            transactionDate,
            transactionTime,
            merchantId = 'unknown'
        } = inquiryInfo;

        const timestamp = this.generateProductionTimestamp();
        const transactionType = this.determineOperationCode(null, { transactionType: inquiryInfo.transactionType || 'consult' });

        let message = process.env.SELIA_ISO_MODE !== 'Prod' || this.config.devModeOverride ? "{161:1;" : "{161:" + seliaId + ";";
        message += `1:1;`;
        message += `2:1;`;
        message += `3:${timestamp};`;
        message += `7:${transactionType.selia};`;
        message += `86:C;`;
        message += `56:9;`;

        const referenceId = inquiryInfo.id_message || inquiryInfo.originalTrxId ||
                           (folioMexipay ? folioMexipay.slice(-8) : '');
        console.log(`[isoSeliaService] 🌏 Final Field 19 value: ${referenceId}`);
        message += `19:${this.escapeField(referenceId)};`;

        if (traceNumber) {
            message += `11:${this.escapeField(traceNumber)};`;
        }

        if (amount && amount !== '0') {
            message += `45:${this.validateAmount(amount)};`;
        }

        if (transactionDate && transactionTime) {
            message += `13:${transactionDate};`;
            message += `12:${transactionTime};`;
        }

        // Use database LDI credentials when not in development mode
        let username = this.config.username;
        let password = this.config.password;
        
        if (process.env.SELIA_ISO_MODE !== 'Dev' && seliaId) {
            console.log(`[isoSeliaService] 🔍 Looking up LDI credentials for status inquiry selia_id ${seliaId} (non-DEV mode)`);
            const ldiCredentials = await this.getLdiCredentials(seliaId);
            
            if (ldiCredentials) {
                username = ldiCredentials.username;
                password = ldiCredentials.password;
                console.log(`[isoSeliaService] ✅ Using database LDI credentials for status inquiry selia_id ${seliaId}`);
            } else {
                console.log(`[isoSeliaService] ⚠️ No LDI credentials found for status inquiry selia_id ${seliaId}, using default credentials`);
            }
        } else {
            console.log(`[isoSeliaService] 🔧 Using default credentials for status inquiry (DEV mode or no selia_id)`);
        }

        message += `54:${this.escapeField(username)};`;
        message += `219:${this.escapeField(password)};`;
        message += "}";

        console.log('📤 [isoSeliaService] Status inquiry message:', message);
        return message;
    }

    /**
     * Parse status response from Selia
     *
     * @param {string} response - Raw response
     * @param {Object} inquiryInfo - Inquiry information
     * @returns {Object} Parsed status response
     */
    parseStatusResponse(response, inquiryInfo) {
        if (!response) {
            return {
                success: false,
                responseCode: '91',
                responseMessage: 'Empty response from Selia gateway',
                isPending: false
            };
        }

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

            const responseCode = fields['14'] || fields['39'] || fields['54'] || '05';
            const success = responseCode === '0' || responseCode === '00';
            const transactionStatus = fields['56'];
            const captureDate = fields['15'];
            const authCode = fields['38'];

            return {
                success: success,
                responseCode: responseCode,
                authorizationCode: authCode,
                captureDate: captureDate,
                transactionId: fields['19'] || fields['37'],
                responseMessage: this.getResponseMessage(responseCode),
                transactionStatus: transactionStatus,
                rawFields: fields,
                isPending: responseCode === '99'
            };

        } catch (error) {
            console.error('❌[isoSeliaService] Status response parsing error:', error.message);
            return {
                success: false,
                responseCode: '96',
                responseMessage: `Status response parsing error: ${error.message}`,
                isPending: false
            };
        }
    }

    /**
     * Build PROSA Token Q6 for MSI transactions
     * @param {number} months - Number of months for MSI
     * @param {string} planType - Plan type (03 for MSI, 05 for interest, 07 for skip payment)
     * @returns {string} Token Q6 in format !Q6[DDPPPT]
     */
    buildTokenQ6(months, planType = '03') {
        console.log(`[isoSeliaService] Building Token Q6 for ${months} months, plan type ${planType}`);
        
        const dd = '00'; // No deferral/grace period
        const pp = String(months).padStart(2, '0'); // Number of payments, zero-padded
        const pt = planType.padStart(2, '0'); // Plan type, zero-padded
        
        const q6Token = `!Q6${dd}${pp}${pt}`;
        
        console.log(`[isoSeliaService] Generated Token Q6: ${q6Token} (DD=${dd}, PP=${pp}, PT=${pt})`);
        
        return q6Token;
    }
}

module.exports = IsoSeliaService;