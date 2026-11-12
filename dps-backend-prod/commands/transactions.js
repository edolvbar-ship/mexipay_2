const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const nodemailer = require('nodemailer');
require('dotenv').config();

// Helper function to flatten nested objects
function flattenObject(obj, prefix = '') {
  if (!obj || typeof obj !== 'object') {
    return {};
  }

  const result = {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      const newKey = prefix ? `${prefix}_${key}` : key;

      if (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)) {
        // Recursively flatten nested objects
        Object.assign(result, flattenObject(value, newKey));
      } else {
        result[newKey] = value;
      }
    }
  }

  return result;
}

// SIMPLE function to generate CSV file
async function generateCSV(rows, filename = null, merchantName = null, sendToEmail = null) {
  if (rows.length === 0) {
    console.log('📭 No data to export to CSV');
    return;
  }

  // Generate filename if not provided
  if (!filename) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    let baseFilename = `transactions_${timestamp}`;

    // Add merchant name to filename if provided
    if (merchantName) {
      // Clean merchant name for filename (remove special characters, spaces)
      const cleanMerchantName = merchantName
        .replace(/[^a-zA-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .substring(0, 30); // Limit length
      baseFilename = `${cleanMerchantName}_${baseFilename}`;
    }

    filename = `${baseFilename}.csv`;
  }

  // Parse JSON from all rows to get all possible keys
  let allJsonKeys = new Set();
  let parsedDataArray = [];

  rows.forEach(row => {
    let parsedJson = {};
    if (row.more_info) {
      try {
        // Clean the JSON string
        let jsonStr = row.more_info;

        // Handle different JSON formats
        if (typeof jsonStr === 'string') {
          jsonStr = jsonStr.trim();

          // Remove outer quotes if present
          if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
            jsonStr = jsonStr.slice(1, -1);
          }

          // Unescape quotes
          jsonStr = jsonStr.replace(/\\"/g, '"');

          // Fix common JSON issues
          // 1. Fix missing quotes around property names
          jsonStr = jsonStr.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');

          // 2. Fix missing quotes around string values (simple cases)
          jsonStr = jsonStr.replace(/:\s*([a-zA-Z_][a-zA-Z0-9_]*)(?=\s*[,}])/g, ': "$1"');

          // 3. Fix trailing commas
          jsonStr = jsonStr.replace(/,\s*}/g, '}');
          jsonStr = jsonStr.replace(/,\s*]/g, ']');

          // Try to parse
          try {
            parsedJson = JSON.parse(jsonStr);
          } catch (parseError) {
            // If still fails, try to extract the valid part
            console.log(`⚠️  JSON parse failed for row ${row.id_message}, attempting recovery...`);

            // Try to find and extract a valid JSON object
            const jsonStart = jsonStr.indexOf('{');
            const jsonEnd = jsonStr.lastIndexOf('}');

            if (jsonStart >= 0 && jsonEnd > jsonStart) {
              const potentialJson = jsonStr.substring(jsonStart, jsonEnd + 1);
              try {
                parsedJson = JSON.parse(potentialJson);
                console.log(`✅ Recovered JSON for row ${row.id_message}`);
              } catch (e) {
                console.log(`❌ Could not recover JSON for row ${row.id_message}`);
                parsedJson = {};
              }
            } else {
              parsedJson = {};
            }
          }
        } else if (typeof jsonStr === 'object') {
          // It's already an object
          parsedJson = jsonStr;
        }

        // Flatten nested objects
        parsedJson = flattenObject(parsedJson);

        // Collect all keys
        Object.keys(parsedJson).forEach(key => allJsonKeys.add(key));

      } catch (e) {
        console.log(`⚠️  Failed to parse JSON for row ${row.id_message}: ${e.message}`);
        if (row.more_info && typeof row.more_info === 'string') {
          console.log(`Raw JSON preview: ${row.more_info.substring(0, 200)}...`);
        }
      }
    }
    parsedDataArray.push(parsedJson);
  });

  // Use your specific column order instead of dynamic JSON keys
  const specificJsonKeys = [
    'billing_address_city',
    'billing_address_country',
    'billing_address_postal_code',
    'billing_address_state',
    'billing_address_street',
    'customer_email',
    'customer_name',
    'expiration_selia_format',
    'order_id',
    'response_message',
    'selia_transaction_id'
  ];

  // Your specific column headers in the exact order you want
  const headers = [
    'ID',
    'Merchant Name',
    'Terminal',
    'Message Type',
    'Reference Number',
    'Amount',
    'Response Code',
    'Authorization',
    'BIN',
    'Last 4',
    'Creation Date',
    'Operation ID',
    'Status',
    'Card Type',
    'Transaction Date',
    'Transaction Time',
    'Capture Date',
    'Card Acceptor',
    'Folio',
    'Trace Number',
    'Entry Mode',
    'Reverse Code',
    'Draft Capture'
  ];

  // Add your specific JSON columns in the order you specified
  headers.push(...specificJsonKeys);

  // Helper function to safely convert any value to CSV string
  const toCSVValue = (value) => {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    // Handle Date objects
    if (value instanceof Date) {
      return `"${value.toISOString()}"`;
    }

    // Convert to string
    let stringValue;
    if (typeof value === 'object') {
      stringValue = JSON.stringify(value);
    } else {
      stringValue = String(value);
    }

    // Escape quotes and wrap in CSV quotes
    return `"${stringValue.replace(/"/g, '""')}"`;
  };

  // Convert rows to CSV format
  const csvRows = [headers.join(',')];

  rows.forEach((row, index) => {
    const parsedJson = parsedDataArray[index] || {};

    const csvRow = [
      toCSVValue(row.id_message),
      toCSVValue(row.name_merchant),
      toCSVValue(row.terminal),
      toCSVValue(row.msg_type),
      toCSVValue(row.reference_number),
      toCSVValue(row.amount),
      toCSVValue(row.resp_code),
      toCSVValue(row.authorization),
      toCSVValue(row.bin),
      toCSVValue(row.last4),
      toCSVValue(row.creation_date),
      toCSVValue(row.id_operation),
      toCSVValue(row.estatus_f),
      toCSVValue(row.card_type),
      toCSVValue(formatTransactionDate(row.tran_date)),
      toCSVValue(formatTransactionTime(row.tran_time)),
      toCSVValue(formatTransactionDate(row.capture_date)),
      toCSVValue(row.card_acceptor),
      toCSVValue(row.folio),
      toCSVValue(row.trace_number),
      toCSVValue(row.entry_mode),
      toCSVValue(row.reverse_code),
      toCSVValue(row.draft_capture)
    ];

    // Add only your specific JSON columns in the order you specified
    specificJsonKeys.forEach(key => {
      let value = parsedJson[key] || '';
      // Format expiration date if it's the expiration_selia_format field
      if (key === 'expiration_selia_format') {
        value = formatExpirationDate(value);
      }
      csvRow.push(toCSVValue(value));
    });

    csvRows.push(csvRow.join(','));
  });

  // Write to file
  const csvContent = csvRows.join('\n');
  
  // Check if email sending is requested
  if (sendToEmail) {
    console.log(`📧 Preparing to send CSV via email to: ${sendToEmail}`);
    const emailSent = await sendEmailWithCSV(csvContent, filename, sendToEmail, merchantName);
    
    if (emailSent) {
      console.log(`📄 CSV file sent via email: ${filename}`);
      console.log(`📊 Exported ${rows.length} transactions with ${specificJsonKeys.length} specific JSON fields`);
      if (merchantName) {
        console.log(`🏪 Merchant: ${merchantName}`);
      }
      return;
    } else {
      console.log('⚠️  Email sending failed, falling back to S3 upload...');
    }
  }
  
  // Upload to S3 instead of writing to local file
  const uploadSuccess = await uploadCSVToS3(csvContent, filename);
  
  if (uploadSuccess) {
    console.log(`📄 CSV file processed and uploaded to S3: ${filename}`);
    console.log(`📊 Exported ${rows.length} transactions with ${specificJsonKeys.length} specific JSON fields`);
    if (merchantName) {
      console.log(`🏪 Merchant: ${merchantName}`);
    }

    // Show warning about JSON parsing issues
    const failedParses = parsedDataArray.filter(obj => Object.keys(obj).length === 0).length;
    if (failedParses > 0) {
      console.log(`⚠️  Warning: ${failedParses} rows had JSON parsing issues (showing empty values for JSON columns)`);
    }
  } else {
    // Fallback to local file if S3 upload fails
    console.log('⚠️  S3 upload failed, falling back to local file...');
    fs.writeFileSync(filename, csvContent, 'utf8');
    console.log(`📄 CSV file generated locally: ${filename}`);
    console.log(`📊 Exported ${rows.length} transactions with ${specificJsonKeys.length} specific JSON fields`);
    if (merchantName) {
      console.log(`🏪 Merchant: ${merchantName}`);
    }
  }
}

// SIMPLE function to display transactions in a clean table
function displayTransactionsTable(rows, title = 'TRANSACTIONS', fullMode = false, specificTxnId = null) {
  if (rows.length === 0) {
    console.log('📭 No records to display');
    return;
  }

  // If full mode and specific transaction, show all fields without truncation
  if (fullMode && specificTxnId && rows.length === 1) {
    const row = rows[0];
    console.log('\n' + '═'.repeat(150));
    console.log(`📋 ${title} - FULL DETAILS`);
    console.log('═'.repeat(150));

    console.log('🔍 TRANSACTION IDENTIFIERS:');
    console.log(`   ID: ${row.id_message || 'N/A'}`);
    console.log(`   Reference Number: ${row.reference_number || 'N/A'}`);
    console.log(`   Authorization: ${row.authorization || 'N/A'}`);
    console.log(`   Response Code: ${row.resp_code || 'N/A'}`);
    console.log(`   Status: ${row.estatus_f || 'N/A'}`);
    console.log(`   Message Type: ${row.msg_type || 'N/A'}`);
    console.log(`   Operation ID: ${row.id_operation || 'N/A'}`);
    console.log(`   Trace Number: ${row.trace_number || 'N/A'}`);

    console.log('\n💰 AMOUNT & CARD INFO:');
    console.log(`   Amount: $${row.amount / 100 || '0.00'}`);
    console.log(`   BIN: ${row.bin || 'N/A'}`);
    console.log(`   Last 4: ${row.last4 || 'N/A'}`);
    console.log(`   Card Type: ${row.card_type || 'N/A'}`);
    console.log(`   Track 2: ${row.track2 || 'N/A'}`);

    console.log('\n🏪 MERCHANT & TERMINAL INFO:');
    console.log(`   Merchant Name: ${row.name_merchant || 'N/A'}`);
    console.log(`   Terminal: ${row.terminal || 'N/A'}`);
    console.log(`   Card Acceptor: ${row.card_acceptor || 'N/A'}`);
    console.log(`   Node: ${row.node || 'N/A'}`);
    console.log(`   Folio: ${row.folio || 'N/A'}`);

    console.log('\n📅 DATES & TIMES:');
    console.log(`   Creation Date: ${row.creation_date || 'N/A'}`);
    console.log(`   Transaction Date: ${formatTransactionDate(row.tran_date)}`);
    console.log(`   Transaction Time: ${formatTransactionTime(row.tran_time)}`);
    console.log(`   Capture Date: ${formatTransactionDate(row.capture_date)}`);

    console.log('\n🔐 FIELD 63 - TOKEN DATA (REQUEST):');
    console.log(`   tkn_data_63_rq: ${row.tkn_data_63_rq || 'N/A'}`);

    console.log('\n🔐 FIELD 63 - TOKEN DATA (RESPONSE):');
    console.log(`   tkn_data_63_rp: ${row.tkn_data_63_rp || 'N/A'}`);

    console.log('\n🔧 OTHER FIELDS:');
    console.log(`   Entry Mode: ${row.entry_mode || 'N/A'}`);
    console.log(`   Reverse Code: ${row.reverse_code || 'N/A'}`);
    console.log(`   Draft Capture: ${row.draft_capture || 'N/A'}`);
    console.log(`   Previous Reference: ${row.reference_number_ant || 'N/A'}`);
    console.log(`   More Info: ${row.more_info || 'N/A'}`);

    console.log('═'.repeat(150));
    return;
  }

  console.log('\n' + '═'.repeat(120));
  console.log(`📋 ${title}`);
  console.log('═'.repeat(120));

  // Display table header
  console.log('│ ID      │ Merchant           │ Terminal   │ Type │ Ref #         │ Amount    │ Resp │ Auth     │ BIN       │ Last4 │ Date/Time          │');
  console.log('├─────────┼────────────────────┼────────────┼──────┼───────────────┼───────────┼──────┼──────────┼───────────┼───────┼────────────────────┤');

  // Display each row
  rows.forEach((row, index) => {
    const id = String(row.id_message || '').padEnd(7);
    const merchant = (row.name_merchant || 'N/A').substring(0, 18).padEnd(18);
    const terminal = (row.terminal || 'N/A').padEnd(10);
    const type = (row.msg_type || 'N/A').padEnd(4);
    const ref = (row.reference_number || 'N/A').padEnd(13);
    const amount = row.amount ? `$${parseInt(row.amount)}`.padEnd(9) : '$0.00'.padEnd(9);
    const resp = (row.resp_code || 'N/A').padEnd(4);
    const auth = (row.authorization || 'N/A').padEnd(8);
    const bin = (row.bin || 'N/A').padEnd(9);
    const last4 = (row.last4 || 'N/A').padEnd(5);

    const date = new Date(row.creation_date);
    const datetime = date.toLocaleString('es-MX', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).padEnd(18);

    console.log(`│ ${id} │ ${merchant} │ ${terminal} │ ${type} │ ${ref} │ ${amount} │ ${resp} │ ${auth} │ ${bin} │ ${last4} │ ${datetime} │`);

    // Add separator every 10 rows
    if (index < rows.length - 1 && (index + 1) % 10 === 0) {
      console.log('├─────────┼────────────────────┼────────────┼──────┼───────────────┼───────────┼──────┼──────────┼───────────┼───────┼────────────────────┤');
    }
  });

  console.log('═'.repeat(120));

  // Summary
  const totalAmount = rows.reduce((sum, row) => sum + (parseInt(row.amount) || 0), 0);
  console.log(`📊 Total: ${rows.length} transactions | Total Amount: $${totalAmount / 100}`);
}

// SIMPLE function to update transaction datetime
async function updateTransactionDatetime(txnId, newDatetime) {
  if (!txnId || !newDatetime) {
    console.error('❌ Missing transaction ID or datetime');
    return false;
  }

  const databaseName = process.env.DB_NAME;
  if (!databaseName) {
    console.error('❌ DB_NAME environment variable is not set!');
    return false;
  }

  console.log(`\n🔧 UPDATING TRANSACTION DATETIME`);
  console.log('─'.repeat(40));
  console.log(`Transaction ID: ${txnId}`);
  console.log(`New Datetime: ${newDatetime}`);

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: databaseName,
    port: process.env.DB_PORT || 3306,
    charset: 'utf8mb4',
    connectTimeout: 5000
  });

  try {
    console.log('\n📊 Fetching current transaction...');

    // Get current transaction
    const [currentRows] = await connection.query(
      'SELECT id_message, creation_date, reference_number FROM iso_message WHERE id_message = ?',
      [txnId]
    );

    if (currentRows.length === 0) {
      console.error(`❌ Transaction ID ${txnId} not found in database`);
      return false;
    }

    const currentDatetime = currentRows[0].creation_date;
    const refNumber = currentRows[0].reference_number || 'N/A';

    console.log(`Current Datetime: ${currentDatetime}`);
    console.log(`Reference: ${refNumber}`);

    console.log('✅ Updating...');

    // Update the creation_date
    const [updateResult] = await connection.query(
      'UPDATE iso_message SET creation_date = ? WHERE id_message = ?',
      [newDatetime, txnId]
    );

    if (updateResult.affectedRows > 0) {
      console.log('\n✅ SUCCESS! Transaction datetime updated:');
      console.log('─'.repeat(40));
      console.log(`ID: ${txnId}`);
      console.log(`Reference: ${refNumber}`);
      console.log(`Old Datetime: ${currentDatetime}`);
      console.log(`New Datetime: ${newDatetime}`);
      console.log('─'.repeat(40));
      return true;
    } else {
      console.error('❌ Update failed - no rows affected');
      return false;
    }

  } catch (error) {
    console.error(`❌ Database error: ${error.message}`);
    return false;
  } finally {
    await connection.end();
  }
}

// SIMPLE function to update transaction amount
async function updateTransactionAmount(txnId, amountInCents) {
  if (!txnId || !amountInCents) {
    console.error('❌ Missing transaction ID or amount');
    return false;
  }

  const databaseName = process.env.DB_NAME;
  if (!databaseName) {
    console.error('❌ DB_NAME environment variable is not set!');
    return false;
  }

  const amountInDollars = (amountInCents / 100);

  console.log(`\n🔧 UPDATING TRANSACTION`);
  console.log('─'.repeat(40));
  console.log(`Transaction ID: ${txnId}`);
  console.log(`New Amount: $${amountInDollars} (${amountInCents} cents)`);

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: databaseName,
    port: process.env.DB_PORT || 3306,
    charset: 'utf8mb4',
    connectTimeout: 5000
  });

  try {
    console.log('\n📊 Fetching current transaction...');

    // Get current transaction
    const [currentRows] = await connection.query(
      'SELECT id_message, amount, reference_number FROM iso_message WHERE id_message = ?',
      [txnId]
    );

    if (currentRows.length === 0) {
      console.error(`❌ Transaction ID ${txnId} not found in database`);
      return false;
    }

    const currentAmount = parseInt(currentRows[0].amount) || 0; // this amount is cents
    const refNumber = currentRows[0].reference_number || 'N/A';

    console.log(`Current Amount: $${currentAmount}`);
    console.log(`Reference: ${refNumber}`);
    console.log(`Difference: $${(amountInDollars - (currentAmount / 100))}`);

    // Ask for confirmation
    console.log('\n⚠️  Are you sure you want to update? (yes/no)');

    // In a real CLI, you'd wait for input, but for simplicity, we'll just update
    // If you want confirmation, uncomment the following:
    // const readline = require('readline');
    // const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    // const answer = await new Promise(resolve => rl.question('> ', resolve));
    // rl.close();
    // if (answer.toLowerCase() !== 'yes') {
    //   console.log('❌ Update cancelled');
    //   return false;
    // }

    console.log('✅ Updating...');

    // Update the amount
    const [updateResult] = await connection.query(
      'UPDATE iso_message SET amount = ? WHERE id_message = ?',
      [amountInDollars, txnId]
    );

    if (updateResult.affectedRows > 0) {
      console.log('\n✅ SUCCESS! Transaction updated:');
      console.log('─'.repeat(40));
      console.log(`ID: ${txnId}`);
      console.log(`Reference: ${refNumber}`);
      console.log(`Old Amount: $${currentAmount}`); // < -- is this correct?
      console.log(`New Amount: $${amountInDollars}`);
      console.log(`Changed by: $${(amountInDollars - currentAmount / 100)}`);
      console.log('─'.repeat(40));
      return true;
    } else {
      console.error('❌ Update failed - no rows affected');
      return false;
    }

  } catch (error) {
    console.error(`❌ Database error: ${error.message}`);
    return false;
  } finally {
    await connection.end();
  }
}

// SIMPLE function to fetch a specific transaction with all fields for full display
async function fetchTransactionFull(txnId) {
  const databaseName = process.env.DB_NAME;
  if (!databaseName) {
    console.error('❌ DB_NAME environment variable is not set!');
    return [];
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: databaseName,
    port: process.env.DB_PORT || 3306,
    charset: 'utf8mb4',
    connectTimeout: 5000
  });

  try {
    console.log(`🔍 Fetching full details for transaction ID: ${txnId}`);

    const [rows] = await connection.query(`
      SELECT
        id_message,
        name_merchant,
        terminal,
        msg_type,
        reference_number,
        amount,
        resp_code,
        authorization,
        bin,
        last4,
        creation_date,
        id_operation,
        estatus_f,
        card_type,
        node,
        tran_date,
        tran_time,
        capture_date,
        tkn_data_63_rq,
        tkn_data_63_rp,
        track2,
        card_acceptor,
        folio,
        trace_number,
        entry_mode,
        reverse_code,
        draft_capture,
        reference_number_ant,
        more_info
      FROM iso_message
      WHERE id_message = ?
    `, [txnId]);

    console.log(`✅ Found ${rows.length} transaction(s)`);
    return rows;

  } catch (error) {
    console.error(`❌ Database error: ${error.message}`);
    return [];
  } finally {
    await connection.end();
  }
}

// SIMPLE function to fetch transactions
async function fetchTransactions(limit = 30, merchantId = null, startDate = null, endDate = null) {
  const databaseName = process.env.DB_NAME;
  if (!databaseName) {
    console.error('❌ DB_NAME environment variable is not set!');
    return [];
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: databaseName,
    port: process.env.DB_PORT || 3306,
    charset: 'utf8mb4',
    connectTimeout: 5000
  });

  try {
    let dateRangeText = '';
    if (startDate || endDate) {
      if (startDate && endDate) {
        dateRangeText = ` from ${startDate} to ${endDate}`;
      } else if (startDate) {
        dateRangeText = ` from ${startDate} onwards`;
      } else {
        dateRangeText = ` until ${endDate}`;
      }
    }
    
    console.log(`📥 Fetching last ${limit} transactions${merchantId ? ` for merchant ID ${merchantId}` : ''}${dateRangeText}...`);

    let query = `
      SELECT
        id_message,
        name_merchant,
        terminal,
        msg_type,
        reference_number,
        amount,
        resp_code,
        authorization,
        bin,
        last4,
        creation_date
      FROM iso_message
      WHERE 1=1
    `;

    const params = [];

    // Add date range filters
    if (startDate) {
      query += ' AND creation_date >= ?';
      params.push(`${startDate} 00:01:00`);
    }
    if (endDate) {
      query += ' AND creation_date <= ?';
      params.push(`${endDate} 23:59:00`);
    }

    if (merchantId) {
      // Try to get merchant name first to show better feedback
      const [merchantRows] = await connection.query(
        'SELECT name_merchant FROM merchant WHERE id_merchant = ?',
        [merchantId]
      );

      if (merchantRows.length === 0) {
        console.log(`⚠️  Merchant ID ${merchantId} not found. Showing all transactions.`);
      } else {
        console.log(`🏪 Filtering by merchant: ${merchantRows[0].name_merchant}`);
        // The iso_message table stores merchant ID as string in name_merchant field
        query += ' AND name_merchant = ?';
        params.push(merchantId.toString()); // Filter by merchant ID as string
      }
    }

    query += ' ORDER BY creation_date DESC LIMIT ?';
    params.push(parseInt(limit));

    const [rows] = await connection.query(query, params);

    console.log(`✅ Found ${rows.length} transaction(s)`);
    return rows;

  } catch (error) {
    console.error(`❌ Database error: ${error.message}`);
    return [];
  } finally {
    await connection.end();
  }
}

// SIMPLE function to fix missing authorization codes
async function fixAuthorizationCodes(limit = 50) {
  const databaseName = process.env.DB_NAME;
  if (!databaseName) {
    console.error('❌ DB_NAME environment variable is not set!');
    return [];
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: databaseName,
    port: process.env.DB_PORT || 3306,
    charset: 'utf8mb4',
    connectTimeout: 5000
  });

  try {
    console.log(`🔧 Fixing authorization codes for last ${limit} transactions...`);

    // Find transactions with missing or empty authorization codes
    const [rows] = await connection.query(`
      SELECT
        id_message,
        reference_number,
        authorization,
        tkn_data_63_rp,
        tkn_data_63_rq,
        resp_code,
        estatus_f
      FROM iso_message
      WHERE (authorization IS NULL OR authorization = '' OR authorization = 'N/A')
      AND resp_code = '00'
      AND estatus_f = 2
      ORDER BY id_message DESC
      LIMIT ${parseInt(limit)}
    `);

    console.log(`✅ Found ${rows.length} transaction(s) with missing authorization codes`);

    let fixedCount = 0;

    for (const row of rows) {
      let authCode = null;

      // Try to extract from tkn_data_63_rp (response data)
      if (row.tkn_data_63_rp) {
        try {
          const tokenData = JSON.parse(row.tkn_data_63_rp);
          if (tokenData.authorization) {
            authCode = tokenData.authorization;
            console.log(`📋 Transaction ${row.id_message}: Found auth in tkn_data_63_rp: ${authCode}`);
          }
        } catch (e) {
          console.log(`⚠️ Failed to parse tkn_data_63_rp for transaction ${row.id_message}`);
        }
      }

      // Try to extract from tkn_data_63_rq (request data)
      if (!authCode && row.tkn_data_63_rq) {
        try {
          const tokenData = JSON.parse(row.tkn_data_63_rq);
          if (tokenData.authorization) {
            authCode = tokenData.authorization;
            console.log(`📋 Transaction ${row.id_message}: Found auth in tkn_data_63_rq: ${authCode}`);
          }
        } catch (e) {
          console.log(`⚠️ Failed to parse tkn_data_63_rq for transaction ${row.id_message}`);
        }
      }

      // Update if auth code found
      if (authCode) {
        const [updateResult] = await connection.query(
          'UPDATE iso_message SET authorization = ? WHERE id_message = ?',
          [authCode, row.id_message]
        );

        if (updateResult.affectedRows > 0) {
          console.log(`✅ FIXED: Transaction ${row.id_message} - Ref: ${row.reference_number} - Auth: ${authCode}`);
          fixedCount++;
        }
      } else {
        console.log(`❌ NO FIX: Transaction ${row.id_message} - Ref: ${row.reference_number} - No auth code found`);
      }
    }

    console.log(`\n🎯 SUMMARY: Fixed ${fixedCount} out of ${rows.length} transactions`);
    return rows;

  } catch (error) {
    console.error(`❌ Database error: ${error.message}`);
    return [];
  } finally {
    await connection.end();
  }
}

// SIMPLE function to search transactions
async function searchTransactions(searchTerm, limit = 30, merchantId = null, startDate = null, endDate = null) {
  const databaseName = process.env.DB_NAME;
  if (!databaseName) {
    console.error('❌ DB_NAME environment variable is not set!');
    return [];
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: databaseName,
    port: process.env.DB_PORT || 3306,
    charset: 'utf8mb4',
    connectTimeout: 5000
  });

  try {
    let dateRangeText = '';
    if (startDate || endDate) {
      if (startDate && endDate) {
        dateRangeText = ` from ${startDate} to ${endDate}`;
      } else if (startDate) {
        dateRangeText = ` from ${startDate} onwards`;
      } else {
        dateRangeText = ` until ${endDate}`;
      }
    }
    
    console.log(`🔍 Searching for: "${searchTerm}"${merchantId ? ` for merchant ID ${merchantId}` : ''}${dateRangeText}`);

    let query = `
      SELECT
        id_message,
        name_merchant,
        terminal,
        msg_type,
        reference_number,
        amount,
        resp_code,
        authorization,
        bin,
        last4,
        creation_date
      FROM iso_message
      WHERE 1=1
    `;

    const params = [];

    // Add search conditions
    if (searchTerm) {
      query += ' AND (reference_number LIKE ? OR bin LIKE ? OR last4 LIKE ? OR authorization LIKE ? OR terminal LIKE ?)';
      params.push(
        `%${searchTerm}%`,
        `%${searchTerm}%`,
        `%${searchTerm}%`,
        `%${searchTerm}%`,
        `%${searchTerm}%`
      );
    }

    // Add date range filters
    if (startDate) {
      query += ' AND creation_date >= ?';
      params.push(`${startDate} 00:01:00`);
    }
    if (endDate) {
      query += ' AND creation_date <= ?';
      params.push(`${endDate} 23:59:00`);
    }

    if (merchantId) {
      // Try to get merchant name first
      const [merchantRows] = await connection.query(
        'SELECT name_merchant FROM merchant WHERE id_merchant = ?',
        [merchantId]
      );

      if (merchantRows.length > 0) {
        query += ' AND name_merchant = ?';
        params.push(merchantId.toString()); // Filter by merchant ID as string
        console.log(`🏪 Filtering by merchant: ${merchantRows[0].name_merchant}`);
      } else {
        console.log(`⚠️  Merchant ID ${merchantId} not found. Showing all search results.`);
      }
    }

    query += ' ORDER BY creation_date DESC LIMIT ?';
    params.push(parseInt(limit));

    const [rows] = await connection.query(query, params);

    console.log(`✅ Found ${rows.length} matching transaction(s)`);
    return rows;

  } catch (error) {
    console.error(`❌ Database error: ${error.message}`);
    return [];
  } finally {
    await connection.end();
  }
}

// Update fetchTransactionsFull function to optionally fetch merchant name:
async function fetchTransactionsFull(limit = 30, merchantId = null, startDate = null, endDate = null) {
  const databaseName = process.env.DB_NAME;
  if (!databaseName) {
    console.error('❌ DB_NAME environment variable is not set!');
    return { rows: [], merchantName: null };
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: databaseName,
    port: process.env.DB_PORT || 3306,
    charset: 'utf8mb4',
    connectTimeout: 5000
  });

  try {
    let dateRangeText = '';
    if (startDate || endDate) {
      if (startDate && endDate) {
        dateRangeText = ` from ${startDate} to ${endDate}`;
      } else if (startDate) {
        dateRangeText = ` from ${startDate} onwards`;
      } else {
        dateRangeText = ` until ${endDate}`;
      }
    }
    
    console.log(`📥 Fetching full details for last ${limit} transactions${merchantId ? ` for merchant ID ${merchantId}` : ''}${dateRangeText}...`);

    // Get merchant name if merchantId is provided
    let merchantName = null;
    if (merchantId) {
      const [merchantRows] = await connection.query(
        'SELECT name_merchant FROM merchant WHERE id_merchant = ?',
        [merchantId]
      );
      if (merchantRows.length > 0) {
        merchantName = merchantRows[0].name_merchant;
        console.log(`🏪 Merchant: ${merchantName}`);
      }
    }

    let query = `
      SELECT
        id_message,
        name_merchant,
        terminal,
        msg_type,
        reference_number,
        amount,
        resp_code,
        authorization,
        bin,
        last4,
        creation_date,
        id_operation,
        estatus_f,
        card_type,
        node,
        tran_date,
        tran_time,
        capture_date,
        track2,
        card_acceptor,
        folio,
        trace_number,
        entry_mode,
        reverse_code,
        draft_capture,
        reference_number_ant,
        more_info
      FROM iso_message
      WHERE 1=1
    `;

    const params = [];

    // Add date range filters
    if (startDate) {
      query += ' AND creation_date >= ?';
      params.push(`${startDate} 00:01:00`);
    }
    if (endDate) {
      query += ' AND creation_date <= ?';
      params.push(`${endDate} 23:59:00`);
    }

    if (merchantId) {
      query += ' AND name_merchant = ?';
      params.push(merchantId.toString());
    }

    query += ' ORDER BY creation_date DESC LIMIT ?';
    params.push(parseInt(limit));

    const [rows] = await connection.query(query, params);

    console.log(`✅ Found ${rows.length} transaction(s)`);
    return { rows, merchantName };

  } catch (error) {
    console.error(`❌ Database error: ${error.message}`);
    return { rows: [], merchantName: null };
  } finally {
    await connection.end();
  }
}

// Update searchTransactionsFull similarly:
async function searchTransactionsFull(searchTerm, limit = 30, merchantId = null, startDate = null, endDate = null) {
  const databaseName = process.env.DB_NAME;
  if (!databaseName) {
    console.error('❌ DB_NAME environment variable is not set!');
    return { rows: [], merchantName: null };
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: databaseName,
    port: process.env.DB_PORT || 3306,
    charset: 'utf8mb4',
    connectTimeout: 5000
  });

  try {
    let dateRangeText = '';
    if (startDate || endDate) {
      if (startDate && endDate) {
        dateRangeText = ` from ${startDate} to ${endDate}`;
      } else if (startDate) {
        dateRangeText = ` from ${startDate} onwards`;
      } else {
        dateRangeText = ` until ${endDate}`;
      }
    }
    
    console.log(`🔍 Searching full details for: "${searchTerm}"${merchantId ? ` for merchant ID ${merchantId}` : ''}${dateRangeText}`);

    // Get merchant name if merchantId is provided
    let merchantName = null;
    if (merchantId) {
      const [merchantRows] = await connection.query(
        'SELECT name_merchant FROM merchant WHERE id_merchant = ?',
        [merchantId]
      );
      if (merchantRows.length > 0) {
        merchantName = merchantRows[0].name_merchant;
        console.log(`🏪 Merchant: ${merchantName}`);
      }
    }

    let query = `
      SELECT
        id_message,
        name_merchant,
        terminal,
        msg_type,
        reference_number,
        amount,
        resp_code,
        authorization,
        bin,
        last4,
        creation_date,
        id_operation,
        estatus_f,
        card_type,
        node,
        tran_date,
        tran_time,
        capture_date,
        track2,
        card_acceptor,
        folio,
        trace_number,
        entry_mode,
        reverse_code,
        draft_capture,
        reference_number_ant,
        more_info
      FROM iso_message
      WHERE 1=1
    `;

    const params = [];

    // Add search conditions
    if (searchTerm) {
      query += ' AND (reference_number LIKE ? OR bin LIKE ? OR last4 LIKE ? OR authorization LIKE ? OR terminal LIKE ?)';
      params.push(
        `%${searchTerm}%`,
        `%${searchTerm}%`,
        `%${searchTerm}%`,
        `%${searchTerm}%`,
        `%${searchTerm}%`
      );
    }

    // Add date range filters
    if (startDate) {
      query += ' AND creation_date >= ?';
      params.push(`${startDate} 00:01:00`);
    }
    if (endDate) {
      query += ' AND creation_date <= ?';
      params.push(`${endDate} 23:59:00`);
    }

    if (merchantId) {
      query += ' AND name_merchant = ?';
      params.push(merchantId.toString());
    }

    query += ' ORDER BY creation_date DESC LIMIT ?';
    params.push(parseInt(limit));

    const [rows] = await connection.query(query, params);

    console.log(`✅ Found ${rows.length} matching transaction(s)`);
    return { rows, merchantName };

  } catch (error) {
    console.error(`❌ Database error: ${error.message}`);
    return { rows: [], merchantName: null };
  } finally {
    await connection.end();
  }
}

// Helper function to validate date format (YYYY-MM-DD)
function isValidDate(dateString) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

// Helper function to format expiration date from YYMM to MM/YYYY
function formatExpirationDate(expiration) {
  if (!expiration || expiration === 'N/A') return 'N/A';
  
  // Remove any non-digit characters
  const cleanExp = expiration.replace(/\D/g, '');
  
  // Check if we have exactly 4 digits
  if (cleanExp.length !== 4) return expiration;
  
  const year = cleanExp.substring(0, 2);
  const month = cleanExp.substring(2, 4);
  
  // Determine full year (assuming 2000s for years 00-99)
  const fullYear = `20${year}`;
  
  return `${month}/${fullYear}`;
}

// Helper function to format transaction date from DDMM to DD de MonthName
function formatTransactionDate(dateStr) {
  if (!dateStr || dateStr === 'N/A') return 'N/A';
  
  // Remove any non-digit characters
  const cleanDate = dateStr.replace(/\D/g, '');
  
  // Check if we have exactly 4 digits
  if (cleanDate.length !== 4) return dateStr;
  
  const day = cleanDate.substring(0, 2);
  const month = parseInt(cleanDate.substring(2, 4));
  
  // Spanish month names
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  
  const monthName = monthNames[month - 1] || 'Mes desconocido';
  
  return `${day} de ${monthName}`;
}

// Helper function to format transaction time from hhmmss to hh:mm:ss
function formatTransactionTime(timeStr) {
  if (!timeStr || timeStr === 'N/A') return 'N/A';
  
  // Remove any non-digit characters
  const cleanTime = timeStr.replace(/\D/g, '');
  
  // Check if we have exactly 6 digits
  if (cleanTime.length !== 6) return timeStr;
  
  const hour = cleanTime.substring(0, 2);
  const minute = cleanTime.substring(2, 4);
  const second = cleanTime.substring(4, 6);
  
  return `${hour}:${minute}:${second}`;
}

// Function to send email with CSV attachment
async function sendEmailWithCSV(csvContent, filename, emailTo, merchantName = null) {
  try {
    // Validate email configuration
    const smtpUser = process.env.SMPT_USER;
    const smtpPass = process.env.SMPT_PASS;
    const smtpHost = process.env.SMPT_HOST;
    const smtpPort = process.env.SMPT_PORT || '587';
    const smtpName = process.env.SMPT_NAME;
    const emailSender = process.env.EMAIL_SENDER || 'noreply@system.com';

    if (!smtpUser || !smtpPass || !smtpHost) {
      console.error('❌ Email configuration missing. Check SMPT_USER, SMPT_PASS, and SMPT_HOST environment variables.');
      return false;
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: false,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: {
        rejectUnauthorized: false
      },
      name: smtpName,
      debug: true,
      logger: true
    });

    // Prepare email content
    const subject = merchantName 
      ? `Transaction Report - ${merchantName} - ${new Date().toLocaleDateString()}`
      : `Transaction Report - ${new Date().toLocaleDateString()}`;

    const html = `
      <h2>Transaction Report</h2>
      <p>Please find attached the CSV file with the transaction data you requested.</p>
      <p><strong>File:</strong> ${filename}</p>
      <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
      ${merchantName ? `<p><strong>Merchant:</strong> ${merchantName}</p>` : ''}
      <p>This is an automated message from the Transaction Management System.</p>
    `;

    // Email options
    const mailOptions = {
      from: emailSender,
      to: emailTo,
      subject: subject,
      html: html,
      attachments: [
        {
          filename: filename,
          content: csvContent,
          contentType: 'text/csv'
        }
      ]
    };

    // Send email
    console.log(`📧 Sending email to: ${emailTo}`);
    const info = await transporter.sendMail(mailOptions);
    
    console.log(`✅ Email sent successfully!`);
    console.log(`📧 Message ID: ${info.messageId}`);
    console.log(`📎 Attached file: ${filename}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Failed to send email: ${error.message}`);
    return false;
  }
}

// Function to upload CSV file to S3
async function uploadCSVToS3(csvContent, filename) {
  try {
    // Validate required environment variables
    if (!process.env.APP_CACHE_S3_BUCKET) {
      console.error('[S3 CSV Uploader] ❌ Missing APP_CACHE_S3_BUCKET environment variable');
      return false;
    }

    const bucketName = process.env.APP_CACHE_S3_BUCKET;
    const bucketRegion = process.env.APP_CACHE_BUCKET_REGION || process.env.APP_CACHE_AWS_REGION || 'us-east-1';

    // Initialize S3 client
    const s3 = new AWS.S3({
      region: bucketRegion,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      sessionToken: process.env.AWS_SESSION_TOKEN
    });

    // Create filename in generated directory with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const s3FileName = `generated/${timestamp}_${filename}`;

    const params = {
      Bucket: bucketName,
      Key: s3FileName,
      Body: csvContent,
      ContentType: 'text/csv',
      Metadata: {
        originalFilename: filename,
        timestamp: new Date().toISOString(),
        generatedBy: 'transactions-cli'
      }
    };

    await s3.upload(params).promise();
    console.log(`[S3 CSV Uploader] ✅ Successfully uploaded CSV to S3: generated/${timestamp}_${filename}`);
    console.log(`[S3 CSV Uploader] 📁 S3 Path: s3://${bucketName}/generated/${timestamp}_${filename}`);
    return true;
  } catch (error) {
    console.error(`[S3 CSV Uploader] ❌ Failed to upload CSV to S3:`, error.message);
    return false;
  }
}

// Function to delete transactions based on search criteria
async function deleteTransactions(searchTerm, limit = 30, merchantId = null, startDate = null, endDate = null, forceMode = false) {
  const databaseName = process.env.DB_NAME;
  if (!databaseName) {
    console.error('❌ DB_NAME environment variable is not set!');
    return false;
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: databaseName,
    port: process.env.DB_PORT || 3306,
    charset: 'utf8mb4',
    connectTimeout: 5000
  });

  try {
    console.log(`🔍 Finding transactions to delete...`);
    
    // First, fetch the transactions that would be deleted
    const results = await searchTransactions(searchTerm, limit, merchantId, startDate, endDate);
    
    if (results.length === 0) {
      console.log('📭 No transactions found matching the search criteria.');
      return false;
    }

    // Display the transactions that will be deleted
    console.log('\n' + '⚠️  '.repeat(20));
    console.log('🔥 TRANSACTIONS TO BE DELETED:');
    console.log('⚠️  '.repeat(20));
    displayTransactionsTable(results, `PENDING DELETION - ${results.length} TRANSACTION(S)`);
    
    if (!forceMode) {
      // Generate random confirmation number
      const confirmationNumber = Math.floor(Math.random() * 900000) + 100000; // 6-digit random number
      
      console.log('\n🛡️  SAFETY CONFIRMATION REQUIRED');
      console.log('─'.repeat(40));
      console.log(`To confirm deletion, enter the following number: ${confirmationNumber}`);
      console.log('This prevents accidental deletions.');
      console.log('─'.repeat(40));
      
      const readline = require('readline');
      const rl = readline.createInterface({ 
        input: process.stdin, 
        output: process.stdout 
      });
      
      const userInput = await new Promise(resolve => {
        rl.question('Enter confirmation number: ', resolve);
      });
      
      rl.close();
      
      if (userInput !== confirmationNumber.toString()) {
        console.log('❌ Confirmation failed. Deletion cancelled.');
        return false;
      }
      
      console.log('✅ Confirmation successful. Proceeding with deletion...');
    } else {
      console.log('⚡ Force mode enabled. Skipping confirmation...');
    }

    // Build the delete query
    let deleteQuery = 'DELETE FROM iso_message WHERE 1=1';
    const deleteParams = [];

    // Add search conditions (same as searchTransactions)
    if (searchTerm) {
      deleteQuery += ' AND (reference_number LIKE ? OR bin LIKE ? OR last4 LIKE ? OR authorization LIKE ? OR terminal LIKE ?)';
      deleteParams.push(
        `%${searchTerm}%`,
        `%${searchTerm}%`,
        `%${searchTerm}%`,
        `%${searchTerm}%`,
        `%${searchTerm}%`
      );
    }

    // Add date range filters
    if (startDate) {
      deleteQuery += ' AND creation_date >= ?';
      deleteParams.push(`${startDate} 00:01:00`);
    }
    if (endDate) {
      deleteQuery += ' AND creation_date <= ?';
      deleteParams.push(`${endDate} 23:59:00`);
    }

    if (merchantId) {
      deleteQuery += ' AND name_merchant = ?';
      deleteParams.push(merchantId.toString());
    }

    deleteQuery += ' LIMIT ?';
    deleteParams.push(parseInt(limit));

    console.log(`\n🗑️  Deleting ${results.length} transaction(s)...`);
    
    const [deleteResult] = await connection.query(deleteQuery, deleteParams);

    if (deleteResult.affectedRows > 0) {
      console.log('\n✅ SUCCESS! Transactions deleted:');
      console.log('─'.repeat(40));
      console.log(`Deleted: ${deleteResult.affectedRows} transaction(s)`);
      console.log(`Search term: "${searchTerm || 'all'}"`);
      if (merchantId) console.log(`Merchant ID: ${merchantId}`);
      if (startDate || endDate) {
        if (startDate && endDate) {
          console.log(`Date range: ${startDate} to ${endDate}`);
        } else if (startDate) {
          console.log(`From: ${startDate}`);
        } else {
          console.log(`Until: ${endDate}`);
        }
      }
      console.log('─'.repeat(40));
      return true;
    } else {
      console.error('❌ Delete failed - no rows affected');
      return false;
    }

  } catch (error) {
    console.error(`❌ Database error: ${error.message}`);
    return false;
  } finally {
    await connection.end();
  }
}

// SIMPLE main function
async function main() {
  const args = process.argv.slice(2);

  // Show help
  if (args.includes('--help') || args.includes('-h')) {
    console.log('\n💸 TRANSACTION MANAGER');
    console.log('='.repeat(40));
    console.log('\nCommands:');
    console.log('  --table                    Show transactions in table format');
    console.log('  --full                     Show full details without truncation (requires --txn)');
    console.log('  --results 50               Show 50 transactions (default: 30)');
    console.log('  --search "12345"           Search for transaction');
    console.log('  --fix-datetime "2026-02-12 01:00:23"  Set transaction datetime (requires --txn)');
    console.log('  --set-amount 1055          Set amount in cents ($10.55)');
    console.log('  --txn 123                  Transaction ID to update/view');
    console.log('  --fix-auth                 Fix missing authorization codes');
    console.log('  --merchant-id 5            Filter by merchant ID');
    console.log('  --csv                      Export results to CSV file');
    console.log('  --send-to email@email.com   Send CSV file via email (requires --csv)');
    console.log('  --start-date YYYY-MM-DD    Start date for filtering (inclusive)');
    console.log('  --end-date YYYY-MM-DD      End date for filtering (inclusive)');
    console.log('  --delete                   Delete found records (requires --search)');
    console.log('  --force                    Skip confirmation prompt for delete (use with caution)');
    console.log('\nExamples:');
    console.log('  node transactions.js --table');
    console.log('  node transactions.js --table --results 50');
    console.log('  node transactions.js --search "363805"');
    console.log('  node transactions.js --fix-datetime "2026-02-12 01:00:23" --txn 123');
    console.log('  node transactions.js --set-amount 1055 --txn 123');
    console.log('  node transactions.js --fix-auth');
    console.log('  node transactions.js --table --txn 123 --full');
    console.log('  node transactions.js --table --merchant-id 5');
    console.log('  node transactions.js --search "12345" --merchant-id 5 --csv');
    console.log('  node transactions.js --table --results 100 --merchant-id 5 --csv');
    console.log('  node transactions.js --table --start-date 2024-01-01 --end-date 2024-01-31');
    console.log('  node transactions.js --search "12345" --start-date 2024-01-01 --end-date 2024-01-31 --csv');
    console.log('  node transactions.js --search "12345" --csv --send-to user@example.com');
    console.log('  node transactions.js --table --merchant-id 5 --csv --send-to admin@company.com');
    console.log('  node transactions.js --search "12345" --delete');
    console.log('  node transactions.js --search "12345" --delete --force');
    console.log('  node transactions.js --search "12345" --results 10000 --delete');
    console.log('='.repeat(40));
    return;
  }

  // Parse arguments
  let limit = 30;
  let searchTerm = null;
  let tableMode = false;
  let fixDatetime = null;
  let setAmount = null;
  let txnId = null;
  let fixAuth = false;
  let fullMode = false;
  let merchantId = null;
  let csvMode = false;
  let startDate = null;
  let endDate = null;
  let deleteMode = false;
  let forceMode = false;
  let sendToEmail = null;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--results' || args[i] === '-r') && i + 1 < args.length) {
      limit = parseInt(args[i + 1]);
      i++;
    } else if ((args[i] === '--search' || args[i] === '-s') && i + 1 < args.length) {
      searchTerm = args[i + 1];
      i++;
    } else if (args[i] === '--table') {
      tableMode = true;
    } else if (args[i] === '--fix-datetime' && i + 1 < args.length) {
      fixDatetime = args[i + 1];
      i++;
    } else if (args[i] === '--set-amount' && i + 1 < args.length) {
      setAmount = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--txn' && i + 1 < args.length) {
      txnId = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--fix-auth') {
      fixAuth = true;
    } else if (args[i] === '--full') {
      fullMode = true;
    } else if ((args[i] === '--merchant-id' || args[i] === '-m' || args[i] === '--merchand-id') && i + 1 < args.length) {
      merchantId = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--csv') {
      csvMode = true;
    } else if ((args[i] === '--start-date' || args[i] === '-sd') && i + 1 < args.length) {
      startDate = args[i + 1];
      i++;
    } else if ((args[i] === '--end-date' || args[i] === '-ed') && i + 1 < args.length) {
      endDate = args[i + 1];
      i++;
    } else if (args[i] === '--delete') {
      deleteMode = true;
    } else if (args[i] === '--force') {
      forceMode = true;
    } else if ((args[i] === '--send-to') && i + 1 < args.length) {
      sendToEmail = args[i + 1];
      i++;
    }
  }

  try {
    // Validate --fix-datetime requires --txn
    if (fixDatetime && !txnId) {
      console.error('❌ Error: --fix-datetime requires --txn to be specified');
      console.error('   Example: --fix-datetime "2026-02-12 01:00:23" --txn 123');
      return;
    }

    // Validate --full flag requires --txn
    if (fullMode && !txnId) {
      console.error('❌ Error: --full flag requires --txn to be specified');
      console.error('   Example: --table --txn 123 --full');
      return;
    }

    // Validate date format
    if (startDate && !isValidDate(startDate)) {
      console.error('❌ Error: Invalid start date format. Use YYYY-MM-DD');
      return;
    }
    if (endDate && !isValidDate(endDate)) {
      console.error('❌ Error: Invalid end date format. Use YYYY-MM-DD');
      return;
    }
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      console.error('❌ Error: Start date cannot be after end date');
      return;
    }

    // Validate --send-to requires --csv
    if (sendToEmail && !csvMode) {
      console.error('❌ Error: --send-to requires --csv to be specified');
      console.error('   Example: --csv --send-to email@example.com');
      return;
    }

    // Validate --delete requires search term
    if (deleteMode && !searchTerm) {
      console.error('❌ Error: --delete requires --search to be specified');
      console.error('   Example: --delete --search "12345"');
      return;
    }

    // Handle fix-datetime command
    if (fixDatetime !== null) {
      if (txnId !== null) {
        await updateTransactionDatetime(txnId, fixDatetime);
        return; // STOP HERE - don't show transactions
      } else {
        console.error('❌ Error: --fix-datetime requires --txn to be specified');
        console.error('   Example: --fix-datetime "2026-02-12 01:00:23" --txn 123');
        return;
      }
    }

    // Handle fix-auth command
    if (fixAuth) {
      await fixAuthorizationCodes(limit);
      return;
    }

    // Handle set-amount command
    if (setAmount !== null) {
      if (txnId !== null) {
        await updateTransactionAmount(txnId, setAmount);
        return; // STOP HERE - don't show transactions
      } else {
        console.error('❌ Error: --set-amount requires --txn to be specified');
        console.error('   Example: --set-amount 1055 --txn 123');
        return;
      }
    }

    // Handle full mode with specific transaction
    if (fullMode && txnId) {
      const results = await fetchTransactionFull(txnId);
      displayTransactionsTable(results, `TRANSACTION ${txnId} - FULL DETAILS`, fullMode, txnId);
      return;
    }

    // Handle table mode with specific transaction (without full)
    if (tableMode && txnId) {
      const results = await fetchTransactionFull(txnId);
      displayTransactionsTable(results, `TRANSACTION ${txnId}`, false, txnId);
      return;
    }

    // Handle search command
    if (searchTerm !== null) {
      if (deleteMode) {
        // Handle delete mode
        await deleteTransactions(searchTerm, limit, merchantId, startDate, endDate, forceMode);
        return;
      }
      
      let results;
      if (csvMode) {
        const { rows, merchantName } = await searchTransactionsFull(searchTerm, limit, merchantId, startDate, endDate);
        await generateCSV(rows, null, merchantName, sendToEmail);
      } else {
        results = await searchTransactions(searchTerm, limit, merchantId, startDate, endDate);
        let dateRangeText = '';
        if (startDate || endDate) {
          if (startDate && endDate) {
            dateRangeText = ` (${startDate} to ${endDate})`;
          } else if (startDate) {
            dateRangeText = ` (from ${startDate})`;
          } else {
            dateRangeText = ` (until ${endDate})`;
          }
        }
        displayTransactionsTable(results, `SEARCH RESULTS: "${searchTerm}"${merchantId ? ` (Merchant ${merchantId})` : ''}${dateRangeText}`);
      }
      return;
    }

    // Handle table command
    if (tableMode) {
      let results;
      if (csvMode) {
        const { rows, merchantName } = await fetchTransactionsFull(limit, merchantId, startDate, endDate);
        await generateCSV(rows, null, merchantName, sendToEmail);
      } else {
        results = await fetchTransactions(limit, merchantId, startDate, endDate);
        let dateRangeText = '';
        if (startDate || endDate) {
          if (startDate && endDate) {
            dateRangeText = ` (${startDate} to ${endDate})`;
          } else if (startDate) {
            dateRangeText = ` (from ${startDate})`;
          } else {
            dateRangeText = ` (until ${endDate})`;
          }
        }
        displayTransactionsTable(results, `LAST ${limit} TRANSACTIONS${merchantId ? ` (Merchant ${merchantId})` : ''}${dateRangeText}`);
      }
      return;
    }

    // Default: show table if no specific command
    console.log('ℹ️  No command specified. Showing table view. Use --help for options.');
    let results;
    if (csvMode) {
      const { rows, merchantName } = await fetchTransactionsFull(limit, merchantId, startDate, endDate);
      await generateCSV(rows, null, merchantName, sendToEmail);
    } else {
      results = await fetchTransactions(limit, merchantId, startDate, endDate);
      let dateRangeText = '';
      if (startDate || endDate) {
        if (startDate && endDate) {
          dateRangeText = ` (${startDate} to ${endDate})`;
        } else if (startDate) {
          dateRangeText = ` (from ${startDate})`;
        } else {
          dateRangeText = ` (until ${endDate})`;
        }
      }
      displayTransactionsTable(results, `LAST ${limit} TRANSACTIONS${merchantId ? ` (Merchant ${merchantId})` : ''}${dateRangeText}`);
    }

  } catch (error) {
    console.error(`💥 Error: ${error.message}`);
  }
}

// Run the script
if (require.main === module) {
  main();
}