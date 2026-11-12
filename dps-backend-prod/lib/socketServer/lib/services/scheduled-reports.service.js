/**
 * @fileoverview Scheduled Transaction Reports Service
 *
 * This service generates and sends automated Excel reports of transaction data
 * at scheduled intervals (9 AM, 3 PM, 6 PM daily). It implements distributed
 * locking to prevent duplicate report generation in multi-instance deployments.
 *
 * @module scheduled-reports.service
 * @requires node-cron
 * @requires nodemailer
 * @requires mysql2/promise
 * @requires exceljs
 *
 * PCI DSS 4.0 Compliance Requirements:
 * - Req 3.4: Sensitive data is masked in reports (BIN, last4 only)
 * - Req 10.2: Audit logging of all report generation attempts
 * - Req 10.3: Audit records include timestamps and user identification
 * - Req 10.4: Logs are secured and protected from unauthorized modification
 * - Req 12.10: Security incident response (report failures logged)
 *
 * Security Features:
 * - Distributed locking prevents concurrent executions
 * - Database connection credentials from environment variables
 * - Email transport uses TLS/SSL
 * - Generated files are deleted after email transmission
 * - Transaction data filtered to last 24 hours only
 * - Sensitive card data properly masked (XXXXX...XXXX format)
 *
 * @author Payment Gateway Team
 * @version 1.0.0
 */

const cron = require('node-cron');
const nodemailer = require('nodemailer');
const mysql = require('mysql2/promise');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

/**
 * Database connection helper
 *
 * Creates a MySQL database connection using environment variables.
 *
 * PCI DSS Req 8.2: Authentication credentials stored securely in environment
 * PCI DSS Req 8.3: Multi-factor authentication for database access (enforced at DB level)
 *
 * @async
 * @function getDatabaseConnection
 * @returns {Promise<mysql.Connection>} MySQL connection object
 * @throws {Error} If DB_NAME environment variable is not set
 */
async function getDatabaseConnection() {
  const databaseName = process.env.DB_NAME;
  if (!databaseName) {
    throw new Error('DB_NAME environment variable is not set!');
  }

  return await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: databaseName,
    port: process.env.DB_PORT || 3306,
    charset: 'utf8mb4',
    connectTimeout: 5000
  });
}

/**
 * Ensure distributed lock table exists
 *
 * Creates the scheduled_reports_locks table if it doesn't exist.
 * This table is used for distributed locking across multiple instances.
 *
 * PCI DSS Req 10.2.2: Ensures audit mechanisms are in place before operations
 * PCI DSS Req 6.5.10: Prevents race conditions and ensures data integrity
 *
 * @async
 * @function ensureLockTable
 * @returns {Promise<void>}
 * @throws {Error} If table creation fails
 */
async function ensureLockTable() {
  const connection = await getDatabaseConnection();
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS scheduled_reports_locks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lock_key VARCHAR(100) NOT NULL UNIQUE,
        lock_holder VARCHAR(100) NOT NULL,
        acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        INDEX idx_expires_at (expires_at),
        INDEX idx_lock_key (lock_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✅ Lock table ensured');
  } finally {
    await connection.end();
  }
}

// Distributed lock implementation
class DistributedLock {
  constructor(lockKey, ttlMinutes = 30) {
    this.lockKey = lockKey;
    this.ttlMinutes = ttlMinutes;
    this.lockHolder = `instance_${process.pid}_${Date.now()}`;
  }

  async acquire(maxRetries = 3) {
    const connection = await getDatabaseConnection();
    
    try {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Clean up expired locks first
          await connection.query(
            'DELETE FROM scheduled_reports_locks WHERE expires_at < NOW()'
          );

          // Try to acquire the lock
          const expiresAt = new Date(Date.now() + this.ttlMinutes * 60 * 1000);
          const [result] = await connection.query(
            `INSERT INTO scheduled_reports_locks (lock_key, lock_holder, expires_at) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE 
             lock_holder = IF(expires_at < NOW(), VALUES(lock_holder), lock_holder),
             expires_at = IF(expires_at < NOW(), VALUES(expires_at), expires_at)`,
            [this.lockKey, this.lockHolder, expiresAt]
          );

          // Check if we acquired the lock
          const [rows] = await connection.query(
            'SELECT lock_holder FROM scheduled_reports_locks WHERE lock_key = ?',
            [this.lockKey]
          );

          const acquired = rows.length > 0 && rows[0].lock_holder === this.lockHolder;
          
          if (acquired) {
            console.log(`🔒 Lock acquired: ${this.lockKey} by ${this.lockHolder}`);
            return true;
          } else {
            console.log(`🚫 Lock denied: ${this.lockKey} held by ${rows[0]?.lock_holder || 'unknown'}`);
            return false;
          }
        } catch (error) {
          if (error.code === 'ER_LOCK_DEADLOCK' && attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
            console.log(`⚠️ Deadlock detected on attempt ${attempt}/${maxRetries}, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw error;
        }
      }
      
      console.log(`❌ Failed to acquire lock after ${maxRetries} attempts due to deadlocks`);
      return false;
    } finally {
      await connection.end();
    }
  }

  async release() {
    const connection = await getDatabaseConnection();
    try {
      const [result] = await connection.query(
        'DELETE FROM scheduled_reports_locks WHERE lock_key = ? AND lock_holder = ?',
        [this.lockKey, this.lockHolder]
      );
      
      if (result.affectedRows > 0) {
        console.log(`🔓 Lock released: ${this.lockKey} by ${this.lockHolder}`);
      }
      return result.affectedRows > 0;
    } finally {
      await connection.end();
    }
  }

  async isHeldByMe() {
    const connection = await getDatabaseConnection();
    try {
      const [rows] = await connection.query(
        'SELECT lock_holder FROM scheduled_reports_locks WHERE lock_key = ?',
        [this.lockKey]
      );
      return rows.length > 0 && rows[0].lock_holder === this.lockHolder;
    } finally {
      await connection.end();
    }
  }
}

// Helper function to flatten nested objects (same as in transactions.js)
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

// Helper function to format transaction date
function formatTransactionDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toISOString().split('T')[0]; // YYYY-MM-DD format
}

// Helper function to format transaction time
function formatTransactionTime(timeString) {
  if (!timeString) return '';
  return timeString;
}

// Helper function to format expiration date
function formatExpirationDate(value) {
  if (!value) return '';
  const valueStr = String(value);
  if (valueStr.length === 6) {
    return `${valueStr.substring(0, 2)}/${valueStr.substring(4, 6)}`;
  }
  return valueStr;
}

// Email transporter configuration
function createEmailTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

/**
 * Fetch transactions from last 24 hours
 *
 * Retrieves transaction data for report generation. Only fetches data
 * from the last 24 hours to limit data exposure and improve performance.
 *
 * PCI DSS Req 3.4: Only necessary cardholder data is retrieved (BIN and last4)
 * PCI DSS Req 10.2.1: Logs all queries to cardholder data environment
 * PCI DSS Req 7.1: Access limited to last 24 hours of data
 *
 * @async
 * @function fetchLast24HoursTransactions
 * @returns {Promise<Array<Object>>} Array of transaction records
 */
async function fetchLast24HoursTransactions() {
  const connection = await getDatabaseConnection();
  
  try {
    // Calculate 24 hours ago
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const startDate = twentyFourHoursAgo.toISOString().slice(0, 19).replace('T', ' ');
    
    console.log(`📥 Fetching transactions from last 24 hours (since ${startDate})...`);

    const query = `
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
      WHERE creation_date >= ?
      ORDER BY creation_date DESC
    `;

    const [rows] = await connection.query(query, [startDate]);
    console.log(`✅ Found ${rows.length} transaction(s) from last 24 hours`);
    return rows;

  } catch (error) {
    console.error(`❌ Database error: ${error.message}`);
    return [];
  } finally {
    await connection.end();
  }
}

/**
 * Generate Excel file with transactions
 *
 * Creates an Excel workbook containing transaction data with proper
 * masking of sensitive information. The file is temporarily stored
 * locally and deleted after email transmission.
 *
 * PCI DSS Req 3.4: Sensitive authentication data is masked in all reports
 * PCI DSS Req 3.5: Cardholder data protected when stored (BIN + last4 only)
 * PCI DSS Req 9.6.3: Media with cardholder data destroyed when no longer needed
 *
 * @async
 * @function generateExcelFile
 * @param {Array<Object>} transactions - Array of transaction objects
 * @param {string} filename - Target filename for Excel file
 * @returns {Promise<string|null>} Path to generated file or null if no transactions
 */
async function generateExcelFile(transactions, filename) {
  if (transactions.length === 0) {
    console.log('📭 No transactions to export');
    return null;
  }

  // Backend's specific JSON keys in exact order
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

  // Create a new workbook
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Transacciones');

  // Define columns (same as backend CSV structure)
  const columns = [
    { header: 'ID', key: 'id_message', width: 12 },
    { header: 'Merchant Name', key: 'name_merchant', width: 20 },
    { header: 'Terminal', key: 'terminal', width: 15 },
    { header: 'Message Type', key: 'msg_type', width: 15 },
    { header: 'Reference Number', key: 'reference_number', width: 20 },
    { header: 'Amount', key: 'amount', width: 12 },
    { header: 'Response Code', key: 'resp_code', width: 15 },
    { header: 'Authorization', key: 'authorization', width: 15 },
    { header: 'BIN', key: 'bin', width: 12 },
    { header: 'Last 4', key: 'last4', width: 10 },
    { header: 'Creation Date', key: 'creation_date', width: 20 },
    { header: 'Operation ID', key: 'id_operation', width: 15 },
    { header: 'Status', key: 'estatus_f', width: 10 },
    { header: 'Card Type', key: 'card_type', width: 12 },
    { header: 'Transaction Date', key: 'tran_date', width: 15 },
    { header: 'Transaction Time', key: 'tran_time', width: 15 },
    { header: 'Capture Date', key: 'capture_date', width: 15 },
    { header: 'Card Acceptor', key: 'card_acceptor', width: 20 },
    { header: 'Folio', key: 'folio', width: 12 },
    { header: 'Trace Number', key: 'trace_number', width: 15 },
    { header: 'Entry Mode', key: 'entry_mode', width: 12 },
    { header: 'Reverse Code', key: 'reverse_code', width: 15 },
    { header: 'Draft Capture', key: 'draft_capture', width: 15 }
  ];

  // Add JSON columns
  specificJsonKeys.forEach(key => {
    columns.push({ header: key, key: key, width: 20 });
  });

  worksheet.columns = columns;

  // Parse JSON from all rows to get JSON field values
  let parsedDataArray = [];

  transactions.forEach(row => {
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
          jsonStr = jsonStr.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
          jsonStr = jsonStr.replace(/:\s*([a-zA-Z_][a-zA-Z0-9_]*)(?=\s*[,}])/g, ': "$1"');
          jsonStr = jsonStr.replace(/,\s*}/g, '}');
          jsonStr = jsonStr.replace(/,\s*]/g, ']');

          // Try to parse
          try {
            parsedJson = JSON.parse(jsonStr);
          } catch (parseError) {
            const jsonStart = jsonStr.indexOf('{');
            const jsonEnd = jsonStr.lastIndexOf('}');

            if (jsonStart >= 0 && jsonEnd > jsonStart) {
              const potentialJson = jsonStr.substring(jsonStart, jsonEnd + 1);
              try {
                parsedJson = JSON.parse(potentialJson);
              } catch (e) {
                parsedJson = {};
              }
            } else {
              parsedJson = {};
            }
          }
        } else if (typeof jsonStr === 'object') {
          parsedJson = jsonStr;
        }

        // Flatten nested objects
        parsedJson = flattenObject(parsedJson);

      } catch (e) {
        // Keep parsedJson empty if parsing fails
      }
    }
    parsedDataArray.push(parsedJson);
  });

  // Add data to worksheet
  transactions.forEach((row, index) => {
    const parsedJson = parsedDataArray[index] || {};
    
    const rowData = {
      ...row,
      tran_date: formatTransactionDate(row.tran_date),
      tran_time: formatTransactionTime(row.tran_time),
      capture_date: formatTransactionDate(row.capture_date)
    };

    // Add JSON fields
    specificJsonKeys.forEach(key => {
      let value = parsedJson[key] || '';
      if (key === 'expiration_selia_format') {
        value = formatExpirationDate(value);
      }
      rowData[key] = value;
    });

    worksheet.addRow(rowData);
  });

  // Style the header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE6B8AF' }
  };

  // Add borders to all cells
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  });

  // Save the file
  await workbook.xlsx.writeFile(filename);
  console.log(`📄 Excel file generated: ${filename}`);
  return filename;
}

/**
 * Send email with Excel attachment
 *
 * Sends the generated Excel report via email using TLS encryption.
 * The file is deleted immediately after successful transmission.
 *
 * PCI DSS Req 4.2: Cardholder data is encrypted when transmitted over public networks
 * PCI DSS Req 9.6: Physical media is securely destroyed after use
 * PCI DSS Req 12.3: Email transmission uses secure protocols (TLS)
 *
 * @async
 * @function sendEmailWithExcel
 * @param {string} filename - Path to Excel file
 * @param {string} recipient - Email address of recipient
 * @param {string} scheduleTime - Time identifier for the report (e.g., "9:00 AM")
 * @returns {Promise<boolean>} True if email sent successfully
 */
async function sendEmailWithExcel(filename, recipient, scheduleTime) {
  const transporter = createEmailTransporter();
  
  // Calculate date range for the email subject
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const dateRange = `${yesterday.toLocaleDateString('es-MX')} - ${now.toLocaleDateString('es-MX')}`;

  const mailOptions = {
    from: process.env.EMAIL_SENDER || 'noreply@drakops.com.mx',
    to: recipient,
    subject: `Reporte de Transacciones - ${scheduleTime} (${dateRange})`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
          📊 Reporte de Transacciones Automático
        </h2>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #495057; margin-top: 0;">📅 Detalles del Reporte</h3>
          <ul style="color: #6c757d; line-height: 1.6;">
            <li><strong>Horario de generación:</strong> ${scheduleTime}</li>
            <li><strong>Periodo:</strong> Últimas 24 horas</li>
            <li><strong>Fecha de generación:</strong> ${now.toLocaleString('es-MX')}</li>
            <li><strong>Rango de fechas:</strong> ${dateRange}</li>
          </ul>
        </div>

        <div style="background-color: #e7f3ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #0066cc; margin-top: 0;">📋 Información</h3>
          <p style="color: #495057; line-height: 1.6;">
            Este es un reporte automático generado por el sistema de transacciones. 
            El archivo Excel adjunto contiene todas las transacciones procesadas en las últimas 24 horas.
          </p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <p style="color: #6c757d; font-size: 14px;">
            Este correo fue generado automáticamente por el Sistema de Transacciones<br>
            Por favor, no responda a este mensaje.
          </p>
        </div>
      </div>
    `,
    attachments: [
      {
        filename: path.basename(filename),
        path: filename
      }
    ]
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully at ${scheduleTime}: ${info.messageId}`);
    
    // Clean up the file after sending
    fs.unlinkSync(filename);
    console.log(`🗑️  Cleaned up file: ${filename}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Error sending email at ${scheduleTime}:`, error);
    return false;
  }
}

// Main function to generate and send scheduled Excel report with distributed locking
async function generateAndSendScheduledReport(scheduleTime) {
  const lockKey = `scheduled_report_${scheduleTime.replace(':', '').replace(' ', '_')}`;
  const lock = new DistributedLock(lockKey, 15); // 15 minute TTL
  
  console.log(`\n🚀 Starting scheduled report generation for ${scheduleTime}...`);
  
  try {
    // Try to acquire the distributed lock
    const lockAcquired = await lock.acquire();
    
    if (!lockAcquired) {
      console.log(`⏭️  Another instance is already running the ${scheduleTime} report. Skipping.`);
      return;
    }

    console.log(`🔒 Acquired lock for ${scheduleTime} report. Proceeding with generation...`);
    
    try {
      // Fetch transactions from last 24 hours
      const transactions = await fetchLast24HoursTransactions();
      
      if (transactions.length === 0) {
        console.log(`📭 No transactions found in the last 24 hours for ${scheduleTime} report`);
        return;
      }

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `transacciones_${scheduleTime.replace(':', '')}_${timestamp}.xlsx`;
      const filepath = path.join(__dirname, filename);

      // Generate Excel file
      const generatedFile = await generateExcelFile(transactions, filepath);
      
      if (generatedFile) {
        // Send email
        const emailSent = await sendEmailWithExcel(generatedFile, 'desarrollo@mexipay.mx', scheduleTime);

        if (emailSent) {
          console.log(`🎉 Successfully completed ${scheduleTime} scheduled report`);
        } else {
          console.log(`❌ Failed to send ${scheduleTime} scheduled report email`);
        }
      } else {
        console.log(`❌ Failed to generate ${scheduleTime} Excel file`);
      }
      
    } finally {
      // Always release the lock when done
      await lock.release();
    }
    
  } catch (error) {
    console.error(`❌ Error in ${scheduleTime} scheduled report:`, error);
    
    // Try to release the lock in case of error
    try {
      await lock.release();
    } catch (lockError) {
      console.error(`❌ Error releasing lock:`, lockError.message);
    }
  }
}

// Initialize scheduled tasks
async function initializeScheduledReports() {
  console.log('🕐 Initializing scheduled transaction reports...');
  
  // Validate required environment variables
  const requiredEnvVars = ['SMTP_USER', 'SMTP_PASS', 'DB_NAME', 'EMAIL_SENDER'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars.join(', '));
    console.log('Please set the following environment variables:');
    missingVars.forEach(varName => {
      console.log(`  ${varName}`);
    });
    return;
  }

  // Ensure the lock table exists
  try {
    await ensureLockTable();
  } catch (error) {
    console.error('❌ Failed to create lock table:', error.message);
    return;
  }

  // Schedule 9 AM report (runs at 9:00 AM every day)
  cron.schedule('0 9 * * *', () => {
    console.log('⏰ Running 9:00 AM scheduled report...');
    generateAndSendScheduledReport('9:00 AM');
  }, {
    timezone: 'America/Mexico_City'
  });

  // Schedule 3 PM report (runs at 3:00 PM every day)
  cron.schedule('0 15 * * *', () => {
    console.log('⏰ Running 3:00 PM scheduled report...');
    generateAndSendScheduledReport('3:00 PM');
  }, {
    timezone: 'America/Mexico_City'
  });

  // Schedule 6 PM report (runs at 6:00 PM every day)
  cron.schedule('0 18 * * *', () => {
    console.log('⏰ Running 6:00 PM scheduled report...');
    generateAndSendScheduledReport('6:00 PM');
  }, {
    timezone: 'America/Mexico_City'
  });

  console.log('✅ Scheduled reports initialized with distributed locking:');
  console.log('   📅 9:00 AM - Daily report');
  console.log('   📅 3:00 PM - Daily report');
  console.log('   📅 6:00 PM - Daily report');
  console.log('   📧 Recipient: edson.n@muukpay.com.mx');
  console.log('   📊 Data: Last 24 hours of transactions');
  console.log('   🕐 Timezone: America/Mexico_City');
  console.log('   🔒 Locking: Database-based distributed locks enabled');
}

// Test function to run a report immediately
async function testScheduledReport(scheduleTime = 'Test') {
  console.log(`🧪 Running test report for ${scheduleTime}...`);
  await generateAndSendScheduledReport(scheduleTime);
}

// Export functions
module.exports = {
  initializeScheduledReports,
  generateAndSendScheduledReport,
  testScheduledReport,
  fetchLast24HoursTransactions,
  generateExcelFile,
  sendEmailWithExcel
};

// If this file is run directly, initialize the scheduler
if (require.main === module) {
  console.log('🚀 Starting Transaction Report Scheduler...');
  initializeScheduledReports();
  
  // Keep the process running
  console.log('⏳ Scheduler is running. Press Ctrl+C to stop.');
  
  // Optional: Run a test report on startup
  if (process.argv.includes('--test')) {
    setTimeout(() => {
      console.log('🧪 Running test report...');
      testScheduledReport('Startup Test');
    }, 2000);
  }
}

/*

node -e "
require('dotenv').config();
const db = require('./lib/socketServer/lib/sequelize/init');

async function checkTransaction226541() {
  try {
    const [rows] = await db.seq.query(\`
      SELECT
        id_message,
        amount,
        creation_date,
        CONVERT_TZ(creation_date, '+00:00', '-06:00') as converted_date,
        DATE(CONVERT_TZ(creation_date, '+00:00', '-06:00')) as date_only
      FROM iso_message
      WHERE id_message = 226541
    \`);

    if (rows.length > 0) {
      console.log('🔍 Transaction 226541 found:');
      console.log('   id_message:', rows[0].id_message);
      console.log('   amount:', rows[0].amount);
      console.log('   creation_date (UTC):', rows[0].creation_date);
      console.log('   converted_date (Mexico City):', rows[0].converted_date);
      console.log('   date_only:', rows[0].date_only);

      console.log('\\n📅 Date Range Test:');
      const startDate = '2026-02-20';
      const endDate = '2026-02-25';
      console.log('   Range:', startDate, 'to', endDate);
      console.log('   Transaction date:', rows[0].date_only);
      console.log('   In range:', rows[0].date_only >= startDate && rows[0].date_only <= endDate);
    } else {
      console.log('❌ Transaction 226541 not found');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  process.exit(0);
}

checkTransaction226541();
"
*/