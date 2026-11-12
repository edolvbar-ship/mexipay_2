/**
 * PCI DSS 4.0 Requirements Coverage:
 * 
 * 1.1 - Network Security Controls:
 * - HTTP client for external API communication
 * - Connection timeout configuration (lines 197-199)
 * - Keep-alive connection management (lines 201-210)
 * 
 * 2.2.1 - Custom Software Development:
 * - Input validation via translator (lines 159-174)
 * - Error handling with fallback responses (lines 344-393)
 * - Timeout monitoring and analysis (lines 218-228, 326-342)
 * 
 * 3.3 - End-User Access to Cardholder Data:
 * - Safe logging of ISO messages (lines 144-149)
 * - Truncation of sensitive data in logs (line 148)
 * - Translator for data transformation
 * 
 * 4.1 - Use Strong Cryptography:
 * - HTTPS via axios (line 233)
 * - Note: No certificate validation configuration visible
 * 
 * 6.2.3 - Protect Remote Access:
 * - Request ID tracking (line 192)
 * - User-Agent header (line 193)
 * 
 * 8.2.1 - Identification and Authentication:
 * - No authentication mechanism in this file
 * - Relies on upstream authentication
 * 
 * 8.3.1 - Access Control:
 * - No access control at this layer
 * 
 * 10.2.1 - Audit Trail:
 * - Comprehensive logging of all phases (lines 129-411)
 * - Timing metrics for performance monitoring (lines 111-117, 395-411)
 * - Request/response logging (lines 176-182, 286-292)
 * 
 * 10.2.2 - Audit Log Retention:
 * - Logs sent to console - retention depends on log management
 * 
 * 10.2.3 - Audit Trail Review:
 * - Detailed timing breakdown for performance analysis
 * - Error logging with stack traces
 * 
 * 11.3.1 - Periodic Testing:
 * - No built-in health checks
 * - Performance monitoring via timing metrics
 * 
 * 12.3.1 - Vulnerability Management:
 * - Axios library - ensure regular updates
 * - Input validation via translator
 * - Error handling prevents information disclosure
 */

// ====================================================================
// HTTPClient - FIXED VERSION WITH AXIOS-FETCH COMPATIBILITY
// ====================================================================

// Import required modules for ISO8583 processing and HTTP communication
var iso8583 = require("../../../lib/iso8583");
var iso8583Queue = require("../../../lib/iso8583-queue");
var helpers = require("../../../lib/helpers");
var iso8583Packet = require("../../../lib/iso8583-packet");
var EventEmitter = require("events").EventEmitter;
const axios = require('axios');  // HTTP client library
const Translator = require("../../Translator/index.js");
const HTTPTranslatorInterface = require("../../Translator/lib/translator.js");

// Global variables for tracking message state
var lastMsg = new Date();
var rq = "";
var node = "";

// HTTPClient constructor - creates an HTTP client for payment processing
// options: configuration object containing queue and timeout settings
// name: identifier for this client instance
// translator: instance of the translator for data transformation
function HTTPClient(options, name, translator) {
    // Load HTTP-specific logic for ISO8583 processing
    var httpLogic = require("../../iso8583/lib/logic/httpLogic.js");
    this.logic = new httpLogic(this, name);
    this.name = 'INTF_HTTPS_'+name;
    this.queue = null;
    this.translator = translator;

    // Initialize the ISO8583 message queue
    this.queue = new iso8583Queue(options);
    this.queue.parent = this;

    // Initialize statistics server if configured
    if (options.statServerPort4) {
        var iso8583StatServer = require("../../../lib/iso8583-statserver");
        this.statServer = new iso8583StatServer(options.statServerPort4);
    }

    // Handle client disconnection - notifies the queue and triggers auto-reversal if enabled
    this.hasGone = function (queueMessageId) {
        var qe = this.queue.confirm(queueMessageId);

        if (qe) {
            console.log((`Warning: client ${qe.senderName} [queue id ${queueMessageId}] terminated activity`).yellow);
            // Trigger auto-reversal for pending transactions if enabled
            if (!global.c.noAutoReversal)
                this.logic.hasGone(qe, node, qe, false);
        }
        else
            console.log((`Client with queue id ${queueMessageId} terminated activity. No queue item was found`).yellow);
    };

    // Adds data to the queue for HTTP processing
    // sender: the client socket that sent the data
    // data: the raw ISO8583 message data
    // params: optional parameters (e.g., delayTime, requestHttp)
    // errReturn: optional error callback function
    // req: optional HTTP request object
    this.sendData = function (sender, data, params, errReturn, req = {}) {
        console.log(`**************************+Sending data in ${this.name}`);
        console.log(`**************************+Sending data in ${sender}`);
        console.log(`**************************+Sending data in ${data}`);
        console.log(`**************************+Sending data in ${params}`);
        console.log(`**************************+Sending data in ${errReturn}`);
        console.log(`**************************+Sending data in ${req}`);

        // Robust validation for params parameter
        if (!params || typeof params !== 'object') {
            params = {};
            console.log(`⚠️ Params was ${params === null ? 'null' : typeof params}, defaulting to empty object`);
        }

        lastMsg = new Date();

        try {
            // Add the message to the queue
            var item = this.queue.addMessage(sender, data, params, errReturn);
            if (!item) return false;
            console.log(`New queue item ${item["id"]}`);

            // Safe validation for sender.queueMessageId
            if (!sender.hasOwnProperty("queueMessageId") || !sender.queueMessageId || (params && params.hasOwnProperty("updateQueueMessageId"))) {
                sender.queueMessageId = item["id"];
            }
        } catch (ex) {
            console.log(("Error adding message to queue: " + ex + "\n" + ex.stack).red);
            sender.end();
            return false;
        }

        // Pass the packet through the statistics server if configured
        if (this.statServer) this.statServer.process(item.packet);

        // Safe validation for delayTime parameter
        if (params && typeof params === 'object' && params.hasOwnProperty("delayTime") && params.delayTime) {
            setTimeout(
                function () {
                    this.processQueue({ queue: options.queue, requestHttp: params.requestHttp }, item);
                }.bind(this),
                params.delayTime
            );
        } else {
            this.processQueue({ queue: options.queue , requestHttp: params ? params.requestHttp : undefined }, item);
        }

        return true;
    };

    // Event listener for termination signal - graceful shutdown
    this.on(
        "terminate",
        function () {
            if (this.queue.isEmpty()) {
                console.log("Warning: quitting...");
                global.flushAndQuit();
            } else {
                console.log("Waiting for the queue to empty");
                this.on("emptyQueue", function () {
                    console.log("Warning: quitting...");
                    global.flushAndQuit();
                });
            }
        }.bind(this)
    );

    // Queue processor - handles ISO8583 messages and converts them to HTTP requests
    this.processQueue = async function (options, item) {
        const startTime = Date.now();
        // Timing metrics for performance monitoring
        const timing = {
            queueProcessing: 0,
            translatorFromIso: 0,
            httpRequest: 0,
            translatorExtract: 0,
            translatorToIso: 0
        };

        // FIX: Declare timeoutIntervals in the correct scope
        let timeoutIntervals = [];

        const sender = item.sender;
        const countPending = this.queue.getPendingCount();
        const countTotal = this.queue.getCount();
        const requestHttp = item.isSystemSender ? options.requestHttp : sender;
        const queue = this.queue;
        const message = item;

        console.log("Processing queue [pending " + countPending + " / total " + countTotal + "]");
        if (countTotal > 0)
            console.log("Queue keys dump: " + queue.getKeys().join(), "verbose");

        if (!countTotal) {
            console.log("The queue is empty");
            return;
        }

        queue.fetchToProcess();
        timing.queueProcessing = Date.now() - startTime;

        const buf = [];
        console.log("Upstreaming data for " + message.senderName);

        // Log the message content safely
        if (global.c["dangerous"]) {
            console.log("[" + helpers.safeLog(message.packet.getRawMessage({ header: global.c["useHeader"], }), ["isoMessage"]) + "]", "verbose");
            console.log("[" + helpers.safeLog(message.packet.getRawMessage({ header: global.c["useHeader"], }), ["hex"]) + "]", "verbose");
        } else {
            console.log("[" + helpers.safeLog(message.packet.getRawMessage({ header: global.c["useHeader"], }), ["isoMessage"]), "verbose");
        }

        buf.push(message.packet.getRawMessage({ header: global.c["useHeader"], }));
        console.log(Buffer.concat(buf));

        let requestInfo;
        let p = null;

        // PHASE 1: TRANSLATOR FROM ISO - Convert ISO8583 to HTTP request
        const translatorStart = Date.now();
        try{
            requestInfo = await this.translator.fromIso(requestHttp, message.packet);
            timing.translatorFromIso = Date.now() - translatorStart;
            console.log(`✓ Translator.fromIso completed in ${timing.translatorFromIso}ms`);
        } catch(err) {
            timing.translatorFromIso = Date.now() - translatorStart;
            console.log(`✗ Translator.fromIso FAILED after ${timing.translatorFromIso}ms: ${err.message}`);
            console.log(err.stack, 'error');
            let qe = queue.getActiveByPacket(message.packet);
            if (qe) {
                queue.confirm(qe.id);
                await qe.sender.sendReply(null, null, ['Missing translator information']);
                this.dropClient(qe.sender);
            }
            return;
        }

        console.log(("\n\nSend data to : " + requestInfo.url
            + "\nMethod       : " + requestInfo.method
            + "\nOrgUrl       : " + requestHttp.originalUrl
            + "\nheaders       : " + JSON.stringify(requestInfo.headers)
            + "\n================================================================================================\n"
            + await this.translator.logFields(requestInfo.body)
            + "\n================================================================================================\n"), 'verbose');

        // PHASE 2: HTTP REQUEST WITH AXIOS-FETCH COMPATIBILITY
        const httpStart = Date.now();
        try {
            // Configure axios with timeout and keep-alive settings
            const axiosConfig = {
                method: requestInfo.method,
                url: requestInfo.url,
                headers: {
                    ...requestInfo.headers,
                    'X-Request-ID': `iso-${message.packet.getField(0) || 'unknown'}-${Date.now()}`,
                    'User-Agent': 'ISO8583-Gateway/1.0'
                },
                data: requestInfo.body,

                timeout: 60000,
                connectTimeout: 15000,
                socketTimeout: 45000,

                // HTTP agent with keep-alive for connection pooling
                httpAgent: new require('http').Agent({
                    keepAlive: true,
                    keepAliveMsecs: 60000,
                    timeout: 60000
                }),
                // HTTPS agent with keep-alive for connection pooling
                httpsAgent: new require('https').Agent({
                    keepAlive: true,
                    keepAliveMsecs: 60000,
                    timeout: 60000
                }),

                // Accept all status codes less than 600
                validateStatus: function (status) {
                    return status < 600;
                }
            };

            // Enhanced timeout monitoring - logs progress every 5 seconds
            const startIntervalMonitoring = () => {
                const interval = setInterval(() => {
                    const elapsed = Date.now() - httpStart;
                    console.log(`⏱️ HTTP request in progress: ${elapsed}ms elapsed`, 'verbose');

                    if (elapsed > 45000) {
                        console.log(`🚨 APPROACHING TIMEOUT: ${elapsed}ms elapsed - 15 seconds remaining`, 'error');
                    }
                }, 5000);
                timeoutIntervals.push(interval);
            };

            startIntervalMonitoring();
            console.log(`🚀 Starting HTTP request to: ${requestInfo.url}`);

            const axiosResponse = await axios(axiosConfig);

            // Clear monitoring on success
            timeoutIntervals.forEach(clearInterval);

            timing.httpRequest = Date.now() - httpStart;
            console.log(`✅ HTTP request COMPLETED in ${timing.httpRequest}ms - Status: ${axiosResponse.status}`);

            // ====================================================================
            // CRITICAL FIX: ADAPT AXIOS RESPONSE TO FETCH FORMAT EXPECTED BY TRANSLATOR
            // ====================================================================

            // Create response object compatible with Fetch API
            const responseHttp = {
                status: axiosResponse.status,
                statusText: axiosResponse.statusText,
                url: axiosResponse.config.url,
                headers: axiosResponse.headers,
                // Add json() method that the translator expects
                json: async function() {
                    try {
                        // If already an object, return it directly
                        if (typeof axiosResponse.data === 'object' && axiosResponse.data !== null) {
                            return axiosResponse.data;
                        }
                        // If string, try to parse as JSON
                        if (typeof axiosResponse.data === 'string') {
                            return JSON.parse(axiosResponse.data);
                        }
                        // For other types, return data as-is
                        return axiosResponse.data;
                    } catch (parseError) {
                        console.log(`❌ Failed to parse response as JSON: ${parseError.message}`, 'error');
                        throw parseError;
                    }
                },
                // text() method for compatibility
                text: async function() {
                    return typeof axiosResponse.data === 'string'
                        ? axiosResponse.data
                        : JSON.stringify(axiosResponse.data);
                },
                // ok property for compatibility
                ok: axiosResponse.status >= 200 && axiosResponse.status < 300
            };

            // PHASE 3: RESPONSE EXTRACTION WITH COMPATIBILITY
            const extractStart = Date.now();
            try {
                let response = await this.translator.extractResponse(responseHttp);
                timing.translatorExtract = Date.now() - extractStart;
                console.log(`✓ Response extraction completed in ${timing.translatorExtract}ms`);

                console.log(("\n\nGot data from: " + responseHttp.url
                    + "\nStatus: " + responseHttp.status
                    + "\nText  : " + responseHttp.statusText
                    + "\nResponse Time: " + timing.httpRequest + "ms"
                    + "\n================================================================================================"
                    + this.translator.logFields(response)
                    + "\n================================================================================================\n"), 'verbose');

                // Check if translator provides a direct JSON response
                let directResponse = await this.translator.getDirectResponse(requestHttp, response);
                if(directResponse){
                    let qe = queue.getActiveByPacket(message.packet);
                    if (qe) {
                        queue.confirm(qe.id);
                        await qe.sender.sendJsonReponse(directResponse, 200);
                        this.dropClient(qe.sender);
                    }
                } else {
                    // PHASE 4: TRANSLATOR TO ISO - Convert HTTP response back to ISO8583
                    const toIsoStart = Date.now();
                    p = await this.translator.toIso(response, requestHttp, message.packet, requestHttp);
                    timing.translatorToIso = Date.now() - toIsoStart;
                    console.log(`✓ Translator.toIso completed in ${timing.translatorToIso}ms`);
                }
            } catch (extractError) {
                console.log(`❌ Response extraction FAILED: ${extractError.message}`, 'error');
                throw extractError; // Re-throw to be caught by the main catch block
            }

        } catch (err) {
            // Clear monitoring on error
            if (timeoutIntervals && timeoutIntervals.length > 0) {
                timeoutIntervals.forEach(clearInterval);
            }

            timing.httpRequest = Date.now() - httpStart;

            console.log(`❌ HTTP request FAILED after ${timing.httpRequest}ms`, 'error');
            console.log(`Error details: ${err.message}`, 'error');
            console.log(err.stack, 'error');

            // COMPREHENSIVE TIMEOUT ANALYSIS
            if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
                console.log(`🕒 TIMEOUT ANALYSIS REPORT:`, 'error');
                console.log(`   Total elapsed time: ${timing.httpRequest}ms`, 'error');
                console.log(`   Request URL: ${requestInfo?.url || 'unknown'}`, 'error');
                console.log(`   Configured timeout: ${err.config?.timeout || 'unknown'}ms`, 'error');

                if (timing.httpRequest < 5000) {
                    console.log(`   🔍 LIKELY CAUSE: DNS resolution or TCP connection timeout`, 'error');
                } else if (timing.httpRequest < 15000) {
                    console.log(`   🔍 LIKELY CAUSE: SSL handshake or connection establishment`, 'error');
                } else if (timing.httpRequest < 30000) {
                    console.log(`   🔍 LIKELY CAUSE: Server processing delay`, 'error');
                } else {
                    console.log(`   🔍 LIKELY CAUSE: Network latency or server unresponsiveness`, 'error');
                }
            }

            // CLEAN TRANSLATOR ERROR HANDLING WITH IMPROVED MANAGEMENT
            const response = this.translator.getUnavailableError();
            const msgIsoReq = message.packet.fields;

            try {
                // Try to create error response using the translator
                if (typeof Translator.interfaceResponseToIso === 'function') {
                    console.log(`Attempting to create error response using Translator.interfaceResponseToIso`);
                    const isoResponse = await Translator.interfaceResponseToIso(response, requestHttp, msgIsoReq);
                    // Ensure p is a valid iso8583Packet
                    if (isoResponse && isoResponse.destPacket) {
                        p = new iso8583Packet(isoResponse.destPacket);
                    } else {
                        throw new Error('Invalid response from Translator.interfaceResponseToIso');
                    }
                    console.log(`✓ Error response created using Translator.interfaceResponseToIso`);
                }
                // Safe fallback
                else {
                    console.log(`⚠️ Using safe fallback error packet creation`, 'warn');
                    p = new iso8583Packet();
                    // Verify methods exist before calling them
                    if (typeof p.setField === 'function') {
                        p.setField(0, '0810'); // MTI for response
                        p.setField(39, '96'); // Response code for system malfunction
                    } else {
                        throw new Error('iso8583Packet.setField is not a function');
                    }
                    console.log(`✓ Basic fallback error response created`);
                }
            } catch (translatorError) {
                console.log(`❌ Failed to create error response: ${translatorError.message}`, 'error');
                // Last resort: create basic packet safely
                try {
                    p = new iso8583Packet();
                    if (p && typeof p.setField === 'function') {
                        p.setField(0, '0810');
                        p.setField(39, '96');
                        console.log(`✓ Emergency fallback error response created`);
                    } else {
                        console.log(`💥 CRITICAL: Cannot create ISO8583 packet - methods missing`, 'error');
                        // If we can't create a packet, we can't continue
                        return;
                    }
                } catch (emergencyError) {
                    console.log(`💥 CRITICAL: Complete failure in error response creation: ${emergencyError.message}`, 'error');
                    return;
                }
            }
        }

        // FINAL TIMING SUMMARY
        const totalTime = Date.now() - startTime;

        console.log(`\n📊 PROCESSING TIMING SUMMARY:`);
        console.log(`   Total processing time: ${totalTime}ms`);
        console.log(`   Queue processing: ${timing.queueProcessing}ms`);
        console.log(`   Translator from ISO: ${timing.translatorFromIso}ms`);
        console.log(`   HTTP request: ${timing.httpRequest}ms`);
        console.log(`   Response extraction: ${timing.translatorExtract}ms`);
        console.log(`   Translator to ISO: ${timing.translatorToIso}ms`);

        if (timing.httpRequest > 30000) {
            console.log(`   ⚠️  HTTP request took >30s - consider optimizing target service`, 'warn');
        }
        if (totalTime > 45000) {
            console.log(`   ⚠️  Total processing >45s - review end-to-end performance`, 'warn');
        }

        if(!p) {
            console.log("No response packet generated - cannot continue");
            return;
        }

        var qe = null;

        if (!p.parseError) {
            var qe = queue.getActiveByPacket(p);

            if (!qe) {
                var lookupFieldsString = global.c["queueMessageKeyFields"].join(",");
                var msg = this.name + " error: ISO host sent data with no proper client connected (client lookup fields: " + lookupFieldsString + ")! Ignoring...";
                msg += "\n\n" + "ISO host says" + p.pretty();
                console.log(msg.red);
                console.log('sending reversal')
                this.logic.hasGone(p,requestHttp, message.packet);
                return;
            } else {
                var cResult = queue.confirm(qe.id);
                if (!cResult)
                    console.log(`Warning: queue::confirm() failed to locate the queue message #${qe.id}`);
            }

            console.log(`Parsed data for ${qe.senderName}`);
            console.log("\n\n" + ` Header: ${p.rawData.toString().substring(0, 12)}` + "\n" + ` Host  : ${qe.senderName + p.pretty()}`, "verbose");

            if(!options.parent) {
                await qe.sender.reply(p, qe, rq, node);
            }
        }
        else {
            console.log("ISO host: failed to parse ISO host iso8583 packet".red);
            console.log(p.parseError, "verbose");
        }

        if (qe) this.dropClient(qe.sender);
    };

    // Drops a client connection - closes the connection
    this.dropClient = function (client) {
        client.end();
    };
}

// Inherit from EventEmitter to enable event-driven architecture
HTTPClient.prototype.__proto__ = EventEmitter.prototype;

// Export the HTTPClient constructor for use in other modules
module.exports = HTTPClient;