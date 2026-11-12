// paymentLinks.js - Complete file with validation for existing invalid authorizations

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
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
        Object.assign(result, flattenObject(value, newKey));
      } else {
        result[newKey] = value;
      }
    }
  }

  return result;
}

// Helper function to get status text
function getStatusText(status) {
  const statusMap = {
    1: 'Pending',
    2: 'Completed',
    3: 'Failed'
  };
  return statusMap[status] || `Unknown (${status})`;
}

// SIMPLE function to generate JSON file
async function generateJSON(rows, filename = null, merchantName = null) {
  if (rows.length === 0) {
    console.log('📭 No data to export to JSON');
    return;
  }

  // Generate filename if not provided
  if (!filename) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    let baseFilename = `payment_links_${timestamp}`;

    if (merchantName) {
      const cleanMerchantName = merchantName
        .replace(/[^a-zA-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .substring(0, 30);
      baseFilename = `${cleanMerchantName}_${baseFilename}`;
    }

    filename = `${baseFilename}.json`;
  }

  // Process rows to merge JSON data
  const processedRows = rows.map(row => {
    let processedRow = { ...row };
    
    // Parse and merge info_adicional
    if (row.info_adicional) {
      try {
        const infoAdicional = typeof row.info_adicional === 'string' ? JSON.parse(row.info_adicional) : row.info_adicional;
        const flattened = flattenObject(infoAdicional);
        Object.assign(processedRow, flattened);
      } catch (e) {
        // Keep original if parsing fails
      }
    }
    
    // Parse and merge selia_response_data
    if (row.selia_response_data) {
      try {
        const seliaData = typeof row.selia_response_data === 'string' ? JSON.parse(row.selia_response_data) : row.selia_response_data;
        const flattened = flattenObject(seliaData);
        Object.assign(processedRow, flattened);
      } catch (e) {
        // Keep original if parsing fails
      }
    }
    
    // Remove original JSON fields to avoid duplication
    delete processedRow.info_adicional;
    delete processedRow.selia_response_data;
    
    return processedRow;
  });

  // Create JSON content
  const jsonContent = JSON.stringify(processedRows, null, 2);

  const uploadSuccess = await uploadJSONToS3(jsonContent, filename);

  if (uploadSuccess) {
    console.log(`📄 JSON file processed and uploaded to S3: ${filename}`);
    console.log(`📊 Exported ${rows.length} payment links`);
    if (merchantName) {
      console.log(`🏪 Merchant: ${merchantName}`);
    }
  } else {
    console.log('⚠️  S3 upload failed, falling back to local file...');
    fs.writeFileSync(filename, jsonContent, 'utf8');
    console.log(`📄 JSON file generated locally: ${filename}`);
    console.log(`📊 Exported ${rows.length} payment links`);
  }
}

// SIMPLE function to generate CSV file
async function generateCSV(rows, filename = null, merchantName = null) {
  if (rows.length === 0) {
    console.log('📭 No data to export to CSV');
    return;
  }

  // Generate filename if not provided
  if (!filename) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    let baseFilename = `payment_links_${timestamp}`;

    if (merchantName) {
      const cleanMerchantName = merchantName
        .replace(/[^a-zA-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .substring(0, 30);
      baseFilename = `${cleanMerchantName}_${baseFilename}`;
    }

    filename = `${baseFilename}.csv`;
  }

  // Parse info_adicional JSON
  let allJsonKeys = new Set();
  let parsedInfoArray = [];

  rows.forEach(row => {
    let parsedInfo = {};
    if (row.info_adicional) {
      try {
        let jsonStr = row.info_adicional;

        if (typeof jsonStr === 'string') {
          jsonStr = jsonStr.trim();

          if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
            jsonStr = jsonStr.slice(1, -1);
          }

          jsonStr = jsonStr.replace(/\\"/g, '"');
          jsonStr = jsonStr.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
          jsonStr = jsonStr.replace(/:\s*([a-zA-Z_][a-zA-Z0-9_]*)(?=\s*[,}])/g, ': "$1"');
          jsonStr = jsonStr.replace(/,\s*}/g, '}');
          jsonStr = jsonStr.replace(/,\s*]/g, ']');

          try {
            parsedInfo = JSON.parse(jsonStr);
          } catch (parseError) {
            console.log(`⚠️  JSON parse failed for link ${row.id}, attempting recovery...`);

            const jsonStart = jsonStr.indexOf('{');
            const jsonEnd = jsonStr.lastIndexOf('}');

            if (jsonStart >= 0 && jsonEnd > jsonStart) {
              const potentialJson = jsonStr.substring(jsonStart, jsonEnd + 1);
              try {
                parsedInfo = JSON.parse(potentialJson);
                console.log(`✅ Recovered JSON for link ${row.id}`);
              } catch (e) {
                parsedInfo = {};
              }
            }
          }
        } else if (typeof jsonStr === 'object') {
          parsedInfo = jsonStr;
        }

        parsedInfo = flattenObject(parsedInfo);
        Object.keys(parsedInfo).forEach(key => allJsonKeys.add(key));

      } catch (e) {
        console.log(`⚠️  Failed to parse info_adicional for link ${row.id}: ${e.message}`);
      }
    }
    parsedInfoArray.push(parsedInfo);
  });

  // Parse selia_response_data if exists
  let parsedSeliaArray = [];
  rows.forEach(row => {
    let parsedSelia = {};
    if (row.selia_response_data) {
      try {
        let jsonStr = row.selia_response_data;
        if (typeof jsonStr === 'string') {
          jsonStr = jsonStr.trim();
          if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
            jsonStr = jsonStr.slice(1, -1);
          }
          jsonStr = jsonStr.replace(/\\"/g, '"');
          parsedSelia = JSON.parse(jsonStr);
          parsedSelia = flattenObject(parsedSelia);
        }
      } catch (e) {
        console.log(`⚠️  Failed to parse selia_response_data for link ${row.id}`);
      }
    }
    parsedSeliaArray.push(parsedSelia);
  });

  // EXACT columns as they appear in the database/model
  const headers = [
    'id',
    'token',
    'id_merchant',
    'id_user',
    'concepto',
    'monto',
    'expire_date',
    'status',
    'info_adicional',
    'created_at',
    'updated_at',
    'processor_type',
    'selia_transaction_id',
    'selia_authorization_code',
    'selia_response_code',
    'selia_response_data'
  ];

  // Helper function to safely convert any value to CSV string
  const toCSVValue = (value) => {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    if (value instanceof Date) {
      return `"${value.toISOString()}"`;
    }

    let stringValue;
    if (typeof value === 'object') {
      stringValue = JSON.stringify(value);
    } else {
      stringValue = String(value);
    }

    return `"${stringValue.replace(/"/g, '""')}"`;
  };

  // Get merchant names for each link
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    charset: 'utf8mb4'
  });

  const merchantIds = [...new Set(rows.map(r => r.id_merchant).filter(id => id))];
  const merchantNames = {};

  if (merchantIds.length > 0) {
    const [merchants] = await connection.query(
      'SELECT id_merchant, name_merchant FROM merchant WHERE id_merchant IN (?)',
      [merchantIds]
    );
    merchants.forEach(m => merchantNames[m.id_merchant] = m.name_merchant);
  }

  await connection.end();

  // Convert rows to CSV format
  const csvRows = [headers.join(',')];

  rows.forEach((row, index) => {
    const csvRow = headers.map(header => {
      return toCSVValue(row[header]);
    });

    csvRows.push(csvRow.join(','));
  });

  // Write to file or upload to S3
  const csvContent = csvRows.join('\n');

  const uploadSuccess = await uploadCSVToS3(csvContent, filename);

  if (uploadSuccess) {
    console.log(`📄 CSV file processed and uploaded to S3: ${filename}`);
    console.log(`📊 Exported ${rows.length} payment links`);
    if (merchantName) {
      console.log(`🏪 Merchant: ${merchantName}`);
    }
  } else {
    console.log('⚠️  S3 upload failed, falling back to local file...');
    fs.writeFileSync(filename, csvContent, 'utf8');
    console.log(`📄 CSV file generated locally: ${filename}`);
    console.log(`📊 Exported ${rows.length} payment links`);
  }
}

// SIMPLE function to display payment links in a clean table with JSON keys as columns
function displayPaymentLinksTable(rows, title = 'PAYMENT LINKS', fullMode = false, specificLinkId = null, highlightAuth = false, allMode = false) {
  if (rows.length === 0) {
    console.log('📭 No records to display');
    return;
  }

  // If full mode and specific link, show all fields without truncation
  if (fullMode && specificLinkId && rows.length === 1) {
    const row = rows[0];
    console.log('\n' + '═'.repeat(150));
    console.log(`📋 ${title} - FULL DETAILS`);
    console.log('═'.repeat(150));

    console.log('🔍 LINK IDENTIFIERS:');
    console.log(`   ID: ${row.id || 'N/A'}`);
    console.log(`   Token: ${row.token || 'N/A'}`);
    console.log(`   Merchant ID: ${row.id_merchant || 'N/A'}`);
    console.log(`   User ID: ${row.id_user || 'N/A'}`);
    console.log(`   Status: ${getStatusText(row.status)} (${row.status})`);

    console.log('\n💰 AMOUNT & CONCEPT:');
    console.log(`   Concepto: ${row.concepto || 'N/A'}`);
    console.log(`   Monto: $${parseFloat(row.monto || 0).toFixed(2)}`);

    console.log('\n📅 DATES:');
    console.log(`   Created At: ${row.created_at || 'N/A'}`);
    console.log(`   Expire Date: ${row.expire_date || 'N/A'}`);
    console.log(`   Updated At: ${row.updated_at || 'N/A'}`);

    console.log('\n🤖 PROCESSOR INFO:');
    console.log(`   Processor Type: ${row.processor_type || 'N/A'}`);
    console.log(`   Selia Transaction ID: ${row.selia_transaction_id || 'N/A'}`);
    console.log(`   Selia Auth Code: ${row.selia_authorization_code || 'N/A'}`);
    console.log(`   Selia Response Code: ${row.selia_response_code || 'N/A'}`);

    console.log('\n🔧 ADDITIONAL INFO:');
    console.log(`   info_adicional: ${row.info_adicional || 'N/A'}`);

    console.log('\n📦 SELIA RESPONSE DATA:');
    console.log(`   selia_response_data: ${row.selia_response_data || 'N/A'}`);

    console.log('═'.repeat(150));
    return;
  }

  // Collect all possible JSON keys from info_adicional and selia_response_data
  const allJsonKeys = new Set();
  const flattenedRows = [];

  rows.forEach(row => {
    let flattenedRow = { ...row };
    
    // Parse and flatten info_adicional and merge directly into row
    if (row.info_adicional) {
      try {
        const infoAdicional = typeof row.info_adicional === 'string' ? JSON.parse(row.info_adicional) : row.info_adicional;
        const flattened = flattenObject(infoAdicional);
        
        // Merge flattened keys directly into the row
        Object.assign(flattenedRow, flattened);
        Object.keys(flattened).forEach(key => allJsonKeys.add(key));
      } catch (e) {
        console.log(`⚠️  Could not parse info_adicional for row ${row.id}: ${e.message}`);
      }
    }

    // Parse and flatten selia_response_data and merge directly into row
    if (row.selia_response_data) {
      try {
        const seliaData = typeof row.selia_response_data === 'string' ? JSON.parse(row.selia_response_data) : row.selia_response_data;
        const flattened = flattenObject(seliaData);
        
        // Merge flattened keys directly into the row
        Object.assign(flattenedRow, flattened);
        Object.keys(flattened).forEach(key => allJsonKeys.add(key));
      } catch (e) {
        console.log(`⚠️  Could not parse selia_response_data for row ${row.id}: ${e.message}`);
      }
    }

    flattenedRows.push(flattenedRow);
  });

  // Sort keys for consistent display
  const sortedJsonKeys = Array.from(allJsonKeys).sort();

  console.log('\n' + '═'.repeat(200));
  console.log(`📋 ${title}${highlightAuth ? ' - AUTHORIZATION HIGHLIGHTS' : ''}`);
  console.log('═'.repeat(200));

  if (highlightAuth) {
    console.log('🔑 LEGEND: 🟢 = Valid 6-digit auth | 🔴 = Empty/Rejected | ⚠️  = Invalid auth | ❓ = Unknown');
    console.log('─'.repeat(200));
  }

  // Build dynamic headers based on available data
  const baseHeaders = ['ID', 'Token', 'Merchant', 'Concepto', 'Amount', 'Status', 'Created', 'Expires'];
  const authHeaders = highlightAuth ? ['Auth Code'] : [];
  const headers = [...baseHeaders, ...authHeaders, ...sortedJsonKeys];

  // Create header row
  const headerRow = '│ ' + headers.map(h => h.substring(0, 15).padEnd(15)).join(' │ ') + ' │';
  const separatorRow = '├─' + headers.map(() => '─'.repeat(15)).join('─├─') + '─┤';

  console.log(headerRow);
  console.log(separatorRow);

  // Display each row
  flattenedRows.forEach((row, index) => {
    const cells = [];
    
    // Base columns
    cells.push(String(row.id || '').substring(0, 15).padEnd(15));
    cells.push(String(row.token || 'N/A').substring(0, 15).padEnd(15));
    cells.push(String(row.id_merchant || '').substring(0, 15).padEnd(15));
    cells.push(String(row.concepto || 'N/A').substring(0, 15).padEnd(15));
    cells.push(String(row.monto ? `$${parseFloat(row.monto).toFixed(2)}` : '$0.00').substring(0, 15).padEnd(15));
    cells.push(String(getStatusText(row.status)).substring(0, 15).padEnd(15));
    
    const created = row.created_at ? new Date(row.created_at).toLocaleString('es-MX', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }) : 'N/A';
    cells.push(created.substring(0, 15).padEnd(15));
    
    const expires = row.expire_date ? new Date(row.expire_date).toLocaleString('es-MX', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }) : 'N/A';
    cells.push(expires.substring(0, 15).padEnd(15));

    // Auth column if highlighting
    if (highlightAuth) {
      const authCode = row.selia_authorization_code || '';
      let authText = '';
      let authIcon = '';

      if (!authCode || authCode === '') {
        authIcon = '🔴';
        authText = 'EMPTY';
      } else if (/^\d{6}$/.test(authCode)) {
        authIcon = '🟢';
        authText = authCode;
      } else if (authCode.length > 6 || !/^\d+$/.test(authCode)) {
        authIcon = '⚠️ ';
        authText = authCode;
      } else {
        authIcon = '❓';
        authText = authCode;
      }

      const authDisplay = `${authIcon} ${authText}`;
      cells.push(authDisplay.substring(0, 15).padEnd(15));
    }

    // JSON columns
    sortedJsonKeys.forEach(key => {
      const value = row[key] || '';
      const displayValue = String(value).substring(0, 15);
      cells.push(displayValue.padEnd(15));
    });

    console.log('│ ' + cells.join(' │ ') + ' │');

    // Add separator every 10 rows for readability
    if (index < flattenedRows.length - 1 && (index + 1) % 10 === 0) {
      console.log(separatorRow);
    }
  });

  console.log('═'.repeat(200));

  const totalAmount = rows.reduce((sum, row) => sum + (parseFloat(row.monto) || 0), 0);
  const completedCount = rows.filter(r => r.status === 2).length;
  const pendingCount = rows.filter(r => r.status === 1).length;
  const failedCount = rows.filter(r => r.status === 3).length;

  if (highlightAuth) {
    // Authorization statistics
    const validAuthCount = rows.filter(r => r.selia_authorization_code && /^\d{6}$/.test(r.selia_authorization_code)).length;
    const emptyAuthCount = rows.filter(r => !r.selia_authorization_code || r.selia_authorization_code === '').length;
    const invalidAuthCount = rows.filter(r => r.selia_authorization_code && !/^\d{6}$/.test(r.selia_authorization_code)).length;

    console.log(`📊 Total: ${rows.length} links | 🟢 Valid Auth: ${validAuthCount} | 🔴 Empty: ${emptyAuthCount} | ⚠️  Invalid: ${invalidAuthCount}`);
    console.log(`📈 Status: ✅ Completed: ${completedCount} | ⏳ Pending: ${pendingCount} | ❌ Failed: ${failedCount}`);
  } else {
    console.log(`📊 Total: ${rows.length} links | Total Amount: $${totalAmount.toFixed(2)}`);
    console.log(`   ✅ Completed: ${completedCount} | ⏳ Pending: ${pendingCount} | ❌ Failed: ${failedCount}`);
  }
}

// SIMPLE function to update link status
async function updateLinkStatus(linkId, newStatus) {
  if (!linkId || !newStatus) {
    console.error('❌ Missing link ID or status');
    return false;
  }

  const validStatuses = [1, 2, 3];
  if (!validStatuses.includes(parseInt(newStatus))) {
    console.error('❌ Invalid status. Use: 1=Pending, 2=Completed, 3=Failed');
    return false;
  }

  const databaseName = process.env.DB_NAME;
  if (!databaseName) {
    console.error('❌ DB_NAME environment variable is not set!');
    return false;
  }

  console.log(`\n🔧 UPDATING PAYMENT LINK STATUS`);
  console.log('─'.repeat(40));
  console.log(`Link ID: ${linkId}`);
  console.log(`New Status: ${getStatusText(newStatus)} (${newStatus})`);

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
    console.log('\n📊 Fetching current link...');

    const [currentRows] = await connection.query(
      'SELECT id, token, status, concepto, monto FROM links_pago WHERE id = ?',
      [linkId]
    );

    if (currentRows.length === 0) {
      console.error(`❌ Link ID ${linkId} not found in database`);
      return false;
    }

    const currentStatus = currentRows[0].status;
    const token = currentRows[0].token || 'N/A';

    console.log(`Current Status: ${getStatusText(currentStatus)} (${currentStatus})`);
    console.log(`Token: ${token}`);

    console.log('✅ Updating...');

    const [updateResult] = await connection.query(
      'UPDATE links_pago SET status = ?, updated_at = NOW() WHERE id = ?',
      [newStatus, linkId]
    );

    if (updateResult.affectedRows > 0) {
      console.log('\n✅ SUCCESS! Payment link updated:');
      console.log('─'.repeat(40));
      console.log(`ID: ${linkId}`);
      console.log(`Token: ${token}`);
      console.log(`Old Status: ${getStatusText(currentStatus)} (${currentStatus})`);
      console.log(`New Status: ${getStatusText(newStatus)} (${newStatus})`);
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

// SIMPLE function to fetch a specific payment link with all fields
async function fetchLinkFull(linkId) {
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
    console.log(`🔍 Fetching full details for payment link ID: ${linkId}`);

    const [rows] = await connection.query(`
      SELECT
        id,
        token,
        id_merchant,
        id_user,
        concepto,
        monto,
        expire_date,
        status,
        info_adicional,
        created_at,
        updated_at,
        processor_type,
        selia_transaction_id,
        selia_authorization_code,
        selia_response_code,
        selia_response_data
      FROM links_pago
      WHERE id = ?
    `, [linkId]);

    console.log(`✅ Found ${rows.length} link(s)`);
    return rows;

  } catch (error) {
    console.error(`❌ Database error: ${error.message}`);
    return [];
  } finally {
    await connection.end();
  }
}

// SIMPLE function to fetch payment links
async function fetchPaymentLinks(limit = 30, merchantId = null, startDate = null, endDate = null, status = null) {
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

    let statusText = status ? ` (status: ${getStatusText(status)})` : '';
    console.log(`📥 Fetching last ${limit} payment links${merchantId ? ` for merchant ID ${merchantId}` : ''}${dateRangeText}${statusText}...`);

    let query = `
      SELECT
        id,
        token,
        id_merchant,
        concepto,
        monto,
        status,
        created_at,
        expire_date,
        selia_authorization_code,
        info_adicional,
        selia_response_data
      FROM links_pago
      WHERE 1=1
    `;

    const params = [];

    if (startDate) {
      query += ' AND created_at >= ?';
      params.push(`${startDate} 00:01:00`);
    }
    if (endDate) {
      query += ' AND created_at <= ?';
      params.push(`${endDate} 23:59:00`);
    }

    if (merchantId) {
      query += ' AND id_merchant = ?';
      params.push(merchantId);
    }

    if (status !== null) {
      query += ' AND status = ?';
      params.push(parseInt(status));
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const [rows] = await connection.query(query, params);

    console.log(`✅ Found ${rows.length} payment link(s)`);
    return rows;

  } catch (error) {
    console.error(`❌ Database error: ${error.message}`);
    return [];
  } finally {
    await connection.end();
  }
}

// SIMPLE function to search payment links
async function searchPaymentLinks(searchTerm, limit = 30, merchantId = null, startDate = null, endDate = null, status = null) {
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

    let statusText = status ? ` (status: ${getStatusText(status)})` : '';
    console.log(`🔍 Searching for: "${searchTerm}"${merchantId ? ` for merchant ID ${merchantId}` : ''}${dateRangeText}${statusText}`);

    let query = `
      SELECT
        id,
        token,
        id_merchant,
        concepto,
        monto,
        status,
        created_at,
        expire_date,
        selia_authorization_code,
        info_adicional,
        selia_response_data
      FROM links_pago
      WHERE 1=1
    `;

    const params = [];

    if (searchTerm) {
      query += ' AND (token LIKE ? OR concepto LIKE ? OR id = ?)';
      params.push(
        `%${searchTerm}%`,
        `%${searchTerm}%`,
        isNaN(searchTerm) ? 0 : parseInt(searchTerm)
      );
    }

    if (startDate) {
      query += ' AND created_at >= ?';
      params.push(`${startDate} 00:01:00`);
    }
    if (endDate) {
      query += ' AND created_at <= ?';
      params.push(`${endDate} 23:59:00`);
    }

    if (merchantId) {
      query += ' AND id_merchant = ?';
      params.push(merchantId);
    }

    if (status !== null) {
      query += ' AND status = ?';
      params.push(parseInt(status));
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const [rows] = await connection.query(query, params);

    console.log(`✅ Found ${rows.length} matching payment link(s)`);
    return rows;

  } catch (error) {
    console.error(`❌ Database error: ${error.message}`);
    return [];
  } finally {
    await connection.end();
  }
}

// Fetch full details for CSV export
async function fetchPaymentLinksFull(limit = 30, merchantId = null, startDate = null, endDate = null, status = null) {
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

    let statusText = status ? ` (status: ${getStatusText(status)})` : '';
    console.log(`📥 Fetching full details for last ${limit} payment links${merchantId ? ` for merchant ID ${merchantId}` : ''}${dateRangeText}${statusText}...`);

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
        id,
        token,
        id_merchant,
        id_user,
        concepto,
        monto,
        expire_date,
        status,
        info_adicional,
        created_at,
        updated_at,
        processor_type,
        selia_transaction_id,
        selia_authorization_code,
        selia_response_code,
        selia_response_data
      FROM links_pago
      WHERE 1=1
    `;

    const params = [];

    if (startDate) {
      query += ' AND created_at >= ?';
      params.push(`${startDate} 00:01:00`);
    }
    if (endDate) {
      query += ' AND created_at <= ?';
      params.push(`${endDate} 23:59:00`);
    }

    if (merchantId) {
      query += ' AND id_merchant = ?';
      params.push(merchantId);
    }

    if (status !== null) {
      query += ' AND status = ?';
      params.push(parseInt(status));
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const [rows] = await connection.query(query, params);

    console.log(`✅ Found ${rows.length} payment link(s)`);
    return { rows, merchantName };

  } catch (error) {
    console.error(`❌ Database error: ${error.message}`);
    return { rows: [], merchantName: null };
  } finally {
    await connection.end();
  }
}

// Search full details for CSV export
async function searchPaymentLinksFull(searchTerm, limit = 30, merchantId = null, startDate = null, endDate = null, status = null) {
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

    let statusText = status ? ` (status: ${getStatusText(status)})` : '';
    console.log(`🔍 Searching full details for: "${searchTerm}"${merchantId ? ` for merchant ID ${merchantId}` : ''}${dateRangeText}${statusText}`);

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
        id,
        token,
        id_merchant,
        id_user,
        concepto,
        monto,
        expire_date,
        status,
        info_adicional,
        created_at,
        updated_at,
        processor_type,
        selia_transaction_id,
        selia_authorization_code,
        selia_response_code,
        selia_response_data
      FROM links_pago
      WHERE 1=1
    `;

    const params = [];

    if (searchTerm) {
      query += ' AND (token LIKE ? OR concepto LIKE ? OR id = ?)';
      params.push(
        `%${searchTerm}%`,
        `%${searchTerm}%`,
        isNaN(searchTerm) ? 0 : parseInt(searchTerm)
      );
    }

    if (startDate) {
      query += ' AND created_at >= ?';
      params.push(`${startDate} 00:01:00`);
    }
    if (endDate) {
      query += ' AND created_at <= ?';
      params.push(`${endDate} 23:59:00`);
    }

    if (merchantId) {
      query += ' AND id_merchant = ?';
      params.push(merchantId);
    }

    if (status !== null) {
      query += ' AND status = ?';
      params.push(parseInt(status));
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const [rows] = await connection.query(query, params);

    console.log(`✅ Found ${rows.length} matching payment link(s)`);
    return { rows, merchantName };

  } catch (error) {
    console.error(`❌ Database error: ${error.message}`);
    return { rows: [], merchantName: null };
  } finally {
    await connection.end();
  }
}

// Helper function to validate date format
function isValidDate(dateString) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;

  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

// AWS SDK v3 function to upload JSON to S3
async function uploadJSONToS3(jsonContent, filename) {
  try {
    if (!process.env.APP_CACHE_S3_BUCKET) {
      console.error('[S3 JSON Uploader] ❌ Missing APP_CACHE_S3_BUCKET environment variable');
      return false;
    }

    const bucketName = process.env.APP_CACHE_S3_BUCKET;
    const bucketRegion = process.env.APP_CACHE_BUCKET_REGION || process.env.APP_CACHE_AWS_REGION || 'us-east-1';

    // Create S3 client with AWS SDK v3
    const s3Client = new S3Client({
      region: bucketRegion,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AWS_SESSION_TOKEN
      }
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const s3FileName = `generated/${timestamp}_${filename}`;

    // Create command with PutObjectCommand (v3)
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3FileName,
      Body: jsonContent,
      ContentType: 'application/json',
      Metadata: {
        originalFilename: filename,
        timestamp: new Date().toISOString(),
        generatedBy: 'payment-links-cli'
      }
    });

    // Send command
    await s3Client.send(command);

    console.log(`[S3 JSON Uploader] ✅ Successfully uploaded JSON to S3: generated/${timestamp}_${filename}`);
    return true;
  } catch (error) {
    console.error('[S3 JSON Uploader] ❌ Error uploading JSON to S3:', error.message);
    return false;
  }
}

// AWS SDK v3 function to upload CSV to S3
async function uploadCSVToS3(csvContent, filename) {
  try {
    if (!process.env.APP_CACHE_S3_BUCKET) {
      console.error('[S3 CSV Uploader] ❌ Missing APP_CACHE_S3_BUCKET environment variable');
      return false;
    }

    const bucketName = process.env.APP_CACHE_S3_BUCKET;
    const bucketRegion = process.env.APP_CACHE_BUCKET_REGION || process.env.APP_CACHE_AWS_REGION || 'us-east-1';

    // Create S3 client with AWS SDK v3
    const s3Client = new S3Client({
      region: bucketRegion,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AWS_SESSION_TOKEN
      }
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const s3FileName = `generated/${timestamp}_${filename}`;

    // Create command with PutObjectCommand (v3)
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3FileName,
      Body: csvContent,
      ContentType: 'text/csv',
      Metadata: {
        originalFilename: filename,
        timestamp: new Date().toISOString(),
        generatedBy: 'payment-links-cli'
      }
    });

    // Send command
    await s3Client.send(command);

    console.log(`[S3 CSV Uploader] ✅ Successfully uploaded CSV to S3: generated/${timestamp}_${filename}`);
    return true;
  } catch (error) {
    console.error(`[S3 CSV Uploader] ❌ Failed to upload CSV to S3:`, error.message);
    return false;
  }
}

// Search transactions function
async function searchTransactions(searchTerm, limit = 30, merchantId = null, startDate = null, endDate = null, status = null) {
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

    let statusText = status ? ` (status: ${status})` : '';
    console.log(`🔍 Searching transactions for: "${searchTerm}"${merchantId ? ` for merchant ID ${merchantId}` : ''}${dateRangeText}${statusText}`);

    let query = `
      SELECT
        id_message,
        reference_number,
        folio,
        authorization,
        resp_code,
        estatus_f,
        amount,
        creation_date,
        name_merchant,
        more_info,
        bin,
        last4,
        card_brand,
        draft_capture,
        reference_number_ant
      FROM iso_message
      WHERE 1=1
    `;

    const params = [];

    if (searchTerm) {
      query += ' AND (reference_number LIKE ? OR folio LIKE ? OR authorization LIKE ? OR id_message = ?)';
      params.push(
        `%${searchTerm}%`,
        `%${searchTerm}%`,
        `%${searchTerm}%`,
        isNaN(searchTerm) ? 0 : parseInt(searchTerm)
      );
    }

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

    if (status !== null) {
      if (status === 'approved') {
        query += ' AND resp_code = "00" AND estatus_f = 2';
      } else if (status === 'declined') {
        query += ' AND resp_code != "00"';
      } else if (status === 'pending') {
        query += ' AND (resp_code IS NULL OR resp_code = "" OR resp_code = "99")';
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

// Fetch transactions function
async function fetchTransactions(limit = 30, merchantId = null, startDate = null, endDate = null, status = null) {
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

    let statusText = status ? ` (status: ${status})` : '';
    console.log(`📥 Fetching last ${limit} transactions${merchantId ? ` for merchant ID ${merchantId}` : ''}${dateRangeText}${statusText}...`);

    let query = `
      SELECT
        id_message,
        reference_number,
        folio,
        authorization,
        resp_code,
        estatus_f,
        amount,
        creation_date,
        name_merchant,
        more_info,
        bin,
        last4,
        card_brand,
        draft_capture,
        reference_number_ant
      FROM iso_message
      WHERE 1=1
    `;

    const params = [];

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

    if (status !== null) {
      if (status === 'approved') {
        query += ' AND resp_code = "00" AND estatus_f = 2';
      } else if (status === 'declined') {
        query += ' AND resp_code != "00"';
      } else if (status === 'pending') {
        query += ' AND (resp_code IS NULL OR resp_code = "" OR resp_code = "99")';
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

// Generate JSON for transactions
async function generateTransactionsJSON(rows, filename = null, merchantName = null) {
  if (rows.length === 0) {
    console.log('📭 No data to export to JSON');
    return;
  }

  // Generate filename if not provided
  if (!filename) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    let baseFilename = `transactions_${timestamp}`;

    if (merchantName) {
      const cleanMerchantName = merchantName
        .replace(/[^a-zA-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .substring(0, 30);
      baseFilename = `${cleanMerchantName}_${baseFilename}`;
    }

    filename = `${baseFilename}.json`;
  }

  // Process rows to merge JSON data
  const processedRows = rows.map(row => {
    let processedRow = { ...row };
    
    // Parse and merge more_info
    if (row.more_info) {
      try {
        const moreInfo = typeof row.more_info === 'string' ? JSON.parse(row.more_info) : row.more_info;
        const flattened = flattenObject(moreInfo);
        Object.assign(processedRow, flattened);
      } catch (e) {
        // Keep original if parsing fails
      }
    }
    
    // Remove original JSON field to avoid duplication
    delete processedRow.more_info;
    
    return processedRow;
  });

  // Create JSON content
  const jsonContent = JSON.stringify(processedRows, null, 2);

  const uploadSuccess = await uploadJSONToS3(jsonContent, filename);

  if (uploadSuccess) {
    console.log(`📄 JSON file processed and uploaded to S3: ${filename}`);
    console.log(`📊 Exported ${rows.length} transactions`);
    if (merchantName) {
      console.log(`🏪 Merchant: ${merchantName}`);
    }
  } else {
    console.log('⚠️  S3 upload failed, falling back to local file...');
    fs.writeFileSync(filename, jsonContent, 'utf8');
    console.log(`📄 JSON file generated locally: ${filename}`);
    console.log(`📊 Exported ${rows.length} transactions`);
  }
}

// Generate CSV for transactions
async function generateTransactionsCSV(rows, filename = null, merchantName = null) {
  if (rows.length === 0) {
    console.log('📭 No data to export to CSV');
    return;
  }

  // Generate filename if not provided
  if (!filename) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    let baseFilename = `transactions_${timestamp}`;

    if (merchantName) {
      const cleanMerchantName = merchantName
        .replace(/[^a-zA-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .substring(0, 30);
      baseFilename = `${cleanMerchantName}_${baseFilename}`;
    }

    filename = `${baseFilename}.csv`;
  }

  // Parse more_info JSON
  let allJsonKeys = new Set();
  let parsedInfoArray = [];

  rows.forEach(row => {
    let parsedInfo = {};
    if (row.more_info) {
      try {
        let jsonStr = row.more_info;

        if (typeof jsonStr === 'string') {
          jsonStr = jsonStr.trim();

          if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
            jsonStr = jsonStr.slice(1, -1);
          }

          jsonStr = jsonStr.replace(/\\"/g, '"');
          jsonStr = jsonStr.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
          jsonStr = jsonStr.replace(/:\s*([a-zA-Z_][a-zA-Z0-9_]*)(?=\s*[,}])/g, ': "$1"');
          jsonStr = jsonStr.replace(/,\s*}/g, '}');
          jsonStr = jsonStr.replace(/,\s*]/g, ']');

          try {
            parsedInfo = JSON.parse(jsonStr);
          } catch (parseError) {
            const jsonStart = jsonStr.indexOf('{');
            const jsonEnd = jsonStr.lastIndexOf('}');

            if (jsonStart >= 0 && jsonEnd > jsonStart) {
              const potentialJson = jsonStr.substring(jsonStart, jsonEnd + 1);
              try {
                parsedInfo = JSON.parse(potentialJson);
              } catch (e) {
                parsedInfo = {};
              }
            }
          }
        } else if (typeof jsonStr === 'object') {
          parsedInfo = jsonStr;
        }

        parsedInfo = flattenObject(parsedInfo);
        Object.keys(parsedInfo).forEach(key => allJsonKeys.add(key));

      } catch (e) {
        console.log(`⚠️  Failed to parse more_info for transaction ${row.id_message}: ${e.message}`);
      }
    }
    parsedInfoArray.push(parsedInfo);
  });

  // Transaction table headers
  const headers = [
    'id_message',
    'reference_number',
    'folio',
    'authorization',
    'resp_code',
    'estatus_f',
    'amount',
    'creation_date',
    'name_merchant',
    'bin',
    'last4',
    'card_brand',
    'draft_capture',
    'reference_number_ant',
    'more_info'
  ];

  // Helper function to safely convert any value to CSV string
  const toCSVValue = (value) => {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    if (value instanceof Date) {
      return `"${value.toISOString()}"`;
    }

    let stringValue;
    if (typeof value === 'object') {
      stringValue = JSON.stringify(value);
    } else {
      stringValue = String(value);
    }

    return `"${stringValue.replace(/"/g, '""')}"`;
  };

  // Convert rows to CSV format
  const csvRows = [headers.join(',')];

  rows.forEach((row, index) => {
    const csvRow = headers.map(header => {
      return toCSVValue(row[header]);
    });

    csvRows.push(csvRow.join(','));
  });

  // Write to file or upload to S3
  const csvContent = csvRows.join('\n');

  const uploadSuccess = await uploadCSVToS3(csvContent, filename);

  if (uploadSuccess) {
    console.log(`📄 CSV file processed and uploaded to S3: ${filename}`);
    console.log(`📊 Exported ${rows.length} transactions`);
    if (merchantName) {
      console.log(`🏪 Merchant: ${merchantName}`);
    }
  } else {
    console.log('⚠️  S3 upload failed, falling back to local file...');
    fs.writeFileSync(filename, csvContent, 'utf8');
    console.log(`📄 CSV file generated locally: ${filename}`);
    console.log(`📊 Exported ${rows.length} transactions`);
  }
}

// Display transactions in table format
function displayTransactionsTable(rows, title = 'TRANSACTIONS') {
  if (rows.length === 0) {
    console.log('📭 No records to display');
    return;
  }

  console.log('\n' + '═'.repeat(150));
  console.log(`📋 ${title}`);
  console.log('═'.repeat(150));

  // Build headers
  const headers = ['ID', 'Reference', 'Folio', 'Auth', 'Resp', 'Status', 'Amount', 'Date', 'Merchant'];
  const headerRow = '│ ' + headers.map(h => h.substring(0, 12).padEnd(12)).join(' │ ') + ' │';
  const separatorRow = '├─' + headers.map(() => '─'.repeat(12)).join('─├─') + '─┤';

  console.log(headerRow);
  console.log(separatorRow);

  // Display each row
  rows.forEach((row, index) => {
    const cells = [];
    
    cells.push(String(row.id_message || '').substring(0, 12).padEnd(12));
    cells.push(String(row.reference_number || 'N/A').substring(0, 12).padEnd(12));
    cells.push(String(row.folio || 'N/A').substring(0, 12).padEnd(12));
    cells.push(String(row.authorization || 'N/A').substring(0, 12).padEnd(12));
    cells.push(String(row.resp_code || 'N/A').substring(0, 12).padEnd(12));
    
    let statusText = 'Unknown';
    if (row.resp_code === '00' && row.estatus_f === 2) {
      statusText = 'Approved';
    } else if (row.resp_code && row.resp_code !== '00') {
      statusText = 'Declined';
    } else if (!row.resp_code || row.resp_code === '99') {
      statusText = 'Pending';
    }
    cells.push(statusText.substring(0, 12).padEnd(12));
    
    cells.push(String(row.amount ? `$${parseFloat(row.amount).toFixed(2)}` : '$0.00').substring(0, 12).padEnd(12));
    
    const date = row.creation_date ? new Date(row.creation_date).toLocaleString('es-MX', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }) : 'N/A';
    cells.push(date.substring(0, 12).padEnd(12));
    
    cells.push(String(row.name_merchant || 'N/A').substring(0, 12).padEnd(12));

    console.log('│ ' + cells.join(' │ ') + ' │');

    // Add separator every 10 rows for readability
    if (index < rows.length - 1 && (index + 1) % 10 === 0) {
      console.log(separatorRow);
    }
  });

  console.log('═'.repeat(150));

  const totalAmount = rows.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);
  const approvedCount = rows.filter(r => r.resp_code === '00' && r.estatus_f === 2).length;
  const declinedCount = rows.filter(r => r.resp_code && r.resp_code !== '00').length;
  const pendingCount = rows.filter(r => !r.resp_code || r.resp_code === '99').length;

  console.log(`📊 Total: ${rows.length} transactions | Total Amount: $${totalAmount.toFixed(2)}`);
  console.log(`   ✅ Approved: ${approvedCount} | ❌ Declined: ${declinedCount} | ⏳ Pending: ${pendingCount}`);
}

// Delete payment links
async function deletePaymentLinks(searchTerm, limit = 30, merchantId = null, startDate = null, endDate = null, status = null, forceMode = false) {
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
    console.log(`🔍 Finding payment links to delete...`);

    const results = await searchPaymentLinks(searchTerm, limit, merchantId, startDate, endDate, status);

    if (results.length === 0) {
      console.log('📭 No payment links found matching the search criteria.');
      return false;
    }

    console.log('\n' + '⚠️  '.repeat(20));
    console.log('🔥 PAYMENT LINKS TO BE DELETED:');
    console.log('⚠️  '.repeat(20));
    displayPaymentLinksTable(results, `PENDING DELETION - ${results.length} LINK(S)`);

    if (!forceMode) {
      const confirmationNumber = Math.floor(Math.random() * 900000) + 100000;

      console.log('\n🛡️  SAFETY CONFIRMATION REQUIRED');
      console.log('─'.repeat(40));
      console.log(`To confirm deletion, enter the following number: ${confirmationNumber}`);
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

    let deleteQuery = 'DELETE FROM links_pago WHERE 1=1';
    const deleteParams = [];

    if (searchTerm) {
      deleteQuery += ' AND (token LIKE ? OR concepto LIKE ? OR id = ?)';
      deleteParams.push(
        `%${searchTerm}%`,
        `%${searchTerm}%`,
        isNaN(searchTerm) ? 0 : parseInt(searchTerm)
      );
    }

    if (startDate) {
      deleteQuery += ' AND created_at >= ?';
      deleteParams.push(`${startDate} 00:01:00`);
    }
    if (endDate) {
      deleteQuery += ' AND created_at <= ?';
      deleteParams.push(`${endDate} 23:59:00`);
    }

    if (merchantId) {
      deleteQuery += ' AND id_merchant = ?';
      deleteParams.push(merchantId);
    }

    if (status !== null) {
      deleteQuery += ' AND status = ?';
      deleteParams.push(parseInt(status));
    }

    deleteQuery += ' LIMIT ?';
    deleteParams.push(parseInt(limit));

    console.log(`\n🗑️  Deleting ${results.length} payment link(s)...`);

    const [deleteResult] = await connection.query(deleteQuery, deleteParams);

    if (deleteResult.affectedRows > 0) {
      console.log('\n✅ SUCCESS! Payment links deleted:');
      console.log('─'.repeat(40));
      console.log(`Deleted: ${deleteResult.affectedRows} link(s)`);
      console.log(`Search term: "${searchTerm || 'all'}"`);
      if (merchantId) console.log(`Merchant ID: ${merchantId}`);
      if (status !== null) console.log(`Status: ${getStatusText(status)} (${status})`);
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

/**
 * Fix authorization codes in iso_message table by using field 50 from Selia response
 * Usage: node paymentLinks.js --fix-auth
 * Optional: --dry-run to see what would be updated without making changes
 * Optional: --limit 100 to process only 100 records
 * Optional: --merchant-id 66 to process only links for a specific merchant
 * Optional: --id 1305 to process only a specific link
 */
async function fixAuthorizations(limit = 1000, dryRun = false, merchantId = null, specificLinkId = null) {
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
    console.log('\n🔧 FIXING AUTHORIZATION CODES (using field 50)');
    console.log('═'.repeat(70));
    if (dryRun) {
      console.log('🚩 DRY RUN MODE - No changes will be made');
    }

    // Build filter description
    let filterDesc = '';
    if (specificLinkId) {
      filterDesc = ` for specific link ID: ${specificLinkId}`;
    } else if (merchantId) {
      filterDesc = ` for merchant ID: ${merchantId}`;
    }
    console.log(`📋 Looking for payment links with Selia data and field 50${filterDesc}...`);

    let query = `
      SELECT
        lp.id AS link_id,
        lp.token,
        lp.selia_response_data,
        lp.info_adicional,
        lp.selia_authorization_code AS link_auth_code,
        lp.selia_response_code,
        lp.id_merchant
      FROM links_pago lp
      WHERE lp.processor_type = 'selia'
        AND lp.selia_response_data IS NOT NULL
        AND lp.selia_response_data != ''
        AND lp.info_adicional IS NOT NULL
        AND lp.info_adicional != ''
        AND lp.selia_response_data LIKE '%"50"%'
    `;

    const params = [];

    // Add filters
    if (specificLinkId) {
      query += ' AND lp.id = ?';
      params.push(specificLinkId);
    } else if (merchantId) {
      query += ' AND lp.id_merchant = ?';
      params.push(merchantId);
    }

    query += ' ORDER BY lp.id DESC LIMIT ?';
    params.push(parseInt(limit));

    const [links] = await connection.query(query, params);

    console.log(`✅ Found ${links.length} payment links with potential authorization data`);

    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    let rejected = 0;
    let invalidField50 = 0;
    let invalidCurrentAuth = 0;

    for (const link of links) {
      processed++;

      try {
        // Parse JSON fields
        let seliaData = null;
        let infoAdicional = null;

        try {
          seliaData = typeof link.selia_response_data === 'string'
            ? JSON.parse(link.selia_response_data)
            : link.selia_response_data;
        } catch (e) {
          console.log(`⚠️  Link ${link.link_id}: Failed to parse selia_response_data`);
          errors++;
          continue;
        }

        try {
          infoAdicional = typeof link.info_adicional === 'string'
            ? JSON.parse(link.info_adicional)
            : link.info_adicional;
        } catch (e) {
          console.log(`⚠️  Link ${link.link_id}: Failed to parse info_adicional`);
          errors++;
          continue;
        }

        // Extract field 50 from parsedFields or rawResponse
        let field50 = null;
        let field8 = seliaData.authorizationCode || seliaData.parsedFields?.['8'] || null;

        // Try to get from parsedFields first
        if (seliaData.parsedFields && seliaData.parsedFields['50']) {
          field50 = seliaData.parsedFields['50'].trim();
        }

        // If not found in parsedFields, try to extract from rawResponse
        if (!field50 && seliaData.rawResponse) {
          const match = seliaData.rawResponse.match(/50:([^;]+);/);
          if (match && match[1]) {
            field50 = match[1].trim();
          }
        }

        // Check if this is a rejected transaction (empty field 50)
        const isRejected = !field50 || field50 === '' || field50.match(/^\s*$/);

        if (isRejected) {
          console.log(`⏭️  Link ${link.link_id}: Field 50 is empty (rejected transaction - response code: ${link.selia_response_code})`);
          rejected++;
          // Still continue to potentially clear invalid current auth
        }

        // Get iso_message_id from info_adicional.tx.iso_message_id
        const isoMessageId = infoAdicional?.tx?.iso_message_id;

        if (!isoMessageId) {
          console.log(`⏭️  Link ${link.link_id}: No iso_message_id found in info_adicional.tx`);
          skipped++;
          continue;
        }

        // Get current iso_message data
        const [isoRows] = await connection.query(
          'SELECT id_message, authorization, resp_code, tkn_data_63_rp FROM iso_message WHERE id_message = ?',
          [isoMessageId]
        );

        if (isoRows.length === 0) {
          console.log(`⏭️  Link ${link.link_id}: ISO message ${isoMessageId} not found`);
          skipped++;
          continue;
        }

        const currentAuth = isoRows[0].authorization;
        const currentRespCode = isoRows[0].resp_code;

        // VALIDATION: Check if current authorization is invalid (not exactly 6 characters)
        let currentAuthInvalid = false;
        if (currentAuth && currentAuth !== '' && currentAuth !== null) {
          if (!/^.{6}$/.test(currentAuth)) {
            currentAuthInvalid = true;
            invalidCurrentAuth++;
            console.log(`   ⚠️  Current auth is invalid: "${currentAuth}" (not exactly 6 characters) - will be cleared`);
          }
        }

        // Log what we found
        console.log(`\n📝 Link ${link.link_id} (Merchant: ${link.id_merchant}) → ISO ${isoMessageId}`);
        console.log(`   Field 8 (Transaction ID): ${field8 || 'N/A'}`);
        console.log(`   Field 50 (Bank Auth): "${field50 || 'EMPTY'}"`);
        console.log(`   Current ISO auth: "${currentAuth || 'EMPTY'}"${currentAuthInvalid ? ' (INVALID)' : ''}`);
        console.log(`   Current resp_code: ${currentRespCode}`);

        // VALIDATION: Check if field 50 has exactly 6 characters (numeric or alphanumeric)
        let field50Valid = false;
        if (field50 && field50 !== '') {
          field50Valid = /^.{6}$/.test(field50);
          if (!field50Valid) {
            invalidField50++;
            console.log(`   ⚠️  Field 50 is not exactly 6 characters: "${field50}" - will be ignored`);
          }
        }

        // Determine what value to set
        let newAuthValue = null; // Default to NULL

        // Priority:
        // 1. If field50 is valid (exactly 6 characters), use it
        // 2. Otherwise, set to NULL (empty)
        if (field50Valid) {
          newAuthValue = field50;
          console.log(`   ✅ Using field 50: "${field50}"`);
        } else {
          console.log(`   ⏭️  Setting authorization to NULL (empty) because field 50 is invalid or empty`);
        }

        // Skip if already correct AND valid
        if (!currentAuthInvalid && currentAuth === newAuthValue) {
          console.log(`   ✅ Already correct and valid`);
          skipped++;
          continue;
        }

        // Show what will be updated
        console.log(`   🔄 Will update: "${currentAuth || 'EMPTY'}"${currentAuthInvalid ? ' (INVALID)' : ''} → "${newAuthValue || 'EMPTY'}"`);

        if (!dryRun) {
          // Update the authorization field
          const [updateResult] = await connection.query(
            'UPDATE iso_message SET authorization = ? WHERE id_message = ?',
            [newAuthValue, isoMessageId]
          );

          if (updateResult.affectedRows > 0) {
            console.log(`   ✅ SUCCESS: Updated authorization to ${newAuthValue || 'EMPTY'}`);

            // Also update the tkn_data_63_rp if it exists
            if (isoRows[0].tkn_data_63_rp) {
              try {
                let tknData = typeof isoRows[0].tkn_data_63_rp === 'string'
                  ? JSON.parse(isoRows[0].tkn_data_63_rp)
                  : isoRows[0].tkn_data_63_rp;

                if (tknData && typeof tknData === 'object') {
                  // Update both possible field names
                  tknData.authorization_code = newAuthValue;
                  tknData.authorization = newAuthValue;

                  await connection.query(
                    'UPDATE iso_message SET tkn_data_63_rp = ? WHERE id_message = ?',
                    [JSON.stringify(tknData), isoMessageId]
                  );
                  console.log(`   ✅ Also updated tkn_data_63_rp`);
                }
              } catch (e) {
                console.log(`   ⚠️  Could not update tkn_data_63_rp: ${e.message}`);
              }
            }

            updated++;
          } else {
            console.log(`   ❌ Failed to update`);
            errors++;
          }
        } else {
          console.log(`   📋 DRY RUN: Would update`);
          updated++; // Count in dry run too for summary
        }

      } catch (error) {
        console.error(`❌ Error processing link ${link.link_id}: ${error.message}`);
        errors++;
      }

      // Progress indicator every 10 records
      if (processed % 10 === 0) {
        console.log(`\n📊 Progress: ${processed}/${links.length} processed`);
      }
    }

    // Summary
    console.log('\n' + '═'.repeat(70));
    console.log('📊 FIX AUTHORIZATION SUMMARY');
    console.log('─'.repeat(40));
    console.log(`Filter: ${filterDesc || 'All links'}`);
    console.log(`Total links processed: ${processed}`);
    console.log(`✅ Would/Did update: ${updated}`);
    console.log(`⚠️  Invalid field 50 (ignored): ${invalidField50}`);
    console.log(`⚠️  Invalid current auth (cleared): ${invalidCurrentAuth}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Rejected transactions: ${rejected}`);
    console.log(`❌ Errors: ${errors}`);
    if (dryRun) {
      console.log('\n🚩 This was a DRY RUN. No changes were made.');
      console.log('   Run without --dry-run to apply changes.');
    }
    console.log('─'.repeat(40));

    return true;

  } catch (error) {
    console.error(`❌ Database error: ${error.message}`);
    return false;
  } finally {
    await connection.end();
  }
}

// MAIN function
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log('\n💳 PAYMENT LINK & TRANSACTION MANAGER');
    console.log('='.repeat(50));
    console.log('\nPayment Link Commands:');
    console.log('  --table                    Show payment links in table format');
    console.log('  --full                     Show full details without truncation (requires --id)');
    console.log('  --results 50               Show 50 links (default: 30)');
    console.log('  --search "token123"        Search for payment link');
    console.log('  --set-status 2             Update status: 1=Pending, 2=Completed, 3=Failed');
    console.log('  --id 123                   Link ID to update/view');
    console.log('  --merchant-id 5            Filter by merchant ID');
    console.log('  --status 1                 1=Pending, 2=Completed, 3=Failed');
    console.log('  --csv                      Export results to CSV file');
    console.log('  --json                     Export results as JSON file to S3 (like --csv)');
    console.log('  --start-date YYYY-MM-DD    Start date for filtering');
    console.log('  --end-date YYYY-MM-DD      End date for filtering');
    console.log('  --delete                   Delete found records (requires --search)');
    console.log('  --force                    Skip confirmation prompt for delete');
    console.log('  --fix-auth                 Fix authorization codes using field 50 from Selia');
    console.log('  --fix-auth --merchant-id 5 Process only links for a specific merchant');
    console.log('  --fix-auth --id 123        Process only a specific link');
    console.log('  --dry-run                  Show what would be updated without making changes');
    console.log('  --limit 500                Limit number of records to process with --fix-auth');
    console.log('  --all --auth                Show all links with authorization code highlighting');
    console.log('  --all --auth --merchant-id 5 Show auth highlights for specific merchant');
    
    console.log('\nTransaction Commands:');
    console.log('  --transactions             Search transactions instead of payment links');
    console.log('  --tx                       Alias for --transactions');
    console.log('  --status approved          Filter approved transactions (resp_code=00, estatus_f=2)');
    console.log('  --status declined          Filter declined transactions (resp_code!=00)');
    console.log('  --status pending           Filter pending transactions (resp_code IS NULL/99)');
    
    console.log('\nExamples (Payment Links):');
    console.log('  node paymentLinks.js --table');
    console.log('  node paymentLinks.js --table --results 50');
    console.log('  node paymentLinks.js --search "abc123"');
    console.log('  node paymentLinks.js --set-status 2 --id 123');
    console.log('  node paymentLinks.js --table --id 123 --full');
    console.log('  node paymentLinks.js --table --merchant-id 5');
    console.log('  node paymentLinks.js --table --status 1');
    console.log('  node paymentLinks.js --search "abc123" --merchant-id 5 --csv');
    console.log('  node paymentLinks.js --table --start-date 2024-01-01 --end-date 2024-01-31');
    console.log('  node paymentLinks.js --search "abc123" --status 2 --delete');
    console.log('  node paymentLinks.js --fix-auth');
    console.log('  node paymentLinks.js --fix-auth --merchant-id 66 --dry-run');
    console.log('  node paymentLinks.js --fix-auth --id 1305');
    console.log('  node paymentLinks.js --fix-auth --limit 100');
    console.log('  node paymentLinks.js --all --auth');
    console.log('  node paymentLinks.js --all --auth --merchant-id 5');
    console.log('  node paymentLinks.js --all --auth --results 100');
    console.log('  node paymentLinks.js --merchant-id 66 --json');
    console.log('  node paymentLinks.js --search "abc123" --json');
    
    console.log('\nExamples (Transactions):');
    console.log('  node paymentLinks.js --transactions --table');
    console.log('  node paymentLinks.js --tx --table --results 50');
    console.log('  node paymentLinks.js --transactions --search "123456"');
    console.log('  node paymentLinks.js --tx --merchant-id 5 --csv');
    console.log('  node paymentLinks.js --transactions --status approved --json');
    console.log('  node paymentLinks.js --tx --start-date 2024-01-01 --end-date 2024-01-31');
    console.log('  node paymentLinks.js --transactions --search "abc123" --status declined --csv');
    
    console.log('='.repeat(50));
    return;
  }

  // Parse arguments
  let limit = 30;
  let searchTerm = null;
  let tableMode = false;
  let setStatus = null;
  let linkId = null;
  let fullMode = false;
  let merchantId = null;
  let csvMode = false;
  let jsonMode = false;
  let startDate = null;
  let endDate = null;
  let deleteMode = false;
  let forceMode = false;
  let status = null;
  let fixAuth = false;
  let dryRun = false;
  let fixAuthLimit = 1000;
  let allMode = false;
  let authMode = false;
  let transactionMode = false;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--results' || args[i] === '-r') && i + 1 < args.length) {
      limit = parseInt(args[i + 1]);
      i++;
    } else if ((args[i] === '--search' || args[i] === '-s') && i + 1 < args.length) {
      searchTerm = args[i + 1];
      i++;
    } else if (args[i] === '--table') {
      tableMode = true;
    } else if ((args[i] === '--set-status') && i + 1 < args.length) {
      setStatus = parseInt(args[i + 1]);
      i++;
    } else if ((args[i] === '--id' || args[i] === '--link-id') && i + 1 < args.length) {
      linkId = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--full') {
      fullMode = true;
    } else if ((args[i] === '--merchant-id' || args[i] === '-m') && i + 1 < args.length) {
      merchantId = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--csv') {
      csvMode = true;
    } else if (args[i] === '--json') {
      jsonMode = true;
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
    } else if ((args[i] === '--status') && i + 1 < args.length) {
      status = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--fix-auth') {
      fixAuth = true;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if ((args[i] === '--limit') && i + 1 < args.length) {
      fixAuthLimit = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--all') {
      allMode = true;
    } else if (args[i] === '--auth') {
      authMode = true;
    } else if (args[i] === '--transactions' || args[i] === '--tx') {
      transactionMode = true;
    }
  }

  try {
    // Handle fix-auth command first (it's a standalone operation)
    if (fixAuth) {
      // Pass merchantId and linkId if they were provided
      await fixAuthorizations(fixAuthLimit, dryRun, merchantId, linkId);
      return;
    }

    // Validate other commands
    if (setStatus !== null && !linkId) {
      console.error('❌ Error: --set-status requires --id to be specified');
      return;
    }

    if (fullMode && !linkId) {
      console.error('❌ Error: --full flag requires --id to be specified');
      return;
    }

    if (startDate && !isValidDate(startDate)) {
      console.error('❌ Error: Invalid start date format. Use YYYY-MM-DD');
      return;
    }
    if (endDate && !isValidDate(endDate)) {
      console.error('❌ Error: Invalid end date format. Use YYYY-MM-DD');
      return;
    }

    if (status !== null && ![1, 2, 3].includes(status)) {
      console.error('❌ Error: Invalid status. Use: 1=Pending, 2=Completed, 3=Failed');
      return;
    }

    if (deleteMode && !searchTerm) {
      console.error('❌ Error: --delete requires --search to be specified');
      return;
    }

    // Validate transaction mode incompatibilities
    if (transactionMode) {
      if (setStatus !== null) {
        console.error('❌ Error: --set-status is not compatible with transaction mode');
        return;
      }
      if (linkId !== null) {
        console.error('❌ Error: --id is not compatible with transaction mode');
        return;
      }
      if (fullMode) {
        console.error('❌ Error: --full is not compatible with transaction mode');
        return;
      }
      if (deleteMode) {
        console.error('❌ Error: --delete is not compatible with transaction mode');
        return;
      }
      if (fixAuth) {
        console.error('❌ Error: --fix-auth is not compatible with transaction mode');
        return;
      }
      if (authMode) {
        console.error('❌ Error: --auth is not compatible with transaction mode');
        return;
      }
    }

    // Validate --auth requires --all
    if (authMode && !allMode) {
      console.error('❌ Error: --auth requires --all to be specified');
      console.error('   Example: --all --auth');
      return;
    }

    // Handle transaction mode
    if (transactionMode) {
      // Handle transaction search
      if (searchTerm !== null) {
        if (csvMode) {
          const results = await searchTransactions(searchTerm, limit, merchantId, startDate, endDate, status);
          await generateTransactionsCSV(results);
        } else if (jsonMode) {
          const results = await searchTransactions(searchTerm, limit, merchantId, startDate, endDate, status);
          await generateTransactionsJSON(results);
        } else {
          const results = await searchTransactions(searchTerm, limit, merchantId, startDate, endDate, status);
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
          let statusText = status ? ` (Status: ${status})` : '';
          displayTransactionsTable(results, `TRANSACTION SEARCH RESULTS: "${searchTerm}"${merchantId ? ` (Merchant ${merchantId})` : ''}${dateRangeText}${statusText}`);
        }
        return;
      }

      // Handle transaction table/export
      if (tableMode || csvMode || jsonMode || allMode) {
        const actualLimit = allMode ? 999999 : limit;
        if (csvMode) {
          const results = await fetchTransactions(actualLimit, merchantId, startDate, endDate, status);
          await generateTransactionsCSV(results);
        } else if (jsonMode) {
          const results = await fetchTransactions(actualLimit, merchantId, startDate, endDate, status);
          await generateTransactionsJSON(results);
        } else {
          const results = await fetchTransactions(actualLimit, merchantId, startDate, endDate, status);
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
          let statusText = status ? ` (Status: ${status})` : '';
          displayTransactionsTable(results, `${allMode ? 'ALL' : `LAST ${actualLimit}`} TRANSACTIONS${merchantId ? ` (Merchant ${merchantId})` : ''}${dateRangeText}${statusText}`);
        }
        return;
      }

      // Default transaction mode - show table
      console.log('ℹ️  Transaction mode detected. Showing table view. Use --help for options.');
      const results = await fetchTransactions(limit, merchantId, startDate, endDate, status);
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
      let statusText = status ? ` (Status: ${status})` : '';
      displayTransactionsTable(results, `LAST ${limit} TRANSACTIONS${merchantId ? ` (Merchant ${merchantId})` : ''}${dateRangeText}${statusText}`);
      return;
    }

    // Handle --all --auth combination
    if (allMode && authMode) {
      const actualLimit = allMode ? 999999 : limit; // Show ALL when --all is used
      const results = await fetchPaymentLinks(actualLimit, merchantId, startDate, endDate, status);
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
      let statusText = status ? ` (Status: ${getStatusText(status)})` : '';
      let merchantText = merchantId ? ` (Merchant ${merchantId})` : '';
      displayPaymentLinksTable(results, `ALL PAYMENT LINKS${merchantText}${dateRangeText}${statusText}`, false, null, true, true);
      return;
    }

    // Handle set-status
    if (setStatus !== null) {
      await updateLinkStatus(linkId, setStatus);
      return;
    }

    // Handle full mode
    if (fullMode && linkId) {
      const results = await fetchLinkFull(linkId);
      displayPaymentLinksTable(results, `PAYMENT LINK ${linkId} - FULL DETAILS`, fullMode, linkId, false, false);
      return;
    }

    // Handle table mode with specific link
    if (tableMode && linkId) {
      const results = await fetchLinkFull(linkId);
      displayPaymentLinksTable(results, `PAYMENT LINK ${linkId}`, false, linkId, false, false);
      return;
    }

    // Handle search
    if (searchTerm !== null) {
      if (deleteMode) {
        await deletePaymentLinks(searchTerm, limit, merchantId, startDate, endDate, status, forceMode);
        return;
      }

      if (csvMode) {
        const { rows, merchantName } = await searchPaymentLinksFull(searchTerm, limit, merchantId, startDate, endDate, status);
        await generateCSV(rows, null, merchantName);
      } else if (jsonMode) {
        const { rows, merchantName } = await searchPaymentLinksFull(searchTerm, limit, merchantId, startDate, endDate, status);
        await generateJSON(rows, null, merchantName);
      } else {
        const results = await searchPaymentLinks(searchTerm, limit, merchantId, startDate, endDate, status);
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
        let statusText = status ? ` (Status: ${getStatusText(status)})` : '';
        displayPaymentLinksTable(results, `SEARCH RESULTS: "${searchTerm}"${merchantId ? ` (Merchant ${merchantId})` : ''}${dateRangeText}${statusText}`, false, null, false, false);
      }
      return;
    }

    // Handle table
    if (tableMode || csvMode || jsonMode || allMode) {
      const actualLimit = allMode ? 999999 : limit; // Show ALL when --all is used
      if (csvMode) {
        const { rows, merchantName } = await fetchPaymentLinksFull(actualLimit, merchantId, startDate, endDate, status);
        await generateCSV(rows, null, merchantName);
      } else if (jsonMode) {
        const { rows, merchantName } = await fetchPaymentLinksFull(actualLimit, merchantId, startDate, endDate, status);
        await generateJSON(rows, null, merchantName);
      } else {
        const results = await fetchPaymentLinks(actualLimit, merchantId, startDate, endDate, status);
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
        let statusText = status ? ` (Status: ${getStatusText(status)})` : '';
        displayPaymentLinksTable(results, `${allMode ? 'ALL' : `LAST ${actualLimit}`} PAYMENT LINKS${merchantId ? ` (Merchant ${merchantId})` : ''}${dateRangeText}${statusText}`, false, null, allMode && authMode, allMode);
      }
      return;
    }

    // Default
    console.log('ℹ️  No command specified. Showing table view. Use --help for options.');
    const results = await fetchPaymentLinks(limit, merchantId, startDate, endDate, status);
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
    let statusText = status ? ` (Status: ${getStatusText(status)})` : '';
    displayPaymentLinksTable(results, `LAST ${limit} PAYMENT LINKS${merchantId ? ` (Merchant ${merchantId})` : ''}${dateRangeText}${statusText}`, false, null, false, false);

  } catch (error) {
    console.error(`💥 Error: ${error.message}`);
  }
}

// Run
if (require.main === module) {
  main();
}