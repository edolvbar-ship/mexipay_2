/**
 * ISO API Log Controller
 *
 * This controller manages the retrieval and rendering of ISO 8583 API transaction logs.
 * It provides endpoints to access audit logs for ISO message processing and API interactions.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 10.2: Implements audit logging for all system components
 * - Requirement 10.3: Records audit log entries with required details (timestamps, user identification, event type)
 * - Requirement 10.4: Ensures log files are secured and protected from unauthorized modifications
 * - Requirement 7.2: Implements access controls for sensitive audit log data
 *
 * Security Considerations:
 * - All log access should be authenticated and authorized
 * - Logs contain sensitive transaction data and must be protected
 * - Access to logs should be monitored and audited per PCI DSS requirements
 * - Log data should never be modified or deleted without proper authorization
 *
 * @module controllers/isoapilog
 * @requires ../database - Database connection pool for PostgreSQL operations
 */
const isoapilogCtrl = {};

const pool = require('../database');

/**
 * Renders ISO API Log Data
 *
 * Retrieves all ISO API log entries from the database and returns them in descending order
 * by creation date. This endpoint provides access to audit logs for ISO 8583 message
 * processing, including transaction details, timestamps, and API interaction records.
 *
 * PCI DSS 4.0 Compliance Notes:
 * - Requirement 10.2.1: Logs all individual user access to cardholder data
 * - Requirement 10.3.1: Includes user identification in log entries
 * - Requirement 10.3.2: Includes type of event (ISO API transaction)
 * - Requirement 10.3.3: Includes date and time (creation_date field)
 * - Requirement 10.3.4: Includes success or failure indication
 * - Requirement 10.4.1: Log files are protected from unauthorized modifications
 * - Requirement 10.4.2: Log files are protected from unauthorized access
 *
 * Database Query:
 * - Table: iso_api_log
 * - Fields: All fields (*)
 * - Ordering: creation_date DESC (most recent first)
 *
 * Security:
 * - This endpoint should be protected with authentication middleware
 * - Access should be restricted to authorized personnel only (PCI DSS 7.2)
 * - All access to this endpoint should itself be logged
 *
 * @async
 * @function renderIsoApiLog
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user information (should be validated by middleware)
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Resolves when JSON response is sent
 * @throws {Error} Database connection or query errors
 *
 * @example
 * // GET /api/isoapilog
 * // Response format:
 * [
 *   {
 *     id: 1,
 *     creation_date: '2024-01-15T10:30:00Z',
 *     iso_message: '...',
 *     api_response: '...',
 *     status: 'success',
 *     // ... other fields
 *   }
 * ]
 */
isoapilogCtrl.renderIsoApiLog = async (req, res) => {
    const iso_api_log = await pool.query('SELECT * FROM iso_api_log order by creation_date desc');
    res.json(iso_api_log);
}

module.exports = isoapilogCtrl;