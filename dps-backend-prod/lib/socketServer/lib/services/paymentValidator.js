/**
 * @fileoverview Payment Payload Validator - Validates incoming payment requests
 * against the BlissCore Integration Guide specification.
 *
 * Validates the full payload structure and returns documented error codes:
 *   - missing_fields: Required fields not present
 *   - invalid_amount: Amount not a positive number
 *   - invalid_card: Card number not 16 digits or not VISA/Mastercard
 *   - invalid_expiry: Expiration month/year out of range or expired
 *   - invalid_cvv: CVV not 3 digits
 *
 * @module paymentValidator
 */

/**
 * Validates the full affiliate payment payload (nested structure).
 *
 * Expected payload:
 *   {
 *     affiliate_code: string,
 *     order_id: string,
 *     amount: number,
 *     currency: string,
 *     description: string,
 *     card: { number, exp_month, exp_year, cvv, holder_name },
 *     customer: { name, email },
 *     billing_address: { street, city, state, country, postal_code }
 *   }
 *
 * @param {Object} body - Request body
 * @returns {Object} { valid: boolean, error?: { code, message }, status?: number }
 */
function validateAffiliatePaymentPayload(body) {
    const errors = [];

    // --- Required top-level fields ---
    const requiredTop = ['affiliate_code', 'order_id', 'amount', 'card'];
    for (const field of requiredTop) {
        if (body[field] === undefined || body[field] === null || body[field] === '') {
            errors.push(field);
        }
    }

    if (errors.length > 0) {
        return {
            valid: false,
            status: 400,
            error: {
                code: 'missing_fields',
                message: `Faltan campos requeridos: ${errors.join(', ')}`
            }
        };
    }

    // --- Amount validation ---
    const amount = parseFloat(body.amount);
    if (isNaN(amount) || amount <= 0) {
        return {
            valid: false,
            status: 400,
            error: {
                code: 'invalid_amount',
                message: 'Monto inválido. Debe ser un número positivo con hasta 2 decimales.'
            }
        };
    }

    // --- Currency validation (optional, defaults to MXN) ---
    const currency = (body.currency || 'MXN').toUpperCase();
    if (currency !== 'MXN') {
        return {
            valid: false,
            status: 400,
            error: {
                code: 'invalid_currency',
                message: 'Moneda no soportada. Solo se acepta MXN (Pesos Mexicanos).'
            }
        };
    }

    // --- Card object validation ---
    const card = body.card;
    if (typeof card !== 'object' || card === null) {
        return {
            valid: false,
            status: 400,
            error: {
                code: 'missing_fields',
                message: 'Falta el objeto card con los datos de la tarjeta.'
            }
        };
    }

    const cardErrors = [];
    if (!card.number) cardErrors.push('card.number');
    if (!card.exp_month) cardErrors.push('card.exp_month');
    if (!card.exp_year) cardErrors.push('card.exp_year');
    if (!card.cvv) cardErrors.push('card.cvv');

    if (cardErrors.length > 0) {
        return {
            valid: false,
            status: 400,
            error: {
                code: 'missing_fields',
                message: `Faltan campos requeridos: ${cardErrors.join(', ')}`
            }
        };
    }

    // --- Card number validation ---
    const cleanCard = String(card.number).replace(/\D/g, '');
    if (!/^\d{16}$/.test(cleanCard)) {
        return {
            valid: false,
            status: 400,
            error: {
                code: 'invalid_card',
                message: 'Tarjeta inválida. El número debe ser de 16 dígitos.'
            }
        };
    }

    // --- Card brand validation (VISA or Mastercard only) ---
    const firstDigit = cleanCard.charAt(0);
    const firstTwo = cleanCard.substring(0, 2);
    const isVisa = firstDigit === '4';
    const isMastercard = firstTwo >= '51' && firstTwo <= '55';
    if (!isVisa && !isMastercard) {
        return {
            valid: false,
            status: 400,
            error: {
                code: 'invalid_card',
                message: 'Tarjeta no soportada. Solo se aceptan tarjetas VISA y MASTERCARD nacionales.'
            }
        };
    }

    // --- Expiration validation ---
    const expMonth = parseInt(card.exp_month);
    const expYear = parseInt(card.exp_year);

    if (isNaN(expMonth) || expMonth < 1 || expMonth > 12) {
        return {
            valid: false,
            status: 400,
            error: {
                code: 'invalid_expiry',
                message: 'Fecha de expiración inválida. El mes debe estar entre 01 y 12.'
            }
        };
    }

    if (isNaN(expYear) || expYear < 2000) {
        return {
            valid: false,
            status: 400,
            error: {
                code: 'invalid_expiry',
                message: 'Fecha de expiración inválida. El año debe ser válido (ej: 2025).'
            }
        };
    }

    // Check if card is expired
    const now = new Date();
    const expDate = new Date(expYear, expMonth - 1, 1);
    expDate.setMonth(expDate.getMonth() + 1); // End of expiration month
    if (expDate < now) {
        return {
            valid: false,
            status: 400,
            error: {
                code: 'expired_card',
                message: 'La tarjeta ha expirado. Usa una fecha de expiración vigente.'
            }
        };
    }

    // --- CVV validation ---
    const cvvStr = String(card.cvv).replace(/\D/g, '');
    if (!/^\d{3,4}$/.test(cvvStr)) {
        return {
            valid: false,
            status: 400,
            error: {
                code: 'invalid_cvv',
                message: 'CVV inválido. Debe ser de 3 o 4 dígitos.'
            }
        };
    }

    // --- order_id length validation ---
    if (String(body.order_id).length > 50) {
        return {
            valid: false,
            status: 400,
            error: {
                code: 'invalid_order_id',
                message: 'order_id inválido. Máximo 50 caracteres.'
            }
        };
    }

    return { valid: true };
}

/**
 * Validates flat payment fields (used by /payment/selia and api.routes.js endpoints
 * where card data comes as individual fields from the frontend).
 *
 * @param {Object} params - Flat payment fields
 * @param {string} params.tarjeta - Card number (may contain dashes)
 * @param {string} params.venci - Expiration in MM/YY format
 * @param {string} params.cvv - CVV code
 * @param {number} params.monto - Amount
 * @returns {Object} { valid: boolean, error?: { code, message }, status?: number }
 */
function validateFlatPaymentFields(params) {
    const { tarjeta, venci, cvv, monto } = params;

    const errors = [];
    if (!tarjeta) errors.push('tarjeta');
    if (!venci) errors.push('venci');
    if (!cvv) errors.push('cvv');
    if (monto === undefined || monto === null) errors.push('monto');

    if (errors.length > 0) {
        return {
            valid: false,
            status: 400,
            error: {
                code: 'missing_fields',
                message: `Faltan campos requeridos: ${errors.join(', ')}`
            }
        };
    }

    // --- Amount validation ---
    const amount = parseFloat(monto);
    if (isNaN(amount) || amount <= 0) {
        return {
            valid: false,
            status: 400,
            error: {
                code: 'invalid_amount',
                message: 'Monto inválido. Debe ser un número positivo.'
            }
        };
    }

    // --- Card number validation ---
    const cleanCard = String(tarjeta).split('-').join('').replace(/\D/g, '');
    if (!/^\d{16}$/.test(cleanCard)) {
        return {
            valid: false,
            status: 400,
            error: {
                code: 'invalid_card',
                message: 'Tarjeta inválida. El número debe ser de 16 dígitos.'
            }
        };
    }

    // --- Card brand validation ---
    const firstDigit = cleanCard.charAt(0);
    const firstTwo = cleanCard.substring(0, 2);
    const isVisa = firstDigit === '4';
    const isMastercard = firstTwo >= '51' && firstTwo <= '55';
    if (!isVisa && !isMastercard) {
        return {
            valid: false,
            status: 400,
            error: {
                code: 'invalid_card',
                message: 'Tarjeta no soportada. Solo se aceptan VISA y MASTERCARD nacionales.'
            }
        };
    }

    // --- Expiration validation (MM/YY format) ---
    const parts = String(venci).split('/');
    if (parts.length !== 2) {
        return {
            valid: false,
            status: 400,
            error: {
                code: 'invalid_expiry',
                message: 'Fecha de expiración inválida. Use formato MM/YY.'
            }
        };
    }

    let expMonth, expYear;
    if (parseInt(parts[0]) > 12) {
        expYear = parseInt(parts[0]);
        expMonth = parseInt(parts[1]);
    } else {
        expMonth = parseInt(parts[0]);
        expYear = parseInt(parts[1]);
    }

    if (isNaN(expMonth) || expMonth < 1 || expMonth > 12) {
        return {
            valid: false,
            status: 400,
            error: {
                code: 'invalid_expiry',
                message: 'Fecha de expiración inválida. El mes debe estar entre 01 y 12.'
            }
        };
    }

    // Normalize 2-digit year to 4-digit
    const fullYear = expYear < 100 ? 2000 + expYear : expYear;

    if (isNaN(fullYear) || fullYear < 2000) {
        return {
            valid: false,
            status: 400,
            error: {
                code: 'invalid_expiry',
                message: 'Fecha de expiración inválida. El año no es válido.'
            }
        };
    }

    // Check if expired
    const now = new Date();
    const expDate = new Date(fullYear, expMonth - 1, 1);
    expDate.setMonth(expDate.getMonth() + 1);
    if (expDate < now) {
        return {
            valid: false,
            status: 400,
            error: {
                code: 'expired_card',
                message: 'La tarjeta ha expirado. Usa una fecha de expiración vigente.'
            }
        };
    }

    // --- CVV validation ---
    const cvvStr = String(cvv).replace(/\D/g, '');
    if (!/^\d{3,4}$/.test(cvvStr)) {
        return {
            valid: false,
            status: 400,
            error: {
                code: 'invalid_cvv',
                message: 'CVV inválido. Debe ser de 3 o 4 dígitos.'
            }
        };
    }

    return { valid: true };
}

module.exports = {
    validateAffiliatePaymentPayload,
    validateFlatPaymentFields
};
