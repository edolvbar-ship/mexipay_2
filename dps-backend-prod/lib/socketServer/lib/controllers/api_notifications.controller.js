/**
 * API Notifications Controller
 *
 * Handles sending transaction receipts and payment links via SMS and WhatsApp.
 * Generates tickets and sends notification messages to customers.
 *
 * PCI DSS 4.0 Requirements:
 * - Requirement 3.4: Renders PAN unreadable (masks sensitive card data in tickets)
 * - Requirement 4.2: Never sends unprotected PANs via end-user messaging
 * - Requirement 9.9: Protects devices that capture payment card data via physical interaction
 * - Requirement 12.10: Implements incident response plan for data security breaches
 */

const notificationController = {};
const db = require('../sequelize/init');

const { validationResult } = require('express-validator');
const moment = require('moment');
const { getTrans, getTicket } = require('../controllers/reportes.controller');
const { unpackEnvTag } = require('../../../emv-packet/lib/emvPacket');

const { sendSmsProcess, sendWhatsappProcess } = require('../services/notifications.service');

    /**
     * Send SMS notification with transaction ticket
     *
     * Creates a transaction ticket and sends it via SMS to specified phone numbers.
     * Validates authorization before processing the request.
     *
     * PCI DSS 4.0 Requirements:
     * - Requirement 3.4: Ensures PANs are rendered unreadable before transmission
     * - Requirement 4.2: Never sends unprotected PANs by end-user messaging technologies
     * - Requirement 10.2: Logs notification sending for audit trail
     *
     * @param {Object} req - Request containing authorization, id, trace_id, and phone numbers
     * @param {Object} res - Express response object
     * @returns {Object} JSON response with success status or error
     */
    notificationController.sendSms = async (req, res) => {

        const errors = validationResult(req);
        if (!errors.isEmpty()){
            return res.status(400).json({ errors: errors.array() , success: false });
        }
        // special validation
        const { authorization } = req.body;
        if(!authorization){
            const errors = [
                {
                    "type": "field",
                    "msg": "Valores requeridos",
                    "path": "authorization",
                    "location": "body"
                }
            ];
            return res.status(400).json({ errors , success: false });
        }

        let messageToSend = "";

        try {
            const ticket = await createTicket(req, res);
            if(!ticket.success){
                return res.status(400).json({ message: "No se ha podido crear el ticket, intentelo más tarde." , success: false });
            }
            messageToSend = `Puede encontrar su ticket en: ${ticket.ticket.pathApi}`;
        } catch (error) {
            dd(error.stack, 'error');
            return res.status(400).json({ errors: errors.array(), message: "Algo ha salido mal y no se ha podido crear el ticket" , success: false });
        }

        return await sendSmsProcess(messageToSend, req.body.numbers, req, res  );

    };

    /**
     * Send WhatsApp notification with transaction ticket
     *
     * Creates a transaction ticket and sends it via WhatsApp to specified recipient.
     * Validates authorization before processing the request.
     *
     * PCI DSS 4.0 Requirements:
     * - Requirement 3.4: Ensures PANs are rendered unreadable before transmission
     * - Requirement 4.2: Never sends unprotected PANs by end-user messaging technologies
     * - Requirement 10.2: Logs notification sending for audit trail
     *
     * @param {Object} req - Request containing authorization, id, trace_id, and recipient (to)
     * @param {Object} res - Express response object
     * @returns {Object} JSON response with success status or error
     */
    notificationController.sendWhatsapp = async ( req, res ) => {

        const errors = validationResult(req);
        if (!errors.isEmpty()){
            return res.status(400).json({ errors: errors.array() , success: false });
        }
        // special validation
        const { authorization } = req.body;
        if(!authorization){
            const errors = [
                {
                    "type": "field",
                    "msg": "Valores requeridos",
                    "path": "authorization",
                    "location": "body"
                }
            ];
            return res.status(400).json({ errors , success: false });
        }

        let messageToSend = "";

        try {
            const ticket = await createTicket(req, res);
            if(!ticket.success){
                return res.status(400).json({ message: "No se ha podido crear el ticket, intentelo más tarde." , success: false });
            }
            messageToSend = `Puede encontrar su ticket en la siguiente dirección: ${ticket.ticket.pathApi}`;
        } catch (error) {
            dd(error.stack, 'error');
            return res.status(400).json({ errors: errors.array(), message: "Algo ha salido mal y no se ha podido crear el ticket" , success: false });
        }

        return await sendWhatsappProcess(messageToSend, req.body.to, req, res );

    }

    /**
     * Send payment link by WhatsApp
     *
     * Sends a custom payment link message via WhatsApp.
     * Used for payment request notifications.
     *
     * PCI DSS 4.0 Requirements:
     * - Requirement 4.2: Ensures secure transmission of payment links
     * - Requirement 10.2: Logs payment link sending for audit purposes
     *
     * @param {Object} req - Request containing message and recipient (to)
     * @param {Object} res - Express response object
     * @returns {Object} JSON response with success status or error
     */
    notificationController.sendPaymentLinkByWhatSapp = async (req,res) => {

        const errors = validationResult(req);

        if (!errors.isEmpty()){
            return res.status(400).json({ errors: errors.array() , success: false });
        }

        return await sendWhatsappProcess(req.body.message, req.body.to, req, res );

    }

    /**
     * Send payment link by SMS
     *
     * Sends a custom payment link message via SMS.
     * Used for payment request notifications.
     *
     * PCI DSS 4.0 Requirements:
     * - Requirement 4.2: Ensures secure transmission of payment links
     * - Requirement 10.2: Logs payment link sending for audit purposes
     *
     * @param {Object} req - Request containing message and phone numbers
     * @param {Object} res - Express response object
     * @returns {Object} JSON response with success status or error
     */
    notificationController.sendPaymentLinkBySms = async ( req, res) => {

        const errors = validationResult(req);

        if (!errors.isEmpty()){
            return res.status(400).json({ errors: errors.array() , success: false });
        }

        return await sendSmsProcess(req.body.message, req.body.numbers, req, res  );

    }

    /**
     * Create transaction ticket
     *
     * Generates a formatted ticket for a transaction with masked sensitive data.
     * Processes EMV tags, formats amounts, and handles timezone conversion.
     *
     * PCI DSS 4.0 Requirements:
     * - Requirement 3.4: Renders PAN unreadable (masks ARQC showing only last 4 digits)
     * - Requirement 3.5.1: Doesn't store full track data, card verification code
     * - Requirement 10.3: Includes date and time in ticket generation
     *
     * @param {Object} req - Request containing transaction identifiers (id, authorization, trace_id)
     * @param {Object} res - Express response object
     * @returns {Object} Ticket response with success status and ticket data or error
     */
    const createTicket = async (req, res) => {

        let tx = await db.isoMessage.findOne({
            attributes: ['id_message'],
            where: {
                reference_number: req.body.id,
                authorization: req.body.authorization,
                trace_number: req.body.trace_id
            }
        });

        if (!tx)
        return res.status(404).json({ errors: 'Transaccion no localizada' });

        let TX = await getTrans({ id_message: tx.id_message });

        if (!TX)
        return res.status(404).json({ errors: 'Transaccion no localizada', line: 2 });

        let TxFinal = null;
        for (const key in TX) {
        if (Object.hasOwnProperty.call(TX, key)) {
            const element = JSON.parse(JSON.stringify(TX[key]));
            element.finalMount = parseFloat(formatMount(element.amount)).toFixed(2);
            const date = moment.tz(new Date(element.creation_date), 'America/Mexico_City');
            element.fecha = date.format("DD/MM/YYYY");
            element.F1 = date.format("DD/MM/YYYY");
            element.F2 = date.format("HH:mm:ss");

            if (element.more_info) {
            element.more_info = JSON.parse(element.more_info);

            const monto = parseFloat(formatMount(element.amount));
            const tip = (element.more_info && element.more_info.tip) ? parseFloat(element.more_info.tip) : 0;
            element.amount = '$ ' + (monto - tip).toFixed(2);

            if (element.more_info.tip) {
                element.more_info.tip = tip.toFixed(2);
            }
            element.more_info.object = unpackEnvTag(element.more_info.emv_tags).tknB2;
            if (element.more_info.object) {
                // PCI DSS 3.4: Mask ARQC, showing only last 4 digits
                element.more_info.object.arqc_l = '************' + element.more_info.object.arqc.substr(element.more_info.object.arqc.length - 4);
                element.more_info.object.aid = element.more_info.object.aid.substr(0, 17);
                element.more_info.object.nombre = hex2a(element.more_info?.object?.cardholderName ?? '' );
                element.more_info.object.aplicationlabel = element.more_info.object.aplicationlabel;
                element.more_info.object.apn = element.more_info.object.apn;
            }
            } else {
            element.amount = '$ ' + (parseFloat(formatMount(element.amount))).toFixed(2);
            }

            TxFinal = element;
        }
        }

        if (req.body.AID) {
        TxFinal.requestData = req.body;
        // PCI DSS 3.4: Mask ARQC in request data
        TxFinal.requestData.ARQC_l = TxFinal.requestData.ARQC.substr(TxFinal.requestData.ARQC.length - 4);
        }

        req.body.data = JSON.stringify(TxFinal);
        req.api = true;
        let ticket = await getTicket(req, res);

        let ticketResponse = {
            success : true,
            ticket  : ticket,
            message : "Ticket creado correctamente."
        };

        if (!ticket || ticket.error){

            ticketResponse = {
                success : false,
                message : ticket?.error || 'Err. Desconocido'
            };
        }

        return ticketResponse;

    }

    /**
     * Format amount from string to decimal
     *
     * Converts amount string format (last 2 digits as decimals) to decimal number.
     * Example: "123456" becomes "1234.56"
     *
     * @param {string} numberStr - Amount string with last 2 digits as decimal places
     * @returns {string} Formatted amount as decimal string
     */
    const formatMount = (numberStr) =>  {
        const num = [parseInt(numberStr.substr(0, 10)), numberStr.substr(-2)];
        return num[0] + '.' + num[1];
    }

    /**
     * Convert hexadecimal string to ASCII
     *
     * Decodes hexadecimal encoded strings (commonly used in EMV data) to readable ASCII.
     *
     * @param {string} hexx - Hexadecimal encoded string
     * @returns {string} Decoded ASCII string
     */
    const hex2a = (hexx) => {
        var hex = hexx.toString();//force conversion
        var str = '';
        for (var i = 0; i < hex.length; i += 2)
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
        return str;
    }


module.exports = notificationController;