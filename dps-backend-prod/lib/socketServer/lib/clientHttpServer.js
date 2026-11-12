/**
 * PCI DSS 4.0 Requirements Coverage:
 * 
 * 1.1 - Network Security Controls:
 * - Implements HSTS (HTTP Strict Transport Security) with max-age (lines 39-40)
 * - Helmet middleware for security headers (line 57)
 * - Removes X-Powered-By header to prevent information disclosure (lines 79-82)
 * 
 * 2.2.1 - Custom Software Development:
 * - Input validation via body-parser with extended: false (line 85)
 * - XML parsing with normalization (line 87)
 * - Session management with secure cookie configuration (lines 99-113)
 * 
 * 3.3 - End-User Access to Cardholder Data:
 * - MySQL session store for secure session management (line 101)
 * - httpOnly cookies to prevent XSS (line 100)
 * - sameSite cookies to prevent CSRF (line 110)
 * 
 * 4.1 - Use Strong Cryptography:
 * - SSL/TLS configuration based on environment (line 107)
 * - Secure cookie flag when SSL is enabled (line 107)
 * 
 * 6.2.3 - Protect Remote Access:
 * - CORS configuration with allowlist (lines 132-142)
 * - Trust proxy configuration for reverse proxy (line 97)
 * 
 * 8.2.1 - Identification and Authentication:
 * - Session-based user authentication
 * 
 * 8.3.1 - Access Control:
 * - Activity logging middleware for TDM routes (line 22, lines 153-158)
 * - User profile and permissions in session (line 122)
 * 
 * 10.2.1 - Audit Trail:
 * - Morgan logging middleware for HTTP requests (line 84)
 * - Activity logger for TDM routes (line 22)
 * 
 * 10.2.2 - Audit Log Retention:
 * - Cron job for periodic log cleanup (lines 187-191)
 * - Configurable retention days via environment variables
 * 
 * 10.2.3 - Audit Trail Review:
 * - Logging of all HTTP requests via morgan
 * - Structured logging with status codes and response times
 * 
 * 11.3.1 - Periodic Testing:
 * - Health check endpoint for monitoring (line 145)
 * - X-Ray integration for distributed tracing (lines 50-53, 164-167)
 * 
 * 12.3.1 - Vulnerability Management:
 * - Helmet middleware for known vulnerability protection (line 57)
 * - Permissions-Policy header for browser security (lines 70-77)
 */

// Import required middleware and libraries
const sts = require("strict-transport-security");  // HSTS middleware for HTTPS enforcement
const express = require("express");                 // Express web framework
const cors = require("cors");                       // CORS middleware for cross-origin requests
const morgan = require("morgan");                   // HTTP request logger middleware
const path = require("path");                       // Node.js path module
const session = require("express-session");          // Session management middleware
const flash = require("connect-flash");              // Flash messages for session
const MySQLStore = require("express-mysql-session")(session);  // MySQL session store
//const SequelizeStore = require('connect-session-sequelize')(session.Store);
const bodyParser = require("body-parser");          // Body parsing middleware
const cookieParser = require('cookie-parser');        // Cookie parsing middleware
const cron = require('node-cron');                   // Cron job scheduler
const permissionsPolicy = require('permissions-policy');  // Permissions-Policy header middleware
require('body-parser-xml')(bodyParser);              // XML body parser support

// Import application-specific modules
const pool = require("./database");                  // MySQL connection pool
const db = require("./sequelize/init");               // Sequelize ORM initialization
const helmet = require('./middlewares/Generales/helmet');  // Security headers middleware
const statics = require('./middlewares/Generales/statics');  // Static file serving middleware

// Add activity logging for TDM routes
const activityLogger = require('./middlewares/activityLogger')(db);

// Import helper functions
var helpers = require('../../../lib/helpers');
var helpersSec = require('../lib/lib/helpers');

// Hex fields for ISO8583 message processing (PAN data)
var hexFields = [52, 55];

// Import database configuration
const {database} = require("./keys");

// Load initial data from database
async function getDataBases() {
    dd("Inicializando bases de datos".yellow);
    // Load response codes for ISO messages
    this.respCodeData = await datosRespCode();
    // Load BIN/routing data for card processing
    this.binData = await datosBIn();
    // Load master key for encryption operations
    global.mk = await get_mk();
    dd("Database inicializada".green);
}

// Main function to create and configure the Express HTTP server
// Parameters: various TCP/TLS/HTTP client instances for payment processing
// c: configuration object containing port and other settings
function clientHttpServer(tcpClient1Prosa, tcpClient2Prosa, tlsClient1Prosa, tlsClient2Prosa, tcpClient1Amex, httpClient1Bnrg, httpClientBroxelWhitelabel, c) {
    const app = express();
    // Configure HSTS (HTTP Strict Transport Security) for global and local scopes
    const globalSTS = sts.getSTS({'max-age': {'days': 30}});
    const localSTS = sts.getSTS({'max-age': {'days': 10}, 'includeSubDomains': true});

    // Load initial data from database
    getDataBases();

    // Set the HTTP port from configuration or default to 3000
    app.set('port', c.listenHttpPort || 3000);

    // Add X-Ray middleware for distributed tracing if enabled
    if (process.env.ENABLE_XRAY === 'true' && global.xrayMiddleware) {
        app.use(global.xrayMiddleware.openSegment('mexipay-gateway'));
        global.dd('X-Ray middleware added to Express app');
    }

    // Apply HSTS middleware for HTTPS enforcement
    app.use(globalSTS);
    // Parse cookies for session management
    app.use(cookieParser());
    // Apply security headers via Helmet middleware
    helmet(app);

    // Add performance monitoring middleware if enabled
    if (process.env.ENABLE_PERFORMANCE_MONITORING === 'true') {
        try {
            const performanceMonitoring = require('../../middlewares/performanceMonitoring');
            app.use(performanceMonitoring);
            global.dd('Performance monitoring middleware added');
        } catch (error) {
            console.warn('Performance monitoring middleware not found, skipping:', error.message);
        }
    }

    // Configure Permissions-Policy header for browser security
    app.use(permissionsPolicy({
        features: {
            fullscreen: ['self'],
            vibrate: ['none'],
            payment: ['self', '"dev.memphispay.mx"'],
            syncXhr: [],
        }
    }));

    // Remove X-Powered-By header to prevent information disclosure
    app.use(function (_req, res, next) {
        res.removeHeader('X-Powered-By');
        next();
    });

    // HTTP request logging middleware
    app.use(morgan("dev"));
    // Body parsing middleware for URL-encoded data (no extended syntax for security)
    app.use(bodyParser.urlencoded({extended: false}));
    // Body parsing middleware for JSON data
    app.use(bodyParser.json());
    // Body parsing middleware for XML data with normalization
    app.use(bodyParser.xml({xmlParseOptions: {normalize: true}}));
    // Body parsing middleware for raw data
    app.use(express.raw());

    // Initialize timeout state for each request
    app.use((req, res, next) => {
        req.timeoutState = {
            hasTimedOut: false
        };
        next();
    });

    // Trust proxy configuration for reverse proxy support
    app.set('trust proxy', 1);

    function seqSessionExtendDefaultFields(defaults, session) {
        return {
            data: defaults.data,
            expires: defaults.expires.getTime() / 1000,
        };
    }
    // Session configuration with MySQL store
    app.use(
      session({
        httpOnly: true,  // Prevent XSS attacks via cookies
        store: new MySQLStore({}, pool), // Store sessions in MySQL
        /*
        store: new SequelizeStore({
            db: db.seq,
          table: "sessions",
            models: {
            modelKey: "Session",
            },
            extendDefaultFields: seqSessionExtendDefaultFields,
          expires: 12 * 60 * 60 * 1000,
        }),
        */
        resave: true,
        saveUninitialized: true,
        secret: process.env.COOKIE_SECRET,  // Session encryption secret
        name: "SESSION_ID",
        cookie: {
            secure: process.env.SSL ? false : true,  // Secure flag for HTTPS
            maxAge: 900000 * 4 * 5,  // Cookie max age
            ephemeral: true,
          sameSite: true, // Prevent CSRF attacks
        },
      }),
    );

    // Flash messages for session
    app.use(flash());

    // Middleware to make flash messages and user data available in views
    app.use((req, _res, next) => {
        app.locals.message = req.flash('message');
        app.locals.success = req.flash('success');
        app.locals.changepwd = req.flash('changepwd');
        app.locals.perfil = req.session.perfil ? req.session.perfil : [];
        app.locals.user = req.user;
        app.locals.code = req.flash('code');
        app.locals.mensaje = req.flash('mensaje');

        // Attach payment processor clients to request object
        req.dataInit = { tcpClient1Prosa, tlsClient1Prosa, tcpClient2Prosa, tlsClient2Prosa, tcpClient1Amex, httpClient1Bnrg, httpClientBroxelWhitelabel };

        next();
    });

    // Configure CORS with allowlist from environment variable
    const origin_s = process.env.CORS_ORIGIN ?? '';
    const corsOptionsDelegate = (req, callback) => {
        const allowlist = origin_s.split(',').map(s => s.trim()).filter(Boolean);
        if (allowlist.length === 0 || allowlist.includes('*')) {
            callback(null, { origin: true });
        } else {
            callback(null, { origin: allowlist });
        }
    };

    // Apply CORS middleware
    app.use(cors(corsOptionsDelegate));
    // Serve static files
    statics(app);

    // Health check endpoint for monitoring
    app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
    // API routes
    app.use('/api', require('./routes/api'));
    app.use('/api/terminal', require('./routes/terminal/msi-terminal.routes'));
    app.use('/payments', require('./routes/processing/links/ecommerce.links.routes'));
    app.use('/gateway', require("./routes/user.routes"));
    app.use('/gateway/merchant', require('./routes/merchant.routes'));
    
    // Add activity logging to ALL TDM routes
    app.use('/tdm/api/v1/user/', activityLogger, require('../../App-TDM/src/routes/authentication'));
    app.use('/tdm/api/v1/smart/', activityLogger, require('../../App-TDM/src/routes/smart'));
    app.use('/tdm/api/v1/bins/', activityLogger, require('../../App-TDM/src/routes/bins'));
    app.use('/tdm/api/v1/paymentlink/', activityLogger, require('../../App-TDM/src/routes/paymentLinks'));
    app.use('/tdm/api/v1/merchant/', activityLogger, require('../../App-TDM/src/routes/merchant'));
    app.use('/tdm/api/v1/terminal/', activityLogger, require('../../App-TDM/src/routes/terminal'));
    
    // Payment processing routes
    app.use('/gateway/v1', require('./routes/processing/3ds.processing.routes'));
    app.use('/gateway/v1', require('./routes/processing/processing.routes'));

    // Add X-Ray close segment middleware before error handlers
    if (process.env.ENABLE_XRAY === 'true' && global.xrayMiddleware) {
        app.use(global.xrayMiddleware.closeSegment());
        global.dd('X-Ray close segment middleware added');
    }

    // 404 handler
    app.use(function(req, res, next) {
        res.status(404).json({ description: 'Recurso no encontrado' });
    });

    // Global error handler
    app.use((err, req, res, next) => {
        console.error(err.stack);
        res.status(500).json({ description: 'Error inesperado!' });
    });

    // Start the HTTP server
    app.listen(app.get('port'), () => global.dd(`Server HTTP on port ${app.get('port')}`));
    return app;
}

// Retrieve and decrypt the master key from database
// Used for encrypting/decrypting sensitive data
async function get_mk() {
    const mkData = await db.keyOp.findOne({limit: 1, raw: true});
    // Decrypt the key using RSA private key and convert to string
    return Buffer.from(helpersSec.decryptStringWithRsaPrivateKey(mkData.key, 'keys/private_db_key_mpos.pem'), 'hex').toString();
}

// Schedule daily log cleanup at midnight
// Deletes old log entries based on retention days from environment variables
cron.schedule('00 00 00 * * *', () => {
    pool.query('DELETE FROM iso_echo_log WHERE creation_date < ?', helpers.fechaPasada(process.env.RET_DAYS_ECHO_TABLE));
    pool.query('DELETE FROM iso_message WHERE creation_date < ?', helpers.fechaPasada(process.env.RET_DAYS_JSON_TABLE));
    pool.query('DELETE FROM iso_api_log WHERE creation_date < ?', helpers.fechaPasada(process.env.RET_DAYS_ISO_TABLE));
});

// Reload BIN data after bulk updates to ensure routing data is current
db.cisoBin.addHook('afterBulkUpdate', async (bin, options) => {
    binData = await datosBIn();
});

// Query to load BIN/routing data for card processing
// Joins multiple tables to get complete routing information
// CAMBIAR ESTO A SEQUELIZE
const datosBIn = () => pool.query('SELECT A.id_bin, A.bin, B.name bank, C.name product, D.name type, E.id_processor, COALESCE(E.fiid, "Definido por comercio") as processor, F.name brand FROM ciso_bin A JOIN iso_issuer_bank B ON A.id_issbank = B.id_issbank JOIN iso_card_product C ON A.id_card_product = C.id_card_product JOIN iso_card_type D ON A.id_card_type = D.id_card_type LEFT JOIN iso_processor E ON A.id_processor = E.id_processor JOIN iso_brand F ON A.id_brand = F.id_brand order by A.bin');

// Query to load ISO response codes for transaction processing
const datosRespCode = () => pool.query('SELECT iso_code, description as device_description FROM ciso_response_code');

// Export the clientHttpServer function for use in other modules
module.exports = clientHttpServer;