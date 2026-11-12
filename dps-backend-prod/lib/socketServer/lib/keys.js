/**
 * PCI DSS 4.0 Requirements Coverage:
 * 
 * 1.1 - Network Security Controls:
 * - SSL/TLS configuration for database connections (lines 15-19)
 * - Environment-based SSL enablement (line 1)
 * 
 * 2.2.1 - Custom Software Development:
 * - Configuration management via environment variables
 * - Connection timeout settings (lines 5-6)
 * 
 * 3.3 - End-User Access to Cardholder Data:
 * - Database credentials from environment variables (lines 7-8)
 * - No direct cardholder data handling
 * 
 * 4.1 - Use Strong Cryptography:
 * - SSL configuration for database connections (lines 15-19)
 * - Security concern: rejectUnauthorized: false (line 17) - vulnerable to MITM
 * 
 * 6.2.3 - Protect Remote Access:
 * - Database host and port configuration (lines 10-11)
 * - Connection limits (line 5)
 * 
 * 8.2.1 - Identification and Authentication:
 * - Database credentials from environment (lines 7-8)
 * - No credential rotation mechanism
 * 
 * 8.3.1 - Access Control:
 * - Connection pooling limits (line 5)
 * - No role-based access control at configuration level
 * 
 * 10.2.1 - Audit Trail:
 * - No audit logging configuration
 * 
 * 10.2.2 - Audit Log Retention:
 * - No audit log retention configuration
 * 
 * 10.2.3 - Audit Trail Review:
 * - No audit trail review mechanism
 * 
 * 11.3.1 - Periodic Testing:
 * - No health check configuration
 * 
 * 12.3.1 - Vulnerability Management:
 * - No vulnerability scanning configuration
 */

// Determine if SSL should be enabled based on environment variable
// Defaults to true if SSL env var is not set
const PROD = (process.env.SSL) ? ((process.env.SSL == 'true') ? true : false) : true   // SE PONE EN TRUE PARA AGREGAR EL SSL A LAS CONSULTA 

// Database connection configuration object
const database = {
    connectionLimit: 50,           // Maximum number of connections in the pool
    //acquireTimeout: 60000,         // Maximum time to acquire a connection from pool (60 seconds)
    //timeout: 60000,                // Maximum time a connection can remain idle before being released (60 seconds)
    user: process.env.DB_USER,     // Database username from environment variable
    password: process.env.DB_PASSWORD, // Database password from environment variable
    database: process.env.DB_NAME,  // Database name from environment variable
    host: process.env.DB_HOST,     // Database host from environment variable
    port: process.env.DB_PORT,     // Database port from environment variable
    timezone: 'local' //process.env.TZ        // Database timezone from environment variable
}

// Add SSL configuration if in production mode
if (PROD) {
    database.ssl = {
        rejectUnauthorized: false  // SSL certificate validation setting
    }
}

// Export database configuration for use in other modules
module.exports = {
    database
}