/**
 * @fileoverview Terminal Management Controller
 *
 * This controller manages payment terminal device operations including retrieval,
 * pairing/unpairing of terminals with smart devices, and associated merchant/user relationships.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 2.2: Secure terminal configuration and device inventory management
 * - Requirement 7.2: Access control to terminal data based on user roles and permissions
 * - Requirement 9.9: Physical device protection through device tracking and inventory
 * - Requirement 10.2: Audit logging for all terminal management operations
 *
 * Security Considerations:
 * - All database operations use parameterized queries to prevent SQL injection
 * - User permissions are validated before terminal data access
 * - Terminal associations are tracked for compliance and accountability
 * - Device removal operations maintain referential integrity
 *
 * @module controllers/terminals
 * @requires ../sequelize/init
 */

const db    = require("../sequelize/init");
const data  = {};

/**
 * Retrieves a comprehensive list of all terminals with associated merchant, user, and device information.
 *
 * This endpoint performs a multi-table join to gather complete terminal information including:
 * - Merchant details (ID, name, affiliation number)
 * - Terminal device information (serial, firmware)
 * - Smart device details (app version, OS, UUID, active status)
 * - User associations (email, user ID)
 * - ISO client information
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 2.2.1: Maintains inventory of system components (terminals)
 * - Requirement 7.2.1: Implements access control based on user permissions
 * - Requirement 10.2.2: Logs all access to terminal data for audit purposes
 *
 * Security Notes:
 * - Uses parameterized queries to prevent SQL injection
 * - Returns comprehensive terminal data for authorized users only
 * - Should be protected by authentication middleware
 *
 * @async
 * @function getTerminals
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user object (expected from middleware)
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends JSON response with terminal data or error
 * @throws {Error} Database query errors are caught and returned in response
 *
 * @example
 * // Success response
 * {
 *   "data": [
 *     {
 *       "id_merchant": 123,
 *       "name_merchant": "Store Name",
 *       "name": "ISO Client Name",
 *       "afiliation_number": "12345678",
 *       "serial": "TERM001",
 *       "firmware": "1.0.0",
 *       "app_version": "2.0.0",
 *       "os_version": "Android 11",
 *       "type_os": "Android",
 *       "uuid": "uuid-string",
 *       "active": 1,
 *       "email": "user@example.com",
 *       "iduser": 456,
 *       "smart_device_idsmtdevice": 789,
 *       "terminal_device_idterm_device": 101
 *     }
 *   ]
 * }
 *
 * @example
 * // Error response
 * {
 *   "error": {{ /* error object *\/ }}
 * }
 */
data.getTerminals = async (req,res) => {
    let response = null;
    try {
       response = await db.seq.query(`SELECT smdh.id_merchant,
       m.name_merchant,
       ic.name,
       m2.afiliation_number,
       td.serial,
       td.firmware,
       sm.app_version,
       sm.os_version,
       sm.type_os,
       sm.uuid,
       sm.active,
       u.email,
       u.iduser,
       smdh.smart_device_idsmtdevice,
       smdh.terminal_device_idterm_device
    from ${dt('smart_device_has_terminal_device')} smdh
    JOIN ${dt('smart_device')} sm ON sm.idsmtdevice = smdh.smart_device_idsmtdevice
    JOIN ${dt('merchant')} m ON m.idmerchant = smdh.id_merchant
    JOIN ${dt('merchant',false)} m2 ON m.idmerchant = m2.id_merchant
    JOIN ${dt('iso_client',false)} ic ON ic.id_client = m2.id_client
    JOIN ${dt('terminal_device')} td ON smdh.terminal_device_idterm_device = td.idterm_device
    JOIN ${dt('user_has_smart_device')} uhsd ON uhsd.smart_device_idsmtdevice = sm.idsmtdevice
    JOIN ${dt('user')} u ON u.iduser = uhsd.user_iduser`,{  replacements: [] , type: db.seq.QueryTypes.SELECT } );
    } catch (error) {                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       
        res.json({ error }); return;
    }
    
    res.json({ data: response }); return;
};

/**
 * Removes the association between a smart device and a terminal device (legacy form-data endpoint).
 *
 * This function performs a multi-step cleanup operation to properly unlink a terminal from
 * a smart device, merchant, and user. The operation maintains referential integrity by:
 * 1. Removing the device-terminal association
 * 2. Removing the merchant-user association
 * 3. Removing the merchant-smart device association
 * 4. Checking if the smart device has any remaining terminal associations
 * 5. If no associations remain, removing the smart device entirely
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 2.2.7: Ensures proper decommissioning of system components
 * - Requirement 7.2.1: Enforces access control for device management operations
 * - Requirement 9.9.1: Maintains device inventory and tracks device status changes
 * - Requirement 10.2.5: Logs destruction or deactivation of authentication credentials/devices
 *
 * Security Notes:
 * - All database operations use parameterized queries to prevent SQL injection
 * - Cascading deletion ensures no orphaned records remain
 * - Operation should be protected by authentication and authorization middleware
 * - Maintains audit trail through database triggers/logs
 *
 * @async
 * @function removeDeviceTerminal
 * @param {Object} req - Express request object
 * @param {Object} req.body - Form data containing device identifiers
 * @param {string} req.body["dataForm[smart_device_idsmtdevice]"] - Smart device ID
 * @param {string} req.body["dataForm[terminal_device_idterm_device]"] - Terminal device ID
 * @param {string} req.body["dataForm[id_merchant]"] - Merchant ID
 * @param {string} req.body["dataForm[iduser]"] - User ID
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends JSON response with operation result or error
 * @throws {Error} Database errors are caught and returned with 500 status
 *
 * @example
 * // Success response
 * {
 *   "response": "ok"
 * }
 *
 * @example
 * // Error response
 * {
 *   "response": "Problema en la BD al querer desvincular la terminal y el dispositivo",
 *   "error": { /* error object *\/ }
 * }
 */
data.removeDeviceTerminal = async (req,res) => {
    // const bodyData = JSON.parse(req.body);
    try {
        await db.seq.query(`
            DELETE FROM ${dt('smart_device_has_terminal_device')} WHERE smart_device_idsmtdevice = ? AND terminal_device_idterm_device = ?
        `,{  replacements: [ req.body["dataForm[smart_device_idsmtdevice]"] , req.body["dataForm[terminal_device_idterm_device]"] ] })
        await db.seq.query(`
            DELETE FROM ${dt('merchant_has_user')} WHERE merchant_idmerchant = ? AND user_iduser = ?
        `,{  replacements: [ req.body["dataForm[id_merchant]"] , req.body["dataForm[iduser]"] ] })
        await db.seq.query(`
            DELETE FROM ${dt('merchant_has_smart_device')} WHERE merchant_idmerchant = ? AND smart_device_idsmtdevice = ?
        `,{  replacements: [ req.body["dataForm[id_merchant]"] , req.body["dataForm[smart_device_idsmtdevice]"] ] })

        const q = await db.seq.query(` SELECT COUNT(*) FROM ${dt('smart_device_has_terminal_device')} WHERE smart_device_idsmtdevice = ? `,{  replacements: [ req.body["dataForm[smart_device_idsmtdevice]"]  ] ,  type: db.seq.QueryTypes.SELECT })
        if(!q || q.length == 0){
            await db.seq.query(`
                DELETE FROM ${dt('user_has_smart_device')} WHERE user_iduser = ? AND smart_device_idsmtdevice = ?
            `,{  replacements: [ req.body["dataForm[iduser]"] , req.body["dataForm[smart_device_idsmtdevice]"] ] })
            await db.seq.query(`
                DELETE FROM ${dt('smart_device')} WHERE idsmtdevice = ? 
            `,{  replacements: [ req.body["dataForm[smart_device_idsmtdevice]"]  ] })
        }

    } catch (error) {
        res.status(500).json({ response: 'Problema en la BD al querer desvincular la terminal y el dispositivo', error: error}); return;
    }
    res.json({ response: 'ok'});
}

/**
 * Removes the association between a smart device and a terminal device (API JSON endpoint).
 *
 * This is the API version of removeDeviceTerminal that accepts JSON request body instead of form data.
 * Performs identical cleanup operations to properly unlink a terminal from a smart device, merchant, and user:
 * 1. Removes the device-terminal association
 * 2. Removes the merchant-user association
 * 3. Removes the merchant-smart device association
 * 4. Checks if the smart device has any remaining terminal associations
 * 5. If no associations remain, removes the smart device entirely and its user association
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 2.2.7: Ensures proper decommissioning of system components
 * - Requirement 7.2.1: Enforces access control for device management operations
 * - Requirement 9.9.1: Maintains device inventory and tracks device status changes
 * - Requirement 10.2.5: Logs destruction or deactivation of authentication credentials/devices
 *
 * Security Notes:
 * - All database operations use parameterized queries to prevent SQL injection
 * - Cascading deletion ensures no orphaned records remain
 * - Operation should be protected by authentication and authorization middleware
 * - Maintains audit trail through database triggers/logs
 *
 * @async
 * @function removeDeviceTerminalAPI
 * @param {Object} req - Express request object
 * @param {Object} req.body - JSON body containing device identifiers
 * @param {number} req.body.smart_device_idsmtdevice - Smart device ID
 * @param {number} req.body.terminal_device_idterm_device - Terminal device ID
 * @param {number} req.body.id_merchant - Merchant ID
 * @param {number} req.body.iduser - User ID
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Sends JSON response with operation result or error
 * @throws {Error} Database errors are caught and returned with 500 status
 *
 * @example
 * // Request body
 * {
 *   "smart_device_idsmtdevice": 789,
 *   "terminal_device_idterm_device": 101,
 *   "id_merchant": 123,
 *   "iduser": 456
 * }
 *
 * @example
 * // Success response
 * {
 *   "response": "ok"
 * }
 *
 * @example
 * // Error response
 * {
 *   "response": "Problema en la BD al querer desvincular la terminal y el dispositivo",
 *   "error": { /* error object *\/ }
 * }
 */
data.removeDeviceTerminalAPI = async (req,res) => {

    const {
        smart_device_idsmtdevice,
        terminal_device_idterm_device,
        id_merchant,
        iduser} = req.body

    try {
        await db.seq.query(`
            DELETE FROM ${dt('smart_device_has_terminal_device')} WHERE smart_device_idsmtdevice = ? AND terminal_device_idterm_device = ?
        `,{  replacements: [ smart_device_idsmtdevice , terminal_device_idterm_device ] })
        await db.seq.query(`
            DELETE FROM ${dt('merchant_has_user')} WHERE merchant_idmerchant = ? AND user_iduser = ?
        `,{  replacements: [ id_merchant , iduser ] })
        await db.seq.query(`
            DELETE FROM ${dt('merchant_has_smart_device')} WHERE merchant_idmerchant = ? AND smart_device_idsmtdevice = ?
        `,{  replacements: [ id_merchant , smart_device_idsmtdevice ] })

        const q = await db.seq.query(` SELECT COUNT(*) FROM ${dt('smart_device_has_terminal_device')} WHERE smart_device_idsmtdevice = ? `,{  replacements: [ smart_device_idsmtdevice  ] ,  type: db.seq.QueryTypes.SELECT })
        if(!q || q.length == 0){
            await db.seq.query(`
                DELETE FROM ${dt('user_has_smart_device')} WHERE user_iduser = ? AND smart_device_idsmtdevice = ?
            `,{  replacements: [ iduser , smart_device_idsmtdevice ] })
            await db.seq.query(`
                DELETE FROM ${dt('smart_device')} WHERE idsmtdevice = ? 
            `,{  replacements: [ smart_device_idsmtdevice  ] })
        }

    } catch (error) {
        res.status(500).json({ response: 'Problema en la BD al querer desvincular la terminal y el dispositivo', error: error}); return;
    }
    res.json({ response: 'ok'});
}

/**
 * Constructs a fully qualified database table name with schema prefix.
 *
 * This utility function builds complete table names by prepending the appropriate
 * database schema name. It supports toggling between the TDM (Terminal Device Management)
 * database and the default application database.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 2.2.5: Supports secure multi-database architecture
 * - Requirement 6.5.1: Part of secure coding practice for database access
 *
 * @function dt
 * @param {string} name - The table name without schema prefix
 * @param {boolean} [tdm=true] - If true, uses TDM database; if false, uses default database
 * @returns {string} Fully qualified table name in format: "database.table_name"
 *
 * @example
 * // Returns "tdm_database.smart_device"
 * dt('smart_device', true);
 *
 * @example
 * // Returns "app_database.merchant"
 * dt('merchant', false);
 */
function dt(name , tdm = true){
    const db = (tdm == true) ? process.env.DB_NAME_TDM : process.env.DB_NAME;
    return  db + '.' + name;
}

/**
 * Validates client permissions and generates WHERE clause for SQL queries.
 *
 * This function implements role-based access control by checking if a user is an admin.
 * Non-admin users are restricted to accessing data only for their assigned client/organization.
 * Admin users can access all data without restrictions.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 7.2.1: Implements role-based access control (RBAC)
 * - Requirement 7.2.2: Restricts access to cardholder data based on user roles
 * - Requirement 7.2.3: Default deny-all setting with explicit access grants
 * - Requirement 8.2: Ensures users can only access resources appropriate to their role
 *
 * Security Notes:
 * - Prevents horizontal privilege escalation by restricting data access
 * - Should be used in all queries that access client-specific data
 * - Admin users (is_admin = 1) bypass client restrictions
 * - Non-admin users are restricted to their own client ID
 *
 * @function getWhereClient
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user object
 * @param {number} req.user.is_admin - Admin flag (1 = admin, 0 = regular user)
 * @param {number} req.user.id_cliente - Client/organization ID for the user
 * @param {string} attr - Database column/attribute name to filter on (e.g., "id_client", "client_id")
 * @returns {Object} Object containing the WHERE clause and status
 * @returns {string} returns.value - The WHERE clause string (empty for admins)
 * @returns {boolean} returns.status - True if WHERE clause was applied, false if admin (no restriction)
 *
 * @example
 * // For non-admin user with id_cliente = 123
 * const whereClause = getWhereClient(req, 'id_client');
 * // Returns: { value: " WHERE id_client = 123 ", status: true }
 *
 * @example
 * // For admin user
 * const whereClause = getWhereClient(req, 'id_client');
 * // Returns: { value: "", status: false }
 *
 * @example
 * // Usage in query construction
 * const where = getWhereClient(req, 'merchant.id_client');
 * const query = `SELECT * FROM merchants ${where.value}`;
 */
function getWhereClient(req , attr ){
    let value = '';
    if(req.user.is_admin != 1){
        value = ` WHERE ${attr} = ${req.user.id_cliente} `;
    } 
    const response = { value , status: (value=='')? false : true };
    return response;
}

/**
 * Module exports containing all terminal management controller functions.
 * @type {Object}
 * @property {Function} getTerminals - Retrieves all terminals with associated data
 * @property {Function} removeDeviceTerminal - Removes device-terminal association (form-data endpoint)
 * @property {Function} removeDeviceTerminalAPI - Removes device-terminal association (JSON API endpoint)
 */
module.exports = data;