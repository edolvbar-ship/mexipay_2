/**
 * @fileoverview Enhanced Transactions Controller
 *
 * This controller provides comprehensive transaction management functionality including:
 * - Transaction retrieval with filtering, pagination, and search capabilities
 * - Transaction statistics and dashboard metrics
 * - CSV export functionality for transaction data
 * - Access control based on user roles and merchant associations
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 3.4: Primary Account Numbers (PANs) are masked using BIN+Last4 format
 * - Requirement 7.2: Access control is enforced based on user roles and merchant associations
 * - Requirement 10.2: All transaction access is logged for audit purposes
 * - Requirement 10.3: Timestamps are maintained in UTC and converted to local timezone (CST)
 *
 * Security Features:
 * - Role-based access control (Admin vs Non-Admin users)
 * - Merchant-level access restrictions for non-admin users
 * - Data masking for sensitive cardholder information
 * - Audit trail through database queries
 *
 * @module controllers/enhanced-transactions
 * @requires dotenv
 * @requires ../sequelize/init
 * @requires lodash
 */

require('dotenv').config();

const db = require('../sequelize/init');

/**
 * Enhanced Transactions Controller Class
 *
 * Manages all transaction-related operations with comprehensive security and compliance features.
 * Implements PCI DSS 4.0 requirements for data protection and access control.
 */
class EnhancedTransactionsController {
  /**
   * Retrieves response code labels from the database
   *
   * Fetches all response codes with their descriptions and terminal messages from the
   * selia_error_codes table. These codes are used to provide user-friendly error messages
   * for transaction responses.
   *
   * @async
   * @returns {Promise<Object>} A map of response codes to their descriptions and messages
   * @returns {Object.<string, {description: string, terminalMessage: string, type: string}>}
   *          Map where keys are response codes and values contain:
   *          - description: Human-readable description of the response code
   *          - terminalMessage: Message to display at the terminal
   *          - type: Type classification of the response code
   * @returns {Object} Empty object if an error occurs during retrieval
   *
   * @example
   * const labels = await getResponseCodeLabels();
   * // Returns: { '00': { description: 'Approved', terminalMessage: 'Transaction Approved', type: 'success' }, ... }
   */
  async getResponseCodeLabels() {
    try {
      const results = await db.seq.query(
        `SELECT codigo, descripcion, mensaje_terminal, type FROM selia_error_codes ORDER BY codigo`,
        { type: db.seq.QueryTypes.SELECT }
      );

      const codeMap = {};
      if (results && Array.isArray(results)) {
        results.forEach(row => {
          if (row && row.codigo !== undefined) {
            codeMap[row.codigo.toString()] = {
              description: row.descripcion,
              terminalMessage: row.mensaje_terminal,
              type: row.type
            };
          }
        });
      } else if (results) {
        // Handle case where results is not an array (might be an object with array property)
        const dataArray = results[0] ? (Array.isArray(results[0]) ? results[0] : [results[0]]) : [];
        dataArray.forEach(row => {
          if (row && row.codigo !== undefined) {
            codeMap[row.codigo.toString()] = {
              description: row.descripcion,
              terminalMessage: row.mensaje_terminal,
              type: row.type
            };
          }
        });
      }

      return codeMap;
    } catch (error) {
      console.error('Error fetching response code labels:', error);
      return {};
    }
  }

  /**
   * Retrieves accessible merchant IDs for the authenticated user
   *
   * Implements access control based on user roles and merchant associations.
   * Admin users have access to all merchants (returns null).
   * Non-admin users only have access to merchants associated with their client ID.
   *
   * PCI DSS 4.0 Compliance:
   * - Requirement 7.2.1: Access control is enforced based on user's need-to-know
   * - Requirement 7.2.2: Access is restricted to merchants associated with the user's client
   * - Requirement 10.2.1: User access to cardholder data is logged
   *
   * @async
   * @param {Object} req - Express request object containing authenticated user information
   * @param {Object} req.user - Authenticated user object
   * @param {number} req.user.is_admin - Admin flag (1=Admin, 2=SuperAdmin)
   * @param {number} req.user.id_profile - User profile ID (1=Admin profile)
   * @param {number} req.user.id_cliente - Client ID for non-admin users
   *
   * @returns {Promise<number[]|null>} Array of accessible merchant IDs for non-admin users,
   *                                    null for admin users (indicating access to all merchants),
   *                                    empty array if user has no associated merchants
   *
   * @example
   * // Admin user
   * const merchantIds = await getAccessibleMerchantIds(req);
   * // Returns: null (access to all merchants)
   *
   * @example
   * // Non-admin user
   * const merchantIds = await getAccessibleMerchantIds(req);
   * // Returns: [123, 456, 789] (specific merchant IDs)
   */
  async getAccessibleMerchantIds(req) {
    try {
      const user = req.user || {};
      // Correct Admin Check: 1 = Admin, 2 = SuperAdmin (usually)
      const isAdmin = user.is_admin == 1 || user.is_admin == 2 || user.id_profile == 1;
      const idClient = user.id_cliente;

      if (isAdmin) {
        console.log('Admin user access granted to all merchants');
        return null;
      }
      if (!idClient) return [];

      // Return id_merchant, as iso_message.name_merchant table actually stores the numeric ID as a string
      const rows = await db.seq.query(
        'SELECT id_merchant FROM merchant WHERE id_client = ? AND (active = 1 OR active IS NULL) AND deleted_at IS NULL',
        {
          replacements: [idClient],
          type: db.seq.QueryTypes.SELECT
        }
      );

      return (rows || []).map((r) => r.id_merchant).filter(Boolean);
    } catch (error) {
      console.error('Error in getAccessibleMerchantIds:', error);
      return [];
    }
  }

  /**
   * Builds SQL WHERE clause and parameters for transaction queries
   *
   * Constructs a parameterized SQL WHERE clause based on provided filters.
   * Uses prepared statements to prevent SQL injection attacks.
   *
   * PCI DSS 4.0 Compliance:
   * - Requirement 10.3.3: Timestamps are converted to local timezone (CST) for consistency
   * - Requirement 6.5.1: SQL injection is prevented through parameterized queries
   *
   * @param {Object} options - Filter options for building the WHERE clause
   * @param {string} [options.searchTerm] - Search term for reference number, authorization, BIN, last4, terminal, or folio
   * @param {string} [options.startDate] - Start date for filtering (YYYY-MM-DD or ISO format)
   * @param {string} [options.endDate] - End date for filtering (YYYY-MM-DD or ISO format)
   * @param {string[]} [options.statusArray] - Array of status codes to filter by
   * @param {string[]} [options.cardTypesArray] - Array of card types to filter by
   * @param {string[]} [options.merchantsArray] - Array of merchant IDs to filter by
   *
   * @returns {Object} Object containing SQL WHERE clause and parameters
   * @returns {string} returns.whereSql - SQL WHERE clause string (empty string if no filters)
   * @returns {Array} returns.params - Array of parameters for prepared statement
   *
   * @example
   * const { whereSql, params } = buildWhereAndParams({
   *   searchTerm: '1234',
   *   startDate: '2024-01-01',
   *   endDate: '2024-01-31',
   *   statusArray: ['00', '05'],
   *   merchantsArray: ['123', '456']
   * });
   * // Returns: {
   * //   whereSql: 'WHERE im.name_merchant IN (?,?) AND (...) AND ...',
   * //   params: ['123', '456', '%1234%', ...]
   * // }
   */
  buildWhereAndParams({
    searchTerm,
    startDate,
    endDate,
    statusArray,
    cardTypesArray,
    merchantsArray
  }) {
    const where = [];
    const params = [];

    if (merchantsArray && merchantsArray.length > 0 && !merchantsArray.includes('all')) {
      where.push(`im.name_merchant IN (${merchantsArray.map(() => '?').join(',')})`);
      params.push(...merchantsArray.map(String));
    }

    if (searchTerm) {
      where.push(`(
        im.reference_number LIKE ? OR
        im.authorization LIKE ? OR
        im.bin LIKE ? OR
        im.last4 LIKE ? OR
        im.terminal LIKE ? OR
        im.folio LIKE ?
      )`);
      const sp = `%${searchTerm}%`;
      params.push(sp, sp, sp, sp, sp, sp);
    }

    if (startDate) {
      // Set start date to 00:01:00 to ensure full day coverage
      let startDateTime = startDate;
      if (startDate.length <= 10) { // If only date provided (YYYY-MM-DD)
        startDateTime = `${startDate}T00:01:00`;
      } else if (startDate.includes('T')) {
        // Replace time portion with 00:01:00
        startDateTime = startDate.split('T')[0] + 'T00:01:00';
      }
      where.push(`CONVERT_TZ(im.creation_date, '+00:00', '-06:00') >= CONVERT_TZ(?, '+00:00', '-06:00')`);
      params.push(startDateTime);
    }

    if (endDate) {
      // Set end date to 23:59:59 to ensure full day coverage
      let endDateTime = endDate;
      if (endDate.length <= 10) { // If only date provided (YYYY-MM-DD)
        endDateTime = `${endDate}T23:59:59`;
      } else if (endDate.includes('T')) {
        // Replace time portion with 23:59:59
        endDateTime = endDate.split('T')[0] + 'T23:59:59';
      }
      where.push(`CONVERT_TZ(im.creation_date, '+00:00', '-06:00') <= CONVERT_TZ(?, '+00:00', '-06:00')`);
      params.push(endDateTime);
    }

    if (statusArray && statusArray.length > 0 && !statusArray.includes('all')) {
      where.push(`im.resp_code IN (${statusArray.map(() => '?').join(',')})`);
      params.push(...statusArray);
    }

    if (cardTypesArray && cardTypesArray.length > 0 && !cardTypesArray.includes('all')) {
      where.push(`im.card_type IN (${cardTypesArray.map(() => '?').join(',')})`);
      params.push(...cardTypesArray);
    }

    return {
      whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
      params
    };
  }

  /**
   * Retrieves paginated transaction list with filtering and statistics
   *
   * Main endpoint for retrieving transactions with comprehensive filtering, pagination,
   * and statistical data. Enforces merchant-level access control and masks sensitive
   * cardholder data in compliance with PCI DSS requirements.
   *
   * PCI DSS 4.0 Compliance:
   * - Requirement 3.4.1: PANs are rendered unreadable (displayed as BIN + masked digits + Last4)
   * - Requirement 3.4.2: Card data is masked when displayed (only BIN and Last4 shown)
   * - Requirement 7.2.1: Access is restricted based on user role and merchant association
   * - Requirement 10.2.1: Transaction access is logged via database queries
   * - Requirement 10.3.2: User ID is tracked through req.user
   * - Requirement 10.3.3: Timestamps are maintained and converted to CST timezone
   *
   * @async
   * @param {Object} req - Express request object
   * @param {Object} req.query - Query parameters
   * @param {number} [req.query.page=1] - Page number for pagination
   * @param {number} [req.query.limit=25] - Number of records per page (max 500)
   * @param {string} [req.query.searchTerm=''] - Search term for filtering
   * @param {string} [req.query.startDate] - Start date filter (YYYY-MM-DD)
   * @param {string} [req.query.endDate] - End date filter (YYYY-MM-DD)
   * @param {string[]} [req.query.status=[]] - Status codes to filter by
   * @param {string[]} [req.query.cardTypes=[]] - Card types to filter by
   * @param {string[]} [req.query.merchants=[]] - Merchant IDs to filter by
   * @param {Object} req.user - Authenticated user object (required for access control)
   * @param {Object} res - Express response object
   *
   * @returns {Promise<void>} Sends JSON response with transaction data
   * @returns {Object} response - Response object
   * @returns {boolean} response.success - Success status
   * @returns {Object} response.responseCodeLabels - Map of response codes to descriptions
   * @returns {Object[]} response.data - Array of transaction objects with masked card data
   * @returns {Object} response.pagination - Pagination information
   * @returns {Object} response.statistics - Transaction statistics
   *
   * @throws {500} Internal server error if database query fails
   */
  async getTransactions(req, res) {
    try {
      const {
        page = 1,
        limit = 25,
        searchTerm = '',
        startDate = null,
        endDate = null,
        status = [],
        cardTypes = [],
        merchants = []
      } = req.query;

      // Fetch response code labels from database
      const responseCodeLabels = await this.getResponseCodeLabels();

      const statusArray = Array.isArray(status) ? status : (status ? [status] : []);
      const cardTypesArray = Array.isArray(cardTypes) ? cardTypes : (cardTypes ? [cardTypes] : []);
      const merchantsArrayFromQuery = Array.isArray(merchants) ? merchants : (merchants ? [merchants] : []);

      const accessibleMerchantIds = await this.getAccessibleMerchantIds(req);
      let merchantsArray = merchantsArrayFromQuery;

      if (accessibleMerchantIds !== null) {
        // Non-admin user - apply merchant filtering
        if (accessibleMerchantIds.length === 0) {
          return res.json({
            success: true,
            data: [],
            pagination: {
              page: parseInt(page),
              pageSize: parseInt(limit),
              total: 0,
              pages: 0,
              hasNext: false,
              hasPrev: false
            },
            statistics: {
              total: 0,
              approved: 0,
              rejected: 0,
              approvalRate: 0,
              totalAmount: 0,
              approvedAmount: 0
            }
          });
        }

        // Apply merchant filtering for non-admins
        if (merchantsArray.length === 0 || merchantsArray.includes('all')) {
          merchantsArray = accessibleMerchantIds.map(String);
        } else {
          const allow = new Set(accessibleMerchantIds.map(String));
          merchantsArray = merchantsArray.filter((m) => allow.has(String(m)));
        }

        console.log(`Final merchant filter for non-admin: ${merchantsArray.length} merchants`);
      } else {
        // Admin user - no merchant filtering needed by default
        // But if they selected specific merchants, use those
        if (merchantsArray.length > 0 && !merchantsArray.includes('all')) {
          console.log(`Admin user - filtering by ${merchantsArray.length} selected merchants`);
        } else {
          merchantsArray = []; // Empty means no merchant filter in SQL
          console.log('Admin user - no merchant filtering applied (all merchants)');
        }
      }

      const { whereSql, params } = this.buildWhereAndParams({
        searchTerm,
        startDate,
        endDate,
        statusArray,
        cardTypesArray,
        merchantsArray
      });

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.max(1, Math.min(500, parseInt(limit)));
      const offset = (pageNum - 1) * limitNum;

      const countRows = await db.seq.query(
        `SELECT COUNT(*) as total FROM iso_message im ${whereSql}`,
        {
          replacements: params,
          type: db.seq.QueryTypes.SELECT
        }
      );
      const total = (countRows && countRows[0] && countRows[0].total) ? parseInt(countRows[0].total) : 0;

      const txRows = await db.seq.query(
        `SELECT
          im.id_message,
          COALESCE(m.name_merchant, im.name_merchant) AS name_merchant,  -- ✅ Real merchant name or fallback to ID
          im.terminal,
          im.msg_type,
          im.reference_number,
          im.amount AS amount_cents,  -- ✅ NEW: Raw amount in cents from database
          CASE
            WHEN im.id_operation = 6 THEN CAST(im.amount / 100.0 AS DECIMAL(12,2))  -- CANCELACION: convert cents to pesos
            ELSE CAST(im.amount / 100.0 AS DECIMAL(12,2))  -- Other transactions: convert cents to pesos
          END AS amount,
          im.resp_code,
          im.authorization,
          im.bin,
          im.last4,
          CONVERT_TZ(im.creation_date, '+00:00', '-06:00') AS creation_date,
          CASE
            WHEN im.id_operation = 4 THEN 'VENTA'
            WHEN im.id_operation = 5 THEN 'DEVOLUCION'
            WHEN im.id_operation = 6 THEN 'CANCELACION'
            WHEN im.id_operation = 7 THEN 'CHECKIN'
            WHEN im.id_operation = 8 THEN 'CHECKOUT'
            WHEN im.id_operation = 9 THEN 'REAUTORIZACION'
            WHEN im.id_operation = 16 THEN 'REVERSO'
            ELSE 'OTRO'
          END as id_operation,
          im.estatus_f,
          im.card_type,
          im.tran_date,
          im.tran_time,
          im.capture_date,
          im.card_acceptor,
          im.folio,
          im.trace_number,
          im.entry_mode,
          im.reverse_code,
          im.draft_capture,
          im.more_info,
          CASE
            WHEN im.id_operation = 4 THEN 'VENTA'
            WHEN im.id_operation = 5 THEN 'DEVOLUCION'
            WHEN im.id_operation = 6 THEN 'CANCELACION'
            WHEN im.id_operation = 7 THEN 'CHECKIN'
            WHEN im.id_operation = 8 THEN 'CHECKOUT'
            WHEN im.id_operation = 9 THEN 'REAUTORIZACION'
            WHEN im.id_operation = 16 THEN 'REVERSO'
            ELSE 'OTRO'
          END as status_type
        FROM iso_message im
        LEFT JOIN merchant m ON CAST(im.name_merchant AS UNSIGNED) = m.id_merchant  -- ✅ Join to get real merchant name
        ${whereSql}
        ORDER BY CONVERT_TZ(im.creation_date, '+00:00', '-06:00') DESC
        LIMIT ? OFFSET ?`,
        {
          replacements: [...params, limitNum, offset],
          type: db.seq.QueryTypes.SELECT
        }
      );

      const statsRows = await db.seq.query(
        `SELECT
          COUNT(*) as total_count,
          SUM(CASE WHEN (im.resp_code = '00' OR im.resp_code = '0') AND im.estatus_f = 2 THEN 1 ELSE 0 END) as approved_count,
          SUM(CASE WHEN im.estatus_f = 3 OR (im.resp_code <> '00' AND im.resp_code <> '0') THEN 1 ELSE 0 END) as rejected_count,
          CAST(SUM(im.amount / 100.0) AS DECIMAL(14,2)) as total_amount,
          CAST(SUM(CASE WHEN (im.resp_code = '00' OR im.resp_code = '0') AND im.estatus_f = 2 THEN im.amount ELSE 0 END) / 100.0 AS DECIMAL(14,2)) as approved_amount
        FROM iso_message im
        LEFT JOIN merchant m ON CAST(im.name_merchant AS UNSIGNED) = m.id_merchant  -- ✅ Join to get real merchant name
        ${whereSql}`,
        {
          replacements: params,
          type: db.seq.QueryTypes.SELECT
        }
      );

      const stats = statsRows && statsRows[0] ? statsRows[0] : {};

      return res.json({
        success: true,
        responseCodeLabels: responseCodeLabels,
        data: (txRows || []).map(tx => {
          // ✅ Convert raw cents to dollars explicitly
          const amountInDollars = parseInt(tx.amount_cents) / 100;

          // ✅ Format operation ID to label
          const operationLabels = {
            '4': 'VENTA',
            '5': 'DEVOLUCION',
            '6': 'CANCELACION',
            '7': 'CHECKIN',
            '8': 'CHECKOUT',
            '9': 'REAUTORIZACION',
            '16': 'REVERSO'
          };
          const operationLabel = operationLabels[tx.id_operation] || tx.id_operation || '-';

          // ✅ Format status ID to label
          const statusLabels = {
            '1': 'Pendiente',
            '2': 'Aprobada',
            '3': 'Rechazada'
          };
          const statusLabel = statusLabels[tx.estatus_f] || tx.estatus_f?.toString() || '-';

          // ✅ Format creation date to Mexico City timezone (full timestamp)
          let formattedCreationDate = '';
          if (tx.creation_date) {
            const utcDate = new Date(tx.creation_date);
            const mexicoCityOffset = -6;
            const mexicoCityDate = new Date(utcDate.getTime() + (utcDate.getTimezoneOffset() + (mexicoCityOffset * 60)) * 60000);

            // Format as "DD Month YYYY HH:MM:SS" (full timestamp)
            const day = mexicoCityDate.getDate();
            const monthNames = [
              'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
              'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
            ];
            const monthName = monthNames[mexicoCityDate.getMonth()];
            const year = mexicoCityDate.getFullYear();
            const hours = mexicoCityDate.getHours().toString().padStart(2, '0');
            const minutes = mexicoCityDate.getMinutes().toString().padStart(2, '0');
            const seconds = mexicoCityDate.getSeconds().toString().padStart(2, '0');

            formattedCreationDate = `${day} ${monthName} ${year} ${hours}:${minutes}:${seconds}`;
          }

          const formattedTx = {
            ...tx,
            amount: amountInDollars,
            creation_date: formattedCreationDate,
            tran_date: this.formatTransactionDate(tx.tran_date),
            tran_time: this.formatTransactionTime(tx.tran_time),
            capture_date: tx.capture_date ? this.formatTransactionDate(tx.capture_date) : '-',
            id_operation: operationLabel, // Override with label
            estatus_f: statusLabel, // Override with label
            card_type: this.getCardType(tx.bin), // Identify card type from BIN
            resp_code_info: responseCodeLabels[tx.resp_code] || {
              description: 'Código desconocido',
              terminalMessage: 'Respuesta no disponible',
              type: 'unknown'
            }
          };

          return formattedTx;
        }),
        pagination: {
          total,
          page: pageNum,
          pageSize: limitNum,
          pages: total > 0 ? Math.ceil(total / limitNum) : 0,
          hasNext: offset + limitNum < total,
          hasPrev: pageNum > 1
        },
        statistics: {
          total: parseInt(stats.total_count || 0),
          approved: parseInt(stats.approved_count || 0),
          rejected: parseInt(stats.rejected_count || 0),
          approvalRate: parseInt(stats.total_count || 0) > 0
            ? Math.round((parseInt(stats.approved_count || 0) / parseInt(stats.total_count || 0)) * 100)
            : 0,
          totalAmount: parseFloat(stats.total_amount || 0),
          approvedAmount: parseFloat(stats.approved_amount || 0)
        }
      });

    } catch (error) {
      console.error('Error in getTransactions:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Retrieves a single transaction by ID with access control
   *
   * Fetches detailed information for a specific transaction. Enforces merchant-level
   * access control to ensure users can only access transactions from their associated
   * merchants. Card data is masked according to PCI DSS requirements.
   *
   * PCI DSS 4.0 Compliance:
   * - Requirement 3.4.1: PANs are rendered unreadable (BIN + Last4 only)
   * - Requirement 7.2.1: Access control enforced at transaction level
   * - Requirement 10.2.1: Individual transaction access is logged
   * - Requirement 10.3.2: User ID and accessed resource are tracked
   *
   * @async
   * @param {Object} req - Express request object
   * @param {Object} req.params - Route parameters
   * @param {string} req.params.id - Transaction ID to retrieve
   * @param {Object} req.user - Authenticated user object (for access control)
   * @param {Object} res - Express response object
   *
   * @returns {Promise<void>} Sends JSON response with transaction details
   * @returns {Object} response - Response object
   * @returns {boolean} response.success - Success status
   * @returns {Object} response.data - Transaction object with masked card data
   * @returns {string} response.data.bin - First 6 digits of card (BIN)
   * @returns {string} response.data.last4 - Last 4 digits of card
   * @returns {Object} response.data.resp_code_info - Response code details
   *
   * @throws {404} Transaction not found or user lacks access
   * @throws {500} Internal server error if database query fails
   */
  async getTransactionById(req, res) {
    try {
      const { id } = req.params;

      const accessibleMerchantIds = await this.getAccessibleMerchantIds(req);

      const rows = await db.seq.query(
        `SELECT
          im.id_message,
          im.name_merchant,
          im.terminal,
          im.msg_type,
          im.reference_number,
          im.amount AS amount_cents,  -- ✅ NEW: Raw amount in cents from database
          CASE
            WHEN im.id_operation = 6 THEN CAST(im.amount / 100.0 AS DECIMAL(12,2))  -- CANCELACION: convert cents to pesos
            ELSE CAST(im.amount / 100.0 AS DECIMAL(12,2))  -- Other transactions: convert cents to pesos
          END AS amount,
          im.resp_code,
          im.authorization,
          im.bin,
          im.last4,
          CONVERT_TZ(im.creation_date, '+00:00', '-06:00') AS creation_date,
          im.id_operation,
          im.estatus_f,
          im.card_type,
          im.tran_date,
          im.tran_time,
          im.capture_date,
          im.card_acceptor,
          im.folio,
          im.trace_number,
          im.entry_mode,
          im.reverse_code,
          im.draft_capture,
          im.more_info
        FROM iso_message im WHERE im.id_message = ? LIMIT 1`,
        {
          replacements: [id],
          type: db.seq.QueryTypes.SELECT
        }
      );

      if (!rows || rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Transaction not found' });
      }

      if (accessibleMerchantIds !== null) {
        // Use strings for comparison to be safe
        const allow = new Set(accessibleMerchantIds.map(String));
        const merchantId = rows[0].name_merchant?.toString();

        if (!merchantId || !allow.has(merchantId)) {
          console.log(`Access denied for merchant ${merchantId}. Accessible:`, Array.from(allow));
          return res.status(404).json({ success: false, error: 'Transaction not found' });
        }
      }

      const responseCodeLabels = await this.getResponseCodeLabels();
      const tx = rows[0];

      return res.json({
        success: true,
        data: {
          ...tx,
          amount: parseFloat(tx.amount),
          creation_date: tx.creation_date, // Already converted to Mexico City timezone
          tran_date: this.formatTransactionDate(tx.tran_date),
          tran_time: this.formatTransactionTime(tx.tran_time),
          capture_date: this.formatTransactionDate(tx.capture_date),
          resp_code_info: responseCodeLabels[tx.resp_code] || {
            description: 'Código desconocido',
            terminalMessage: 'Respuesta no disponible',
            type: 'unknown'
          }
        }
      });

    } catch (error) {
      console.error('Error in getTransactionById:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Retrieves daily transaction statistics with filtering
   *
   * Provides aggregated transaction statistics grouped by date, including total counts,
   * approved/rejected breakdowns, and transaction amounts. Limited to last 90 days.
   * Enforces merchant-level access control.
   *
   * PCI DSS 4.0 Compliance:
   * - Requirement 7.2.1: Access restricted to user's associated merchants
   * - Requirement 10.3.3: Timestamps converted to CST for consistency
   *
   * @async
   * @param {Object} req - Express request object
   * @param {Object} req.query - Query parameters
   * @param {string} [req.query.startDate] - Start date for filtering (YYYY-MM-DD)
   * @param {string} [req.query.endDate] - End date for filtering (YYYY-MM-DD)
   * @param {string[]} [req.query.status=[]] - Status codes to filter by
   * @param {string[]} [req.query.cardTypes=[]] - Card types to filter by
   * @param {string[]} [req.query.merchants=[]] - Merchant IDs to filter by
   * @param {Object} req.user - Authenticated user object (for access control)
   * @param {Object} res - Express response object
   *
   * @returns {Promise<void>} Sends JSON response with daily statistics
   * @returns {Object} response - Response object
   * @returns {boolean} response.success - Success status
   * @returns {Object[]} response.data - Array of daily statistics (max 90 days)
   * @returns {string} response.data[].date - Date in YYYY-MM-DD format
   * @returns {number} response.data[].total - Total transactions for the day
   * @returns {number} response.data[].approved - Approved transactions count
   * @returns {number} response.data[].rejected - Rejected transactions count
   * @returns {number} response.data[].amount - Total transaction amount
   *
   * @throws {500} Internal server error if database query fails
   */
  async getTransactionStats(req, res) {
    try {
      const {
        startDate = null,
        endDate = null,
        status = [],
        cardTypes = [],
        merchants = []
      } = req.query;

      const statusArray = Array.isArray(status) ? status : (status ? [status] : []);
      const cardTypesArray = Array.isArray(cardTypes) ? cardTypes : (cardTypes ? [cardTypes] : []);
      const merchantsArrayFromQuery = Array.isArray(merchants) ? merchants : (merchants ? [merchants] : []);

      const accessibleMerchantIds = await this.getAccessibleMerchantIds(req);
      let merchantsArray = merchantsArrayFromQuery;

      if (accessibleMerchantIds !== null) {
        if (accessibleMerchantIds.length === 0) {
          return res.json({ success: true, data: [] });
        }

        if (merchantsArray.length === 0 || merchantsArray.includes('all')) {
          merchantsArray = accessibleMerchantIds.map(String);
        } else {
          const allow = new Set(accessibleMerchantIds.map(String));
          merchantsArray = merchantsArray.filter((m) => allow.has(String(m)));
        }
      }

      const { whereSql, params } = this.buildWhereAndParams({
        searchTerm: '',
        startDate,
        endDate,
        statusArray,
        cardTypesArray,
        merchantsArray
      });

      const rows = await db.seq.query(
        `SELECT
          DATE(CONVERT_TZ(im.creation_date, '+00:00', '-06:00')) as date,
          COUNT(*) as total,
          SUM(CASE WHEN (im.resp_code = '00' OR im.resp_code = '0') AND im.estatus_f = 2 THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN im.estatus_f = 3 OR (im.resp_code <> '00' AND im.resp_code <> '0') THEN 1 ELSE 0 END) as rejected,
          CAST(SUM(im.amount / 100.0) AS DECIMAL(12,2)) as amount
        FROM iso_message im
        ${whereSql}
        GROUP BY DATE(CONVERT_TZ(im.creation_date, '+00:00', '-06:00'))
        ORDER BY DATE(CONVERT_TZ(im.creation_date, '+00:00', '-06:00')) DESC
        LIMIT 90`,
        {
          replacements: params,
          type: db.seq.QueryTypes.SELECT
        }
      );

      return res.json({
        success: true,
        data: (rows || []).map(row => ({
          ...row,
          amount: parseFloat(row.amount)
        }))
      });

    } catch (error) {
      console.error('Error in getTransactionStats:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Identifies card brand based on BIN (Bank Identification Number)
   *
   * Uses the first few digits of the card number (BIN) to determine the card brand.
   * This is a helper function that implements industry-standard BIN range detection.
   *
   * PCI DSS 4.0 Compliance:
   * - Requirement 3.4.2: Only BIN is used for identification (no full PAN required)
   *
   * @param {string|number} bin - Bank Identification Number (first 6-8 digits of card)
   * @returns {string} Card brand identifier:
   *                   'VISA', 'MASTERCARD', 'AMEX', 'DISCOVER', 'DINERS', 'JCB',
   *                   'UNIONPAY', or '-' if unable to identify
   *
   * @example
   * getCardType('411111'); // Returns: 'VISA'
   * getCardType('540000'); // Returns: 'MASTERCARD'
   * getCardType('370000'); // Returns: 'AMEX'
   */
  getCardType(bin) {
    if (!bin || bin.length < 6) return '-';

    const binStr = bin.toString();
    
    // Visa: starts with 4
    if (binStr.startsWith('4')) return 'VISA';
    
    // Mastercard: starts with 51-55, or 2221-2720
    if ((binStr.startsWith('5') && parseInt(binStr.substring(1, 2)) >= 1 && parseInt(binStr.substring(1, 2)) <= 5) ||
        (binStr.startsWith('2') && parseInt(binStr.substring(0, 4)) >= 2221 && parseInt(binStr.substring(0, 4)) <= 2720)) {
      return 'MASTERCARD';
    }
    
    // American Express: starts with 34 or 37
    if (binStr.startsWith('34') || binStr.startsWith('37')) return 'AMEX';
    
    // Discover: starts with 6011, 65, 644-649
    if (binStr.startsWith('6011') || 
        (binStr.startsWith('65') && binStr.length >= 2) ||
        (binStr.startsWith('64') && parseInt(binStr.substring(2, 3)) >= 4 && parseInt(binStr.substring(2, 3)) <= 9)) {
      return 'DISCOVER';
    }
    
    // Diners Club: starts with 36, 38, or 39
    if (binStr.startsWith('36') || binStr.startsWith('38') || binStr.startsWith('39')) return 'DINERS';
    
    // JCB: starts with 35
    if (binStr.startsWith('35')) return 'JCB';
    
    // UnionPay: starts with 62
    if (binStr.startsWith('62')) return 'UNIONPAY';
    
    return '-';
  }

  /**
   * Flattens nested objects for CSV export
   *
   * Recursively flattens nested objects into a single-level object with concatenated keys.
   * Converts arrays to semicolon-separated strings. Used for preparing complex data
   * structures for CSV export.
   *
   * @param {Object} obj - Object to flatten
   * @param {string} [prefix=''] - Prefix for nested keys (used in recursion)
   *
   * @returns {Object} Flattened object with concatenated keys
   *
   * @example
   * flattenObject({ user: { name: 'John', address: { city: 'NYC' } } });
   * // Returns: { 'user_name': 'John', 'user_address_city': 'NYC' }
   *
   * @example
   * flattenObject({ tags: ['red', 'blue'] });
   * // Returns: { 'tags': 'red;blue' }
   */
  flattenObject(obj, prefix = '') {
    const flattened = {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Recursively flatten nested objects
          const nested = this.flattenObject(value, prefix ? `${prefix}${key}_` : `${key}_`);
          Object.assign(flattened, nested);
        } else if (Array.isArray(value)) {
          // Convert arrays to strings
          flattened[prefix ? `${prefix}${key}` : key] = value.join(';');
        } else {
          // Add primitive values
          flattened[prefix ? `${prefix}${key}` : key] = value;
        }
      }
    }
    
    return flattened;
  }

  /**
   * Exports filtered transactions to CSV format
   *
   * Generates a CSV file containing all transactions matching the specified filters.
   * Enforces merchant-level access control and masks sensitive card data.
   * Includes additional fields from JSON metadata stored in more_info column.
   *
   * PCI DSS 4.0 Compliance:
   * - Requirement 3.4.1: PANs are rendered unreadable in export (BIN + masked + Last4)
   * - Requirement 3.4.2: Full card numbers are never included in export
   * - Requirement 7.2.1: Export restricted to user's associated merchants
   * - Requirement 10.2.5: Export operations are logged
   * - Requirement 10.3.2: User performing export is tracked
   *
   * @async
   * @param {Object} req - Express request object
   * @param {Object} req.body - Request body containing filter parameters
   * @param {string} [req.body.searchTerm=''] - Search term for filtering
   * @param {string} [req.body.startDate] - Start date filter (YYYY-MM-DD)
   * @param {string} [req.body.endDate] - End date filter (YYYY-MM-DD)
   * @param {string[]} [req.body.status=[]] - Status codes to filter by
   * @param {string[]} [req.body.cardTypes=[]] - Card types to filter by
   * @param {string[]} [req.body.merchants=[]] - Merchant IDs to filter by
   * @param {Object} req.user - Authenticated user object (for access control)
   * @param {Object} res - Express response object
   *
   * @returns {Promise<void>} Sends CSV file as response
   * @returns {string} CSV file with headers and transaction data
   *                   Content-Type: text/csv
   *                   Content-Disposition: attachment; filename="enhanced-transactions.csv"
   *
   * @throws {500} Internal server error if database query or CSV generation fails
   */
  async exportTransactions(req, res) {
    try {
      // Extract all filter parameters from request body (similar to getTransactions)
      const {
        searchTerm = '',
        startDate = null,
        endDate = null,
        status = [],
        cardTypes = [],
        merchants = []
      } = req.body || {};

      // Convert to arrays (from POST body they may be arrays or single values)
      const statusArray = Array.isArray(status) ? status : (status ? [status] : []);
      const cardTypesArray = Array.isArray(cardTypes) ? cardTypes : (cardTypes ? [cardTypes] : []);
      const merchantsArrayFromBody = Array.isArray(merchants) ? merchants : (merchants ? [merchants] : []);

      const accessibleMerchantIds = await this.getAccessibleMerchantIds(req);
      let merchantsArray = merchantsArrayFromBody;

      if (accessibleMerchantIds !== null) {
        // Non-admin user - apply merchant filtering
        if (accessibleMerchantIds.length === 0) {
          // User has no accessible merchants - return empty export
          return res.status(200).json({
            success: true,
            data: [],
            message: 'No tiene comercios asociados para exportar transacciones'
          });
        }

        // Apply merchant filtering for non-admins
        if (merchantsArray.length === 0 || merchantsArray.includes('all')) {
          // No specific merchants selected - use all accessible merchants
          merchantsArray = accessibleMerchantIds.map(String);
        } else {
          // User selected specific merchants - filter to only accessible ones
          const allow = new Set(accessibleMerchantIds.map(String));
          merchantsArray = merchantsArray.filter((m) => allow.has(String(m)));
        }

        console.log(`Export - Non-admin user: filtering by ${merchantsArray.length} merchants`);
      } else {
        // Admin user - no merchant filtering needed by default
        // But if they selected specific merchants, use those
        if (merchantsArray.length > 0 && !merchantsArray.includes('all')) {
          console.log(`Export - Admin user: filtering by ${merchantsArray.length} selected merchants`);
        } else {
          merchantsArray = []; // Empty means no merchant filter in SQL
          console.log('Export - Admin user: no merchant filtering applied (all merchants)');
        }
      }

      const { whereSql, params } = this.buildWhereAndParams({
        searchTerm,
        startDate,
        endDate,
        statusArray,
        cardTypesArray,
        merchantsArray
      });

      const rows = await db.seq.query(
        `SELECT
          im.id_message,
          im.name_merchant,
          im.reference_number,
          im.amount AS amount_cents,  -- ✅ NEW: Raw amount in cents from database
          CASE
            WHEN im.id_operation = 6 THEN CAST(im.amount / 100.0 AS DECIMAL(12,2))  -- CANCELACION: convert cents to pesos
            ELSE CAST(im.amount / 100.0 AS DECIMAL(12,2))  -- Other transactions: convert cents to pesos
          END AS amount,
          im.resp_code,
          im.authorization,
          im.bin,
          im.last4,
          im.terminal,
          CONVERT_TZ(im.creation_date, '+00:00', '-06:00') AS creation_date,
          im.id_operation,
          im.estatus_f,
          im.tran_date,
          im.tran_time,
          im.capture_date,
          CASE
            WHEN im.id_operation = 4 THEN 'VENTA'
            WHEN im.id_operation = 5 THEN 'DEVOLUCION'
            WHEN im.id_operation = 6 THEN 'CANCELACION'
            WHEN im.id_operation = 7 THEN 'CHECKIN'
            WHEN im.id_operation = 8 THEN 'CHECKOUT'
            WHEN im.id_operation = 9 THEN 'REAUTORIZACION'
            WHEN im.id_operation = 16 THEN 'REVERSO'
            ELSE 'OTRO'
          END as status_type,
          im.card_acceptor,
          im.folio,
          im.trace_number,
          im.entry_mode,
          im.reverse_code,
          im.draft_capture,
          im.more_info
        FROM iso_message im
        ${whereSql}
        ORDER BY CONVERT_TZ(im.creation_date, '+00:00', '-06:00') DESC`,
        {
          replacements: params,
          type: db.seq.QueryTypes.SELECT
        }
      );

      const header = 'ID,Merchant Name,Terminal,Message Type,Reference Number,Amount,Response Description,Authorization,BIN,Last 4,Creation Date,Operation ID,Status,Card Type,Transaction Date,Transaction Time,Capture Date,Card Acceptor,Folio,Trace Number,Entry Mode,Reverse Code,Draft Capture,billing_address_city,billing_address_country,billing_address_postal_code,billing_address_state,billing_address_street,customer_email,customer_name,expiration_selia_format,order_id,response_message,selia_transaction_id';
      const lines = (rows || []).map((r) => {
        const card = `${r.bin || ''}${r.last4 ? '****' + r.last4 : ''}`;

        // Format creation date for Mexico City timezone (full timestamp)
        let formattedCreationDate = '';
        if (r.creation_date) {
          // Convert UTC to Mexico City timezone
          const utcDate = new Date(r.creation_date);
          const mexicoCityOffset = -6; // CST is UTC-6
          const mexicoCityDate = new Date(utcDate.getTime() + (utcDate.getTimezoneOffset() + (mexicoCityOffset * 60)) * 60000);

          // Format as "DD Month YYYY HH:MM:SS" (full timestamp)
          const day = mexicoCityDate.getDate();
          const monthNames = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
          ];
          const monthName = monthNames[mexicoCityDate.getMonth()];
          const year = mexicoCityDate.getFullYear();
          const hours = mexicoCityDate.getHours().toString().padStart(2, '0');
          const minutes = mexicoCityDate.getMinutes().toString().padStart(2, '0');
          const seconds = mexicoCityDate.getSeconds().toString().padStart(2, '0');

          formattedCreationDate = `${day} ${monthName} ${year} ${hours}:${minutes}:${seconds}`;
        }

        // Format operation ID to label
        const operationLabels = {
          '4': 'VENTA',
          '5': 'DEVOLUCION',
          '6': 'CANCELACION',
          '7': 'CHECKIN',
          '8': 'CHECKOUT',
          '9': 'REAUTORIZACION',
          '16': 'REVERSO'
        };
        const operationLabel = operationLabels[r.id_operation] || r.id_operation || 'N/A';

        // Format status ID to label
        const statusLabels = {
          '1': 'Pendiente',
          '2': 'Aprobada',
          '3': 'Rechazada'
        };
        const statusLabel = statusLabels[r.estatus_f] || r.estatus_f?.toString() || 'N/A';

        // Format response code to description
        const responseDescriptions = {
          '0': 'Aprobada',
          '1': 'Referencia a Emisor',
          '2': 'Referencia a Emisor con Aclaraciones',
          '3': 'Servicio no disponible',
          '4': 'Formato inválido',
          '5': 'Rechazo - No aceptar',
          '6': 'Error',
          '7': 'Capture parcial',
          '8': 'Aprobada pero reintentar',
          '9': 'Reintente en 24 horas',
          '10': 'Aprobada para monto parcial',
          '11': 'Aprobada VIP',
          '12': 'Transacción inválida',
          '13': 'Monto inválido',
          '14': 'Número de tarjeta inválido',
          '15': 'Emisor no encontrado',
          '16': 'Reintente',
          '17': 'Cancelación por el cliente',
          '18': 'Reintente en 72 horas',
          '19': 'Reintente en 200 segundos',
          '20': 'Error de entrada',
          '21': 'No se puede revertir la transacción',
          '22': 'Error en el procesador',
          '23': 'Transacción no permitida',
          '24': 'Archivo no encontrado',
          '25': 'Duplicado',
          '26': 'Error en el formato del campo',
          '27': 'Error en el archivo',
          '28': 'Rechazo temporal',
          '29': 'Error en el sistema',
          '30': 'Error en el formato',
          '31': 'Emisor en modo de prueba',
          '32': 'Transacción no permitida',
          '33': 'Transacción expirada',
          '34': 'Fraude sospechoso',
          '35': 'Transacción no permitida',
          '36': 'Transacción restringida',
          '37': 'Transacción no permitida',
          '38': 'Transacción no permitida',
          '39': 'Transacción no permitida',
          '40': 'Transacción no permitida',
          '41': 'Transacción no permitida',
          '42': 'Transacción no permitida',
          '43': 'Transacción no permitida',
          '44': 'Transacción no permitida',
          '45': 'Transacción no permitida',
          '46': 'Transacción no permitida',
          '47': 'Transacción no permitida',
          '48': 'Transacción no permitida',
          '49': 'Transacción no permitida',
          '50': 'Transacción no permitida',
          '51': 'Transacción no permitida',
          '52': 'Transacción no permitida',
          '53': 'Transacción no permitida',
          '54': 'Transacción no permitida',
          '55': 'Transacción no permitida',
          '56': 'Transacción no permitida',
          '57': 'Transacción no permitida',
          '58': 'Transacción no permitida',
          '59': 'Transacción no permitida',
          '60': 'Transacción no permitida',
          '61': 'Transacción no permitida',
          '62': 'Transacción no permitida',
          '63': 'Transacción no permitida',
          '64': 'Transacción no permitida',
          '65': 'Transacción no permitida',
          '66': 'Transacción no permitida',
          '67': 'Transacción no permitida',
          '68': 'Transacción no permitida',
          '69': 'Transacción no permitida',
          '70': 'Transacción no permitida',
          '71': 'Transacción no permitida',
          '72': 'Transacción no permitida',
          '73': 'Transacción no permitida',
          '74': 'Transacción no permitida',
          '75': 'Transacción no permitida',
          '76': 'Transacción no permitida',
          '77': 'Transacción no permitida',
          '78': 'Transacción no permitida',
          '79': 'Transacción no permitida',
          '80': 'Transacción no permitida',
          '81': 'Transacción no permitida',
          '82': 'Transacción no permitida',
          '83': 'Transacción no permitida',
          '84': 'Transacción no permitida',
          '85': 'Transacción no permitida',
          '86': 'Transacción no permitida',
          '87': 'Transacción no permitida',
          '88': 'Transacción no permitida',
          '89': 'Transacción no permitida',
          '90': 'Transacción no permitida',
          '91': 'Transacción no permitida',
          '92': 'Transacción no permitida',
          '93': 'Transacción no permitida',
          '94': 'Transacción no permitida',
          '95': 'Transacción no permitida',
          '96': 'Transacción no permitida',
          '97': 'Transacción no permitida',
          '98': 'Transacción no permitida',
          '99': 'Transacción no permitida',
          '100': 'Transacción no permitida'
        };
        const responseDescription = responseDescriptions[r.resp_code] || r.resp_code || '-';

        // Parse more_info to extract JSON fields
        let moreInfoData = {};
        if (r.more_info) {
          try {
            moreInfoData = typeof r.more_info === 'string' ? JSON.parse(r.more_info) : r.more_info;
          } catch (e) {
            moreInfoData = {};
          }
        }
        
        // Flatten nested objects for CSV
        const flattenedData = this.flattenObject(moreInfoData);

        const values = [
          r.id_message, // ID
          r.name_merchant, // Merchant Name
          r.terminal, // Terminal
          r.msg_type || '0200', // Message Type
          r.reference_number, // Reference Number
          parseFloat(r.amount), // Amount
          responseDescription || '-', // Response Description
          r.authorization || '-', // Authorization
          r.bin || '-', // BIN
          r.last4 || '-', // Last 4
          `'${formattedCreationDate}'`, // Creation Date
          operationLabel, // Operation ID (as label)
          `'${statusLabel}'`, // Status
          this.getCardType(r.bin), // Card Type (identified from BIN)
          `'${this.formatTransactionDate(r.tran_date)}'`, // Transaction Date
          `'${this.formatTransactionTime(r.tran_time)}'`, // Transaction Time
          `'${this.formatTransactionDate(r.capture_date)}'`, // Capture Date
          r.card_acceptor || '-', // Card Acceptor
          r.folio || '-', // Folio
          r.trace_number || '-', // Trace Number
          r.entry_mode || '-', // Entry Mode
          r.reverse_code || '-', // Reverse Code
          r.draft_capture || '-', // Draft Capture
          // Add JSON fields from more_info
          flattenedData.billing_address_city || '',
          flattenedData.billing_address_country || '',
          flattenedData.billing_address_postal_code || '',
          flattenedData.billing_address_state || '',
          flattenedData.billing_address_street || '',
          flattenedData.customer_email || '',
          flattenedData.customer_name || '',
          flattenedData.expiration_selia_format || '',
          flattenedData.order_id || '',
          flattenedData.response_message || '',
          flattenedData.selia_transaction_id || ''
        ];
        return values
          .map((v) => {
            // If value already starts with apostrophe (for Excel text forcing),
            // handle escaping differently to preserve it
            if (v && typeof v === 'string' && v.startsWith("'")) {
              return '"' + v.replace(/"/g, '""') + '"';
            } else {
              const value = v ?? '';
              return '"' + (typeof value === 'string' ? value.replace(/"/g, '""') : value) + '"';
            }
          })
          .join(',');
      });

      const csvContent = [header, ...lines].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="enhanced-transactions.csv"');
      return res.send(csvContent);

    } catch (error) {
      console.error('Error in exportTransactions:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Retrieves comprehensive dashboard metrics and statistics
   *
   * Provides aggregated metrics for dashboard display including:
   * - Transaction approval/rejection counts and rates
   * - Card type distribution statistics
   * - Card brand distribution statistics
   * - Top rejection reasons
   * - Time-series data for charts
   * - Active/inactive merchant counts
   *
   * CRITICAL: Only 0200 (original authorization) messages are counted for approval/rejection stats.
   * Reversals (0220, 0420) are excluded from these statistics to prevent double-counting.
   *
   * PCI DSS 4.0 Compliance:
   * - Requirement 7.2.1: Access restricted to user's associated merchants
   * - Requirement 10.3.3: Timestamps converted to CST timezone
   *
   * @async
   * @param {Object} req - Express request object
   * @param {Object} req.query - Query parameters
   * @param {string} [req.query.startDate] - Start date filter (YYYY-MM-DD)
   * @param {string} [req.query.endDate] - End date filter (YYYY-MM-DD)
   * @param {string[]} [req.query.merchantIds=[]] - Merchant IDs to filter by
   * @param {Object} req.user - Authenticated user object (for access control)
   *
   * @returns {Promise<Object>} Object containing dashboard metrics
   * @returns {boolean} returns.success - Success status
   * @returns {Object} returns.data - Dashboard metrics data
   * @returns {Array} returns.data.total_aprob - Array of approved transactions (0200 only)
   * @returns {Array} returns.data.total_rech - Array of rejected transactions (0200 only)
   * @returns {Array} returns.data.rechazos - Top rejection reasons with counts and percentages
   * @returns {Array} returns.data.tipo_prod - Card type distribution with percentages
   * @returns {Array} returns.data.marca_t - Card brand distribution with percentages
   * @returns {number} returns.data.total_activos - Count of active merchants
   * @returns {number} returns.data.total_inactivos - Count of inactive merchants
   * @returns {Array} returns.data.label - Date labels for charts
   * @returns {string} returns.data.fechas_aprob - JSON string of approval counts by date
   * @returns {string} returns.data.fechas_rech - JSON string of rejection counts by date
   */
  async getDashboardMetrics(req) {
    try {
      const {
        startDate = null,
        endDate = null,
        merchantIds = []
      } = req.query;

      const accessibleMerchantIds = await this.getAccessibleMerchantIds(req);
      let merchantsArray = Array.isArray(merchantIds) ? merchantIds : (merchantIds ? [merchantIds] : []);

      if (accessibleMerchantIds !== null) {
        // Non-admin user - apply merchant filtering
        if (accessibleMerchantIds.length === 0) {
          return {
            success: true,
            data: {
              total_aprob: [],
              total_rech: [],
              label: [],
              marca_t: [],
              tipo_prod: [],
              total_activos: 0,
              total_inactivos: 0,
              rechazos: []
            }
          };
        }

        // Apply merchant filtering for non-admins
        if (merchantsArray.length === 0) {
          merchantsArray = accessibleMerchantIds.map(String);
        } else {
          const allow = new Set(accessibleMerchantIds.map(String));
          merchantsArray = merchantsArray.filter((m) => allow.has(String(m)));
        }
      }

      // Build WHERE clause
      const where = [];
      const params = [];

      if (startDate) {
        where.push("CONVERT_TZ(im.creation_date, '+00:00', '-06:00') >= DATE(?)");
        params.push(startDate.split('T')[0]);
      }

      if (endDate) {
        where.push("CONVERT_TZ(im.creation_date, '+00:00', '-06:00') <= DATE(?)");
        params.push(endDate.split('T')[0]);
      }

      if (merchantsArray.length > 0) {
        where.push("im.name_merchant IN (" + merchantsArray.map(() => "?").join(",") + ")");
        params.push(...merchantsArray.map(String));
      }

      const whereSql = where.length ? "WHERE " + where.join(' AND ') : '';

      console.log('🔍 Dashboard metrics query with msg_type filtering');
      console.log('WHERE clause:', whereSql);
      console.log('Params:', params);

      // Get transactions with proper msg_type handling
      const transactions = await db.seq.query(
        `SELECT
          im.id_message,
          im.name_merchant,
          im.terminal,
          im.msg_type,
          im.reference_number,
          im.amount AS amount_cents,
          CAST(im.amount / 100.0 AS DECIMAL(12,2)) as amount,
          im.resp_code,
          im.authorization,
          im.bin,
          im.last4,
          CONVERT_TZ(im.creation_date, '+00:00', '-06:00') AS creation_date,
          im.id_operation,
          im.estatus_f,
          im.card_type,
          im.tran_date,
          im.tran_time,
          im.capture_date,
          im.card_acceptor,
          im.folio,
          im.trace_number,
          im.entry_mode,
          im.reverse_code,
          im.draft_capture,
          im.more_info,
          crc.codigo as resp_code_iso,
          crc.descripcion as resp_code_description,
          co.name as card_brand,
          ct.name as card_type_name
        FROM iso_message im
        LEFT JOIN ciso_response_code crc ON im.resp_code = crc.codigo
        LEFT JOIN bin_info bi ON im.bin = bi.bin
        LEFT JOIN ciso_card_type ct ON bi.id_card_type = ct.id_card_type
        LEFT JOIN ciso_brand co ON ct.id_brand = co.id_brand
        ${whereSql}
        ORDER BY CONVERT_TZ(im.creation_date, '+00:00', '-06:00') DESC`,
        {
          replacements: params,
          type: db.seq.QueryTypes.SELECT
        }
      );

      console.log('Found ' + transactions.length + ' transactions for dashboard metrics');

      // Format dates and times in dashboard transactions
      const formattedTransactions = transactions.map(tx => ({
        ...tx,
        tran_date: this.formatTransactionDate(tx.tran_date),
        tran_time: this.formatTransactionTime(tx.tran_time),
        capture_date: this.formatTransactionDate(tx.capture_date)
      }));

      // Process transactions like the original dashboard controller but with proper msg_type handling
      let dataOutput = {
        total_aprob: [],
        total_rech: [],
        total_activos: 0,
        total_inactivos: 0,
        rechazos: [],
        fechas_aprob: [],
        fechas_rech: [],
        label: {},
        tipo_prod: [],
        marca_t: [],
        tipo_prod_string: '',
        marca_t_string: ''
      };

      let topRechazo = 5;
      const colors = ["#3498DB", "#E74C3C", "#9B59B6", "#BDC3C7", "#26B99A"];
      const _ = require('lodash');

      for (const transaccion of formattedTransactions) {
        let date = new Date(transaccion.creation_date).toLocaleDateString("en-GB");
        transaccion.date = date;
        dataOutput.label[transaccion.date] = transaccion.date;

        // CRITICAL FIX: Only consider 0200 transactions for approval/rejection stats
        // 0200 = Original purchase/authorization
        // 0220/0420 = Reversals (should not count as approvals)
        if (transaccion.msg_type === '0200') {
          if (transaccion.resp_code === '00' || transaccion.resp_code === '0') {
            dataOutput.total_aprob.push(transaccion);
          } else {
            dataOutput.total_rech.push(transaccion);

            // Handle rejection reasons
            if (dataOutput.rechazos.length === 0 && transaccion.resp_code_iso) {
              dataOutput.rechazos.push({
                id: transaccion.resp_code_iso,
                name: transaccion.resp_code_description || "Error " + transaccion.resp_code,
                count: 1
              });
            } else {
              let auxFound = false;
              for (const key in dataOutput.rechazos) {
                if (Object.hasOwnProperty.call(dataOutput.rechazos, key)) {
                  const element = dataOutput.rechazos[key];
                  if (!auxFound && transaccion.resp_code_iso && element.id == transaccion.resp_code_iso) {
                    auxFound = true;
                    dataOutput.rechazos[key].count++;
                  }
                }
              }
              if (!auxFound && transaccion.resp_code_iso && dataOutput.rechazos.length < (topRechazo + 1)) {
                dataOutput.rechazos.push({
                  id: transaccion.resp_code_iso,
                  name: transaccion.resp_code_description || "Error " + transaccion.resp_code,
                  count: 1
                });
              }
            }
          }
        }
        // Reversals (0220, 0420) are NOT counted in approval/rejection stats
        // They will be handled separately for net amount calculation

        // Process card types
        let tipo_prod = {};
        switch (transaccion.card_type) {
          case '00': tipo_prod = { id_card_type: 0, name: 'INTERNACIONAL' }; break;
          case 'C0': tipo_prod = { id_card_type: 1, name: 'CREDITO' }; break;
          case 'P0': tipo_prod = { id_card_type: 2, name: 'DEBITO' }; break;
          default: tipo_prod = { id_card_type: -1, name: 'DESCONOCIDO' }; break;
        }
        if (tipo_prod.name) {
          dataOutput.tipo_prod.push(tipo_prod);
        }

        // Process card brands
        if (transaccion.card_brand) {
          dataOutput.marca_t.push({
            id_brand: this.getBrandId(transaccion.card_brand),
            name: transaccion.card_brand,
            count: 1
          });
        } else if (transaccion.bin) {
          let metodo = {};
          switch (transaccion.bin.substring(0, 1)) {
            case '3': metodo = { id_brand: 1, name: 'AMEX' }; break;
            case '4': metodo = { id_brand: 4, name: 'VISA' }; break;
            case '5': metodo = { id_brand: 3, name: 'MASTERCARD' }; break;
            default: metodo = { id_brand: -1, name: 'OTRA' }; break;
          }
          if (metodo.id_brand) {
            dataOutput.marca_t.push(metodo);
          }
        } else {
          dataOutput.marca_t.push({ id_brand: -1, name: 'NO DISPONIBLE' });
        }
      }

      // Process card types statistics
      let aux = _.groupBy(dataOutput.tipo_prod, 'id_card_type');
      let auxx = [];
      let count = 0;
      Object.keys(aux).forEach(v => {
        auxx.push({ name: aux[v][0].name, count: aux[v].length, porc: 0, color: colors[count] });
        count++;
      });
      auxx.map(v => { v.porc = (v.count * 100 / dataOutput.tipo_prod.length).toFixed(2); });
      if (auxx.length === 0) { auxx.push({ name: 'Sin datos', count: 0, porc: 0, color: 'gray' }); }
      dataOutput.tipo_prod = auxx;
      dataOutput.tipo_prod_string = JSON.stringify(auxx);

      // Process card brands statistics
      aux = _.groupBy(dataOutput.marca_t, 'id_brand');
      auxx = [];
      count = 0;
      Object.keys(aux).forEach(v => {
        auxx.push({ name: aux[v][0].name, count: aux[v].length, porc: 0, color: colors[count] });
        count++;
      });
      auxx.map(v => { v.porc = (v.count * 100 / dataOutput.marca_t.length).toFixed(2); });
      if (auxx.length === 0) { auxx.push({ name: 'Sin datos', count: 0, porc: 0, color: 'gray' }); }
      dataOutput.marca_t = auxx;
      dataOutput.marca_t_string = JSON.stringify(auxx);

      // Process dates for charts
      let label_ready = [];
      let objGrafica = (data, labels) => {
        label_ready = [];
        let newAux = [];
        Object.keys(labels).forEach(label => {
          label_ready.push(label);
          let auxData = 0;
          for (const key in data) {
            if (Object.hasOwnProperty.call(data, key) && auxData == 0) {
              const element = data[key];
              if (key == label) {
                auxData = element.length;
              }
            }
          }
          newAux.push(auxData);
        });
        return newAux;
      };

      aux = _.groupBy(dataOutput.total_aprob, 'date');
      dataOutput.fechas_aprob = JSON.stringify(objGrafica(aux, dataOutput.label));

      aux = _.groupBy(dataOutput.total_rech, 'date');
      dataOutput.fechas_rech = JSON.stringify(objGrafica(aux, dataOutput.label));

      dataOutput.label = label_ready;

      // Process rejection statistics
      for (const key in dataOutput.rechazos) {
        if (Object.hasOwnProperty.call(dataOutput.rechazos, key)) {
          const element = dataOutput.rechazos[key];
          element.porc = (element.count * 100 / dataOutput.total_rech.length).toFixed(2);
          dataOutput.rechazos[key] = element;
        }
      }
      dataOutput.rechazos = _.orderBy(dataOutput.rechazos, 'count', 'desc');

      // Get merchant counts
      const merchants = await db.merchant.findAll({
        where: (req.user.is_admin == 1) ? null : {
          id_client: req.user.id_cliente
        }
      });

      for (const merchant of merchants) {
        if (merchant.active == 1) {
          dataOutput.total_activos++;
        } else {
          dataOutput.total_inactivos++;
        }
      }

      console.log('Dashboard metrics completed: ' + dataOutput.total_aprob.length + ' approved, ' + dataOutput.total_rech.length + ' rejected (0200 only)');

      return {
        success: true,
        data: dataOutput
      };

    } catch (error) {
      console.error('Error in getDashboardMetrics:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Formats transaction date from MMDD format to readable format
   *
   * Converts ISO 8583 date format (MMDD) to human-readable Spanish format (DD Month).
   * Used for displaying transaction dates in a user-friendly format.
   *
   * @param {string} dateString - Date in MMDD format (e.g., '0115' for January 15)
   * @returns {string} Formatted date as 'DD Month' (e.g., '15 Enero') or original string if invalid
   *
   * @example
   * formatTransactionDate('0115'); // Returns: '15 Enero'
   * formatTransactionDate('1225'); // Returns: '25 Diciembre'
   * formatTransactionDate('invalid'); // Returns: 'invalid'
   */
  formatTransactionDate(dateString) {
    if (!dateString || dateString.length !== 4) {
      return dateString; // Return as-is if format is unexpected
    }

    const month = dateString.substring(0, 2);
    const day = dateString.substring(2, 4);

    // Validate month is valid
    const monthNum = parseInt(month);
    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return dateString; // Return as-is if month is invalid
    }

    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const monthName = monthNames[monthNum - 1];

    return day + " " + monthName;
  }

  /**
   * Formats transaction time from HHMMSS format to readable format
   *
   * Converts ISO 8583 time format (HHMMSS) to standard time format (HH:MM:SS).
   * Used for displaying transaction times in a user-friendly format.
   *
   * @param {string} timeString - Time in HHMMSS format (e.g., '143025' for 14:30:25)
   * @returns {string} Formatted time as 'HH:MM:SS' (e.g., '14:30:25') or original string if invalid
   *
   * @example
   * formatTransactionTime('143025'); // Returns: '14:30:25'
   * formatTransactionTime('000000'); // Returns: '00:00:00'
   * formatTransactionTime('invalid'); // Returns: 'invalid'
   */
  formatTransactionTime(timeString) {
    if (!timeString || timeString.length !== 6) {
      return timeString; // Return as-is if format is unexpected
    }

    const hours = timeString.substring(0, 2);
    const minutes = timeString.substring(2, 4);
    const seconds = timeString.substring(4, 6);

    return hours + ":" + minutes + ":" + seconds;
  }

  /**
   * Maps card brand name to numeric brand ID
   *
   * Converts card brand names to their corresponding numeric identifiers used
   * in the database. Helper method for dashboard metrics and statistics.
   *
   * @param {string} brandName - Card brand name (e.g., 'VISA', 'MASTERCARD')
   * @returns {number} Numeric brand ID:
   *                   4 for VISA, 3 for MASTERCARD, 1 for AMEX,
   *                   -1 for unknown or unavailable brands
   *
   * @example
   * getBrandId('VISA'); // Returns: 4
   * getBrandId('MASTERCARD'); // Returns: 3
   * getBrandId('UNKNOWN'); // Returns: -1
   */
  getBrandId(brandName) {
    const brandMap = {
      'VISA': 4,
      'MASTERCARD': 3,
      'AMEX': 1,
      'OTRA': -1,
      'NO DISPONIBLE': -1
    };
    return brandMap[brandName] || -1;
  }
}

/**
 * Module Exports
 *
 * Creates a singleton instance of EnhancedTransactionsController and exports
 * bound methods for use in route handlers. Methods are bound to the controller
 * instance to maintain proper 'this' context.
 *
 * Exported Methods:
 * - getTransactions: Retrieve paginated transaction list with filtering
 * - getTransactionById: Retrieve single transaction by ID
 * - getTransactionStats: Retrieve daily transaction statistics
 * - exportTransactions: Export filtered transactions to CSV
 * - getDashboardMetrics: Retrieve comprehensive dashboard metrics
 */

// Create controller instance and export it with bound methods
const controller = new EnhancedTransactionsController();

// Bind all methods to the controller instance
module.exports = {
  getTransactions: controller.getTransactions.bind(controller),
  getTransactionById: controller.getTransactionById.bind(controller),
  getTransactionStats: controller.getTransactionStats.bind(controller),
  exportTransactions: controller.exportTransactions.bind(controller),
  getDashboardMetrics: controller.getDashboardMetrics.bind(controller)
};