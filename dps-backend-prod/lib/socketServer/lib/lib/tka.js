const crypto = require('crypto');

/**
 * Generates a TKA (token de autenticación) using HMAC-SHA256.
 * PCI DSS 4.0: Req 8.3.1 / 8.3.6 (strong authentication token).
 * @param {string} tkr - Merchant token_activation (shared secret component).
 * @param {string} tms - Timestamp/nonce from the request.
 * @param {string} afiliation_number - Merchant affiliation number.
 * @returns {Promise<string>} Base64-encoded HMAC-SHA256 digest.
 */
async function generateTKA(tkr, tms, afiliation_number) {
    const secretKey = process.env.TKA_SECRET_KEY || '=your-super-secure-256-bit-key-change-this-in-production';

    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(tkr + tms + afiliation_number);

    return hmac.digest('base64');
}

/**
 * Validates a received TKA against the expected HMAC-SHA256 value.
 * Uses crypto.timingSafeEqual to prevent timing side-channel attacks.
 * PCI DSS 4.0: Req 8.3.2 / 8.3.6 (token validation), Req 6.5.2 (secure coding).
 * @param {string} tkr - Merchant token_activation.
 * @param {string} tms - Timestamp/nonce from the request.
 * @param {string} afiliation_number - Merchant affiliation number.
 * @param {string} receivedTKA - Token received from the client.
 * @returns {Promise<boolean>} True if the token is valid.
 */
async function validateTKA(tkr, tms, afiliation_number, receivedTKA) {
    try {
        const expectedTKA = await generateTKA(tkr, tms, afiliation_number);
        return crypto.timingSafeEqual(
            Buffer.from(expectedTKA),
            Buffer.from(receivedTKA)
        );
    } catch (error) {
        console.error('TKA Validation Error:', error);
        return false;
    }
}

exports.generateTKA = generateTKA;
exports.validateTKA = validateTKA;