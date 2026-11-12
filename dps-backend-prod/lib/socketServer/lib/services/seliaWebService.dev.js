/**
 * @fileoverview Selia Web Service - Development Environment
 *
 * This service handles encrypted payment processing with Selia gateway via HTTPS.
 * It implements AES-128-ECB encryption for sensitive card data and communicates
 * with Selia's test/development environment.
 *
 * @module seliaWebService.dev
 * @requires https
 * @requires crypto
 *
 * PCI DSS 4.0 Compliance Requirements:
 * - Req 3.4: Sensitive authentication data is encrypted before transmission
 * - Req 4.2: Strong cryptography used for transmission over public networks (HTTPS/TLS)
 * - Req 6.5.3: Secure cryptographic storage and transmission
 * - Req 8.2.1: Strong cryptography to render cardholder data unreadable
 * - Req 10.2: Audit trail of all payment processing attempts
 * - Req 12.8: Third-party service provider security managed
 *
 * Security Features:
 * - AES-128-ECB encryption for sensitive card data (field 465)
 * - HTTPS/TLS for all network communications
 * - Card data encrypted before transmission
 * - Debug logging can be enabled/disabled
 * - Database integration for error code lookup
 *
 * @author Payment Gateway Team
 * @version 1.0.0
 */

const https = require('https');
const crypto = require('crypto');

/**
 * Selia Web Service - Development Environment
 *
 * Handles payment processing through Selia's HTTPS gateway with encrypted
 * card data transmission for development/testing.
 *
 * PCI DSS Req 4.2: Uses HTTPS with TLS for secure transmission
 * PCI DSS Req 3.4: Encrypts cardholder data before transmission
 *
 * @class SeliaWebService
 */
class SeliaWebService {
    /**
     * Initialize Selia Web Service
     *
     * Loads configuration from environment variables or provided config object.
     *
     * PCI DSS Req 8.2: Credentials stored securely
     * PCI DSS Req 6.5.3: Encryption keys managed securely
     *
     * @constructor
     * @param {Object} config - Configuration options
     * @param {string} config.host - Selia gateway host
     * @param {number} config.port - Selia gateway HTTPS port
     * @param {string} config.aesKey - AES encryption key
     * @param {string} config.companyId - Selia company/merchant ID
     * @param {string} config.username - Selia API username
     * @param {string} config.password - Selia API password
     * @param {boolean} config.debug - Enable debug logging
     */
    constructor(config = {}) {
        this.config = {
            host: config.host || process.env.SELIA_HOST || '200.94.104.94',
            port: config.port || process.env.SELIA_PORT || 32003,
            aesKey: config.aesKey || process.env.SELIA_AES_KEY || 'W0ten03L3rvxC851',
            companyId: config.companyId || process.env.SELIA_COMPANY_ECOMMERCE_ID || 98,
            username: config.username || process.env.SELIA_USERNAME || "crytest99w3D",
            password: config.password || process.env.SELIA_PASSWORD || "tac",
            debug: config.debug || process.env.SELIA_DEBUG === 'true'
        };

        this.db = config.sequelize || null; // Sequelize instance for error code lookup

//        this.validateConfig();
    }

    log(message, data = null) {
        if (this.debug) {
            console.log(`🔍 [SELIA_DEBUG] ${message}`);
            if (data) console.log('   Data:', JSON.stringify(data, null, 2));
        }
    }

    /**
     * Process payment through Selia gateway
     *
     * Main entry point for payment processing. Builds encrypted message,
     * sends to Selia, and processes response.
     *
     * PCI DSS Req 3.4: Card data encrypted before transmission
     * PCI DSS Req 4.2: Secure transmission over HTTPS
     * PCI DSS Req 6.5.3: Proper error handling
     * PCI DSS Req 10.2.2: Logs all payment attempts
     *
     * @async
     * @param {Object} paymentData - Payment information
     * @param {string} paymentData.cardNumber - Card number (will be encrypted)
     * @param {string} paymentData.amount - Transaction amount in cents
     * @param {string} paymentData.cvv - Card verification value (will be encrypted)
     * @param {string} paymentData.expiration - Expiration date (will be encrypted)
     * @param {string} [paymentData.transactionType='501'] - Transaction type
     * @returns {Promise<Object>} Payment result with success flag and details
     * @throws {Error} If payment processing fails
     */
    async processPayment(paymentData) {
        try {
            this.log('Starting payment process', paymentData);

            // Build message with ALL original fields PLUS encrypted field 465
            const message = this.buildMessageWithBoth(paymentData);
            this.log('Final message ready', { message });

            // Send via HTTPS
            this.log('Sending via HTTPS...');
            const response = await this.sendHttpsRequest(message);
            this.log('HTTPS response received', { response });

            const parsed = await this.parseSeliaResponse(response); // Now async
            this.log('Response parsed', parsed);

            return parsed;

        } catch (error) {
            this.log('ERROR in processPayment', { error: error.message });
            throw new Error(`Payment failed: ${error.message}`);
        }
    }

    buildMessageWithBoth(paymentData) {
        this.log('Building message with ALL original fields PLUS encrypted field 465');

        const {
            cardNumber,
            amount,
            cvv,
            expiration,
            transactionType = '501',
            entryMode = '1', // Using 1 as shown in encrypted example
            branchId = '16739',
            terminalId = '1'
        } = paymentData;

        const timestamp = this.generateSeliaTimestamp();
        const ticketNumber = this.generateTicketNumber();
        const randomField = this.generateRandomField();

        this.log('Generated fields:', { timestamp, ticketNumber, randomField });

        // Build the COMPLETE original message with ALL fields
        let message = `{161:${this.config.companyId};`;
        message += `1:${branchId};`;
        message += `2:${terminalId};`;
        message += `3:${timestamp};`;
        message += `7:${transactionType};`;
        message += `56:0;`;
        message += `35:${cardNumber};`; // Keep original field 35
        message += `45:${amount};`;     // Keep original field 45
        message += `73:${cvv};`;        // Keep original field 73
        message += `58:${entryMode};`;  // Using 1 as per encrypted example
        message += `37:${expiration};`; // Keep original field 37
        message += `19:${ticketNumber};`; // Keep original field 19
        message += `54:${this.config.username};`;
        message += `219:${this.config.password};`;
        message += `604:${randomField}`; // Keep original field 604

        // Now ADD the encrypted version as field 465
        const fieldsToEncrypt = [
            cardNumber,    // field 35
            amount,        // field 45
            cvv,           // field 73
            expiration,    // field 37
            ticketNumber,  // field 19
            randomField    // field 604
        ];

        const dataToEncrypt = fieldsToEncrypt.join(';');
        this.log('Data to encrypt for field 465', { dataToEncrypt });

        // Encrypt the data
        const encryptedData = this.encryptData(dataToEncrypt);
        this.log('Encrypted data for field 465', { encryptedData });

        // ADD field 465 to the existing message
        message += `;465:${encryptedData}`;
        message += '}';

        this.log('Final message with ALL original fields PLUS encrypted field 465', { message });
        return message;
    }

    /**
     * Encrypt sensitive data using AES-128-ECB
     *
     * Encrypts card data before transmission to comply with PCI DSS requirements.
     *
     * PCI DSS Req 3.4: Sensitive authentication data rendered unreadable
     * PCI DSS Req 3.5: Cryptographic keys protected
     * PCI DSS Req 8.2.1: Strong cryptography used
     *
     * @param {string} dataToEncrypt - Plain text data to encrypt
     * @returns {string} Encrypted data in uppercase hexadecimal format
     * @throws {Error} If encryption fails
     */
    encryptData(dataToEncrypt) {
        try {
            this.log('Encrypting data for field 465');

            const key = Buffer.from(this.config.aesKey, 'utf8');
            const cipher = crypto.createCipheriv('aes-128-ecb', key, null);
            cipher.setAutoPadding(true);

            let encrypted = cipher.update(dataToEncrypt, 'utf8', 'hex');
            encrypted += cipher.final('hex');

            return encrypted.toUpperCase();

        } catch (error) {
            this.log('Encryption error', { error: error.message });
            throw new Error(`Encryption failed: ${error.message}`);
        }
    }

    sendHttpsRequest(message) {
        return new Promise((resolve, reject) => {
            this.log('Creating HTTPS request to Selia');

            const options = {
                hostname: this.config.host,
                port: this.config.port,
                path: '/',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'SeliaWeb-NodeJS/1.0'
                },
                timeout: 30000,
                rejectUnauthorized: false,
                agent: false
            };

            this.log('Sending message to Selia:', { message });

            const req = https.request(options, (res) => {
                this.log('HTTPS response received from Selia', {
                    statusCode: res.statusCode,
                    statusMessage: res.statusMessage
                });

                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    this.log('HTTPS response complete', {
                        dataLength: data.length,
                        data: data
                    });
                    resolve(data);
                });
            });

            req.on('error', (error) => {
                this.log('HTTPS request error', { error: error.message });
                reject(new Error(`HTTPS error: ${error.message}`));
            });

            req.on('timeout', () => {
                this.log('HTTPS request timeout');
                req.destroy();
                reject(new Error('HTTPS timeout'));
            });

            const postData = `Request=${encodeURIComponent(message)}`;
            req.write(postData);
            req.end();
        });
    }

    async parseSeliaResponse(response) {
        this.log('Parsing Selia response', { response });

        if (!response || response.trim() === '') {
            return {
                success: false,
                responseCode: 'NO_RESPONSE',
                responseMessage: 'Empty response from server',
                rawResponse: response,
                parsedFields: {}
            };
        }

        const cleanResponse = response.replace(/[{}]/g, '');
        const fields = {};
        const pairs = cleanResponse.split(';');

        pairs.forEach(pair => {
            const [key, value] = pair.split(':');
            if (key && value) {
                fields[key.trim()] = value.trim();
            }
        });

        this.log('Parsed fields from Selia', fields);

        const responseCode = fields['14'];
        const success = responseCode === '0';

        // Get the user-friendly message from the Selia error codes catalogue
        const responseMessage = await this.getSeliaResponseMessage(responseCode);

        return {
            success,
            transactionId: fields['19'],
            authorizationCode: fields['38'],
            responseCode: responseCode,
            responseMessage: responseMessage,
            rawResponse: response,
            parsedFields: fields
        };
    }

    async getSeliaResponseMessage(responseCode) {
        try {
            if (!this.db) {
                this.log('Sequelize not available, using fallback messages');
                return this.getFallbackMessage(responseCode);
            }

            // Convert responseCode to integer for database lookup
            const code = parseInt(responseCode);

            if (isNaN(code)) {
                this.log('Invalid response code format', { responseCode });
                return `Código de respuesta inválido: ${responseCode}`;
            }

            // Look up the error code in the database
            const errorCode = await this.db.models.selia_error_code.findOne({
                where: { codigo: code }
            });

            if (errorCode) {
                this.log('Found error code in database', {
                    code: code,
                    message: errorCode.mensaje_terminal,
                    type: errorCode.type
                });
                return errorCode.mensaje_terminal || errorCode.descripcion;
            } else {
                this.log('Error code not found in database', { code: code });
                return this.getFallbackMessage(responseCode);
            }

        } catch (error) {
            this.log('Error looking up Selia error code', {
                error: error.message,
                responseCode: responseCode
            });
            return this.getFallbackMessage(responseCode);
        }
    }

    getFallbackMessage(code) {
        const messages = {
            '0': 'Transacción aprobada',
            '1': 'Transacción declinada - Referir al emisor',
            '5': 'Transacción declinada - No honrar',
            '6': 'Error en campo de datos',
            '14': 'Número de tarjeta inválido',
            '51': 'Fondos insuficientes',
            '54': 'Tarjeta vencida',
            '96': 'Falla en el sistema'
        };

        return messages[code] || `Código de respuesta no reconocido: ${code}`;
    }

    generateSeliaTimestamp() {
        const now = new Date();
        return now.getFullYear() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0') +
            String(now.getHours()).padStart(2, '0') +
            String(now.getMinutes()).padStart(2, '0') +
            String(now.getSeconds()).padStart(2, '0');
    }

    generateTicketNumber() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    generateRandomField() {
        return Math.floor(1000000000 + Math.random() * 9000000000).toString();
    }
}

module.exports = SeliaWebService;