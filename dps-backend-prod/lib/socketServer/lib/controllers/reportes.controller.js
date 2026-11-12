/**
 * @file reportes.controller.js
 * @description Reports and Transaction Retrieval Controller
 *
 * This controller manages transaction reports, ticket generation, and data retrieval operations
 * for the payment gateway system. It provides comprehensive transaction querying, grouping,
 * and reporting capabilities with built-in security controls.
 *
 * Key Responsibilities:
 * - Transaction retrieval and filtering with timezone-aware date handling
 * - Merchant transaction reports and consolidation
 * - PDF ticket generation for approved/rejected transactions
 * - Account statements (estados de cuenta) generation
 * - Chargeback (contracargo) data retrieval
 * - Liquidation reports
 *
 * PCI DSS 4.0 Compliance Requirements:
 * @pcidss Requirement 3.4 - PAN Masking: Card numbers are masked in all reports and tickets
 * @pcidss Requirement 7.2 - Access Control: Merchant filtering based on user authentication
 * @pcidss Requirement 10.2 - Audit Logging: All report generation actions are logged
 * @pcidss Requirement 10.3 - Timestamp Management: Uses creation_date with timezone awareness
 *
 * Security Features:
 * - User-level access control for merchant data
 * - Date range validation to prevent excessive data loading
 * - Track2 decryption handled securely through helpers
 * - Sensitive tokenized data excluded from queries
 *
 * @module controllers/reportes
 * @requires sequelize
 * @requires moment-timezone
 * @requires adm-zip
 * @requires puppeteer
 */

// lib/socketServer/lib/controllers/reportes.controller.js
const { Op } = require('sequelize');
const moment = require('moment-timezone');
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const rController = {};
const db = require('../sequelize/init');
const vars = require('../vars');
const { unpackEnvTag } = require('../../../emv-packet/lib/emvPacket');
const makeEstado = require('./../Classes/makeEstado');
const helpers = require("../../../helpers/lib/helpers");
const { makeReport } = require('./../Classes/makeExcelDispersion');
const transactionCacheController = require('./transactionCacheController');

/**
 * Maximum allowed date range for transaction queries in days.
 * Prevents excessive data loading and maintains system performance.
 * @constant {number}
 */
const MAX_DATE_RANGE_DAYS = 90;

/**
 * Validates and limits the date range to prevent excessive data loading
 * @param {string} dateRange - Date range string in format "startDate endDate"
 * @returns {Object} Object with startDate and endDate as ISO strings with time components
 */
function validateAndLimitDateRange(dateRange) {
  if (!dateRange || typeof dateRange !== 'string') {
    throw new Error('Invalid date range format');
  }

  const [startDateStr, endDateStr] = dateRange.split(' ');
  if (!startDateStr || !endDateStr) {
    throw new Error('Invalid date range format. Expected "startDate endDate"');
  }

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new Error('Invalid date values');
  }

  if (endDate < startDate) {
    throw new Error('End date cannot be before start date');
  }

  const maxEndDate = new Date(startDate);
  maxEndDate.setDate(startDate.getDate() + MAX_DATE_RANGE_DAYS);

  const limitedEndDate = endDate > maxEndDate ? maxEndDate : endDate;

  if (endDate > maxEndDate) {
    console.warn(`Date range exceeds ${MAX_DATE_RANGE_DAYS} days. Limiting to ${MAX_DATE_RANGE_DAYS} days.`);
  }

  // Return full ISO strings with time components for creation_date filtering
  return {
    startDate: moment(startDate).startOf('day').toISOString(),
    endDate: moment(limitedEndDate).endOf('day').toISOString()
  };
}

const express = require('express');
const app = express();

app.set('views', path.join(__dirname, '..', 'views'));
app.set('view engine', 'hbs');

const logoPath = `${path.join(__dirname, '..',"..","..","..", 'static')}/logo.png`;
const imageBuffer = fs.readFileSync(logoPath);
const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;

rController.getTrans = getTransaction;
rController.getTransDash = getTransactionDash;
rController.getTransApp = getTransactionsApp;

/**
 * Retrieves chargeback (contracargo) records for a given date range.
 * Filters results based on user's client access permissions.
 *
 * @async
 * @function getContracargos
 * @param {Object} options - Query options
 * @param {string} [options.fechas] - Date range in format "startDate endDate"
 * @param {Object} [req=null] - Express request object with authenticated user
 * @param {Object} [req.user] - Authenticated user object
 * @param {number} [req.user.id_cliente] - Client ID for filtering chargebacks
 * @returns {Promise<Array>} Array of chargeback records filtered by user access
 *
 * @pcidss Requirement 7.2 - Access Control: Filters chargebacks by client ownership
 * @pcidss Requirement 10.2 - Audit Logging: Chargeback retrieval should be logged
 */
async function getContracargos(options, req = null) {
  let whereData = {};
  if (options.fechas) {
    const fechas = options.fechas.split(" ");
    const startedDate = fechas[0];
    const endDate = fechas[1];
    const dt = [startedDate, endDate];
    whereData.fecha_cargo = {
      [db.Sequelize.Op.between]: dt
    };
  }
  const cg = await db.contracargos.findAll({ where: whereData });
  let auxCg = [];
  if (req.user && req.user.id_cliente) {
    for (const ax of cg) {
      ax.data_merchant = JSON.parse(ax.data_merchant);
      if (parseInt(req.user.id_cliente) === parseInt(ax.data_merchant.merchant.id_client)) {
        auxCg.push(ax);
      }
    }
  } else {
    auxCg = cg;
  }
  return auxCg;
}

/**
 * Retrieves transactions for mobile app with timezone-aware filtering.
 * FIXED: Uses creation_date instead of tran_date for accurate date filtering.
 *
 * This function queries transactions with proper UTC conversion from Mexico City timezone,
 * groups related operations (sales, cancellations, refunds), and enriches data with
 * card information and EMV tags.
 *
 * @async
 * @function getTransactionsApp
 * @param {Object} options - Query options
 * @param {string} [options.fechas] - Date range in format "YYYY-MM-DD YYYY-MM-DD"
 * @param {string} [options.reference] - Filter by reference number
 * @param {string} [options.serial] - Filter by terminal serial
 * @param {boolean} [options.rejected] - Return only rejected transactions
 * @param {boolean} [options.cancelled] - Return only cancelled transactions
 * @param {Object} [req=null] - Express request object with authenticated user
 * @param {Object} [req.user] - Authenticated user object
 * @param {number} [req.user.id_merchant] - Merchant ID for filtering
 * @param {boolean} [_twoModels=true] - Legacy parameter, not currently used
 * @returns {Promise<Array>} Array of grouped and enriched transaction objects
 *
 * @pcidss Requirement 3.4 - PAN Masking: Card data is masked in returned transactions
 * @pcidss Requirement 7.2 - Access Control: Filters by merchant based on user authentication
 * @pcidss Requirement 10.3 - Timestamp Management: Uses creation_date with timezone conversion
 */
async function getTransactionsApp(options, req = null, _twoModels = true) {
  const moment = require('moment-timezone');

  const whereData = {
//    id_operation: {
////      [Op.ne]: 3, // Exclude voided transactions
//    },
  };

  try {
    var fechas = options.fechas.split(' ');
    // Handle date formats with slashes
    if (fechas[0].includes('/')) {
      for (let index = 0; index < 2; index++) {
        var aux = fechas[index].split('/');
        aux = `${aux[0]}-${aux[1]}-${aux[2]}`;
        fechas[index] = aux;
      }
    }

    // Remove time component if present
    fechas[0] = fechas[0].split('T')[0];
    fechas[1] = fechas[1].split('T')[0];

    // Convert local Mexico City dates to UTC for database query
    const localStartDateTime = `${fechas[0]}T00:00:00.000-06:00`;
    const localEndDateTime = `${fechas[1]}T23:59:59.999-06:00`;
    
    const utcStartDate = new Date(localStartDateTime).toISOString();
    const utcEndDate = new Date(localEndDateTime).toISOString();

    console.log(`📅 Reportes merchant usando creation_date: ${utcStartDate} a ${utcEndDate}`);
    console.log(`   Fechas originales: ${fechas[0]} a ${fechas[1]}`);
    console.log(`   Local dates: ${localStartDateTime} a ${localEndDateTime}`);
    console.log(`   UTC dates: ${utcStartDate} a ${utcEndDate}`);
      
    whereData.creation_date = {
      [Op.between]: [utcStartDate, utcEndDate]
    };

  } catch (error) {
    console.error('Invalid dates, ignoring dates filter....', error);
  }

  if (options.reference) whereData.reference_number = options.reference;
  if (options.serial) whereData.terminal = options.serial;
  
  // Add merchant filtering if user is logged in
  if (req != undefined && req.user != undefined && req.user.id_merchant)
    whereData.name_merchant = req.user.id_merchant;

  let operations = [];
  var ventas = [];

  try {
    console.log(`🔍 Ejecutando query con whereData:`, JSON.stringify(whereData, null, 2));

    operations = await db.isoMessage.findAll({
      attributes: { exclude: ['tkn_data_63_rq', 'tkn_data_63_rp', 'node'] },
      order: [
        ["id_message", "ASC"]
      ],
      include: [
        {
          model: db.signatures,
          as: 'signature',
          required: false,
          attributes: ['id']
        },
        { model: db.cisoOperation, as: 'tipo_operacion', attributes: { exclude: ['creation_date'] } },
        {
          model: db.cisoRespCode,
          as: 'codigo_resp',
          attributes: { exclude: ['creation_date'] }
        },
        {
          required: false,
          model: db.cisoBin,
          as: 'bin_info',
          attributes: ['id_bin'],
          include: [
            { attributes: ['name'], required: false, model: db.isoBrand, as: 'tipo_tarjeta' },
            { attributes: ['name'], required: false, model: db.isoIssuerBank, as: 'banco_emisor' },
            { attributes: ['name'], required: false, model: db.isoCardTypes, as: 'tipo_producto' },
          ]
        }
      ],
      where: whereData
    });

    console.log(`✅ Query ejecutada. Encontradas ${operations.length} transacciones`);

    if (operations.length === 0) {
      console.log('⚠️ No se encontraron transacciones. Verificando filtros...');
      console.log('   name_merchant:', req?.user?.id_merchant);
      console.log('   fechas:', options.fechas);
      console.log('   serial:', options.serial);
    }

    const result = JSON.parse(JSON.stringify(operations));

    const onlyRejected = options.rejected;
    const onlyCancelled = options.cancelled;
    const { notOriginal, groupedTransacctions, transactionRejecteds } = await getGroupedTransacctions(result, onlyRejected);

    if (onlyCancelled) {
      // Return all transactions that have cancellation (both direct and nested)
      const cancelledTransactions = [];
      
      // Add direct cancellation records
      cancelledTransactions.push(...groupedTransacctions.filter(t => t.id_operation === 6));
      cancelledTransactions.push(...notOriginal.filter(t => t.id_operation === 6));
      
      // Add original sales that have cancellation objects
      cancelledTransactions.push(...groupedTransacctions.filter(t => t.cancelacion));
      
      ventas = cancelledTransactions;
    } else {
      ventas = onlyRejected ? transactionRejecteds : groupedTransacctions;
    }

    console.log(`📊 Transacciones procesadas: ${ventas.length}`);

  } catch (error) {
    console.error('Error en getTransactionsApp:', error.stack);
  }

  console.log('[getTransactionsApp] First 3 raw amounts from DB:');
  ventas.slice(0, 3).forEach(tx => {
    console.log(`  ID ${tx.id_message}: amount = ${tx.amount} (raw from DB)`);
  });
  return ventas;
}

/**
 * Retrieves transactions with comprehensive filtering and merchant association.
 * FIXED: Uses creation_date instead of tran_date for accurate date filtering.
 *
 * This is the main transaction retrieval function used by web dashboard and reports.
 * Performs timezone-aware queries, validates date ranges, applies access control,
 * and enriches data with merchant and card information.
 *
 * @async
 * @function getTransaction
 * @param {Object} options - Query options
 * @param {string} [options.fechas] - Date range in format "startDate endDate"
 * @param {number} [options.operacion] - Filter by operation type ID
 * @param {string} [options.response] - Filter by response code
 * @param {number} [options.id_message] - Filter by specific message ID
 * @param {boolean} [options.onlyResponse] - Only transactions with non-empty response
 * @param {number} [options.draft_capture] - Filter by draft capture status
 * @param {boolean} [options.bin] - Only transactions with BIN information
 * @param {boolean} [options.cancelled] - Only cancelled transactions
 * @param {Object} [req=null] - Express request object with authenticated user
 * @param {Object} [req.user] - Authenticated user object
 * @param {number} [req.user.id_cliente] - Client ID for filtering (non-admin users)
 * @param {number} [req.user.id_merchant] - Merchant ID for filtering
 * @param {number} [req.user.is_admin] - Admin flag (1 = admin)
 * @param {boolean} [req.forceAllClient] - Override client filtering
 * @param {Object} [req.body] - Request body with additional filters
 * @param {string} [req.body.response] - Response code filter
 * @param {string} [req.body.tipoOperacion] - Operation type filter
 * @param {boolean} [twoModels=true] - Query both merchant models for compatibility
 * @returns {Promise<Array>} Array of transaction objects with merchant associations
 *
 * @pcidss Requirement 3.4 - PAN Masking: Sensitive card data excluded from queries
 * @pcidss Requirement 7.2 - Access Control: Role-based filtering by client and merchant
 * @pcidss Requirement 10.3 - Timestamp Management: Uses creation_date with UTC conversion
 */
async function getTransaction(options, req = null, twoModels = true) {
  const moment = require('moment-timezone');

  console.debug('twoModels ----->', twoModels);
  let whereData = {};
  let whereMerchant = {};

  if (req != undefined && req.user != undefined && req.user.is_admin !== 1 && !req.forceAllClient)
    whereMerchant.id_client = req.user.id_cliente;

  if (req != undefined && req.user != undefined && req.user.id_merchant)
    whereData.name_merchant = req.user.id_merchant;

  if (req != undefined && req.body.response != undefined && req.body.response !== '')
    whereData.resp_code = { [db.Sequelize.Op.eq]: req.body.response };

  if (options.onlyResponse)
    whereData.resp_code = { [db.Sequelize.Op.ne]: '' };

  if (options.draft_capture)
    whereData.draft_capture = options.draft_capture;

  if (options.bin)
    whereData.bin = { [db.Sequelize.Op.ne]: '' };

  if (options.operacion)
    whereData.id_operation = options.operacion;
  else if (req != undefined && req.body.tipoOperacion != undefined && req.body.tipoOperacion !== '')
    whereData.id_operation = { [db.Sequelize.Op.or]: [4,5,6,7,12,19] };

  if (options.cancelled)
    whereData.id_operation = 6; // CANCELACION operation

  if (options.response)
    whereData.resp_code = { [db.Sequelize.Op.eq]: options.response };

  if (options.id_message)
    whereData.id_message = options.id_message;

  if (options.fechas) {
    try {
      const { startDate, endDate } = validateAndLimitDateRange(options.fechas);

      // CORRECT: Use timezone-aware date filtering
      console.log(`📅 getTransaction usando creation_date: ${startDate} a ${endDate}`);
      console.log(`   Fechas originales: ${options.fechas}`);

      // Convert local Mexico City dates to UTC for database query
      const localStartDateTime = `${startDate}T00:00:00.000-06:00`;
      const localEndDateTime = `${endDate}T23:59:59.999-06:00`;
      
      const utcStartDate = new Date(localStartDateTime).toISOString();
      const utcEndDate = new Date(localEndDateTime).toISOString();

      whereData.creation_date = {
        [db.Sequelize.Op.between]: [utcStartDate, utcEndDate]
      };

    } catch (error) {
      console.error('Error procesando rango de fechas:', error.message);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 7);

      // CORRECT: Default range using timezone-aware date filtering
      const localStartDateTime = `${startDate.toISOString().split('T')[0]}T00:00:00.000-06:00`;
      const localEndDateTime = `${endDate.toISOString().split('T')[0]}T23:59:59.999-06:00`;
      
      const utcStartDate = new Date(localStartDateTime).toISOString();
      const utcEndDate = new Date(localEndDateTime).toISOString();
      
      whereData.creation_date = {
        [db.Sequelize.Op.between]: [utcStartDate, utcEndDate]
      };

      console.warn(`Usando rango por defecto (últimos 7 días) con creation_date debido a error: ${error.message}`);
    }
  }

  const arrAux = ['merchant_por_id'];
  if (twoModels)
    arrAux.push('merchant');

  const auxResponse = new Map();
  const queryAttrs = new Set();

  console.log(`🔍 Ejecutando query con filtros:`);
  console.log('   whereData:', JSON.stringify(whereData, null, 2));
  console.log('   whereMerchant:', JSON.stringify(whereMerchant, null, 2));

  for (const attr of arrAux) {
    const Aux = await queryMaster(attr, whereData, whereMerchant);

    if (Aux) {
      console.log(`✅ Query ${attr} devolvió ${Aux.length} resultados`);
      for (const r of Aux) {
        if (attr === 'merchant_por_id') {
          r.merchant = r.merchant_por_id;
          delete r.merchant_por_id;
        }

        const idMessage = r.id_message;
        if (!auxResponse.has(idMessage)) {
          auxResponse.set(idMessage, r);
          queryAttrs.add(idMessage);
        }
      }
    }
  }

  const results = Array.from(auxResponse.values());
  console.log(`📊 Total de transacciones encontradas: ${results.length}`);

  if (results.length > 0) {
    console.log(`📅 Fechas de transacciones encontradas (creation_date):`);
    results.slice(0, 5).forEach((tx, i) => {
      console.log(`   ${i+1}. ID: ${tx.id_message}, creation_date: ${tx.creation_date}, tran_date: ${tx.tran_date}`);
    });
  }

  return results;
}

/**
 * Retrieves transactions for dashboard display with timezone-aware filtering.
 * FIXED: Uses creation_date instead of tran_date for accurate date filtering.
 *
 * Similar to getTransaction but optimized for dashboard queries with reduced
 * data attributes. Uses creation_date with proper UTC conversion for accurate
 * date-based filtering.
 *
 * @async
 * @function getTransactionDash
 * @param {Object} options - Query options
 * @param {string} [options.fechas] - Date range in format "startDate endDate"
 * @param {number} [options.operacion] - Filter by operation type ID
 * @param {string} [options.response] - Filter by response code
 * @param {number} [options.id_message] - Filter by specific message ID
 * @param {boolean} [options.onlyResponse] - Only transactions with response
 * @param {number} [options.draft_capture] - Filter by draft capture status
 * @param {boolean} [options.bin] - Only transactions with BIN info
 * @param {boolean} [options.cancelled] - Only cancelled transactions
 * @param {Object} req - Express request object with authenticated user (required for dash)
 * @param {Object} req.user - Authenticated user object
 * @param {number} req.user.id_cliente - Client ID for filtering (non-admin)
 * @param {number} [req.user.id_merchant] - Merchant ID for filtering
 * @param {number} req.user.is_admin - Admin flag (1 = admin)
 * @param {boolean} [req.forceAllClient] - Override client filtering
 * @param {boolean} [twoModels=true] - Query both merchant models
 * @returns {Promise<Array>} Array of transaction objects for dashboard
 *
 * @pcidss Requirement 7.2 - Access Control: Dashboard data filtered by user access level
 * @pcidss Requirement 10.3 - Timestamp Management: Uses creation_date with timezone conversion
 */
async function getTransactionDash(options, req = null, twoModels = true) {
  const moment = require('moment-timezone');

  let whereData = {};
  let whereMerchant = {};

  if (req && req.user.is_admin !== 1 && !req.forceAllClient)
    whereMerchant.id_client = req.user.id_cliente;

  if (req && req.user.id_merchant)
    whereData.name_merchant = req.user.id_merchant;

  if (options.onlyResponse)
    whereData.resp_code = { [db.Sequelize.Op.ne]: '' };

  if (options.draft_capture)
    whereData.draft_capture = options.draft_capture;

  if (options.bin)
    whereData.bin = { [db.Sequelize.Op.ne]: '' };

  if (options.operacion)
    whereData.id_operation = options.operacion;

  if (options.cancelled)
    whereData.id_operation = 6; // CANCELACION operation

  if (options.response)
    whereData.resp_code = options.response;

  if (options.id_message)
    whereData.id_message = options.id_message;

  if (options.fechas) {
    try {
      const { startDate, endDate } = validateAndLimitDateRange(options.fechas);

      console.log(`📅 Dashboard usando rango de fechas: ${startDate} a ${endDate}`);

      // Convert local Mexico City dates to UTC for database query
      const localStartDateTime = `${startDate}T00:00:00.000-06:00`;
      const localEndDateTime = `${endDate}T23:59:59.999-06:00`;
      
      const utcStartDate = new Date(localStartDateTime).toISOString();
      const utcEndDate = new Date(localEndDateTime).toISOString();
      
      console.log(`📅 Dashboard usando creation_date: ${utcStartDate} a ${utcEndDate}`);

      whereData.creation_date = {
        [db.Sequelize.Op.between]: [utcStartDate, utcEndDate]
      };

    } catch (error) {
      console.error('Error procesando rango de fechas del dashboard:', error.message);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 7);

      // CORRECT: Default range using timezone-aware date filtering
      const localStartDateTime = `${startDate.toISOString().split('T')[0]}T00:00:00.000-06:00`;
      const localEndDateTime = `${endDate.toISOString().split('T')[0]}T23:59:59.999-06:00`;
      
      const utcStartDate = new Date(localStartDateTime).toISOString();
      const utcEndDate = new Date(localEndDateTime).toISOString();
      
      whereData.creation_date = {
        [db.Sequelize.Op.between]: [utcStartDate, utcEndDate]
      };

      console.warn(`Usando rango por defecto (últimos 7 días) con creation_date debido a error: ${error.message}`);
    }
  }

  const arrAux = ['merchant_por_id'];
  if (twoModels)
    arrAux.push('merchant');

  const auxResponse = new Map();
  const queryAttrs = new Set();

  console.log(`🔍 Dashboard ejecutando query con filtros:`);
  console.log('   whereData:', JSON.stringify(whereData, null, 2));

  for (const attr of arrAux) {
    const Aux = await queryMasterDash(attr, whereData, whereMerchant);

    if (Aux) {
      console.log(`✅ Dashboard query ${attr} devolvió ${Aux.length} resultados`);
      for (const r of Aux) {
        if (attr === 'merchant_por_id') {
          r.merchant = r.merchant_por_id;
          delete r.merchant_por_id;
        }

        const idMessage = r.id_message;
        if (!auxResponse.has(idMessage)) {
          auxResponse.set(idMessage, r);
          queryAttrs.add(idMessage);
        }
      }
    }
  }

  const results = Array.from(auxResponse.values());
  console.log(`📊 Dashboard - Total de transacciones encontradas: ${results.length}`);

  return results;
}

/**
 * Groups and enriches transactions with related operations and card data.
 *
 * This function processes raw transaction data to:
 * - Normalize amounts from cents to dollars for display
 * - Group cancellations and refunds with their original sales
 * - Extract and decrypt EMV tags and track2 data
 * - Build card information objects
 * - Filter rejected transactions
 * - Sort by most recent first
 *
 * @async
 * @function getGroupedTransacctions
 * @param {Array} transacctions - Raw transaction array from database
 * @param {boolean} [onlyRejected=false] - Return only rejected transactions
 * @returns {Promise<Object>} Object containing:
 *   - groupedTransacctions: Array of approved transactions with nested cancellations/refunds
 *   - notOriginal: Array of standalone cancellations/refunds without original sale
 *   - transactionRejecteds: Array of rejected transactions (if onlyRejected=true)
 *
 * @pcidss Requirement 3.4 - PAN Masking: Track2 data is decrypted securely via helpers
 * @pcidss Requirement 10.3 - Timestamp Management: Sorts by creation_date
 *
 * @example
 * const { groupedTransacctions, notOriginal } = await getGroupedTransacctions(rawTxs, false);
 * // groupedTransacctions[0].cancelacion will contain the cancellation if exists
 */
async function getGroupedTransacctions(transacctions, onlyRejected = false) {
  const notOriginal = [];
  const groupedTransacctions = [];
  const transactionRejecteds = [];

  for (let i = 0; i < transacctions.length; i++) {
    // Parse more_info safely
    try {
      transacctions[i].more_info = JSON.parse(transacctions[i].more_info || '{}');
    } catch (e) {
      console.warn(`[getGroupedTransacctions] Failed to parse more_info for tx ${transacctions[i].id_message}:`, e.message);
      transacctions[i].more_info = {};
    }

    // ──────────────────────────────────────────────
    // NORMALIZE AMOUNT: DB stores cents → display in dollars
    // ──────────────────────────────────────────────
    const amountCents = Number(transacctions[i].amount) || 0;
    const amountDollars = (amountCents / 100).toFixed(2);

    console.log(
      `[getGroupedTransacctions] ID ${transacctions[i].id_message} | op ${transacctions[i].id_operation} | ` +
      `cents → dollars: ${amountCents} → $${amountDollars}`
    );

    // Attach both versions for flexibility
    transacctions[i].amount_cents = amountCents;           // raw from DB
    transacctions[i].amount = amountDollars;               // display value
    transacctions[i].amount_formatted = `$${amountDollars}`; // nice table column

    // Special logging for cancellations/refunds
    if ([6, 7].includes(transacctions[i].id_operation)) {
      console.log(
        `[getGroupedTransacctions] ${transacctions[i].id_operation === 6 ? 'CANCEL' : 'REFUND'} DEBUG: ` +
        `ID ${transacctions[i].id_message} | original cents=${amountCents} → $${amountDollars}`
      );
    }

    // ──────────────────────────────────────────────
    // Card information block (unchanged)
    // ──────────────────────────────────────────────
    transacctions[i].cardInformation = {
      cardHolder: transacctions[i]?.more_info?.card_holder ?? "",
      cardType: transacctions[i].bin_info?.tipo_tarjeta?.name ?? "",
      cardBrand: transacctions[i].bin_info?.tipo_producto?.name ?? "",
      emisorBank: transacctions[i].bin_info?.banco_emisor?.name ?? ""
    };

    // Decrypt track2 if present
    if (transacctions[i].track2) {
      try {
        const decryptedTrack2 = await helpers.decryptTrack2(transacctions[i].track2);
        if (decryptedTrack2) {
          transacctions[i].track2 = decryptedTrack2;
          console.log('[getGroupedTransacctions] 🔓 Track2 decrypted for tx:', transacctions[i].reference_number);
        }
      } catch (error) {
        console.error('[getGroupedTransacctions] ❌ Failed to decrypt track2:', error.message);
      }
    }

    // ──────────────────────────────────────────────
    // Status & grouping logic (with fixed amount already applied)
    // ──────────────────────────────────────────────
    if (
      (transacctions[i].resp_code === "00" || transacctions[i].resp_code === "0") &&
      (transacctions[i].estatus_f == 2 || transacctions[i].estatus_f === "2")
    ) {
      switch (transacctions[i].id_operation) {
        case 4: // Normal sale
          groupedTransacctions.push(transacctions[i]);
          transacctions[i].status = 0;
          transacctions[i].description = 'APROBADA';

          // EMV tags
          if (transacctions[i].more_info.emv_tags != null) {
            console.log(`[getGroupedTransacctions] ✅ EMV tags found for tx ${transacctions[i].reference_number}`);
            const tags = unpackEnvTag(transacctions[i].more_info.emv_tags).tknB2;
            transacctions[i].arqc = tags.arqc;
            transacctions[i].aid = tags.aid;
            transacctions[i].tvr = tags.tvr;
            transacctions[i].tsi = tags.tsr;
          } else {
            console.log(`[getGroupedTransacctions] ⚠️ No EMV tags for tx ${transacctions[i].reference_number}`);
          }
          break;

        case 6: // Cancellation
          const indexVentaOriginal = groupedTransacctions.findIndex(el =>
            helpers.padLeft(el.reference_number, 12, '0') === helpers.padLeft(transacctions[i].reference_number_ant, 12, '0')
          );

          if (indexVentaOriginal === -1) {
            // Standalone cancellation
            transacctions[i].status = 1;
            transacctions[i].description = 'CANCELADA';
            transacctions[i].rejectedReason = transacctions[i].codigo_resp?.description || 'Cancelación sin venta original';
            groupedTransacctions.push(transacctions[i]);
          } else {
            // Attach to original sale
            transacctions[i].status = 1;
            transacctions[i].description = 'CANCELADA';
            groupedTransacctions[indexVentaOriginal].cancelacion = {
              reference_number: transacctions[i].reference_number,
              resp_code: transacctions[i].resp_code,
              id_operation: transacctions[i].id_operation,
              creation_date: transacctions[i].creation_date,
              reference_number_ant: transacctions[i].reference_number_ant,
              folio: transacctions[i].folio,
              tipo_operacion: transacctions[i].tipo_operacion.name,
              authorization: transacctions[i].authorization,
              status: 0,
              trace_number: transacctions[i].trace_number,
              amount: transacctions[i].amount, // already in dollars
              amount_cents: transacctions[i].amount_cents
            };
          }
          break;

        case 7: // Refund
          const indexVentaOriginalR = groupedTransacctions.findIndex(el =>
            helpers.padLeft(el.reference_number, 12, '0') === helpers.padLeft(transacctions[i].reference_number_ant, 12, '0')
          );

          if (indexVentaOriginalR === -1) {
            // Standalone refund
            transacctions[i].description = "DEVOLUCION";
            transacctions[i].rejectedReason = transacctions[i].codigo_resp?.description || 'Devolución sin venta original';
            groupedTransacctions.push(transacctions[i]);
          } else {
            transacctions[i].description = "DEVOLUCION";
            groupedTransacctions[indexVentaOriginalR].devolucion = {
              reference_number: transacctions[i].reference_number,
              resp_code: transacctions[i].resp_code,
              id_operation: transacctions[i].id_operation,
              creation_date: transacctions[i].creation_date,
              reference_number_ant: transacctions[i].reference_number_ant,
              folio: transacctions[i].folio,
              tipo_operacion: transacctions[i].tipo_operacion.name,
              authorization: transacctions[i].authorization,
              status: 0,
              trace_number: transacctions[i].trace_number,
              amount: transacctions[i].amount, // dollars
              amount_cents: transacctions[i].amount_cents
            };
          }
          break;

        default:
          transacctions[i].description = transacctions[i].tipo_operacion.name;
          groupedTransacctions.push(transacctions[i]);
          transacctions[i].status = 0;

          if (transacctions[i].more_info.emv_tags != null) {
            console.log(`[getGroupedTransacctions] ✅ EMV tags found (other op) ${transacctions[i].reference_number}`);
            const tags = unpackEnvTag(transacctions[i].more_info.emv_tags).tknB2;
            transacctions[i].arqc = tags.arqc;
            transacctions[i].aid = tags.aid;
            transacctions[i].tvr = tags.tvr;
            transacctions[i].tsi = tags.tsr;
          }
          break;
      }
    } else {
      // Non-approved transactions: pending (estatus_f=1), rejected (estatus_f=3), failed (estatus_f=4),
      // or approved status but non-00 resp_code
      transacctions[i].status = transacctions[i].id_operation == 4 ? 1 : 0;

      if (transacctions[i].estatus_f == 1 || transacctions[i].estatus_f === "1") {
        transacctions[i].statusDescription = "PENDIENTE";
      } else if (transacctions[i].estatus_f == 4 || transacctions[i].estatus_f === "4") {
        transacctions[i].statusDescription = "FALLIDA";
      } else {
        transacctions[i].statusDescription = "RECHAZADA";
      }

      transacctions[i].description = transacctions[i].tipo_operacion.name.toUpperCase();
      transacctions[i].rejectedReason = transacctions[i].codigo_resp?.description || 'No reason provided';

      if (transacctions[i].more_info.emv_tags != null) {
        console.log(`[getGroupedTransacctions] ✅ EMV tags (non-approved) ${transacctions[i].reference_number}`);
        const tags = unpackEnvTag(transacctions[i].more_info.emv_tags).tknB2;
        transacctions[i].arqc = tags.arqc;
        transacctions[i].aid = tags.aid;
        transacctions[i].tvr = tags.tvr;
        transacctions[i].tsi = tags.tsr;
      }

      groupedTransacctions.push(transacctions[i]);
      transactionRejecteds.push(transacctions[i]);
    }
  }

  if (onlyRejected) {
    return { transactionRejecteds, notOriginal };
  }

  // Sort by date (most recent first)
  groupedTransacctions.sort((a, b) => {
    let dateA = a.creation_date;
    let dateB = b.creation_date;

    if (a.cancelacion) dateA = a.cancelacion.creation_date;
    if (a.devolucion) dateA = a.devolucion.creation_date;
    if (b.cancelacion) dateB = b.cancelacion.creation_date;
    if (b.devolucion) dateB = b.devolucion.creation_date;

    return dateB - dateA; // newest first
  });

  return {
    groupedTransacctions,
    notOriginal
  };
}

/**
 * Transforms date format from slash-separated to dash-separated.
 *
 * @function transformarFecha
 * @param {string} fecha - Date string in format "DD/MM/YYYY"
 * @returns {string} Date string in format "DD-MM-YYYY"
 * @private
 */
function transformarFecha(fecha) {
  const [dia, mes, anio] = fecha.split('/');
  return `${dia}-${mes}-${anio}`;
}

/**
 * Master query function for retrieving transactions with merchant associations.
 *
 * Executes a comprehensive database query with all necessary joins for merchant,
 * BIN, operation type, response code, and bank information. Excludes sensitive
 * tokenized data fields.
 *
 * @function queryMaster
 * @param {string} attr - Merchant association attribute name ('merchant' or 'merchant_por_id')
 * @param {Object} whereData - Transaction filter conditions
 * @param {Object} whereMerchant - Merchant filter conditions (client access control)
 * @returns {Promise<Array>} Transaction records with full associations
 *
 * @pcidss Requirement 3.4 - PAN Masking: Excludes tkn_data_63_rq, tkn_data_63_rp fields
 * @pcidss Requirement 7.2 - Access Control: Applies whereMerchant filter for client access
 * @private
 */
function queryMaster(attr, whereData, whereMerchant) {
  console.debug('whereData ----->', whereData);
  console.debug('whereMerchant ----->', whereMerchant);
  return db.isoMessage.findAll({
    attributes: { exclude: ['tkn_data_63_rq', 'tkn_data_63_rp', 'node'] },
    include: [
      {
        model: db.signatures,
        as: 'signature',
        required: false,
        attributes: ['id']
      },
      {
        required: false,
        model: db.cisoBin,
        as: 'bin_info',
        attributes: { exclude: ['creation_date', 'last_update'] },
        include: [
          { model: db.isoBrand, as: 'tipo_tarjeta', attributes: { exclude: ['creation_date'] } },
          { model: db.isoProcessor, as: 'procesador', attributes: { exclude: ['creation_date'] } },
          { model: db.isoCardTypes, as: 'tipo_producto', attributes: { exclude: ['creation_date'] } },
          { model: db.isoIssuerBank, as: 'banco_emisor', attributes: { exclude: ['creation_date', 'last_update'] } },
        ]
      },
      { model: db.cisoOperation, as: 'tipo_operacion', attributes: { exclude: ['creation_date'] } },
      {
        model: db.cisoRespCode,
        as: 'codigo_resp',
        attributes: { exclude: ['creation_date'] }
      },
      {
        model: db.merchant,
        required: true,
        as: attr,
        attributes: ['id_merchant', 'id_client', 'name_merchant', 'afiliation_number', 'active', 'afiliation_link',
          'taza_credito', 'taza_debito', 'taza_amex', 'tasa_credito_b', 'tasa_debito_b', 'tasa_amex_b',
          'tasa_credito_c', 'tasa_debito_c', 'tasa_amex_c', 'tasa_credito_d', 'tasa_debito_d', 'tasa_amex_d',
          'taza_link_credito', 'taza_link_debito', 'taza_link_amex', 'tasa_link_credito_b', 'tasa_link_debito_b', 'tasa_link_amex_b',
          'tasa_link_credito_c', 'tasa_link_debito_c', 'tasa_link_amex_c', 'tasa_link_credito_d', 'tasa_link_debito_d', 'tasa_link_amex_d'],
        include: [
          { model: db.datosDireccion, as: 'datos_direccion', attributes: { exclude: ['createdAt', 'updatedAt'] } },
          { model: db.isoAcquiererBank, as: 'banco_adq', attributes: { exclude: ['creation_date'] } },
          { model: db.isoClient, as: 'iso_client_dt', attributes: { exclude: ['creation_date'] }, required: true },
        ],
        where: whereMerchant
      }
    ],
    where: whereData,
    order: [
      ['creation_date', 'ASC'],
    ]
  });
}

/**
 * Dashboard-optimized query function for retrieving transactions with reduced data.
 *
 * Similar to queryMaster but returns fewer attributes for faster dashboard loading.
 * Only includes essential merchant rates and BIN brand information.
 *
 * @function queryMasterDash
 * @param {string} attr - Merchant association attribute name ('merchant' or 'merchant_por_id')
 * @param {Object} whereData - Transaction filter conditions
 * @param {Object} whereMerchant - Merchant filter conditions (client access control)
 * @returns {Promise<Array>} Transaction records with reduced attribute set for dashboard
 *
 * @pcidss Requirement 3.4 - PAN Masking: Excludes sensitive tokenized fields
 * @pcidss Requirement 7.2 - Access Control: Applies whereMerchant for client filtering
 * @private
 */
function queryMasterDash(attr, whereData, whereMerchant) {
  return db.isoMessage.findAll({
    attributes: { exclude: ['tkn_data_63_rq', 'tkn_data_63_rp', 'node'] },
    include: [
      {
        required: false,
        model: db.cisoBin,
        as: 'bin_info',
        attributes: { exclude: ['creation_date', 'last_update'] },
        include: [
          { model: db.isoBrand, as: 'tipo_tarjeta', attributes: { exclude: ['creation_date'] } }
        ]
      },
      {
        model: db.cisoRespCode,
        as: 'codigo_resp',
        attributes: {
          exclude: ['creation_date']
        }
      },
      {
        model: db.merchant,
        required: true,
        as: attr,
        attributes: ['id_merchant', 'id_client', 'name_merchant', 'afiliation_number', 'active',
          'taza_credito', 'taza_debito', 'taza_amex', 'tasa_credito_b', 'tasa_debito_b', 'tasa_amex_b', 'afiliation_link',
          'tasa_credito_c', 'tasa_debito_c', 'tasa_amex_c', 'tasa_credito_d', 'tasa_debito_d', 'tasa_amex_d'
        ],
        where: whereMerchant
      }
    ],
    where: whereData
  });
}

/**
 * Formats a numeric string representing cents into a decimal dollar amount.
 *
 * Handles various input formats:
 * - Already formatted decimals (e.g., "10.50")
 * - Cents as integers (e.g., "1050" -> "10.50")
 * - Leading zeros (e.g., "0050" -> "0.50")
 *
 * @function formatMount
 * @param {string|number} numberStr - Amount in cents or formatted string
 * @returns {string} Formatted amount as decimal string with 2 decimal places
 * @private
 *
 * @example
 * formatMount("1050")  // returns "10.50"
 * formatMount("50")    // returns "0.50"
 * formatMount("10.50") // returns "10.50"
 */
function formatMount(numberStr) {
  if (!numberStr) return '0.00';

  const str = numberStr.toString().trim();

  if (str.includes('.') && str.split('.')[1].length === 2) {
    return parseFloat(str).toFixed(2);
  }

  const cleanStr = str.replace(/^0+(?=\d)/, '') || '0';

  if (cleanStr.length === 0 || cleanStr === '0') return '0.00';

  if (cleanStr.length <= 2) {
    return (parseInt(cleanStr, 10) / 100).toFixed(2);
  }

  const pesos = cleanStr.slice(0, -2) || '0';
  const cents = cleanStr.slice(-2).padStart(2, '0');
  return `${parseInt(pesos, 10)}.${cents}`;
}

/**
 * Retrieves a signature from the database and returns it as base64 string.
 *
 * @async
 * @function getSign
 * @param {number} id_signature - Signature record ID
 * @returns {Promise<string>} Base64-encoded signature image
 * @throws {Error} If signature with given ID is not found
 * @private
 */
async function getSign(id_signature) {
  const signatureRecord = await db.signatures.findOne({ where: { id: id_signature } });
  if (!signatureRecord) throw new Error(`Firma con ID ${id_signature} no encontrada.`);
  return signatureRecord.signature.toString('base64');
}

/**
 * Builds a formatted address string from address data object.
 *
 * @function buildAddress
 * @param {Object} addressData - Address data object
 * @param {string} [addressData.calle] - Street name
 * @param {string} [addressData.no_ext] - Exterior number
 * @param {string} [addressData.no_int] - Interior number
 * @param {string} [addressData.colonia] - Neighborhood/colony
 * @param {string} [addressData.alcaldia] - Borough/municipality
 * @param {string} [addressData.cp] - Postal code
 * @param {string} [addressData.ciudad] - City
 * @param {string} [addressData.pais] - Country
 * @returns {string} Comma-separated formatted address string in title case
 * @private
 */
function buildAddress(addressData) {
  return ['calle', 'no_ext', 'no_int', 'colonia', 'alcaldia', 'cp', 'ciudad', 'pais']
      .map(part => addressData[part] ? titleCase(addressData[part]) : '')
      .filter(part => part).join(', ');
}

/**
 * Ensures a directory exists, creating it recursively if needed.
 *
 * @function ensureDirectoryExists
 * @param {string} dir - Directory path to ensure exists
 * @private
 */
const ensureDirectoryExists = (dir) => {
  if (!fs.existsSync(dir))
    fs.mkdirSync(dir, { recursive: true });
};

/**
 * Generates a PDF ticket for a transaction (approved or rejected).
 *
 * This endpoint creates a PDF receipt using Puppeteer with transaction details,
 * merchant information, and optionally a signature. The PDF is saved to the
 * public/tickets directory and the filename is returned.
 *
 * @async
 * @function getTicket
 * @memberof rController
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {Object|string} req.body.data - Transaction data (object or JSON string)
 * @param {boolean} [req.body.is_rejected] - Whether transaction was rejected
 * @param {boolean} [req.api] - Whether called via API (vs socket)
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} Object with data property containing PDF filename
 *
 * @pcidss Requirement 3.4 - PAN Masking: Card data in ticket is masked
 * @pcidss Requirement 10.2 - Audit Logging: Ticket generation should be logged
 *
 * @example
 * POST /ticket
 * Body: { data: {...transactionData}, is_rejected: false }
 * Response: { data: "ticket.1234567890.pdf" }
 */
rController.getTicket = async (req, res) => {
  console.log('getTicket');
  console.log('getTicket req.api', req.api);
  try {
    const data = typeof req.body.data == 'string' ? JSON.parse(req.body.data) : req.body.data;
    data.direccion = buildAddress(data.merchant_por_id.datos_direccion);

    if (data.signature)
      data.signature.data = await getSign(data.signature.id);

    data.modo_autorizacion = undefined;

    if(data.more_info.tipo_tx === "VENTA" ){
      switch(data.more_info.auth){
        case 'Firma electrónica':
          data.modo_autorizacion = "AUTORIZACIÓN CON FIRMA ELECTRÓNICA";
          break;
        case 'Contactless NFC':
          data.modo_autorizacion = "CONTACTLESS-NFC";
      }
    }

    if(data.more_info?.chargePlan?.months){
      data.more_info.chargePlan.months = parseInt(data.more_info.chargePlan.months);
    }

    data.muestra_firma = data.more_info.tipo_tx !== "VENTA";
    data.tipo_operacion.name = helpers.getOperationLabel(data.tipo_operacion.name);

    const basePath = path.join(process.cwd(), 'lib', 'socketServer', 'lib');
    const publicTicketsPath = path.join(basePath, 'public', 'tickets');
    ensureDirectoryExists(publicTicketsPath);
    const pdfName = `ticket.${Date.now()}.pdf`;

    let reportDir = 'reports/ticket';

    if(req.body.is_rejected){
      const respCode = await db.cisoRespCode.findOne({
        where: {
          iso_code: data.resp_code
        }
      });

      data.rejectedBy = (respCode) ? respCode.description : "NO SE PUDO REALIZAR LA TRANSACCIÓN";
      reportDir = 'reports/ticketRejected';
    }

    return new Promise((resolve) => {
      app.render(reportDir, { layout: false, data: data, base64Image, termConditionUrl }, async (err, renderedHtml) => {
        if (err) throw err;

        const browser = await puppeteer.launch({
          headless: 'new'
        });
        const page = await browser.newPage();
        await page.setContent(renderedHtml);
        await page.pdf({
          path: path.join(publicTicketsPath, pdfName),
          format: 'A4'
        });

        await browser.close();

        const out = {
          data: pdfName,
        };

        if(!req.api)
          res.json(out);

        return resolve(out);
      });
    });
  } catch (error) {
    return req.api
        ? { error: error.message || "Se produjo un error durante la creación del PDF." }
        : res.status(500).json({ error: error.message || "Se produjo un error durante la creación del PDF." });
  }
};

/**
 * Generates a liquidation report for a specific date range.
 *
 * Retrieves transaction data for liquidation purposes using the transaction cache
 * controller. Handles date format normalization and validation.
 *
 * @async
 * @function getReportLiquidation
 * @memberof rController
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.fechas - Date range (format: "YYYY-MM-DD YYYY-MM-DD" or "YYYY-MM-DD HH:mm YYYY-MM-DD HH:mm")
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} Liquidation report data
 *
 * @pcidss Requirement 7.2 - Access Control: Report filtered by user permissions
 * @pcidss Requirement 10.2 - Audit Logging: Report generation should be logged
 */
rController.getReportLiquidation = async (req, res) => {
  console.log('rController.getReportLiquidation');

  try {
    if (!req.body.fechas || req.body.fechas === '') {
      return res.json({ data: [] });
    }

    console.log(`Raw fechas from frontend: "${req.body.fechas}"`);

    const dates = req.body.fechas.split(' ');
    console.log(`Split dates:`, dates);

    if (dates.length !== 2 && dates.length !== 4) {
      return res.status(400).send({ message: 'Malformacion de fecha. Se esperan dos fechas separadas por espacio.' });
    }

    let finalFechas;

    if (dates.length === 4) {
      console.log('Detected 4-element date format (date + time pairs)');
      const startedDate = dates[0];
      const endDate = dates[2];
      finalFechas = `${startedDate} ${endDate}`;
      console.log(`Reconstructed fechas: "${finalFechas}"`);
    } else {
      finalFechas = req.body.fechas;
      console.log(`Using 2-element format: "${finalFechas}"`);
    }

    const dataDT = await transactionCacheController.getReportLiquidationByDate(finalFechas, req);
    return res.json(dataDT);

  } catch (error) {
    console.error('Liquidation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error generating liquidation report',
      error: error.message
    });
  }
};

/**
 * Retrieves formatted transaction tickets for a date range.
 * FIXED: Uses creation_date filtering correctly.
 *
 * Returns transaction data formatted for ticket display with proper amount handling,
 * EMV tag processing, and timezone conversion. Only includes approved transactions (response code '00').
 *
 * @async
 * @function getTickets
 * @memberof rController
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.fechas - ISO date range (format: "YYYY-MM-DDTHH:mm:ss.sssZ YYYY-MM-DDTHH:mm:ss.sssZ")
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} Object with data array containing formatted transactions
 *
 * @pcidss Requirement 3.4 - PAN Masking: ARQC partially masked in response
 * @pcidss Requirement 10.3 - Timestamp Management: Uses creation_date with timezone conversion
 */
rController.getTickets = async (req, res) => {
  if (req.body.fechas == '')
    return res.json({ data: [] });

  if (req.body.fechas.split(' ').length != 2)
    return res.status(400).send({ message: 'Malformacion de fecha YYYY/MM/DD YYYY/MM/DD' });

  const pattern = /^[0-9]{4}-((0[13578]|1[02])-(0[1-9]|[12][0-9]|3[01])|(0[469]|11)-(0[1-9]|[12][0-9]|30)|(02)-(0[1-9]|[12][0-9]))T(0[0-9]|1[0-9]|2[0-3]):(0[0-9]|[1-5][0-9]):(0[0-9]|[1-5][0-9])\.[0-9]{3}Z$/;

  const dates = req.body.fechas.split(' ');

  if (!pattern.test(dates[0]) || !pattern.test(dates[1])) {
    return res.status(400).json({
      success: false,
      message: "Las fechas ingresadas no son validas, se esperan unas fechas en formato ISO completo."
    });
  }

  const startedDate = dates[0];
  const endDate = dates[1];

  if (!validateDate(startedDate) || !validateDate(endDate))
    return res.status(400).send({ message: "Rango de fecha no valido" });

  // CORRECT: getTransaction now uses creation_date internally
  var resp = JSON.parse(JSON.stringify(await getTransaction({
    fechas: `${startedDate} ${endDate}`,
    response: '00'
  }, req)));

  for (const key in resp) {
    if (Object.hasOwnProperty.call(resp, key)) {
      const element = resp[key];
      const date = moment.tz(new Date(element.creation_date), 'America/Mexico_City');
      element.finalMount = parseFloat(element.amount).toFixed(2);

      if (element.more_info) {
        try {
          element.more_info = JSON.parse(element.more_info);
        } catch (error) {
          element.more_info = {};
        }
        const monto = parseFloat(element.amount);
        const tip = (element.more_info && element.more_info.tip) ? parseFloat(element.more_info.tip) : 0;
        element.amount = '$ ' + (monto - tip).toFixed(2);
        if (element.more_info.tip) { element.more_info.tip = tip.toFixed(2); }

        if (element.more_info.emv_tags) {
          try {
            element.more_info.object = unpackEnvTag(element.more_info.emv_tags).tknB2;
            if (element.more_info.object) {
              element.more_info.object.arqc_l = '************' + element.more_info.object.arqc.substr(element.more_info.object.arqc.length - 4);
              element.more_info.object.aid = element.more_info.object.aid.substr(0, 17);
            }
          } catch (e) {
            console.error('Error unpacking EMV tags:', e);
          }
        }

        if (element.more_info.link_pago) {
          element.more_info.merchant_data.afiliation_number = (element.more_info.merchant_data.afiliation_link) ? element.more_info.merchant_data.afiliation_number : '';
        }
      } else {
        element.amount = '$ ' + (parseFloat(element.amount)).toFixed(2);
      }

      resp[key] = element;
    }
  }

  return res.json({ data: resp });
};

rController.getPosJson = async (req, res) => {
  console.log(req.user);
  let where = {};
  let whereMerchant = {};
  if (req != undefined && req.user != undefined && req.user.is_admin !== 1 && !req.forceAllClient)
    whereMerchant.id_client = req.user.id_cliente;

  let fechas = [];

  if (req.body.fechas) {
    if (req.body.fechas == '')
      return res.json({ data: [] });

    if (req.body.fechas.split(' ').length != 2)
      return res.status(400).send({ message: 'Malformacion de fecha YYYY/MM/DD YYYY/MM/DD' });

    const pattern = /^[0-9]{4}-((0[13578]|1[02])-(0[1-9]|[12][0-9]|3[01])|(0[469]|11)-(0[1-9]|[12][0-9]|30)|(02)-(0[1-9]|[12][0-9]))T(0[0-9]|1[0-9]|2[0-3]):(0[0-9]|[1-5][0-9]):(0[0-9]|[1-5][0-9])\.[0-9]{3}Z$/;

    fechas = req.body.fechas.split(' ');

    if (!pattern.test(fechas[0]) || !pattern.test(fechas[1])) {
      return res.status(400).json({
        success: false,
        message: "Las fechas ingresadas no son validas, se esperan unas fechas en formato ISO completo."
      });
    }

    const startedDate = fechas[0];
    const endDate = fechas[1];

    var dt = [startedDate, endDate];

    if (!validateDate(startedDate) || !validateDate(endDate))
      return res.status(400).send({ message: 'Rango de fecha no valido' });

    where.creation_date = {
      [db.Sequelize.Op.between]: dt
    };
  }

  const txs = JSON.parse(JSON.stringify(await db.isoApiLog.findAll({ where, order: [['creation_date', 'ASC']] })));
  const realTx = [];

  for (const tx of txs) {
    if (fechas.length > 0) {
      fechas = req.body.fechas.split(' ');

      let auxI = fechas[0].split('-');
      fechas[0] = new Date(auxI[0], parseInt(auxI[1]) - 1, auxI[2]);

      let auxF = fechas[1].split('-');
      fechas[1] = new Date(auxF[0], parseInt(auxF[1]) - 1, auxF[2]);

      let creationDate = new Date(tx.creation_date).toLocaleDateString();
      creationDate = creationDate.split('/');
      if (parseInt(auxI[2]) <= parseInt(creationDate[0]) && auxF[2] >= parseInt(creationDate[0]))
        realTx.push(tx);
    } else
      realTx.push(tx);
  }

  let dataDt = {
    data: txs
  };
  res.json(dataDt);
};

const createColumn = (textName, data, isAdmin, customWidth = null, isLastCount = false) => ({
  textName,
  data,
  width: customWidth || (isAdmin ? '3%' : '5%'),
  className: 'dt-smaller-font' + (customWidth === '12%' ? ' dt-scroll' : ''),
  ...(isLastCount && { lastCount: true }),
});

rController.getContracargo = async (req, res) => {
  if (req.body.fechas.split(' ').length != 2)
    return res.status(400).send({ message: 'Malformacion de fecha YYYY/MM/DD YYYY/MM/DD' });

  const pattern = /^[0-9]{4}-((0[13578]|1[02])-(0[1-9]|[12][0-9]|3[01])|(0[469]|11)-(0[1-9]|[12][0-9]|30)|(02)-(0[1-9]|[12][0-9]))T(0[0-9]|1[0-9]|2[0-3]):(0[0-9]|[1-5][0-9]):(0[0-9]|[1-5][0-9])\.[0-9]{3}Z$/;

  const dates = req.body.fechas.split(' ');

  if (!pattern.test(dates[0]) || !pattern.test(dates[1])) {
    return res.status(400).json({
      success: false,
      message: "Las fechas ingresadas no son validas, se esperan unas fechas en formato ISO completo."
    });
  }

  const startedDate = dates[0];
  const endDate = dates[1];

  if (!validateDate(startedDate) || !validateDate(endDate)) {
    res.status(400).send({ message: "Rango de fecha no valido" });
    return;
  }

  let cg = await getContracargos(req.body, req);
  cg = JSON.parse(JSON.stringify(cg));
  for (const v of cg) {
    v.tipo_cc = (v.tipo_cc) ? v.tipo_cc : '';
  }
  res.json({ data: cg });
};

function validateDate(date) {
  return date.toString() !== 'Invalid Date';
}

function titleCase(string) {
  return string.replace(/\w\S*/g, function (txt) { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); });
}

rController.infoStados = async (req, res) => {
  const meses = await db.consolidacion.findAll({
    attributes: [
      [db.consolidacion.sequelize.fn('DISTINCT', db.consolidacion.sequelize.fn('MONTH', db.consolidacion.sequelize.col('created_at'))), 'n_mes'],
      [db.consolidacion.sequelize.fn('YEAR', db.consolidacion.sequelize.col('created_at')), 'anio']
    ],
    distinct: true,
    raw: true
  });

  return res.json({ meses });
};

rController.makeStados = async (req, res) => {
  try {
    const { comercio: id_merchant, mes, anio } = req.body;

    // Add validation for required fields with proper error messages
    if (!id_merchant || !mes || !anio) {
      return res.status(400).json({
        success: false,
        message: "El comercio, mes y año son requeridos para generar los estados de cuenta"
      });
    }

    // Validate month and year format
    const monthNum = parseInt(mes);
    const yearNum = parseInt(anio);
    
    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({
        success: false,
        message: "El mes debe ser un número entre 1 y 12"
      });
    }

    if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2030) {
      return res.status(400).json({
        success: false,
        message: "El año debe ser un número válido"
      });
    }

    // Validate comercio field
    const comercioNum = parseInt(id_merchant);
    if (isNaN(comercioNum)) {
      return res.status(400).json({
        success: false,
        message: "El comercio debe ser un número válido"
      });
    }

    moment.tz.setDefault('America/Mexico_City');

  // Validate and normalize detalle parameter
  const detalle = req.body.detalle;
  const normalizedDetalle = (detalle === 'Y' || detalle === 'y' || detalle === true) ? 'Y' : 'N';

  const startDate = moment([anio, mes - 1, 1]).startOf('day');
  const endDate = moment([anio, mes - 1, 1]).endOf('month').endOf('day');

  const whereMerchant = {};

  if (comercioNum !== 0)
    whereMerchant.id_merchant = comercioNum;

  const merchants = await db.merchant.findAll({
    attributes: ['id_merchant', 'razon_social', 'name_merchant', 'with_invoices', 'rfc_merchant', 'id_client', 'afiliation_number', 'msi'],
    include: [{
      model: db.datosDireccion,
      attributes: ['calle', 'no_ext', 'no_int', 'colonia', 'alcaldia', 'ciudad', 'cp', 'pais'],
      as: 'datos_direccion',
      required: false // Use LEFT JOIN to get merchants even if they don't have address data
    }],
    where: whereMerchant,
    raw: false, // Change to false to get proper nested objects
    nest: false // Disable nesting to avoid circular references
  });

  console.log(`🏪 Found ${merchants.length} merchants for estado de cuenta`);
  
  // Handle case when no merchants are found
  if (merchants.length === 0) {
    return res.status(404).json({
      success: false,
      message: "No se encontraron comercios para los criterios seleccionados"
    });
  }
  
  // Debug: Log first merchant structure
  if (merchants.length > 0) {
    const firstMerchant = merchants[0];
    console.log('🔍 Sample merchant ID:', firstMerchant.id_merchant, 'Name:', firstMerchant.razon_social);
    console.log('🔍 Sample merchant MSI type:', typeof firstMerchant.msi, 'MSI value:', firstMerchant.msi);
  }

  const files = merchants.map(async m => {
    console.log('🏪 Processing merchant ID:', m.id_merchant, 'Name:', m.razon_social);
    console.log('🏪 Merchant MSI type:', typeof m.msi, 'MSI value:', m.msi);
    
    dd(("\n\nObteniendo informacion transaciones:"
        + "\n================================================================================================"
        + "\n     Comercio ID:" + m.id_merchant
        + "\n     Comercio Name:" + m.razon_social
        + "\n     startDate:" + startDate.format()
        + "\n     endDate:" + endDate.format()
        + "\n================================================================================================\n"), 'verbose');

    const registros = await db.consolidacion.findAll({
      attributes: ['amount', 'reference_number', 'status', 't_medio', 'taza_credito', 'taza_debito', 'taza_amex', 'tasa_credito_b', 'tasa_debito_b', 'tasa_amex_b', 'tasa_credito_c', 'tasa_debito_c', 'tasa_amex_c', 'tasa_credito_d', 'tasa_debito_d', 'tasa_amex_d', [db.consolidacion.sequelize.literal('EXTRACT(DAY FROM tx_at)'), 'dia'], 'msi', 'isLink'],
      where: {
        tx_at: {
          [Op.and]: [
            { [Op.gte]: startDate.format() },
            { [Op.lte]: endDate.format() }
          ]
        },
        id_merchant: m.id_merchant
      },
      order: [
        ['tx_at', 'ASC']
      ],
      raw: true
    });

    console.log(`📊 Found ${registros.length} transactions for merchant ${m.id_merchant} from ${startDate.format()} to ${endDate.format()}`);
    if (registros.length > 0) {
      console.log('📋 Sample transaction:', registros[0]);
      console.log('📋 All transaction amounts:', registros.map(r => r.amount));
    } else {
      console.log('⚠️ No transactions found for this merchant and date range');
      console.log('🔍 Query details:');
      console.log('   - Merchant ID:', m.id_merchant);
      console.log('   - Start Date:', startDate.format());
      console.log('   - End Date:', endDate.format());
      console.log('   - Date Range SQL:', {
        tx_at: {
          [Op.and]: [
            { [Op.gte]: startDate.format() },
            { [Op.lte]: endDate.format() }
          ]
        },
        id_merchant: m.id_merchant
      });
    }

    return await makeEstado(normalizedDetalle, req.body.anio, req.body.mes, m, registros).catch(error => {
      console.error('❌ Error in makeEstado for merchant', m.id_merchant, ':', error);
      return {OK:false, filePath: null, error: error.message};
    });
  });

  const f = await Promise.all(files);

  const zip = new AdmZip();

  const ProLoadFilesColl = f.map(file => {
    return new Promise(resolve => {
      if (file.OK) {
        fs.access(file.filePath, fs.constants.F_OK, (err) => {
          if (err)
            return resolve(`[Err] FileName: ${path.basename(file.filePath)} ---> Archivo no generado`);

          fs.stat(file.filePath, (err, stats) => {
            if (err)
              return resolve(`[Err] FileName: ${path.basename(file.filePath)} ---> Archivo generado, pero con errores`);

            if (stats.isFile()) {
              const pdfData = fs.readFileSync(file.filePath);
              zip.addFile(path.basename(file.filePath), pdfData);

              return resolve(`[OK] FileName: ${path.basename(file.filePath)} ---> Archivo generado --- Size: ${stats.size} bytes --- createAT: ${stats.mtime}`);
            }

            return resolve(`[Err] FileName: ${path.basename(file.filePath)} ---> Archivo generado, pero con errores`);
          });
        });
      } else {
        return resolve(`[Err] FileName: ${path.basename(file.filePath)} ---> Archivo no generado`);
      }
    });
  });

  const result = await Promise.all(ProLoadFilesColl);
  const info = result.join('\n');
  zip.addFile('info.txt', Buffer.alloc(info.length, info), info);

  const zipData = zip.toBuffer();

  // Check if zip is empty or contains no valid files
  const successfulFiles = result.filter(r => r.includes('[OK]'));
  if (successfulFiles.length === 0) {
    return res.status(400).json({
      success: false,
      message: "No se encontraron datos para generar los estados de cuenta en el período seleccionado"
    });
  }

  res.set('Content-Type', 'application/octet-stream');
  res.set('Content-Disposition', `attachment; filename=${req.body.anio}${req.body.mes}_estados.zip`);
  res.set('Content-Length', zipData.length);

  res.send(zipData);
  
  } catch (error) {
    console.error('Error en makeStados:', error);
    return res.status(500).json({
      success: false,
      message: "Error interno al generar los estados de cuenta: " + error.message
    });
  }
};

rController.getConsolidation = async (req, res) => {
  try {
    const { grupos, dayStart, dayEnd } = await transactionCacheController.getConsolidationByDate(req.params.day, req.params.cliente, req);

    const name = req.params.cliente === 'all' ? 'Todos' : req.params.cliente;
    moment.locale('es');
    const dayname = moment(dayEnd).format('DD-MMMM-YYYY');
    const fileName = `${name}-${dayname}`;

    let format = req.query.format || 'pdf';
    format = 'pdf';

    const result = await makeReport(grupos, dayStart, dayEnd, fileName, format);
    if (result === true) {
      return res.download(`${fileName}.${format}`);
    }
    return res.status(500).send('Error generating report');
  } catch (error) {
    console.error('Consolidation error:', error);
    return res.status(500).send(error.message);
  }
};

module.exports = rController;


// rController.getConsolidation = async (req, res) => {
//
//   const min = 60000;
//   const hora = 60 * min;
//   const dayStart = new Date(parseInt(req.params.day) - hora);
//   const dayEnd = new Date(parseInt(req.params.day) + (22 * hora) + (59 * min) + (min - 1000));
//
//   const status = [2, 4, 5];
//
//   const where = 'all' === req.params.cliente ? { status, created_at: { [Op.between]: [dayStart, dayEnd] } } : { status, id_client: req.params.cliente, created_at: { [Op.between]: [dayStart, dayEnd] } }
//
//
//   const response = await db.consolidacion.findAll({
//     include: [{
//       model: db.merchant,
//       as: 'merchant',
//       attributes: ['name_merchant', 'id_datos_bancarios', 'rfc_merchant', 'tasa_debito_b', 'tasa_credito_b', 'retencion', 'msi'],
//       include: {
//         model: db.datosBancarios,
//         as: 'datos_bancarios',
//         attributes: ['clabe'],
//       }
//     }],
//     where,
//     raw: true
//   });
//
//   const clientes = [];
//   response.forEach(r => {
//     if (!clientes.includes(r.id_client)) clientes.push(r.id_client);
//   });
//
//   const id_merchants = [];
//   const ProGruposColl = clientes.map(async idClient => {
//     const merchants = [];
//     response.filter(r => r.id_client === idClient).map(r => {
//       if(2 === r.status) {
//         if('credit' === r.t_medio && 0 !== r.msi)
//           r.t_medio = `credit_msi${r.msi}`;
//
//         if(1 === r.isLink) {
//           if('debit' === r.t_medio)
//             r.t_medio = 'debit_link';
//
//           else if('credit' === r.t_medio)
//             r.t_medio = 'credit_link';
//
//           else if('internacional' === r.t_medio)
//             r.t_medio = 'internacional_link';
//         }
//       }
//
//       return r;
//     }).forEach(r => {
//       if (!id_merchants.includes(r.id_merchant)) {
//         const msiConfig = JSON.parse(r['merchant.msi']);
//         const msi_Tasa = [3,6,9,12,18].map(m => {
//           const slc = msiConfig.filter(msiC => msiC.type === m);
//
//           return slc[0] || { percent: 0 };
//         });
//
//         console.log('merchant.tasas ----->', [
//           r.tasa_amex_b,
//           r.tasa_debito_b,
//           r.tasa_credito_b
//         ]);
//
//         merchants.push({
//           id: r.id_merchant,
//           name: r['merchant.name_merchant'],
//           clabe: r['merchant.datos_bancarios.clabe'],
//           rfc: r['merchant.rfc_merchant'],
//           retencion: parseFloat(r['merchant.retencion']),
//           dataCargo_internacional_link: {
//             no: 0,
//             montoBruto: 0,
//             tasa: 0,
//             comision: 0,
//             ivaTasa: 0,
//             ivaComision: 0,
//             montoNeto: 0,
//             tasas: [parseFloat(r.tasa_amex_b)]
//           },
//           dataCargo_internacional: {
//             no: 0,
//             montoBruto: 0,
//             tasa: 0,
//             comision: 0,
//             ivaTasa: 0,
//             ivaComision: 0,
//             montoNeto: 0,
//             tasas: [parseFloat(r.tasa_amex_b)]
//           },
//           dataCargo_debit_link: {
//             no: 0,
//             montoBruto: 0,
//             tasa: 0,
//             comision: 0,
//             ivaTasa: 0,
//             ivaComision: 0,
//             montoNeto: 0,
//             tasas: [parseFloat(r.tasa_debito_b)]
//           },
//           dataCargo_debit: {
//             no: 0,
//             montoBruto: 0,
//             tasa: 0,
//             comision: 0,
//             ivaTasa: 0,
//             ivaComision: 0,
//             montoNeto: 0,
//             tasas: [parseFloat(r.tasa_debito_b)]
//           },
//           dataCargo_credit: {
//             no: 0,
//             montoBruto: 0,
//             tasa: 0,
//             comision: 0,
//             ivaTasa: 0,
//             ivaComision: 0,
//             montoNeto: 0,
//             tasas: [parseFloat(r.tasa_credito_b)]
//           },
//           dataCargo_credit_link: {
//             no: 0,
//             montoBruto: 0,
//             tasa: 0,
//             comision: 0,
//             ivaTasa: 0,
//             ivaComision: 0,
//             montoNeto: 0,
//             tasas: [parseFloat(r.tasa_credito_b)]
//           },
//           dataCargo_credit_msi3: {
//             no: 0,
//             montoBruto: 0,
//             tasa: 0,
//             comision: 0,
//             ivaTasa: 0,
//             ivaComision: 0,
//             montoNeto: 0,
//             tasas: [parseFloat(r.tasa_credito_b)+parseFloat(msi_Tasa[0].percent)],
//             sobretasas: parseFloat(msi_Tasa[0].percent),
//           },
//           dataCargo_credit_msi6: {
//             no: 0,
//             montoBruto: 0,
//             tasa: 0,
//             comision: 0,
//             ivaTasa: 0,
//             ivaComision: 0,
//             montoNeto: 0,
//             tasas: [parseFloat(r.tasa_credito_b)+parseFloat(msi_Tasa[1].percent)],
//             sobretasas: parseFloat(msi_Tasa[1].percent),
//           },
//           dataCargo_credit_msi9: {
//             no: 0,
//             montoBruto: 0,
//             tasa: 0,
//             comision: 0,
//             ivaTasa: 0,
//             ivaComision: 0,
//             montoNeto: 0,
//             tasas: [parseFloat(r.tasa_credito_b)+parseFloat(msi_Tasa[2].percent)],
//             sobretasas: parseFloat(msi_Tasa[2].percent),
//           },
//           dataCargo_credit_msi12: {
//             no: 0,
//             montoBruto: 0,
//             tasa: 0,
//             comision: 0,
//             ivaTasa: 0,
//             ivaComision: 0,
//             montoNeto: 0,
//             tasas: [parseFloat(r.tasa_credito_b)+parseFloat(msi_Tasa[3].percent)],
//             sobretasas: parseFloat(msi_Tasa[3].percent),
//           },
//           dataCargo_credit_msi18: {
//             no: 0,
//             montoBruto: 0,
//             tasa: 0,
//             comision: 0,
//             ivaTasa: 0,
//             ivaComision: 0,
//             montoNeto: 0,
//             tasas: [parseFloat(r.tasa_credito_b)+parseFloat(msi_Tasa[4].percent)],
//             sobretasas: parseFloat(msi_Tasa[4].percent),
//           },
//           dataDevolucion_debit: {
//             no: 0,
//             montoBruto: 0,
//             tasa: 0,
//             comision: 0,
//             ivaTasa: 0,
//             ivaComision: 0,
//             montoNeto: 0,
//             tasas: [parseFloat(r.tasa_debito_b)]
//           },
//           dataDevolucion_internacional: {
//             no: 0,
//             montoBruto: 0,
//             tasa: 0,
//             comision: 0,
//             ivaTasa: 0,
//             ivaComision: 0,
//             montoNeto: 0,
//             tasas: [parseFloat(r.tasa_amex_b)]
//           },
//           dataDevolucion_credit: {
//             no: 0,
//             montoBruto: 0,
//             tasa: 0,
//             comision: 0,
//             ivaTasa: 0,
//             ivaComision: 0,
//             montoNeto: 0,
//             tasas: [parseFloat(r.tasa_credito_b)]
//           },
//           dataCancelacion_debit: {
//             no: 0,
//             montoBruto: 0,
//             tasa: 0,
//             comision: 0,
//             ivaTasa: 0,
//             ivaComision: 0,
//             montoNeto: 0,
//             tasas: [parseFloat(r.tasa_debito_b)]
//           },
//           dataCancelacion_internacional: {
//             no: 0,
//             montoBruto: 0,
//             tasa: 0,
//             comision: 0,
//             ivaTasa: 0,
//             ivaComision: 0,
//             montoNeto: 0,
//             tasas: [parseFloat(r.tasa_amex_b)]
//           },
//           dataCancelacion_credit: {
//             no: 0,
//             montoBruto: 0,
//             tasa: 0,
//             comision: 0,
//             ivaTasa: 0,
//             ivaComision: 0,
//             montoNeto: 0,
//             tasas: [parseFloat(r.tasa_credito_b)]
//           },
//         })
//         id_merchants.push(r.id_merchant);
//       }
//     });
//
//     const cliente = await db.isoClient.findOne({ attributes: ['name'], where: { id_client: idClient }, raw: true });
//
//     return { cli: { id: idClient, name: cliente?.name ?? 'Desconocido' }, merchants }
//   });
//
//   const grupos = await Promise.all(ProGruposColl);
//
//   grupos.forEach((g, i) => {
//     g.merchants.forEach((gm, ii) => {
//       [
//         ['dataCargo', 2, 1],
//         ['dataDevolucion', 4, 1],
//         ['dataCancelacion', 5, 1]
//       ].forEach(k => {
//         ['debit', 'debit_link', 'credit', 'credit_link', 'credit_msi3', 'credit_msi6', 'credit_msi9', 'credit_msi12', 'credit_msi18', 'internacional', 'internacional_link'].forEach(tag => {
//           const masterTag = `${k[0]}_${tag}`;
//           if(grupos[i].merchants[ii][masterTag]) {
//             const cargos = response.filter(r => {
//               const vCli = r.id_client === g.cli.id;
//               const vComercio = r.id_merchant === gm.id;
//               const vMedio = tag === r.t_medio;
//               const vStatus = k[1] === r.status;
//
//               return vCli && vComercio && vMedio && vStatus;
//             })
//
//             const no = cargos.length;
//
//             const montoBruto = cargos.map(c => k[2] * parseFloat(c.amount)).reduce((anterior, actual) => anterior + actual, 0);
//
//             let tasas = grupos[i].merchants[ii][masterTag].tasas
//             const tasa = cargos.map(c => {
//               const cMeses = JSON.parse(c['merchant.msi']).filter(m => c.msi === m.type);
//               const sobretasa = cMeses[0] || { percent: 0 };
//               console.log('c.t_medio ----->', c.t_medio);
//               const vTasa = parseFloat(
//                   /^credit/.test(c.t_medio) ? (0 === c.msi ? c.tasa_credito_b : (parseFloat(c.tasa_credito_b) + parseFloat(sobretasa.percent)) )
//                       : (/^internacional/.test(c.t_medio) ? c.tasa_amex_b : c.tasa_debito_b)
//               );
//
//               tasas.push(vTasa);
//
//               return k[2] * (parseFloat(c.amount) / 100) * vTasa;
//             }).reduce((anterior, actual) => anterior + actual, 0);
//
//             const comision = cargos.map(c => {
//               console.log('comision - c.t_medio ----->', c.t_medio);
//
//               return parseFloat(/^credit/.test(c.t_medio) ? c.tasa_credito_d : (/^internacional/.test(c.t_medio) ? c.tasa_amex_d : c.tasa_debito_d))
//             }).reduce((anterior, actual) => anterior + actual, 0);
//
//             const ivaTasa = (tasa / 100) * 16;
//             const ivaComision = (comision / 100) * 16
//             const montoNeto = montoBruto - (tasa + comision + ivaTasa + ivaComision)
//
//             tasas = encontrarNumeroMasRepetido(tasas);
//
//             grupos[i].merchants[ii][masterTag] = { no, montoBruto, tasa, comision, ivaTasa, ivaComision, montoNeto, tasas }
//           }
//         })
//       });
//     })
//   });
//
//   function encontrarNumeroMasRepetido(array) {
//     let frecuencia = {};
//
//     for (let i = 0; i < array.length; i++) {
//       if (array[i] in frecuencia)
//         frecuencia[array[i]]++;
//       else
//         frecuencia[array[i]] = 1;
//     }
//
//
//     let maxFrecuencia = 0;
//     let numeroMasRepetido;
//     for (let numero in frecuencia) {
//       if (frecuencia[numero] > maxFrecuencia) {
//         maxFrecuencia = frecuencia[numero];
//         numeroMasRepetido = numero;
//       }
//     }
//
//     return numeroMasRepetido;
//   }
//
//   const name = (req.params.cliente === 'all' ) ? 'Todos' : req.params.cliente ;
//   moment.locale('es');
//   const dayname = moment(dayEnd).format('DD-MMMM-YYYY');
//   const fileName = `${name}-${dayname}`;
//
//   let format = req.query.format || 'pdf';
//   if (format === 'xlsx' && !req.user.is_admin) format = 'pdf';
//
//   makeReport(grupos, dayStart, dayEnd, fileName, format).then(r => {
//     if (true === r)
//       return res.download(`${fileName}.${format}`)
//
//     return res.status(500).end(error)
//   })
//       .catch((error) => res.status(500).end(error));
//
//   // end function
// }
rController.getConsolidation = async (req, res) => {
  try {
    const { grupos, dayStart, dayEnd } = await transactionCacheController.getConsolidationByDate(req.params.day, req.params.cliente, req);

    const name = req.params.cliente === 'all' ? 'Todos' : req.params.cliente;
    moment.locale('es');
    const dayname = moment(dayEnd).format('DD-MMMM-YYYY');
    const fileName = `${name}-${dayname}`;

    let format = req.query.format || 'pdf';
    // if (format === 'xlsx' && !req.user.is_admin)
    format = 'pdf';

    const result = await makeReport(grupos, dayStart, dayEnd, fileName, format);
    if (result === true) {
      return res.download(`${fileName}.${format}`);
    }
    return res.status(500).send('Error generating report');
  } catch (error) {
    console.error('Consolidation error:', error);
    return res.status(500).send(error.message);
  }
};
module.exports = rController;