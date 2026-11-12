const crypto = require('crypto');

async function generateTKA(tkr, tms, afiliation_number) {
    const secretKey = process.env.TKA_SECRET_KEY || 'your-super-secure-256-bit-key-change-this-in-production';

    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(tkr + tms + afiliation_number);

    return hmac.digest('base64');
}

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