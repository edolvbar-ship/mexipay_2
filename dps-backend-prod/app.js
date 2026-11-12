// require('./lib/helpers/envLoader');
require('dotenv').config();

// Set project-wide default timezone globally
process.env.TZ = 'America/Mexico_City';

const { argv } = require('optimist');
var cfgParams = require('./lib/cfgParams/index');
var winston = require('winston');
require('winston-logstash');
require('winston-daily-rotate-file');
const AWS = require('aws-sdk');
var WinstonCloudWatch = require('winston-cloudwatch');
var fs = require('fs');
var { S3StreamLogger } = require('s3-streamlogger');

var logger = false;
var fileTransport = null;

// Initialize X-Ray if enabled
if (process.env.ENABLE_XRAY === 'true') {
    try {
        const AWSXRay = require('aws-xray-sdk');
        const expressMiddleware = AWSXRay.express;
        
        // Initialize X-Ray (newer SDK doesn't need explicit init)
        // AWSXRay.init(); // Not needed in newer versions
        
        // We'll add the middleware after express is initialized
        global.xrayMiddleware = expressMiddleware;
        console.log('X-Ray initialized successfully');
    } catch (error) {
        console.error('Failed to initialize X-Ray:', error.message);
    }
}


// invoicer requirement
const cron = require('node-cron');
const { Worker } = require('worker_threads');

// Available runtime parameters configuration
global.validParams = require('./parameters.js').params;

// This one displays configuration help
String.prototype.repeat = function (num) {
    return new Array(num + 1).join(this);
}

const c = {};

// Load command line parameters
for (let name in argv) {
    if (name === '_' || name.startsWith('$')) continue;

    const val = cfgParams.read(name, argv[name]);

    val !== null ? c[name] = val : (
        console.log(`Configuration error: invalid parameter ${name}. See node app.js --help for available parameters.`),
            process.exit(0)
    );
}

// Read file config
if (c.c) {
    if (!fs.existsSync(c.c)) {
        console.error(`Configuration file ${c.c} does not exist!`);
        process.exit(0);
    }

    const cfgData = JSON.parse(fs.readFileSync(c.c, 'utf8'));

    for (let name in cfgData) {
        const val = cfgParams.read(name, cfgData[name]);

        val !== null ? c[name] = val : (
            console.error(`Configuration file: invalid parameter ${name}. See node app.js --help for available parameters.`),
                process.exit(0)
        );
    }
}

const defaults = {};

// Applying defaults
for (let name in validParams) {
    const { default: defaultValue } = validParams[name];
    if (typeof defaultValue !== undefined && !c.hasOwnProperty(name)) {
        c[name] = cfgParams.read(name, defaultValue);
        defaults[name] = true;
    }
}

// Assigning global properties
Object.assign(global, { c, dd, generateErrorMsg, generateLogMsg, defaultSyntax: c.hostConfig , s3_stream: null});

// Update the listening port if it exists in the environment variables
if (process.env.PORT) c.listenHttpPort = process.env.PORT;

// Display help screen
if (c.help) {
    cfgParams.showHelp();

    process.exit(0);
}

// Display help in JSON format
if (c.helpJson) {
    cfgParams.showHelpJSON();

    process.exit(0);
}

// Checking parameters
if ((!c.tcpClientHost1 && !c.tlsClientHost1 && !c.tlsClientHostAmex1 && !c.httpClientHost1 && !c.tcpServerPort1 && !c.tlsServerPort1 && !c.testClients && !c.echoServerPort)
    || (c.tcpClientHost1 && (!c.tcpClientHost1Port1 || (!c.listenPort && !c.listenHttpPort)))
    || (c.tlsClientHost1 && (!c.tlsClientHost1Port1 || (!c.listenPort && !c.listenHttpPort)))
    || (c.tlsClientHostAmex1 && (!c.tlsClientHostAmex1Port1 || (!c.listenPort && !c.listenHttpPort)))
    || (c.httpClientHost1 && (!c.listenPort && !c.listenHttpPort))) {

    console.log("Usage app.js [options]");
    console.log("Run app.js --help to see help");

    process.exit(0);
} else if (c.testClients && !c.testTargetHost) {
    console.log("No test target host specified. Aborting");

    process.exit(0);
} else if (c.testClients && (!c.testTargetPort1)) {
    console.log("No test target port specified. Aborting");

    process.exit(0);
} else if (c.logstashHost && !c.logstashPort) {
    console.log("No Logstash port specified. Aborting");

    process.exit(0);
}

// Overrides
if (c.overrides) {
    const params = c.overrides.split(',');
    global.overrides = {};

    for (let param of params) {
        let [key, type, length] = param.split(':');
        let item = { type };

        if (length !== 'undefined')
            item.length = parseInt(length, 10);

        global.overrides[key] = item;
    }
}

// Header format
if (c.headerFormat) {
    const params = c.headerFormat.split(',');
    global.headerFormat = params.map(param => {
        const [name, type, length, defaultValue] = param.split(':');
        const item = { name, type, length: parseInt(length, 10) };

        if (defaultValue !== 'undefined')
            item.default = defaultValue;

        return item;
    });
}

// Setting up Winston debug
c.debugLevel = 'warn';
if (c.v) c.debugLevel = 'info';
if (c.vv) c.debugLevel = 'debug';

if (c.debugLevel) {
    var transports = [];

    const { combine, timestamp, printf } = winston.format;
    const myFormat = printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`);

    // Set up console logging
    if (!c.silent) {
        transports.push(new winston.transports.Console(
            {
                level: c.debugLevel,
                format: combine(
                    winston.format.colorize(),
                    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                    myFormat
                )
            }));
    }

    // Set up logging into file
    if (c.logFile) {
        fileTransport = new winston.transports.DailyRotateFile({
            filename: c.logFile + `_` + '%DATE%',
            dirname: `${__dirname}/logs/`,
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            extension: '.log',
            maxSize: `${process.env.RET_SIZE_LOG_MB}` + 'm',
            maxFiles: `${process.env.RET_DAYS_LOG}` + 'd',
            level: c.debugLevel,
            format: combine(
                timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                myFormat
            )
        });

        fileTransport.on('flush', function() {
            process.exit(0);
        });

        transports.push(fileTransport);
    }

    // Set up logging into S3 file
    if (process.env.AWS_BUCKET != "") {
        try {
            var s3_stream = new S3StreamLogger({
                bucket: process.env.AWS_BUCKET,
                access_key_id: process.env.AWS_ACCESS_KEY_ID,
                secret_access_key: process.env.AWS_SECRET_ACCESS_KEY,
                server_side_encryption: true,
                compress: true,
                max_file_size: process.env.AWS_MAX_FILE_SIZE,
                upload_every: process.env.AWS_UPLOAD_EVERY,
                rotate_every: process.env.AWS_ROTATE_EVERY,
                region: process.env.AWS_REGION
            })


            s3_stream.on('error', err => console.error(err));

            fileTransport = new (winston.transports.Stream)({
                stream: s3_stream,
                level: c.debugLevel,
                format: combine(
                    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                    myFormat
                )
            });

            fileTransport.on('error', err => console.error(err));

            Object.assign(global, { s3_stream });
            transports.push(fileTransport);
        } catch (error) {
            console.error('Error S3StreamLogger: ', error);
        }
    }

    if (process.env.AWS_REGION != "") {
        AWS.config.update({ region: process.env.AWS_REGION });
        winston.add(
        new WinstonCloudWatch({
            cloudWatchLogs: new AWS.CloudWatchLogs(),
            logGroupName: "logging",
            logStreamName: "tx",
        }),
        );
    }

    // Logstash
    if (c.logstashHost) {
        ls = new (winston.transports.Logstash)(
            {
                host: c.logstashHost,
                port: c.logstashPort,
                node_name: c.logstashNode,
                level: c.debugLevel
            });

        ls.on('error', function (error) {
            dd('Winston Logstash error: ' + error);
        });

        transports.push(ls);
    }
    logger = winston.createLogger({
        transports: transports,
        levels: winston.config.syslog.levels,
        level: c.debugLevel
    });
    logger.info(`Activated logging transports: [${transports.map((v) => {return v.name}).join(', ')}]`);
    
    logger.exitOnError = false;
}

// c.debugLevel output
function dd(msg, level = 'info') {
    if (!logger || !msg) return;

    //const safeMsg = `${helpers.safeLog(msg)}`;
    const safeMsg = `${msg}`;
    logger.log(level, safeMsg);
}

function generateErrorMsg(obj) {
    const errorMsg = JSON.stringify(obj, null, 2);

    if (errorMsg) dd_error(errorMsg);
    else console.error('Error converting object to string');
}

function generateLogMsg(obj) {
    const logMsg = JSON.stringify(obj, null, 2);

    if (logMsg) logger.log('info', logMsg);
    else console.error('Error converting object to string');
}

function dd_error(msg) {
    logger.error(msg);
}

dd('Important: starting...'.green);
dd('Remote host configuration name: ' + c.hostConfig);

// SIMPLE SOCKET CONTROL: Only create payment sockets if PORT is 3001
const shouldCreateSockets = process.env.PORT === '3001';
dd(`Socket creation: ${shouldCreateSockets} (PORT: ${process.env.PORT})`);

// Start the TCP Client servers
// Initialize servers
let tcpServer1, tcpServer2, tlsServer1, tlsServer2, tlsServerAmex1, httpServerHost1, serverHttp, httpClientBroxelWhitelabel;

// Helper function to display server running messages
function logServerStart(type, server, port) {
    dd(`ISO-8583 ${type} Server ${server} RAW is now running on port ${port}`.green);
}

// Helper function to restore server stats
function restoreServerStats(server) {
    if (server.statServer && c.statDumpFile && fs.existsSync(c.statDumpFile))
        server.statServer.restore(JSON.parse(fs.readFileSync(c.statDumpFile)));
}

var socketServer = require('./lib/socketServer/index');
// Only initialize payment sockets if PORT is 3001
if ((c.tcpClientHost1 || c.tcpServerPort1 || c.tcpServerPort2 || c.tlsClientHost1 || c.tlsServerPort1 || c.tlsServerPort2 || c.tlsClientHostAmex1 || c.httpClientHost1) && shouldCreateSockets) {
    tcpServer1 = !c.tcpServerPort1 ? new socketServer.tcpClient1(c) : new socketServer.tcpServer1(c);
    tcpServer2 = !c.tcpServerPort2 ? new socketServer.tcpClient2(c) : new socketServer.tcpServer2(c);
    tlsServer1 = !c.tlsServerPort1 ? new socketServer.tlsClient1(c) : new socketServer.tlsServer1(c);
    tlsServer2 = !c.tlsServerPort2 ? new socketServer.tlsClient2(c) : new socketServer.tlsServer2(c);
    tlsServerAmex1 = !c.tlsServerPortAmex1 ? new socketServer.tcpClientAmex1(c) : new socketServer.tlsServerAmex1(c);

    if (c.tcpLocalServerPort1) logServerStart('TCP', 1, c.tcpLocalServerPort1);
    if (c.tcpLocalServerPort2) logServerStart('TCP', 2, c.tcpLocalServerPort2);
    if (c.tlsLocalServerPort1) logServerStart('TLS', 1, c.tlsLocalServerPort1);
    if (c.tlsLocalServerPort2) logServerStart('TLS', 2, c.tlsLocalServerPort2);
    if (c.tlsLocalServerPortAmex1) logServerStart('TLS AMEX', 1, c.tlsLocalServerPortAmex1);
    if (c.httpClientHost1) httpServerHost1 = new socketServer.httpClient1(c);

    
    if (c.broxelGWUrl){
        const { tranWhitelabel } = require('./lib/Translator/index.js');
        httpClientBroxelWhitelabel = new socketServer.httpClient(c, 'BROXEL_WHITELABEL', new tranWhitelabel(c.broxelGWUrl));
    }   

    [tcpServer1, tcpServer2, tlsServer1, tlsServer2, tlsServerAmex1].forEach(restoreServerStats);

    dd("✓ Payment sockets initialized - this instance handles payment processing");
} else if (c.tcpClientHost1 || c.tcpServerPort1 || c.tcpServerPort2 || c.tlsClientHost1 || c.tlsServerPort1 || c.tlsServerPort2 || c.tlsClientHostAmex1 || c.httpClientHost1) {
    dd("✗ Payment sockets SKIPPED - this instance does not handle payment processing");

    // Set all socket servers to null to avoid undefined references
    tcpServer1 = null;
    tcpServer2 = null;
    tlsServer1 = null;
    tlsServer2 = null;
    tlsServerAmex1 = null;
    httpServerHost1 = null;
    httpClientBroxelWhitelabel = null;
}

// HTTP server should always be created (for API requests)
if (c.listenHttpPort) {
    serverHttp = new socketServer.clientHttpServer(tcpServer1, tcpServer2, tlsServer1, tlsServer2, tlsServerAmex1, httpServerHost1, httpClientBroxelWhitelabel, c);
    dd(`HTTP server listening on port ${c.listenHttpPort}`);
}

if (c.echoServerPort || c.testClients) var testSuite = require('./lib/testSuite');

// Start test server and perform tests
if (c.echoServerPort) {
    // Run local echo server
    var echoServer = new testSuite.echoServer(c, dd).listen(c.echoServerPort);
    dd("Echo server is now running on port " + c.echoServerPort);
}

// Run local clients
if (c.testClients) {
    setTimeout(function () {
        var testClients = [];
        for (var i = 1; i < c.testClients + 1; i++) {
            testClients.push(new testSuite.testClient1(dd).start(c, i));
            testClients.push(new testSuite.tlsTestClient1(dd).start(c, i));
        }
    }, 30000);
}

// Pidfile
if (c.pidFile) {
    fs.writeFile(c.pidFile, process.pid, function (err) {
        if (err) dd(err);
    });
}


// Rotate winston logs
winstonRotate = function (fileTransport) {
  const fullname = path.join(fileTransport.dirname, fileTransport._getFile(false));

  function reopen() {
    if (fileTransport._stream) {
      fileTransport._stream.end();
      fileTransport._stream.destroySoon();
    }

    const stream = fs.createWriteStream(fullname, fileTransport.options);
    stream.setMaxListeners(Infinity);

    fileTransport._size = 0;
    fileTransport._stream = stream;

    fileTransport.once('flush', () => {
      fileTransport.opening = false;
      fileTransport.emit('open', fullname);
    });

    fileTransport.flush();
  }

  return reopen();
};

// Signals
process.on('SIGINT', function () {
    dd('Warning: got SIGINT.', 'warning');
    gracefulQuit();
});

process.on('SIGTERM', function () {
    dd('Warning: got SIGTERM.', 'warning');
    gracefulQuit();
});

process.on('SIGHUP', function () {
    dd('Warning: got SIGHUP.', 'warning');

    if (tcpServer1 && tcpServer1.statServer) tcpServer1.statServer.reset();
    if (tlsServer1 && tlsServer1.statServer) tlsServer1.statServer.reset();
    if (tcpServer2 && tcpServer2.statServer) tcpServer2.statServer.reset();
    if (tlsServer2 && tlsServer2.statServer) tlsServer2.statServer.reset();
    if (tlsServerAmex1 && tlsServerAmex1.statServer) tlsServerAmex1.statServer.reset();
    if (fileTransport) winstonRotate(fileTransport);
});

// On Exit
process.on('exit', function (code) {
    if (c.pidFile) {
        // Clear pid file
        fs.writeFile(c.pidFile, '', function (err) {
            if (err) dd(err, 'error');
        });
    }

    // Dump stats only if sockets were created
    if (shouldCreateSockets) {
        if (tcpServer1 && tcpServer1.statServer && c.statDumpFile) {
            fs.writeFileSync(c.statDumpFile, JSON.stringify(tcpServer1.statServer.dump()));
        }
        if (tlsServer1 && tlsServer1.statServer && c.statDumpFile) {
            fs.writeFileSync(c.statDumpFile, JSON.stringify(tlsServer1.statServer.dump()));
        }
        if (tcpServer2 && tcpServer2.statServer && c.statDumpFile) {
            fs.writeFileSync(c.statDumpFile, JSON.stringify(tcpServer2.statServer.dump()));
        }
        if (tlsServer2 && tlsServer2.statServer && c.statDumpFile) {
            fs.writeFileSync(c.statDumpFile, JSON.stringify(tlsServer2.statServer.dump()));
        }
        if (tlsServerAmex1 && tlsServerAmex1.statServer && c.statDumpFile) {
            fs.writeFileSync(c.statDumpFile, JSON.stringify(tlsServerAmex1.statServer.dump()));
        }
    }
});

function gracefulQuit() {
    dd('Initiating graceful shutdown...');

    // Only shutdown socket servers if they were created
    if (shouldCreateSockets) {
        // If there are upstream servers -- let them pick a proper moment then quit
        if (tcpServer1) {
            if (serverSocket1) serverSocket1.deny();
            tcpServer1.emit('terminate');
        }

        if (tcpServer2) {
            if (serverSocket4) serverSocket4.deny();
            tcpServer2.emit('terminate');
        }

        if (tlsServer1) {
            if (serverSocket2) serverSocket2.deny();
            tlsServer1.emit('terminate');
        }

        if (tlsServer2) {
            if (serverSocket5) serverSocket5.deny();
            tlsServer2.emit('terminate');
        }

        if (tlsServerAmex1) {
            if (serverSocket3) serverSocket3.deny();
            tlsServerAmex1.emit('terminate');
        }

        dd('Payment socket servers shutdown initiated');
    } else {
        dd('No payment sockets to shutdown');
    }

    dd('Graceful shutdown completed, exiting...');
    global.flushAndQuit();
}

global.flushAndQuit = function () {
    process.exit(0);
}

const runBackgroundTask = () => {
    const worker = new Worker('./backgroundProcess.js');

    worker.on('message', (message) => {
        dd( `Mensaje del worker: ${message}` );
    });

    worker.on('error', (error) => {
        dd(error.stack, 'error');
    });

    worker.on('exit', (code) => {
        if (code !== 0) {
            dd( `El worker ha terminado con código de error: ${code}` , 'error');
        } else {
            dd( 'El worker ha finalizado correctamente' );
        }
    });

};

// Initialize scheduled transaction reports
const scheduledReportsActive = process.env.SCHEDULED_REPORTS_ACTIVE || 'false';

if( scheduledReportsActive == 'true' ){
    try {
        const scheduledReports = require('./lib/socketServer/lib/services/scheduled-reports.service');
        // Initialize asynchronously
        scheduledReports.initializeScheduledReports().then(() => {
            dd('✅ Scheduled transaction reports initialized (9 AM, 3 PM, 6 PM) with distributed locking');
        }).catch(error => {
            dd('❌ Failed to initialize scheduled reports:', error.message);
        });
    } catch (error) {
        dd('❌ Failed to load scheduled reports module:', error.message);
    }
} else {
    dd('ℹ️  Scheduled reports are disabled. Set SCHEDULED_REPORTS_ACTIVE=true to enable.'.yellow);
}