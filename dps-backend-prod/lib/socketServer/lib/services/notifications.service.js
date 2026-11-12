/**
 * Notifications Service
 * Handles SMS and WhatsApp notifications via external service
 *
 * PCI DSS 4.0 Requirements Covered:
 * - Req 4.2: Ensures secure transmission of notification data via HTTPS
 * - Req 8.2.1: Uses strong cryptography (SHA-256) for password hashing
 * - Req 10.2: Supports audit trail through transaction notifications
 * - Req 12.10: Enables incident response via multi-channel notifications
 */

const axios = require('axios');
const crypto = require('crypto');

const username   = process.env.INVOICER_USERNAME || '';
const password   = process.env.INVOICER_PASSWORD || '';
const urlService = process.env.INVOICER_URL || '';

/**
 * Prepare password hash for authentication
 * PCI DSS 4.0: Req 8.2.1 - Uses SHA-256 hashing for credential security
 * @param {string} password - Plain text password
 * @returns {string} Base64-encoded SHA-256 hash
 */
const preparePassword = (password) => {
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    return Buffer.from(passwordHash).toString('base64');
}

const getToken = async () => {

    const passwordHashed   = preparePassword(password);
    const bodyRequest = { username, password : passwordHashed };
    try {
        const result = await axios.post(`${urlService}api/auth/login`, bodyRequest );
        return result.data.token;

    } catch (error) {
        dd(error.stack, 'error');
        return '';
    }
}

const getHeadersToken = (token) => {
    const config = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        }
    };
    return config;
}

/**
 * Send WhatsApp notification
 * PCI DSS 4.0: Req 4.2 - Transmits notifications securely via HTTPS
 * @param {string} message - Message content
 * @param {string} to - Recipient phone number
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @returns {Promise<object>} HTTP response with send result
 */
const sendWhatsappProcess = async (message, to, req, res) => {

    const token = await getToken();

    if (token == ''){
        return res.status(400).json({ message : `No ha sido posible enviar la notificación por Whatsapp`, success: false });
    }

    const config        = getHeadersToken(token);
    const data          = {
        "message" : message,
        "to"      : to
    };

    try {
        const url = `${urlService}api/whatsapp`
        await axios.post( url, data, config );
        return res.status(200).json({ message : `Whatsapp enviado.`, success: true });

    } catch (error) {
        dd(` no se ha podido enviar notificación por Whatsapp para  ${data.to}`, 'error');
        const errorMessage = ( error?.errno  && error.errno == -4078) 
        ? 'No se ha podido conectar al servicio de notificaciones..'
        : error.response.data ;

        return res.status(400).json({ message : errorMessage, success: false });
    }

}

/**
 * Send SMS notification
 * PCI DSS 4.0: Req 4.2 - Transmits notifications securely via HTTPS
 * @param {string} message - Message content
 * @param {array} numbers - Array of recipient phone numbers
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @returns {Promise<object>} HTTP response with send result
 */
const sendSmsProcess = async (message, numbers, req, res ) => {

    const token = await getToken();

    if (token == ''){
        return res.status(400).json({ message : `No ha sido posible enviar la notificación por SMS`, success: false });
    }

    const config        = getHeadersToken(token);
    const data          = {
            "message" : message,
            "numbers" : numbers
        };

    try {
        const url = `${urlService}api/sms`
        await axios.post( url, data, config );
        return res.status(200).json({ message : `SMS enviado.`, success: true });
    } catch (error) {
        dd(` no se ha podido enviar notificación para  ${data.numbers.join(', ')}`, 'error');
        const errorMessage = ( error?.errno  && error.errno == -4078) 
        ? 'No se ha podido conectar al servicio de notificaciones..'
        : error.response.data ;
        return res.status(400).json({ message : errorMessage, success: false });
    }

}

module.exports = { sendWhatsappProcess, sendSmsProcess };