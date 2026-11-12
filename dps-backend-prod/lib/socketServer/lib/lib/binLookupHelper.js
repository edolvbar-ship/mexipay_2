'use strict';
/**
 * @file BIN Lookup Helper
 *
 * Provides database-powered BIN (Bank Identification Number) identification
 * using the ciso_bin table with the same join structure as datosBIn().
 * Falls back to first-digit brand detection when the BIN is not in the database.
 *
 * Usage (as module):
 *   const { getBinDataInfoInt } = require('../lib/binLookupHelper');
 *   const binInfo = await getBinDataInfoInt('41111111');
 *
 * Usage (command line):
 *   node lib/socketServer/lib/lib/binLookupHelper.js <BIN>
 *   Example: node lib/socketServer/lib/lib/binLookupHelper.js 41111111
 *
 * @module binLookupHelper
 */
require('dotenv').config();

let sequelize = null;
let QueryTypes = null;
let dbInitialized = false;

/**
 * Lazily initializes the database connection.
 * @returns {Promise<boolean>} True if connection is available, false otherwise.
 */
async function initDatabase() {
  if (dbInitialized && sequelize) return true;
  try {
    const db = require('../sequelize/init');
    const seq = require('sequelize');

    if (!db || !db.seq) {
      console.error('[binLookupHelper] Sequelize init module loaded but db.seq is undefined');
      return false;
    }

    sequelize = db.seq;
    QueryTypes = seq.QueryTypes;
    dbInitialized = true;
    return true;
  } catch (error) {
    console.error('[binLookupHelper] Database initialization failed:', error.message);
    return false;
  }
}

/**
 * Default BIN info returned when no BIN is provided or as a base for fallbacks.
 * @param {string} [bin=''] - The BIN string.
 * @returns {Object} Default BIN info object.
 */
function getDefaultBinInfo(bin = '') {
  return {
    id_bin: 0,
    id_processor: null,
    processor: 'Definido por comercio',
    bin: bin,
    bank: 'INTERNACIONAL',
    product: 'INTERNACIONAL',
    type: 'GENERAL',
    brand: 'GENERAL',
  };
}

/**
 * Detects card brand from the first digit of a BIN.
 * @param {string} bin - The BIN string.
 * @returns {string} Brand name ('AMEX', 'VISA', 'MASTERCARD', or 'GENERAL').
 */
function detectBrandByFirstDigit(bin) {
  if (!bin || typeof bin !== 'string') return 'GENERAL';
  const firstDigit = bin.substring(0, 1);
  if (firstDigit === '3') return 'AMEX';
  if (firstDigit === '4') return 'VISA';
  if (firstDigit === '5' || firstDigit === '6') return 'MASTERCARD';
  return 'GENERAL';
}

/**
 * Queries the ciso_bin table for full BIN metadata using the same 5-table join
 * as datosBIn() in clientHttpServer.js.
 *
 * @param {string} binTry - The BIN string to look up (6 or 8 digits).
 * @returns {Promise<Object|null>} BIN info object from database, or null if not found.
 */
async function queryBinFromDatabase(binTry) {
  const dbReady = await initDatabase();
  if (!dbReady || !sequelize || typeof sequelize.query !== 'function') {
    console.debug('[binLookupHelper] Database not available for BIN lookup');
    return null;
  }

  const rows = await sequelize.query(
    `SELECT A.id_bin, A.bin, B.name bank, C.name product, D.name type,
            E.id_processor, COALESCE(E.fiid, 'Definido por comercio') as processor,
            F.name brand
     FROM ciso_bin A
     JOIN iso_issuer_bank B ON A.id_issbank = B.id_issbank
     JOIN iso_card_product C ON A.id_card_product = C.id_card_product
     JOIN iso_card_type D ON A.id_card_type = D.id_card_type
     LEFT JOIN iso_processor E ON A.id_processor = E.id_processor
     JOIN iso_brand F ON A.id_brand = F.id_brand
     WHERE A.bin = :bin
     LIMIT 1`,
    {
      replacements: { bin: binTry },
      type: QueryTypes.SELECT,
    }
  );

  if (rows && rows.length > 0) {
    const row = rows[0];
    return {
      id_bin: row.id_bin,
      id_processor: row.id_processor,
      processor: row.processor,
      bin: row.bin,
      bank: row.bank,
      product: row.product,
      type: row.type,
      brand: row.brand,
    };
  }
  return null;
}

/**
 * Looks up BIN information from the ciso_bin database table.
 * Tries 8-digit BIN first, then 6-digit. If not found in the database,
 * falls back to first-digit brand detection.
 *
 * @param {string} bin - The BIN string (typically 6-8 digits from card number).
 * @returns {Promise<Object>} BIN info object with fields:
 *   {id_bin, id_processor, processor, bin, bank, product, type, brand}
 */
async function getBinDataInfoInt(bin) {
  const safeBin = (bin && typeof bin === 'string') ? bin : '';
  const defaultInfo = getDefaultBinInfo(safeBin);

  if (!safeBin) {
    return defaultInfo;
  }

  // Try database lookup — 8-digit first, then 6-digit
  try {
    const binCandidates = [safeBin.substring(0, 8), safeBin.substring(0, 6)].filter(
      (v, i, a) => v && a.indexOf(v) === i
    );

    for (const binTry of binCandidates) {
      const result = await queryBinFromDatabase(binTry);
      if (result) {
        console.debug(
          '[binLookupHelper] ✅ BIN found in ciso_bin table:',
          binTry,
          '→',
          result.brand,
          result.bank
        );
        return result;
      }
    }
    console.debug(
      '[binLookupHelper] 🔄 BIN not found in ciso_bin table, using brand detection fallback:',
      safeBin
    );
  } catch (error) {
    console.error('[binLookupHelper] Error during BIN database lookup:', error.message);
  }

  // Fallback: brand detection by first digit
  defaultInfo.brand = detectBrandByFirstDigit(safeBin);
  return defaultInfo;
}

// CLI support
if (require.main === module) {
  const bin = process.argv[2];
  if (!bin) {
    console.log('Usage: node binLookupHelper.js <BIN>');
    console.log('Example: node binLookupHelper.js 41111111');
    process.exit(0);
  }

  getBinDataInfoInt(bin)
    .then((result) => {
      console.log('BIN Lookup Result:');
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error:', err.message);
      process.exit(1);
    });
}

module.exports = {
  getBinDataInfoInt,
  getDefaultBinInfo,
  detectBrandByFirstDigit,
  queryBinFromDatabase,
};