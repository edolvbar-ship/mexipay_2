#!/usr/bin/env node

require('dotenv').config();

const IsoSeliaService = require('../lib/socketServer/lib/services/isoSeliaService');
const helpers = require('../lib/helpers/lib/helpers');
const { seq: sequelize, ...db } = require('../lib/socketServer/lib/sequelize/init');

// FIXED CONFIG
function getSeliaConfig() {
  return {
    companyId: parseInt(process.env.SELIA_COMPANY_TPV_ID || '44001', 10),
    username: process.env.SELIA_ISO_USERNAME,
    password: process.env.SELIA_ISO_PASSWORD,
    host: process.env.SELIA_ISO_HOST || '152.0.2.121',
    port: parseInt(process.env.SELIA_ISO_PORT || '5001', 10),
    aesKey: process.env.SELIA_AES_KEY,
    timeout: 30000,
    debug: true,
  };
}

function parseArgs(argv) {
  const out = { list: false, cancel: null, limit: 25, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--list') out.list = true;
    else if (a === '--cancel') out.cancel = argv[i + 1] || null, i++;
    else if (a === '--limit') out.limit = parseInt(argv[i + 1] || '25', 10), i++;
    else if (a === '--dry-run') out.dryRun = true;
  }
  return out;
}

// FIXED TRANSACTION ID EXTRACTION
function extractTransactionId(tx) {
  if (!tx.tkn_data_63_rp) return null;

  const hex = String(tx.tkn_data_63_rp).replace(/^&/, '').replace(/\s/g, '');

  // Look for "transaction_id":" in hex
  const pattern = '227472616E73616374696F6E5F6964223A22';
  const index = hex.indexOf(pattern);

  if (index !== -1) {
    const start = index + pattern.length;
    let tidHex = '';

    // Extract until closing quote (hex 22)
    for (let i = start; i < hex.length; i += 2) {
      const pair = hex.substr(i, 2);
      if (pair === '22') break; // Closing quote
      tidHex += pair;
    }

    if (tidHex) {
      // Convert hex to string
      let tid = '';
      for (let i = 0; i < tidHex.length; i += 2) {
        tid += String.fromCharCode(parseInt(tidHex.substr(i, 2), 16));
      }
      return tid;
    }
  }

  return null;
}

// GET PROPER TERMINAL ID
function getTerminalId(tx) {
  const terminal = tx.terminal || 'N860W176266';
  // Remove non-alphanumeric and ensure proper length
  return terminal.replace(/[^A-Z0-9]/g, '').substring(0, 12);
}

// GET PROPER NODO FROM TERMINAL
function getNodoFromTerminal(terminal) {
  // Terminal format: N860W176266
  // Extract the numeric part after W
  const match = terminal.match(/W(\d+)/);
  return match ? match[1] : '1';
}

// BUILD PROPER ISO 611 FOR CANCEL
function buildISO611ForCancel(tx, track2) {
  // Cancel uses MTI 0420
  const mti = '0420';

  // Primary bitmap (hex): 7238008002EE0920
  // Fields: 2,3,4,7,11,12,13,22,25,35,37,38,41,42,49,55,63
  const primaryBitmap = '7238008002EE0920';

  // Field 2: PAN
  const pan = track2.split('=')[0];
  const f2 = pan.length.toString(16).padStart(2, '0').toUpperCase() + pan;

  // Field 3: Processing code (00 00 00 for reversal)
  const f3 = '000000';

  // Field 4: Amount in cents (14.00 = 1400)
  const amountCents = String(Math.round((tx.amount || 0) * 100)).padStart(12, '0');
  const f4 = amountCents;

  // Field 7: Transmission date/time (MMDDHHMMSS)
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mn = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const f7 = mm + dd + hh + mn + ss;

  // Field 11: STAN (from trace_number or generate)
  const f11 = String(tx.trace_number || Date.now() % 1000000).padStart(6, '0');

  // Field 12: Local time
  const f12 = hh + mn + ss;

  // Field 13: Local date
  const f13 = mm + dd;

  // Field 22: POS entry mode
  const f22 = tx.entry_mode || '501';

  // Field 25: POS condition code
  const f25 = '00';

  // Field 35: Track 2 data
  const f35 = track2.length.toString(16).padStart(2, '0').toUpperCase() + track2;

  // Field 37: RRN (Retrieval Reference Number)
  const f37 = (tx.reference_number || '').padStart(12, '0');

  // Field 38: Auth code
  const f38 = (tx.authorization || '').padStart(6, '0');

  // Field 41: Terminal ID (8 chars)
  const terminalId = getTerminalId(tx);
  const f41 = terminalId.substring(0, 8).padEnd(8, ' ');

  // Field 42: Merchant ID (15 chars)
  const merchantId = tx.name_merchant || tx.card_acceptor || '62';
  const f42 = merchantId.substring(0, 15).padEnd(15, ' ');

  // Field 49: Currency (484 = MXN)
  const f49 = '484';

  // Field 52: PIN Data (16 zeros for cancel)
  const f52 = '0000000000000000';

  // Field 55: EMV data (from tkn_data_63_rq)
  let f55 = '';
  if (tx.tkn_data_63_rq) {
    try {
      let emvData = String(tx.tkn_data_63_rq).trim();
      if (emvData.startsWith('&')) emvData = emvData.substring(1).trim();
      emvData = emvData.replace(/\s/g, '');

      if (!/^[0-9A-F]+$/i.test(emvData)) {
        emvData = Buffer.from(emvData).toString('hex');
      }

      const length = Math.min(emvData.length / 2, 255);
      f55 = length.toString(16).padStart(2, '0').toUpperCase() + emvData.substring(0, length * 2);
    } catch (e) {
      console.log('Note: Could not include EMV data');
    }
  }

  // Field 63: Private data (from tkn_data_63_rp)
  let f63 = '';
  if (tx.tkn_data_63_rp) {
    try {
      let privateData = String(tx.tkn_data_63_rp).trim();
      if (privateData.startsWith('&')) privateData = privateData.substring(1).trim();
      privateData = privateData.replace(/\s/g, '');

      if (!/^[0-9A-F]+$/i.test(privateData)) {
        privateData = Buffer.from(privateData).toString('hex');
      }

      const length = Math.min(privateData.length / 2, 999);
      f63 = length.toString().padStart(3, '0') + privateData.substring(0, length * 2);
    } catch (e) {
      console.log('Note: Could not include private data');
    }
  }

  // Build ISO
  let iso = mti + primaryBitmap + f2 + f3 + f4 + f7 + f11 + f12 + f13 + f22 + f25 + f35 + f37 + f38 + f41 + f42 + f49 + f52;

  // Add EMV data if present (update bitmap)
  if (f55) {
    // Set bit 55 in secondary bitmap
    iso = iso.substring(0, 20) + '8' + iso.substring(21) + f55;
  }

  // Add private data if present
  if (f63) {
    // Set bit 63 in secondary bitmap
    if (f55) {
      iso = iso.substring(0, 20) + 'C' + iso.substring(21) + f63;
    } else {
      iso = iso.substring(0, 20) + '4' + iso.substring(21) + f63;
    }
  }

  return iso;
}

// BUILD PROPER SELIA MESSAGE
function buildSeliaCancelMessage(tx, track2, transactionId) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  const transactionDateTime = `${year}${month}${day}${hours}${minutes}${seconds}`;

  // Get masked PAN
  const pan = track2.split('=')[0];
  const maskedPan = pan.substring(0, 6) + '******' + pan.substring(pan.length - 4);

  // Get amount in cents
  const amountCents = String(Math.round((tx.amount || 0) * 100));

  // Get terminal and nodo
  const terminal = getTerminalId(tx);
  const nodo = getNodoFromTerminal(terminal);

  // Build ISO 611
  const iso611 = buildISO611ForCancel(tx, track2);

  // Get config
  const config = getSeliaConfig();

  // Build fields - CORRECT ORDER AND NO EXTRA QUOTES!
  const fields = {
    '161': String(config.companyId), // Company ID
    '1': '1', // Originador
    '2': nodo, // Nodo
    '3': transactionDateTime, // FechaHora
    '7': '503', // TrxType (503 = Cancelación)
    '19': tx.folio || tx.reference_number || '', // Ticket POS
    '35': maskedPan, // Tarjeta enmascarada
    '45': amountCents, // Monto en centavos
    '50': tx.authorization || '', // Auth original
    '56': '0', // TrxSubtype
    '58': '5', // EntryMode (5 = PINPAD)
    '74': transactionId, // TrxID Original - NO EXTRA QUOTE!
    '163': 'S', // Voucher
    '172': process.env.SELIA_AFFILIATION || '9471496', // Afiliación
    '611': iso611, // Mensaje ISO
    '54': config.username || '', // Usuario Selia
    '219': config.password || '', // Contraseña Selia
  };

  // Remove empty/null/undefined fields
  Object.keys(fields).forEach(key => {
    if (!fields[key] && fields[key] !== '0') {
      delete fields[key];
    }
  });

  // Build message string
  let seliaMsg = '{';
  const fieldOrder = ['161', '1', '2', '3', '7', '19', '35', '45', '50', '56', '58', '74', '163', '172', '611', '54', '219'];

  for (const key of fieldOrder) {
    if (fields[key] !== undefined) {
      seliaMsg += `${key}:${fields[key]};`;
    }
  }

  seliaMsg = seliaMsg.slice(0, -1) + '}';
  return seliaMsg;
}

// LIST FUNCTION
async function listApproved(limit) {
  const rows = await db.isoMessage.findAll({
    where: { estatus_f: 2 },
    order: [['creation_date', 'DESC']],
    limit,
    raw: true,
  });

  console.log('\n' + '='.repeat(150));
  console.log('APPROVED TRANSACTIONS');
  console.log('='.repeat(150));
  console.log('id | created | merchant | terminal | amount | auth | trxId | ref | entry');
  console.log('-' + '-'.repeat(149));

  for (const r of rows) {
    const tid = extractTransactionId(r);
    const created = r.creation_date ? new Date(r.creation_date).toISOString().substring(0, 19).replace('T', ' ') : '';

    console.log(
      String(r.id_message).padEnd(4) + ' | ' +
      created.padEnd(19) + ' | ' +
      String(r.name_merchant || '').padEnd(8) + ' | ' +
      String(r.terminal || '').padEnd(10) + ' | ' +
      String(r.amount || '').padEnd(7) + ' | ' +
      String(r.authorization || '').padEnd(6) + ' | ' +
      String(tid || '').padEnd(10) + ' | ' +
      String(r.folio || r.reference_number || '').padEnd(12) + ' | ' +
      String(r.entry_mode || '')
    );
  }

  console.log('='.repeat(150));
  console.log(`Showing ${rows.length} row(s)`);
}

// MAIN CANCEL FUNCTION - FIXED!
async function cancelByAuthCode(authCode, { dryRun }) {
  console.log(`\n🎯 CANCEL TRANSACTION: ${authCode}`);

  const tx = await db.isoMessage.findOne({
    where: { authorization: String(authCode) },
    order: [['id_message', 'DESC']],
    raw: true,
  });

  if (!tx) {
    console.error(`❌ No transaction with auth=${authCode}`);
    process.exitCode = 1;
    return;
  }

  console.log(`✅ Found: ID ${tx.id_message}, $${tx.amount}, ${tx.terminal}`);

  if (tx.estatus_f !== 2) {
    console.error(`❌ Not approved (status=${tx.estatus_f})`);
    process.exitCode = 1;
    return;
  }

  // Get transaction ID
  const transactionId = extractTransactionId(tx);
  if (!transactionId) {
    console.error('❌ Cannot extract transaction ID');
    console.log('tkn_data_63_rp:', tx.tkn_data_63_rp?.substring(0, 100));
    process.exitCode = 1;
    return;
  }

  console.log(`✅ Transaction ID: ${transactionId}`);

  // Get track2
  let track2;
  try {
    const decrypted = await helpers.decryptTrack2(tx.track2);
    track2 = String(decrypted).trim();
    if (track2.includes('D')) track2 = track2.replace('D', '=');
    console.log(`✅ Track2: ${track2.substring(0, 30)}...`);
  } catch (e) {
    console.error(`❌ Cannot decrypt track2: ${e.message}`);
    process.exitCode = 1;
    return;
  }

  // Build Selia message
  console.log('\n🔨 Building Selia message...');
  const seliaMessage = buildSeliaCancelMessage(tx, track2, transactionId);

  console.log('\n' + '='.repeat(80));
  console.log('📤 SELIA MESSAGE (VALIDATED)');
  console.log('='.repeat(80));

  // Validate the message
  const lines = [];
  let inField = false;
  let currentField = '';

  for (let i = 0; i < seliaMessage.length; i++) {
    if (seliaMessage[i] === '{') {
      lines.push('{');
    } else if (seliaMessage[i] === '}') {
      if (currentField) {
        lines.push(`  ${currentField}`);
        currentField = '';
      }
      lines.push('}');
    } else if (seliaMessage[i] === ';') {
      if (currentField) {
        lines.push(`  ${currentField}`);
        currentField = '';
      }
    } else {
      currentField += seliaMessage[i];
    }
  }

  console.log(lines.join('\n'));

  // Check for common errors
  if (seliaMessage.includes('""')) {
    console.error('\n⚠️  WARNING: Message contains empty quotes!');
  }

  if (seliaMessage.includes('166939323"')) {
    console.error('\n⚠️  ERROR: Extra quote in field 74!');
    console.log('Should be: 74:166939323');
    console.log('Actual:    ', seliaMessage.match(/74:[^;]+/)?.[0]);
  }

  const terminalField = seliaMessage.match(/611:[^;]+/)?.[0] || '';
  if (terminalField.includes('N860W17662 ')) {
    console.error('\n⚠️  ERROR: Truncated terminal ID in ISO!');
    console.log('Should be: N860W176266');
  }

  console.log(`\nMessage length: ${seliaMessage.length} chars`);

  if (dryRun) {
    console.log('\n🚫 DRY RUN - Not sending');
    return;
  }

  // Send via IsoSeliaService
  console.log('\n🚀 Sending via IsoSeliaService...');

  const config = getSeliaConfig();
  const seliaService = new IsoSeliaService({
    ...config,
    db: { ...db, sequelize },
    helpers,
  });

  try {
    // Build payment info
    const pan = track2.split('=')[0];
    const paymentInfo = {
      transactionType: 'cancel',
      originador: '1',
      merchantId: tx.name_merchant || '62',
      nodo: getNodoFromTerminal(tx.terminal),
      folioMexipay: tx.folio || tx.reference_number,
      amount: String(Math.round((tx.amount || 0) * 100)),
      cardNumber: pan,
      tk2: track2,
      cardType: tx.card_type || 'DE',
      cardEmisor: 'VISA',
      versionMexipay: 'MxPay251101',
      originalAuthCode: authCode,
      originalTrxId: transactionId,
      isEcommerce: false,
    };

    const guid = `cancel_${Date.now()}`;

    console.log('\n📤 Sending with params:');
    console.log('- Transaction ID:', transactionId);
    console.log('- Merchant:', paymentInfo.merchantId);
    console.log('- Nodo:', paymentInfo.nodo);
    console.log('- Amount:', paymentInfo.amount);

    const result = await seliaService.processISOMessage(seliaMessage, paymentInfo, {
      guid,
      merchantId: paymentInfo.merchantId,
      reference: paymentInfo.folioMexipay,
    });

    console.log('\n✅ RESPONSE:');
    console.log('Success:', result.success);
    console.log('Code:', result.responseCode);
    console.log('Message:', result.responseMessage);
    console.log('Auth:', result.authorizationCode);
    console.log('New TrxID:', result.transactionId);

    if (!result.success) {
      console.error('❌ Cancellation failed');
      process.exitCode = 1;
    }

  } catch (error) {
    console.error('\n💥 Error:', error.message);
    if (error.stack) console.error(error.stack.split('\n')[0]);
    process.exitCode = 1;
  }
}

// MAIN
async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.list && !args.cancel) {
    console.log('\nUsage:');
    console.log('  node cancel_fixed.js --list [--limit 25]');
    console.log('  node cancel_fixed.js --cancel <authCode> [--dry-run]');
    console.log('\nExample for 042451:');
    console.log('  node cancel_fixed.js --cancel 042451 --dry-run');
    console.log('  node cancel_fixed.js --cancel 042451');
    process.exitCode = 1;
    return;
  }

  try {
    if (args.list) {
      await listApproved(args.limit);
    }

    if (args.cancel) {
      await cancelByAuthCode(args.cancel, { dryRun: args.dryRun });
    }
  } catch (err) {
    console.error('\n💥 Fatal:', err?.message || err);
    process.exitCode = 1;
  } finally {
    try {
      if (sequelize && typeof sequelize.close === 'function') {
        await sequelize.close();
      }
    } catch {
      // ignore
    }
  }
}

if (require.main === module) {
  main();
}