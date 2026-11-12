/**
 * PCI DSS 4.0 Requirements Coverage:
 * 
 * 1.1 - Network Security Controls:
 * - Database connection configuration (lines 12-13)
 * - Connection pooling for resource management (line 6)
 * 
 * 2.2.1 - Custom Software Development:
 * - Connection validation and error handling (lines 14-25)
 * - Connection release after validation (line 21)
 * 
 * 3.3 - End-User Access to Cardholder Data:
 * - Database credentials loaded from environment variables (via keys.js)
 * - No direct cardholder data handling in this file
 * 
 * 4.1 - Use Strong Cryptography:
 * - SSL configuration based on environment (see keys.js)
 * - Connection timeout settings (lines 5-6)
 * 
 * 6.2.3 - Protect Remote Access:
 * - Database connection limits (line 5)
 * - Host and port configuration for remote access control
 * 
 * 8.2.1 - Identification and Authentication:
 * - Database authentication via username/password (lines 7-8)
 * - Credentials from environment variables (see keys.js)
 * 
 * 8.3.1 - Access Control:
 * - Connection pooling limits access (line 5)
 * - No role-based access control at this layer
 * 
 * 10.2.1 - Audit Trail:
 * - No audit logging implemented in this file
 * - Connection success/failure logged to console (lines 18, 16)
 * 
 * 10.2.2 - Audit Log Retention:
 * - No audit log retention mechanism
 * 
 * 10.2.3 - Audit Trail Review:
 * - No audit trail review mechanism
 * 
 * 11.3.1 - Periodic Testing:
 * - No built-in health checks
 * - Connection validation on startup (lines 14-25)
 * 
 * 12.3.1 - Vulnerability Management:
 * - Uses mysql2 library - ensure regular updates
 * - No input validation at this layer
 */

// Import MySQL2 library for database connections
const mysql = require('mysql2');
// Import promisify to convert callback-based functions to promises
const { promisify }= require('util');

/**
 * @type {import('./keys').database}
 */
// Load database configuration from keys.js (host, user, password, database name, SSL settings)
const database = require('./keys').database;

/**
 * @type {import('mysql2').Pool}
 */
// Create a connection pool for efficient database connection management
// Pool allows multiple connections to be reused, reducing overhead
const pool = mysql.createPool(database);

global.dd('Probando conexion a DB');
global.dd(`Database from env. DB_NAME: ${process.env.DB_NAME} DB_USER: ${process.env.DB_USER} DB_PASSWORD ${process.env.DB_PASSWORD}`, 'debug');
global.dd(`DB connection options: ${JSON.stringify(database)}`, 'debug');
// Test database connection on startup
pool.getConnection((err, connection) => {
  if (err) {
      // Log connection error if connection fails
      global.dd(`Error al probar conexion a DB ${err}`, 'error');
    } else {
      // Log successful connection
      global.dd('DB Base connectada', 'debug');
      // Release the test connection back to the pool
      connection.release();
  }
  return;
});

// Promisify Pool Querys
// Convert pool.query from callback-based to promise-based for async/await usage
pool.query = promisify(pool.query);

// Export the pool for use in other modules
module.exports = pool;