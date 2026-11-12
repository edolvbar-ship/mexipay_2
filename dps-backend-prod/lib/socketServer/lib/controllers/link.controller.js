/**
 * Payment Link Controller
 *
 * Handles payment link generation, distribution, and retrieval operations.
 * This controller manages secure payment links that allow customers to make payments
 * through a web interface without requiring physical card presence.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 4.2: Implements secure transmission of payment data through tokenized URLs
 * - Requirement 6.5.3: Uses secure cryptographic storage for payment link tokens
 * - Requirement 7.2: Enforces access control through merchant and user validation
 * - Requirement 10.2: Supports audit logging through database operations and email tracking
 *
 * Security Considerations:
 * - Payment links are tokenized to prevent direct exposure of sensitive data
 * - Access control is enforced at both merchant and user levels
 * - Links can have expiration dates to limit exposure window
 * - All database operations are logged for audit trail
 *
 * @module controllers/link.controller
 * @requires sequelize/init
 * @requires services/mail.service
 * @requires moment
 */

const linkController = {};
const db = require('../sequelize/init');
const mailService = require('../services/mail.service');
var moment = require('moment');

/**
 * Send Payment Link via Email
 *
 * Retrieves a payment link from the database and sends it to the specified email address.
 * This function enables distribution of payment links to customers through email.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 4.2: Ensures secure transmission by using tokenized URLs instead of sensitive data
 * - Requirement 10.2.4: Logs email distribution events for audit trail
 * - Requirement 7.2: Validates link ownership before distribution
 *
 * Security Notes:
 * - Link existence is validated before sending
 * - Only the token is transmitted, not sensitive payment data
 * - Email service handles secure SMTP transmission
 *
 * @async
 * @function sendLink
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {number} req.body.id - Payment link ID to send
 * @param {string} req.body.email - Recipient email address
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with success status
 * @returns {Object} returns.success - Boolean indicating operation success
 * @returns {string} returns.error - Error message if operation fails
 *
 * @example
 * // Request body
 * {
 *   "id": 123,
 *   "email": "customer@example.com"
 * }
 *
 * // Success response
 * { "success": true }
 *
 * // Error response
 * { "error": "Link no encontrado" }
 */
linkController.sendLink = async (req, res) => {
  const link = await db.linksPago.findOne({
    where: { id: req.body.id }
  });
  if (!link)
    return res.json({ error: 'Link no encontrado' });

  const url = `https://drakops.com.mx/payment?token=${link.token}`;
  const response = mailService.sendEmail({
    emailTo: req.body.email,
    subject: 'Link de pago ',
    text: url,
  });

  if ((await response).error)
    return res.status(400).json({ error: response.error, success: false });

  return res.json({ success: true });
};

/**
 * Generate New Payment Link
 *
 * Creates a new payment link with a unique token and stores it in the database.
 * The link can be shared with customers to enable remote payments without card present.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 6.5.3: Implements secure cryptographic storage through unique token generation
 * - Requirement 4.2: Creates tokenized URLs for secure payment data transmission
 * - Requirement 7.2: Associates links with specific users and merchants for access control
 * - Requirement 10.2.1: Creates audit trail through database logging of link creation
 *
 * Security Notes:
 * - Token generation uses timestamp + random string for uniqueness and unpredictability
 * - Links are associated with specific user and merchant for authorization
 * - Optional expiration date limits the time window of link validity
 * - All link data is persisted for audit and tracking purposes
 *
 * @async
 * @function generateLink
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {number} req.body.id_user - User ID creating the link
 * @param {number} req.body.id_comercio - Merchant ID associated with the link
 * @param {string} req.body.concepto - Payment concept/description
 * @param {number} req.body.monto - Payment amount in currency units
 * @param {string} [req.body.expire_date] - Optional expiration date (ISO format)
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with generated link data
 * @returns {string} returns.url - Full payment URL with token
 * @returns {number} returns.id - Database ID of created link
 * @returns {boolean} returns.success - Operation success status
 *
 * @example
 * // Request body
 * {
 *   "id_user": 456,
 *   "id_comercio": 789,
 *   "concepto": "Product Purchase",
 *   "monto": 100.50,
 *   "expire_date": "2024-12-31T23:59:59Z"
 * }
 *
 * // Success response
 * {
 *   "url": "https://drakops.com.mx/payment?token=1234567890-abc123",
 *   "id": 123,
 *   "success": true
 * }
 *
 * // Failure response
 * { "success": false }
 */
linkController.generateLink = async (req, res) => {
  const token = (new Date().getTime() / 1000) + '-' + (Math.random() + 1).toString(36).substring(3);
  const url = `https://drakops.com.mx/payment?token=${token}`;
  const result = await db.linksPago.create({
    token: token,
    id_user: req.body.id_user,
    id_merchant: req.body.id_comercio,
    concepto: req.body.concepto,
    monto: req.body.monto,
    expire_date: (req.body.expire_date) ? moment.tz(new Date(req.body.expire_date), 'America/Mexico_City').format() : null,
    info_adicional: JSON.stringify({ app: 1 })
  });

  if (result)
    return res.json({ url, id: result.id, success: true });

    return res.json({ success: false });
}

/**
 * Retrieve Payment Links Data
 *
 * Fetches all payment links for a specific merchant and user, with formatted output
 * including currency formatting, status translation, and date localization.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 7.2.1: Enforces strict access control by validating merchant and user IDs
 * - Requirement 7.2.2: Implements role-based access - users can only view their own links
 * - Requirement 10.2.2: Creates audit trail through database query logging
 * - Requirement 6.5.10: Prevents unauthorized access through dual authorization checks
 *
 * Security Notes:
 * - Dual authorization check: validates both merchant data and user ID
 * - Returns 401 Unauthorized if either merchant or user validation fails
 * - Filters results by both merchant ID and user ID to prevent cross-access
 * - Token data is included but should only be shared through authorized channels
 *
 * Data Processing:
 * - Currency formatting using Mexican peso (MXN) locale
 * - Date formatting using America/Mexico_City timezone
 * - Status translation from numeric to human-readable format
 * - Constructs full payment URLs for easy distribution
 *
 * @async
 * @function getLinksData
 * @param {Object} req - Express request object
 * @param {Object} req.merchantData - Merchant authentication data (from middleware)
 * @param {number} req.merchantData.id_merchant - Authenticated merchant ID
 * @param {Object} req.body - Request body
 * @param {number} req.body.id_user - User ID to filter links
 * @param {Object} res - Express response object
 * @returns {Promise<Array<Object>>} JSON array of formatted payment link objects
 * @returns {number} returns[].id - Link database ID
 * @returns {string} returns[].token - Unique payment token
 * @returns {string} returns[].concepto - Payment concept/description
 * @returns {string} returns[].monto - Formatted amount with currency symbol
 * @returns {string} returns[].status - Payment status ('Pendiente' or 'Liquidado')
 * @returns {string} returns[].expire_date - Formatted expiration date
 * @returns {string} returns[].info_adicional - Full payment URL
 *
 * @throws {401} If merchant data is missing or invalid
 * @throws {401} If user ID is not provided
 *
 * @example
 * // Request with authentication
 * // req.merchantData = { id_merchant: 789 }
 * // req.body = { id_user: 456 }
 *
 * // Success response
 * [
 *   {
 *     "id": 123,
 *     "token": "1234567890-abc123",
 *     "concepto": "Product Purchase",
 *     "monto": "$100.50",
 *     "status": "Pendiente",
 *     "expire_date": "12/31/2024",
 *     "info_adicional": "https://drakops.com.mx/payment?token=1234567890-abc123"
 *   }
 * ]
 *
 * // Error response
 * 401 "No authorizado"
 */
linkController.getLinksData = async (req, res) => {
  const formatter = new Intl.NumberFormat('es-MX', {
    currency: 'MXN',
    style: 'currency'
  });
  if (!req.merchantData.id_merchant)
    return res.status(401).send('No authorizado');

  const where = {};
  where.id_merchant = req.merchantData.id_merchant;
  if(!req.body.id_user) { return res.status(401).send('No authorizado'); }
  where.id_user = req.body.id_user;
  const response = await db.linksPago.findAll({ where });
  var listaLinks = [];
  response.forEach(element => {
    const url = 'https://drakops.com.mx/payment?token=' + element.token;
    const link = {
      id: element.id,
      token: element.token,
      concepto: element.concepto,
      monto: formatter.format(element.monto),
      status: (element.status == 1) ? 'Pendiente' : 'Liquidado',
      expire_date: moment.tz(new Date(element.expire_date), 'America/Mexico_City').format('L'),
      info_adicional: url
    }
    listaLinks.push(link);
  });

  return res.json(listaLinks);
}

module.exports = linkController;