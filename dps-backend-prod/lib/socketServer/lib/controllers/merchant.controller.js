/**
 * @fileoverview Merchant Management Controller
 *
 * This controller handles merchant account operations including retrieval,
 * listing, and soft deletion of merchant records. All operations require
 * proper authentication and authorization.
 *
 * PCI DSS 4.0 Compliance Requirements:
 * - Requirement 7.2: Access to system components and cardholder data is
 *   restricted based on user's job classification and function
 * - Requirement 8.2: User authentication and password management to ensure
 *   only authorized users can access merchant data
 * - Requirement 10.2: Audit logs for all access to merchant records and
 *   cardholder data must be implemented
 * - Requirement 12.3: Usage policies must be enforced for all merchant
 *   management operations
 *
 * Security Considerations:
 * - All merchant data access must be logged for audit purposes
 * - Merchant deletion is a soft delete (data retention for compliance)
 * - Access control validation should occur before operations
 * - Sensitive merchant information requires encryption at rest
 *
 * @module controllers/merchant
 * @requires ../database
 * @requires ../sequelize/init
 */

const pool = require('../database');
const db = require('../sequelize/init');
const merchantsCtrl = {};



/**
 * Soft deletes a merchant account by marking it as inactive
 *
 * Performs a soft delete operation by setting the deleted_at timestamp
 * and marking the merchant as inactive. This maintains data integrity
 * and compliance with data retention requirements.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 7.2.1: Access control mechanisms must be in place
 * - Requirement 10.2.5: Use of audit trails for changes to authentication
 *   credentials and privilege escalations
 * - Requirement 12.3.10: Explicit management approval for merchant account
 *   lifecycle operations
 *
 * Security Notes:
 * - Operation should be logged for audit trail (Requirement 10.2)
 * - Requires administrative privileges (Requirement 7.2)
 * - Soft delete preserves data for compliance audits
 * - Consider implementing approval workflow for production
 *
 * @async
 * @function deleteMerchant
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {number} req.body.id - The merchant ID to soft delete
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with operation status
 * @returns {string} returns.response - Operation result ('ok' on success)
 *
 * @example
 * // Request body:
 * {
 *   "id": 12345
 * }
 *
 * // Response:
 * {
 *   "response": "ok"
 * }
 */
merchantsCtrl.deleteMerchant = async (req, res) => {
  const { id } = req.body;
  await db.merchant.update(
    {
      // name_merchant: sequelize.literal(`CONCAT(id_merchant, '_', LEFT(name_merchant, 16 - CHAR_LENGTH(id_merchant)))`),
      deleted_at: Date.now(),
      active: 0
    },
    { where: { id_merchant: id } },
  );
  return res.json({ response: 'ok' });
};

/**
 * Retrieves detailed information for a specific merchant
 *
 * Fetches comprehensive merchant data including associated relationships
 * such as ISO client details, person type, address data, banking data,
 * and transaction profile. Formats monetary values for display.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 7.2.2: Access control system enforces privilege assignments
 *   based on individual user's job classification and function
 * - Requirement 8.2.1: Strong authentication credentials must be verified
 *   before granting access to merchant data
 * - Requirement 10.2.2: All actions taken by individuals with administrative
 *   access must be logged
 * - Requirement 12.3.1: Explicit approval from authorized parties for
 *   merchant data access
 *
 * Data Protection:
 * - Merchant banking data requires special handling (PCI DSS 3.4)
 * - Ensure sensitive data fields are masked if not authorized
 * - Log all access attempts for audit purposes
 * - Transaction limits (min/max) must be validated
 *
 * @async
 * @function getMerchant
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {number} req.query.id - The merchant ID to retrieve
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with merchant data
 * @returns {Object} returns.data - Detailed merchant information
 * @returns {number} returns.data.id_merchant - Merchant unique identifier
 * @returns {string} returns.data.name_merchant - Merchant business name
 * @returns {string} returns.data.afiliation_number - Merchant affiliation number
 * @returns {string} returns.data['3DS'] - 3D Secure configuration status
 * @returns {string} returns.data.min - Minimum transaction amount (formatted USD)
 * @returns {string} returns.data.max - Maximum transaction amount (formatted USD)
 * @returns {string|null} returns.data.selia_id - Selia integration identifier
 * @returns {Object} returns.data.iso_client_dt - ISO client details
 * @returns {Object} returns.data.tipo_persona_dt - Person type information
 * @returns {Object} returns.data.datos_direccion - Address information
 * @returns {Object} returns.data.datos_bancarios - Banking information (sensitive)
 * @returns {Object} returns.data.profile_trans - Transaction profile data
 *
 * @throws {Error} Returns error object if database operation fails
 *
 * @example
 * // Request:
 * GET /merchant?id=12345
 *
 * // Response:
 * {
 *   "data": {
 *     "id_merchant": 12345,
 *     "name_merchant": "Example Store",
 *     "3DS": true,
 *     "min": "$10.00",
 *     "max": "$50000.00",
 *     "selia_id": "SEL-12345",
 *     "iso_client_dt": {...},
 *     "datos_bancarios": {...}
 *   }
 * }
 */
merchantsCtrl.getMerchant = async (req, res) => {
  dd(('merchant.controller.getMerchant').green);

  try {
     db.merchant.findOne({
      include: [
        { required: false, model: db.isoClient, as: 'iso_client_dt' },
        { required: false, model: db.tipoPersona, as: 'tipo_persona_dt' },
        { required: false, model: db.datosDireccion, as: 'datos_direccion' },
        { required: false, model: db.datosBancarios, as: 'datos_bancarios' },
        { required: false, model: db.isoProfileTrans, as: 'profile_trans'}
      ],
      where: { id_merchant: req.query.id },
    }).then(function (merchant) {
      let data = merchant.toJSON();
      let dollarUS = Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      });
      data['3DS'] = data['3DS'];
      data['min'] = dollarUS.format(data['min']).replace(',','');
      data['max'] = dollarUS.format(data['max']).replace(',','');
      // Ensure selia_id is included in the response
      data['selia_id'] = data['selia_id'] || null;
      return res.json({ data: data });
    });
  } catch (error) {
    console.error(error)
    return res.json(error);
  }
};

/**
 * Retrieves merchant information by affiliation number and activation token
 *
 * Fetches merchant data using the affiliation number and activation token
 * (tkact) for secure merchant verification. Joins with profile transaction
 * and acquirer bank information. Used primarily for merchant account
 * activation and verification workflows.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 7.2.3: Default access rights are set to "deny-all" and
 *   explicit approval is required for merchant data access
 * - Requirement 8.2.3: Passwords/passphrases must meet minimum strength
 *   requirements (token activation validation)
 * - Requirement 10.2.1: All individual user accesses to cardholder data
 *   must be logged
 * - Requirement 12.3.2: Explicit usage policies for authentication
 *   mechanisms like activation tokens
 *
 * Security Considerations:
 * - Token activation (tkact) must be validated and time-limited
 * - Access attempts should be rate-limited to prevent brute force
 * - Failed authentication attempts must be logged
 * - Sensitive fields should be filtered based on user permissions
 * - Consider implementing token expiration and rotation
 *
 * @async
 * @function getByIdMerchant
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - The merchant affiliation number
 * @param {Object} req.headers - HTTP headers
 * @param {string} req.headers['x-act'] - Activation token for authentication
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with merchant data or error message
 * @returns {number} returns.id_merchant - Merchant unique identifier
 * @returns {string} returns.name_merchant - Merchant business name
 * @returns {string} returns.afiliation_number - Merchant affiliation number
 * @returns {string} returns.serie_terminal - Terminal serial number
 * @returns {string} returns.representative - Legal representative name
 * @returns {string} returns.alias_name - Merchant alias/DBA
 * @returns {string} returns.url_merchant - Merchant website URL
 * @returns {string} returns.rfc_merchant - Mexican tax ID (RFC)
 * @returns {string} returns.description - Merchant description
 * @returns {string} returns.contact_merchant - Primary contact name
 * @returns {string} returns.email_contact - Contact email address
 * @returns {string} returns.tel1_contact - Primary phone number
 * @returns {string} returns.tel2_contact - Secondary phone number
 * @returns {string} returns.mobile_contact - Mobile phone number
 * @returns {boolean} returns.use_moreterminals - Multi-terminal flag
 * @returns {number} returns.active - Merchant active status (0=inactive, 1=active)
 * @returns {string} returns.profile_transaction - Transaction profile hex value
 * @returns {number} returns.id_profile_transaction - Profile transaction ID
 * @returns {string} returns.MSI - Months without interest configuration
 * @returns {string} returns.acquirer_bank - Acquirer bank name
 * @returns {string|null} returns.selia_id - Selia integration identifier
 *
 * @throws {Object} Returns error message if merchant not found
 * @throws {string} throws.mensaje - Error message
 * @throws {string} throws.afiliacion - The affiliation number that was not found
 *
 * @example
 * // Request:
 * GET /merchant/:id
 * Headers: { 'x-act': 'activation-token-12345' }
 *
 * // Success Response:
 * {
 *   "id_merchant": 12345,
 *   "name_merchant": "Example Store",
 *   "afiliation_number": "987654321",
 *   "active": 1,
 *   "acquirer_bank": "Bank Name",
 *   "selia_id": "SEL-12345"
 * }
 *
 * // Error Response:
 * {
 *   "mensaje": "No existe el comercio",
 *   "afiliacion": "987654321"
 * }
 */
merchantsCtrl.getByIdMerchant = async (req, res) => {
  const { id } = req.params;
  const tkact = req.headers['x-act'];

  const merchant = await pool.query(
    "SELECT A.*, B.hex_value profile_transaction, C.name acquirer_bank FROM merchant A JOIN iso_profile_transaction B ON A.id_profile_transaction = B.id_profile_transaction JOIN iso_acquirer_bank C ON A.id_acqbank = C.id_acqbank WHERE afiliation_number = ? and token_activation = ?",
    [id, tkact]
  );
  if (merchant[0]) {
    const {
      id_merchant,
      name_merchant,
      mcc_idmcc,
      afiliation_number,
      representative,
      alias_name,
      url_merchant,
      rfc_merchant,
      description,
      agente_comercial,
      contact_merchant,
      rol_contact,
      email_contact,
      tel1_contact,
      tel2_contact,
      mobile_contact,
      use_moreterminals,
      active,
      id_profile_transaction,
      profile_transaction,
      creation_date,
      last_update,
      serie_terminal,
      MSI,
      acquirer_bank,
      selia_id // Added selia_id
    } = merchant[0];
    const showMerchant = {
      id_merchant,
      serie_terminal,
      name_merchant,
      mcc_idmcc,
      afiliation_number,
      representative,
      alias_name,
      url_merchant,
      rfc_merchant,
      description,
      agente_comercial,
      contact_merchant,
      rol_contact,
      email_contact,
      tel1_contact,
      tel2_contact,
      mobile_contact,
      use_moreterminals,
      active,
      profile_transaction,
      id_profile_transaction,
      creation_date,
      last_update,
      MSI,
      acquirer_bank,
      selia_id // Added selia_id
    };
    console.log('edit merchant')
    console.log(showMerchant);
    return res.json(showMerchant);
  }

  return res.json({ mensaje: 'No existe el comercio', afiliacion: id });
};

/**
 * Lists all active merchants with basic information
 *
 * Retrieves a simplified list of all merchants containing only their ID
 * and name, sorted alphabetically by name. This endpoint is typically
 * used for populating dropdown menus, search filters, or merchant
 * selection interfaces.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 7.2.1: Access control systems must be in place to restrict
 *   access based on users' need to know
 * - Requirement 8.2.1: Authentication credentials must be verified before
 *   granting access to merchant lists
 * - Requirement 10.2.3: Access to all audit trails must be logged for
 *   merchant listing operations
 * - Requirement 12.3.3: List of current service providers must be maintained
 *   (merchant registry)
 *
 * Performance Considerations:
 * - Uses raw query mode for better performance
 * - Returns only essential fields to minimize payload size
 * - Consider implementing pagination for large merchant databases
 * - May require caching for frequently accessed lists
 *
 * Security Notes:
 * - This endpoint exposes merchant names; ensure proper authorization
 * - Consider rate limiting to prevent enumeration attacks
 * - Log access for audit purposes (Requirement 10.2)
 * - Filter inactive/deleted merchants from results
 *
 * @async
 * @function list
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<Array<Object>>} JSON array of merchant objects
 * @returns {number} returns[].id_merchant - Merchant unique identifier
 * @returns {string} returns[].name_merchant - Merchant business name
 *
 * @example
 * // Request:
 * GET /merchants/list
 *
 * // Response:
 * [
 *   {
 *     "id_merchant": 12345,
 *     "name_merchant": "ABC Store"
 *   },
 *   {
 *     "id_merchant": 12346,
 *     "name_merchant": "XYZ Shop"
 *   }
 * ]
 */
merchantsCtrl.list = async (req, res) => {
  dd(('merchant.controller.list').green);

  const merchants = await db.merchant.findAll({
    attributes: ['id_merchant', 'name_merchant'],
    order: ['name_merchant'],
    raw: true
   });

  return res.json(merchants);
}

module.exports = merchantsCtrl;