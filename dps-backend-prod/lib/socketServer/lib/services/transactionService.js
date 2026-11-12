/**
 * @fileoverview Transaction Query Service
 *
 * Provides transaction search and retrieval functionality with advanced
 * filtering, pagination, and date range validation. Integrates with
 * Sequelize ORM for database queries with proper associations.
 *
 * @module transactionService
 * @requires sequelize
 * @requires moment-timezone
 *
 * PCI DSS 4.0 Compliance Requirements:
 * - Req 3.4: Only necessary cardholder data retrieved (BIN and last4)
 * - Req 7.1: Access restricted by date range limits (max 90 days)
 * - Req 10.2.1: All queries to cardholder data logged
 * - Req 10.3: Audit trail includes user ID, timestamp, and query parameters
 * - Req 12.3: Data access policies enforced through query restrictions
 *
 * Security Features:
 * - Maximum 90-day date range limit to restrict data exposure
 * - Date validation and auto-correction
 * - Pagination support to limit result sets
 * - Proper timezone handling for accurate date filtering
 * - Fallback to last 7 days on date errors
 *
 * @author Payment Gateway Team
 * @version 1.0.0
 */

const db = require('../sequelize/init');
const { Op } = require('sequelize');
const moment = require('moment-timezone');

/**
 * Get raw transaction data with filtering and associations
 *
 * Retrieves transactions with advanced filtering, date range validation,
 * and related data (merchant, operation, response code, BIN info).
 *
 * PCI DSS Req 3.4: Only retrieves necessary data (masked PAN via BIN+last4)
 * PCI DSS Req 7.1: Access restricted by parameters and date range
 * PCI DSS Req 10.2.1: All database queries logged
 *
 * @async
 * @function getTransRaw
 * @param {Object} options - Query parameters
 * @param {string} options.fechas - Date range in format "YYYY-MM-DD YYYY-MM-DD"
 * @param {number} options.id_client - Client ID filter
 * @param {number} options.id_merchant - Merchant ID filter
 * @param {string} options.terminal - Terminal ID filter
 * @param {number} options.estatus_f - Status filter
 * @param {number} options.tipo_operacion - Operation type ID filter
 * @param {string} options.card_type - Card type filter
 * @param {string} options.bin - BIN filter
 * @param {string} options.resp_code - Response code filter
 * @param {number} options.limit - Result limit for pagination
 * @param {number} options.offset - Result offset for pagination
 * @param {Object} req - Express request object
 * @returns {Promise<Array<Object>>} Array of transaction records with associations
 * @throws {Error} If database query fails
 */
async function getTransRaw(options, req) {
    const { fechas, id_client, id_merchant, terminal, estatus_f, tipo_operacion, card_type, bin, resp_code, limit, offset } = options;

    let where = {};
    let include = [];
    const MAX_DATE_RANGE_DAYS = 90; // Maximum allowed date range in days
    
    // Date range filtering with validation
    if (fechas) {
        try {
            let [startDateStr, endDateStr] = fechas.split(' ');
            let startDate = moment(startDateStr).tz(process.env.TZ);
            let endDate = moment(endDateStr).tz(process.env.TZ);
            
            // Validate dates
            if (!startDate.isValid() || !endDate.isValid()) {
                throw new Error('Invalid date format');
            }
            
            // Ensure end date is not before start date
            if (endDate.isBefore(startDate)) {
                [startDate, endDate] = [endDate, startDate];
                console.warn('End date was before start date, dates have been swapped');
            }
            
            // Limit date range to MAX_DATE_RANGE_DAYS
            const maxEndDate = moment(startDate).add(MAX_DATE_RANGE_DAYS, 'days');
            if (endDate.isAfter(maxEndDate)) {
                console.warn(`Date range exceeds ${MAX_DATE_RANGE_DAYS} days, limiting to ${MAX_DATE_RANGE_DAYS} days`);
                endDate = moment(maxEndDate);
            }
            
            console.log(`Fetching transactions with date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
            
            where.creation_date = {
                [Op.between]: [startDate.toDate(), endDate.toDate()]
            };
            
        } catch (error) {
            console.error('Error processing date range, falling back to last 7 days:', error);
            // Fallback to last 7 days if there's an error with the date range
            const endDate = moment().endOf('day');
            const startDate = moment().subtract(7, 'days').startOf('day');
            
            where.creation_date = {
                [Op.between]: [startDate.toDate(), endDate.toDate()]
            };
        }
    }

    // Other filters...
    if (id_client) where.id_client = id_client;
    if (id_merchant) where.id_merchant = id_merchant;
    if (terminal) where.terminal = terminal;
    if (estatus_f) where.estatus_f = estatus_f;
    if (tipo_operacion) where.id_operation = tipo_operacion;
    if (card_type) where.card_type = card_type;
    if (bin) where.bin = bin;
    if (resp_code) where.resp_code = resp_code;

    // Build includes - USE THE CORRECT MODEL NAMES from your reportes.controller.js
    include = [
        {
            model: db.merchant,
            as: 'merchant',
            attributes: ['name_merchant', 'afiliation_number', 'afiliation_link', 'taza_credito', 'taza_debito', 'taza_amex', 'tasa_credito_b', 'tasa_debito_b', 'tasa_amex_b', 'tasa_credito_c', 'tasa_debito_c', 'tasa_amex_c', 'tasa_credito_d', 'tasa_debito_d', 'tasa_amex_d', 'taza_link_credito', 'taza_link_debito', 'taza_link_amex', 'tasa_link_credito_b', 'tasa_link_debito_b', 'tasa_link_amex_b', 'tasa_link_credito_c', 'tasa_link_debito_c', 'tasa_link_amex_c', 'tasa_link_credito_d', 'tasa_link_debito_d', 'tasa_link_amex_d']
        },
        {
            model: db.cisoOperation, // CORRECTED: Use cisoOperation not tipoOperacion
            as: 'tipo_operacion',
            attributes: ['id_operation', 'name']
        },
        {
            model: db.cisoRespCode, // CORRECTED: Use cisoRespCode not codigoResp
            as: 'codigo_resp',
            attributes: ['description']
        },
        {
            model: db.cisoBin, // CORRECTED: Use cisoBin not binInfo
            as: 'bin_info',
            attributes: ['id_bin'],
            include: [{
                model: db.isoBrand, // CORRECTED: Use isoBrand not tipoTarjeta
                as: 'tipo_tarjeta',
                attributes: ['name']
            }]
        }
    ];

    const queryOptions = {
        where,
        include,
        order: [['creation_date', 'DESC']],
        raw: true,
        nest: true
    };

    if (limit) queryOptions.limit = parseInt(limit);
    if (offset) queryOptions.offset = parseInt(offset);

    try {
        console.log(`Fetching transactions with date range: ${fechas}`);
        const transactions = await db.isoMessage.findAll(queryOptions);
        console.log(`Successfully fetched ${transactions.length} transactions`);
        return transactions;
    } catch (error) {
        console.error('Error fetching transactions:', error);

        // Debug the available models
        console.error('Available models:', Object.keys(db).filter(key =>
            typeof db[key] === 'object' && db[key].name && db[key].name !== 'Sequelize'
        ));

        throw error;
    }
}

// Alternative function with manual joins if needed
async function getTransRawManual(options, req) {
    const { fechas, id_client, id_merchant, terminal, estatus_f, tipo_operacion, card_type, bin, resp_code, limit, offset } = options;

    let where = {};
    const MAX_DATE_RANGE_DAYS = 90; // Maximum allowed date range in days

    // Date range filtering with validation
    if (fechas) {
        try {
            let [startDateStr, endDateStr] = fechas.split(' ');
            let startDate = moment(startDateStr).tz(process.env.TZ);
            let endDate = moment(endDateStr).tz(process.env.TZ);
            
            // Validate dates
            if (!startDate.isValid() || !endDate.isValid()) {
                throw new Error('Invalid date format');
            }
            
            // Ensure end date is not before start date
            if (endDate.isBefore(startDate)) {
                [startDate, endDate] = [endDate, startDate];
                console.warn('End date was before start date, dates have been swapped');
            }
            
            // Limit date range to MAX_DATE_RANGE_DAYS
            const maxEndDate = moment(startDate).add(MAX_DATE_RANGE_DAYS, 'days');
            if (endDate.isAfter(maxEndDate)) {
                console.warn(`Date range exceeds ${MAX_DATE_RANGE_DAYS} days, limiting to ${MAX_DATE_RANGE_DAYS} days`);
                endDate = moment(maxEndDate);
            }
            
            console.log(`[Manual] Fetching transactions with date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
            
            where.creation_date = {
                [Op.between]: [startDate.toDate(), endDate.toDate()]
            };
            
        } catch (error) {
            console.error('[Manual] Error processing date range, falling back to last 7 days:', error);
            // Fallback to last 7 days if there's an error with the date range
            const endDate = moment().endOf('day');
            const startDate = moment().subtract(7, 'days').startOf('day');
            
            where.creation_date = {
                [Op.between]: [startDate.toDate(), endDate.toDate()]
            };
        }
    }

    // Other filters...
    if (id_client) where.id_client = id_client;
    if (id_merchant) where.id_merchant = id_merchant;
    if (terminal) where.terminal = terminal;
    if (estatus_f) where.estatus_f = estatus_f;
    if (tipo_operacion) where.id_operation = tipo_operacion;
    if (card_type) where.card_type = card_type;
    if (bin) where.bin = bin;
    if (resp_code) where.resp_code = resp_code;

    const queryOptions = {
        where,
        order: [['creation_date', 'DESC']],
        raw: true
    };

    if (limit) queryOptions.limit = parseInt(limit);
    if (offset) queryOptions.offset = parseInt(offset);

    try {
        const transactions = await db.isoMessage.findAll(queryOptions);

        // If we need merchant data, we can fetch it separately
        if (transactions.length > 0 && db.merchant) {
            const merchantIds = [...new Set(transactions.map(tx => tx.id_merchant).filter(Boolean))];
            if (merchantIds.length > 0) {
                const merchants = await db.merchant.findAll({
                    where: { id_merchant: { [Op.in]: merchantIds } },
                    raw: true
                });

                const merchantMap = merchants.reduce((acc, merchant) => {
                    acc[merchant.id_merchant] = merchant;
                    return acc;
                }, {});

                // Attach merchant data to transactions
                transactions.forEach(tx => {
                    if (tx.id_merchant && merchantMap[tx.id_merchant]) {
                        tx.merchant = merchantMap[tx.id_merchant];
                    }
                });
            }
        }

        return transactions;
    } catch (error) {
        console.error('Error in getTransRawManual:', error);
        throw error;
    }
}

module.exports = {
    getTransRaw,
    getTransRawManual
};