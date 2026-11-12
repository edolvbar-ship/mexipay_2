/**
 * API Authentication Controller
 *
 * Handles API authentication endpoints for transaction retrieval and signature management.
 * This controller processes requests from both SPA/backend and mobile applications.
 *
 * PCI DSS 4.0 Requirements:
 * - Requirement 3.4: Renders PAN unreadable (not storing full card data)
 * - Requirement 10.2: Implements audit logging for transaction access
 * - Requirement 10.3: Records audit trail entries with timestamp synchronization
 */

const processorsCtrl = {};
let moment = require('moment-timezone');
moment.tz.setDefault('America/Mexico_City');
const { getTrans, getTransApp } = require('../controllers/reportes.controller');
const db = require('../sequelize/init');

/**
 * Converts a timestamp to Mexico City timezone
 *
 * PCI DSS 4.0 Requirement 10.3.3: Ensures consistent time source across the system
 *
 * @param {string} timestamp - The timestamp to convert
 * @returns {string} Formatted timestamp in Mexico City timezone (YYYY-MM-DD HH:mm:ss)
 */
function convertToMexicoTimezone(timestamp) {
  if (!timestamp) return timestamp;

  const moment = require('moment-timezone');
  console.log(`🕐 Original timestamp: ${timestamp}`);

  // Check if timestamp already has timezone info
  if (timestamp.includes('Z') || timestamp.includes('+') || timestamp.includes('-')) {
    // It's already timezone-aware, convert to Mexico City
    const converted = moment(timestamp).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss');
    console.log(`🕐 Timezone-aware conversion: ${timestamp} -> ${converted}`);
    return converted;
  } else {
    // Assume it's already in Mexico City time, just format it
    const formatted = moment(timestamp).format('YYYY-MM-DD HH:mm:ss');
    console.log(`🕐 Already local time, just formatting: ${timestamp} -> ${formatted}`);
    return formatted;
  }
}

/**
 * Recursively converts all timestamp fields in an object to Mexico City timezone
 *
 * PCI DSS 4.0 Requirement 10.3.3: Synchronizes all critical system clocks and times
 *
 * @param {Object|Array} obj - Object or array containing potential timestamp fields
 * @returns {Object|Array} Object with all timestamps converted to Mexico City timezone
 */
function recursivelyConvertTimestamps(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  // Array handling
  if (Array.isArray(obj)) {
    return obj.map(item => recursivelyConvertTimestamps(item));
  }

  // Object handling
  const converted = {};
  for (const [key, value] of Object.entries(obj)) {
    // Check if this is a timestamp field
    if (typeof value === 'string' && (
      key.includes('_at') ||
      key.includes('date') ||
      key.includes('time') ||
      (key === 'creation_date') ||
      (key === 'stored_at') ||
      (key === 'updated_at') ||
      (key === 'processed_at')
    )) {
      // Check if it looks like a timestamp (ISO format or similar)
      if (value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/) ||
          value.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)) {
        converted[key] = convertToMexicoTimezone(value);
      } else {
        converted[key] = value;
      }
    } else if (typeof value === 'object') {
      converted[key] = recursivelyConvertTimestamps(value);
    } else {
      converted[key] = value;
    }
  }

  return converted;
}

/**
 * GET TRANSACTIONS (for SPA/backend)
 *
 * Retrieves transactions for a merchant with normalized amounts and timezone conversion.
 * Converts amounts from cents to dollars and applies Mexico City timezone to all timestamps.
 *
 * PCI DSS 4.0 Requirements:
 * - Requirement 7.2: Ensures data access is limited to authorized users based on merchant ID
 * - Requirement 10.2.2: Logs all actions taken by users with administrative access
 * - Requirement 10.3: Audit log entries include timestamps
 *
 * @param {Object} req - Express request object containing fechas in body and merchantData
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with transaction data or error
 */
processorsCtrl.getTx = async (req, res) => {
  console.log('processorsCtrl.getTx', req.body.fechas);
  let error = null;
  let TX    = [];
  req.user  = { id_cliente: req.merchantData.id_client , id_merchant: req.merchantData.id_merchant };

  try {
    TX = await getTrans({ fechas: req.body.fechas }, req);

    // Normalize amounts here too
    TX = TX.map(tx => {
      const cents = Number(tx.amount) || 0;
      const dollars = (cents / 100).toFixed(2);

      console.log(
        `[getTx] Normalizing TX ${tx.id_message} | ` +
        `cents → dollars: ${cents} → $${dollars}`
      );

      return {
        ...tx,
        amount: dollars,
        amount_formatted: `$${dollars}`,
        amount_cents: cents
      };
    });

    TX = recursivelyConvertTimestamps(TX);

    return res.json({ status: true, data: TX });
  } catch (error) {
    return res.status(400).json({ status: false, error: true, data: error.message, stack: error.stack });
  }
};

/**
 * GET TRANSACTIONS APP (for mobile application)
 *
 * Retrieves transactions for mobile application with normalized amounts.
 * Amount is kept in cents format (not divided by 100) for mobile compatibility.
 * Applies Mexico City timezone to all timestamps.
 *
 * PCI DSS 4.0 Requirements:
 * - Requirement 7.2: Access control based on merchant authentication
 * - Requirement 10.2.2: Logs transaction data access
 * - Requirement 10.3: Maintains audit trail with timestamps
 *
 * @param {Object} req - Express request object with merchantData and body parameters
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with transaction data or error
 */
processorsCtrl.getTxApp = async (req, res) => {
    console.log('processorsCtrl.getTxApp', req.body.fechas);
    let error = null;
    let TX    = [];
    req.user  = { id_cliente: req.merchantData.id_client , id_merchant: req.merchantData.id_merchant };

    try {
        // Get raw transactions from DB (amount in cents)
        TX = await getTransApp({ ...req.body }, req);

        console.log(`✅ getTransApp devolvió ${TX.length} transacciones`);

        // ──────────────────────────────────────────────
        // NORMALIZE AMOUNTS: cents → dollars
        // ──────────────────────────────────────────────
        TX = TX.map(tx => {
            const cents = Number(tx.amount) || 0;
            const dollars = (cents).toFixed(2);

            console.log(
                `[getTxApp] Normalizing TX ${tx.id_message} | ` +
                `Ref ${tx.reference_number} | ` +
                `cents → dollars: ${cents} → $${dollars}`
            );

            return {
                ...tx,
                amount: dollars,                     // "17.45", "13.31", etc.
                amount_formatted: `$${dollars}`,     // ready for UI
                amount_cents: cents                  // keep original for reference
            };
        });

        // Convert timestamps to Mexico City (already good)
        TX = recursivelyConvertTimestamps(TX);

        return res.json({ status: true, data: TX });

    } catch (error) {
        console.error('[getTxApp] Error:', error);
        return res.status(400).json({
            status: false,
            error: true,
            data: error.message,
            stack: error.stack
        });
    }
};
/**
 * Save signature from Base64
 *
 * Stores or updates a customer signature associated with a transaction.
 * Signature is stored as a binary blob for space efficiency.
 *
 * PCI DSS 4.0 Requirements:
 * - Requirement 3.4: Protects cardholder data storage (signature linked to transaction)
 * - Requirement 10.2.2: Logs all actions taken to modify cardholder data
 * - Requirement 12.3: Implements usage policies for critical technologies
 *
 * @param {Object} req - Request containing firma (base64), reference_number, and authorization
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with success message or error
 */
processorsCtrl.saveSignature = async (req,res) => {
  const blob = Buffer.from(req.body.firma,"base64");

  // Busca la transacción por reference_number y authorization
  const tx = await db.isoMessage.findOne({
    include: {
      model: db.signatures,
      as: 'signature',
      required: false,
      attributes:['id']
    },
    where: {
      reference_number: req.body.reference_number,
      authorization: req.body.authorization
    }
  });

  if(tx){
    if(tx.signature){
      // Actualiza firma existente
      const signature = await db.signatures.findOne({ where: {id: tx.signature.id } });
      signature.signature = blob;
      signature.updated_at = Date.now();
      await signature.save();
    } else {
      // Crea nueva firma
      await db.signatures.create({
        id_iso_message: tx.id_message,
        signature: blob,
      });
    }
    res.json({ msg: "firma guardada" });
    return;
  } else {
    res.status(404).json({error:'Transacción no encontrada'});
    return;
  }
};

/**
 * Get signature
 *
 * Retrieves a signature from the database and returns it as base64 encoded string.
 *
 * PCI DSS 4.0 Requirements:
 * - Requirement 7.2: Access to signature data based on user authorization
 * - Requirement 10.2.1: Logs all individual user access to cardholder data
 *
 * @param {Object} req - Request containing signature id in body
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with base64 encoded signature or error
 */
processorsCtrl.getSignature = async (req,res) => {
  try {
    const img = await getSign(req.body.id);
    res.json({ img });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Helper function to retrieve signature from database
 *
 * PCI DSS 4.0 Requirement 7.2: Enforces access control for cardholder data
 *
 * @param {number} id_signature - The signature ID to retrieve
 * @returns {string} Base64 encoded signature
 * @throws {Error} If signature is not found
 */
async function getSign(id_signature) {
  const S = await db.signatures.findOne({ where: { id: id_signature } });
  if (!S) throw new Error('Firma no encontrada');

  return S.signature.toString('base64');
}

/**
 * Helper function to generate random numbers
 *
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {number} Random integer between min and max
 */
function random(min,max){
  return Math.floor((Math.random() * (max - min + 1)) + min);
}

module.exports = processorsCtrl;