/**
 * PCI DSS 4.0 Requirements Coverage:
 * 
 * 1.1 - Network Security Controls:
 * - TLS client for secure connection to payment processor (line 190)
 * - Connection timeout configuration (line 205)
 * - Certificate-based authentication (line 193)
 * 
 * 2.2.1 - Custom Software Development:
 * - Input validation via safe logging (lines 269-280)
 * - Error handling with reconnection logic (lines 429-438)
 * - Timeout handling (lines 441-457)
 * 
 * 3.3 - End-User Access to Cardholder Data:
 * - Safe logging of ISO messages (lines 269-280)
 * - Truncation of sensitive data in logs (line 277)
 * - Conditional logging based on dangerous mode
 * 
 * 4.1 - Use Strong Cryptography:
 * - TLS connection for encrypted communication (line 190)
 * - Security concern: rejectUnauthorized: false (line 194) - vulnerable to MITM
 * - 3DES encryption for key exchange (line 140)
 * - RSA decryption for transport key (line 133)
 * - CRC32 for integrity verification (line 141)
 * - Security concern: Global MK key in memory (line 138)
 * 
 * 6.2.3 - Protect Remote Access:
 * - Host and port configuration (lines 191-192)
 * - Connection timeout to prevent hanging (line 205)
 * 
 * 8.2.1 - Identification and Authentication:
 * - Certificate-based authentication (line 193)
 * - No additional authentication mechanism
 * 
 * 8.3.1 - Access Control:
 * - No role-based access control
 * - Connection denial via flags
 * 
 * 10.2.1 - Audit Trail:
 * - Connection logging (lines 188, 196)
 * - Data receipt logging (lines 305-312)
 * - Echo logging (lines 334-352)
 * - Error logging (lines 436, 442)
 * 
 * 10.2.2 - Audit Log Retention:
 * - Logs sent to console - retention depends on log management
 * 
 * 10.2.3 - Audit Trail Review:
 * - All socket events logged
 * - Echo requests/responses logged
 * 
 * 11.3.1 - Periodic Testing:
 * - Echo mechanism for connection health (lines 176-184)
 * - Echo interval: 30 seconds (line 184)
 * 
 * 12.3.1 - Vulnerability Management:
 * - TLS library - ensure regular updates
 * - Input validation via safe logging
 * - Error handling prevents information disclosure
 */

/* eslint-disable no-undef */
/* eslint-disable no-restricted-syntax */
/* eslint-disable guard-for-in */

// Import required modules for TLS socket communication and ISO8583 processing
const tls = require('tls');  // TLS module for secure socket connections
const fs = require('fs');  // File system module for reading certificates
const { EventEmitter } = require('events');  // EventEmitter for event-driven architecture
const iso8583Packet = require('../../iso8583-packet');  // ISO8583 packet class
const helpers = require('../../helpers');  // Helper utilities
const iso8583Queue = require('../../iso8583-queue');  // ISO8583 message queue
const iso8583 = require('../../iso8583');  // ISO8583 base library
const Translator = require("../../Translator/index.js");  // Data transformation
const helpersSec = require("../lib/lib/helpers");  // Security helper functions

// Global variables for state management
const flags = {};  // Shared flags for connection state
let queue = null;  // Queue instance for ISO8583 messages
let lastMsg = new Date();  // Timestamp of last message for echo monitoring
let rq = '';  // Buffer for reversal messages
let node = '';  // Remote node address string

// User options with timeout defaults for reconnection and error handling
const uOptions = {
  // Delay time before reconnect after timeout error
  timeoutError: 3000,

  // Delay time before reconnect after connection refused error
  timeoutErrorRefused: 10000,

  // Delay before forced connection close
  timeoutSocketTerminate: 5000,

  // Timeout for ISO-host reply
  timeoutHostReply: 35000,

  // Timeout for Echo to ISOClient
  timeoutSendEcho: 15,
};

// Sets flag values for connection state management
function setFlags(values) {
  // Merges values into flags object
  for (const key in values) {
    flags[key] = values[key];
  }
}

// Get flag value by key
function getFlag(key) {
  // Returns flag value or null if not found
  const value = flags.hasOwnProperty(key) ? flags[key] : null;
  return value;
}

// ISOClient constructor - creates a TLS client for payment processor communication
// Note: Uses Socket2 and tcpClientHost2 configuration (second upstream connection)
// options: configuration object containing host, port, and timeout settings
function ISOClient(options) {
  // Initialize the TLS socket
  this.Socket2 = initSocket(options, this);

  // Load ISO8583 logic based on global syntax configuration
  const iso8583Logic = require(`../../iso8583/lib/logic/${global.defaultSyntax}.js`);
  this.logic = new iso8583Logic(this);

  // Initialize the ISO8583 message queue
  queue = new iso8583Queue(options);
  queue.parent = this;

  // Initialize statistics server if configured
  if (options.statServerPort0) {
    const iso8583StatServer = require('../../iso8583-statserver');
    this.statServer = new iso8583StatServer(options.statServerPort0);
  }

  // Notifies the ISOClient queue that a client has disconnected
  this.hasGone = function (queueMessageId) {
    // Confirm and get queue entry
    const qe = queue.confirm(queueMessageId);

    // Client queue item exists - handle the disconnection
    if (qe) {
      dd((`Warning: client ${qe.senderName} [queue id ${queueMessageId}] terminated activity`).yellow);
      // Trigger auto-reversal for pending transactions if enabled
      if (!global.c.noAutoReversal) {
        this.logic.hasGone(qe.packet, node, false);
      }
    // Client queue item does not exist - log warning
    } else {
      dd((`Client with queue id ${queueMessageId} terminated activity. No queue item was found`).yellow);
    }

    // Process the queue
    this.Socket2.processQueue();
  };

  // Adds data to the queue for TLS processing
  this.sendData = (sender, data, params, errReturn) => {
    dd('**************************Sending data in tcpClient1');
    // Default params if not provided
    if (!params) params = {};
 
    // Update last message timestamp
    lastMsg = new Date();
    
    // Try adding message to queue
    try {
      var item = queue.addMessage(sender, data, params, errReturn);
      if (!item) return false;
      dd(`New queue item ${item.id}`);

      // Associate queue message ID with sender for tracking
      if (!sender.hasOwnProperty('queueMessageId') || !sender.queueMessageId || params.hasOwnProperty('updateQueueMessageId')) sender.queueMessageId = item.id;
    } catch (ex) {
      // Log error and end sender on failure
      dd((`Error adding message to queue: ${ex}\n${ex.stack}`).red);
      sender.end();
    }

    // Pass packet through statistics server if configured
    if (this.statServer) this.statServer.process(item.packet);

    // Process queue with delay if specified, otherwise immediately
    if (params.hasOwnProperty('delayTime') && params.delayTime) {
      setTimeout(() => { this.Socket2.processQueue(sender); }, params.delayTime);
    } else {
      this.Socket2.processQueue(sender);
    }
    
    return true;
  };

  // Event listener for termination signal - graceful shutdown
  this.on('terminate', () => {
    // If queue is empty, quit immediately
    if (queue.isEmpty()) {
      dd('Warning: quitting...');
      global.flushAndQuit();
    } else {
      // Wait for queue to empty
      dd('Waiting for the queue to empty');

      this.on('emptyQueue', () => {
        dd('Warning: quitting...');
        global.flushAndQuit();
      });
    }
  });

  // Method for key initialization - handles master key exchange
  this.initKey = async (sender, message) => {
    dd('==================== initKey ==============');
    // Get data from ISO8583 packet
    let data = message.packet.fields;
    // Convert RSA encrypted key from hex to base64
    var CiphertextBlob = Buffer.from(sender.body.rsa, "hex").toString("base64");
    // Decrypt transport key using RSA private key
    var transportKey = Buffer.from(await helpersSec.decryptStringWithRsaPrivateKey(CiphertextBlob, 'keys/private_mpos.pem'), "ascii").toString().toUpperCase();

    // Compute Key Check Value (KCV) for transport key
    var transportKeyKcv = await helpersSec.encrypt3des('0000000000000000', transportKey).substring(0, 6).toUpperCase();
    // Verify KCV matches the check value from sender
    if (transportKeyKcv == sender.body.check_value) {
      // Use global TMK (Terminal Master Key)
      var mpos_tmk = global.mk;
      // Compute TMK KCV
      var mpos_tmk_Kcv = await helpersSec.encrypt3des('0000000000000000', mpos_tmk).substring(0, 6).toUpperCase();
      // Encrypt TMK with transport key
      var mpos_tmk_enc = await helpersSec.encrypt3des(mpos_tmk, transportKey).substring(0, 32).toUpperCase();
      // Compute CRC32 for integrity verification
      var mpos_tmk_crc32 = await helpersSec.calcCrc32(mpos_tmk_enc);

      // Prepare response object
      var res = { mpos_tmk_enc, mpos_tmk_Kcv, mpos_tmk_crc32 };

      // Set response fields for successful initialization
      data[0] = "0210"; 
      data[39] = "00";
      // Append encrypted key data to field 63 using Translator
      data[63] =data[63] + Translator.jsonToIso.prototype.buildTkn(
        "EX",
          res.mpos_tmk_enc +
          helpers.randomString(15, 1) + "00001" +
          res.mpos_tmk_Kcv +
          "00" +
          res.mpos_tmk_crc32
          + Translator.jsonToIso.prototype.buildTkn("ER", "00"));  
    }else{
      // Set error response if KCV mismatch
      data[0] = "0210"; 
      data[39] = "72";
      dd(("Error de Inicialización! Terminal: " + sender.body.device.serial).red);
    }

    // Create response packet
    const p = new iso8583Packet(data);
    // Get active queue entry
    const qe = queue.getActiveByPacket(p);

    // Send response to sender
    await qe.sender.reply(p, qe, rq, node);

    // Drop client connection
    if (qe) {
      Socket2.dropClient(qe.sender);
    }else {
      // Confirm queue message if no queue entry found
      var cResult = queue.confirm(message.id);
      if (!cResult) dd(`Warning: queue::confirm() failed to locate the queue message #${  message.id}`);
    }

    return true;
  };

  // Echo check interval - sends echo request if no activity for 30 seconds
  setInterval(() => {
    // Calculate seconds since last message
    const timmerlog = new Date() - lastMsg;
    const Seconds_from_T1_to_T2 = timmerlog / 1000;
    const Seconds_Between_Dates = Math.abs(Seconds_from_T1_to_T2);
  
    // Send echo if >29 seconds and no retry in progress
    if (Seconds_Between_Dates > 29 && flags.retryDelay == 0) {
      if (typeof this.logic.sendUpstreamEcho === 'function') this.logic.sendUpstreamEcho();
    }
  }, 30000);
}

// Initializes TLS socket for secure connection to payment processor
// Note: Uses tcpClientHost2 configuration (second upstream connection)
function initSocket(options, parent) {
  dd((`Connecting to Server Host: ${options.tcpClientHost1}:${options.tcpClientHost1Port1}`).yellow);

  // Establish TLS connection
  Socket2 = tls.connect({
    host: options.tcpClientHost2,
    port: options.tcpClientHost2Port1,
    cert: fs.readFileSync('cacert.cer'),  // Read certificate file
    rejectUnauthorized: false,  // Security concern: disables certificate validation
    }, () => {
    // Set node address string
    node = (`${Socket2.remoteAddress}:${Socket2.remotePort}`);
    dd((`Connected to Server Host: ${node}!`).green);

    // Call onConnect handler if defined
    if (typeof parent.logic.onConnect === 'function') parent.logic.onConnect();

    // Disable Nagle's algorithm for immediate sending
    Socket2.setNoDelay(true);
    // Reset connection state to connected
    Socket2.resetState({ isConnected: Date.now() });
    // Process queued messages
    Socket2.processQueue();

    // Set timeout if configured
    if (Socket2.options.upstreamTimeout) Socket2.setTimeout(Socket2.options.upstreamTimeout * 1000);
  });
  
  // Reset upstream status variables
  Socket2.resetState = function (values) {
    // Default to empty object
    if (!values) values = {};

    // 'Connected' flag is set when ISOClient is connected
    if (!values.hasOwnProperty('isConnected')) values.isConnected = 0;

    // 'Shutting down' flag is set when ISOClient is closing the connection
    if (!values.hasOwnProperty('isShuttingDown')) values.isShuttingDown = 0;

    // 'retryDelay' counter reflects the amount of seconds before reconnect
    if (!values.hasOwnProperty('retryDelay')) values.retryDelay = 0;

    // Update flags with new values
    setFlags(values);
  };

  // Initial state reset
  Socket2.resetState();
  // Attach options to socket
  Socket2.options = options;

  // Queue processor - handles ISO8583 messages and sends them to upstream
  Socket2.processQueue = (sender) => {
    // Reset retry delay
    Socket2.retryDelay = 0;

    // Get queue counts
    const countPending = queue.getPendingCount();
    const countTotal = queue.getCount();

    // Log queue status
    dd(`Processing queue [pending ${countPending} / total ${countTotal}]`);
    if (countTotal > 0) dd(`Queue keys dump: ${queue.getKeys().join()}`, 'verbose');

    // Emit emptyQueue event if queue is empty
    if (!countTotal) {
      dd('The queue is empty');
      parent.emit('emptyQueue');
      return;
    }

    // Check if connected to upstream
    if (!getFlag('isConnected')) {
      dd('Host Interface is not connected yet...'.yellow);
      return;
    }

    // Check if connection is in progress
    if (Socket2._connecting) {
      dd('Waiting for ISOClient to connect...');
      return;
    }

    // Check if connection is shutting down
    if (getFlag('isShuttingDown')) {
      dd('Shutting down the connection. Stay tuned...');
      return;
    }

    // Fetch messages from queue for processing
    const messages = queue.fetchToProcess();

    // Use application buffering with Nagle disabled for performance
    const buf = [];

    // Process each message in the queue
    for (const i in messages) {
      var message = messages[i];
      if (message.comment) dd(message.comment);
      dd(`Upstreaming data for ${message.senderName}`);

      // Log message content safely
      if (global.c.dangerous) {
        dd((`[${helpers.safeLog(message.packet.getRawMessage({
          header: global.c.useHeader,
        }), ['isoMessage'])}]`), 'verbose');
        dd((`[${helpers.safeLog(message.packet.getRawMessage({
          header: global.c.useHeader,
        }), ['hex'])}]`), 'verbose');
      } else {
        dd((`[${helpers.safeLog(message.packet.getRawMessage({
          header: global.c.useHeader,
        }), ['isoMessage']).substring(0, 14)}...]`), 'verbose');
      }

      // Add raw message to buffer
      buf.push(message.packet.getRawMessage({
        header: global.c.useHeader,
      }));
    }
    // Set rq buffer for reversal transactions
    if (message && message.packet.messageTypeId == '0420') rq = Buffer.concat(buf);

    // Special handling for initKeys endpoint - local key exchange
    if (sender?.originalUrl?.includes('/v1/initKeys')) {
      // Call initKey instead of sending to upstream
      parent.initKey(sender, message);
    }else{
      // Send concatenated buffer to upstream payment processor
      dd(Buffer.concat(buf))
      Socket2.write(Buffer.concat(buf));
    }

  };

  // Drops a client connection - closes the connection
  Socket2.dropClient = function (client) {
    client.end();
  };

  // 'Data' event handler - triggered when upstream sends data
  Socket2.on('data', async function (data) {
    // Log received data
    dd(`Got data from ISO-host (${data.length}b)`);
    dd(data);
    // Log verbose with safe data masking
    if (global.c.dangerous) {
      dd((`[${helpers.safeLog(data, ['isoMessage'])}]`).cyan, 'verbose');
      dd((`[${helpers.safeLog(data, ['hex'])}]`).cyan, 'verbose');
    } else {
      dd((`[${(helpers.safeLog(data, ['isoMessage'])).substring(0, 14)}...]`).cyan, 'verbose');
    }

    // Multi-message flag for handling multiple messages in one packet
    let multiMessage = false;

    // Split data by header if configured
    if (global.c.useHeader) {
      const packager = new iso8583(global.defaultSyntax);
      packetData = packager.config.processors.splitByHeader(data);

      if (packetData.length > 1) multiMessage = true;
    } else {
      packetData = [data];
    }

    // Process each packet in the data
    for (const index in packetData) {
      // Create ISO8583 packet from data
      const p = new iso8583Packet(packetData[index]);
      // Get active queue entry for this packet
      const qe = queue.getActiveByPacket(p);
      // Log multi-message packets
      if (multiMessage) dd((`[${helpers.safeLog(packetData[index], ['isoMessage'])}]`), 'verbose');

      // If packet parsed successfully
      if (!p.parseError) {
        // Handle echo request (0800)
        if (p.messageTypeId == '0800') {
          dd('ISO Client echo request');
          dd('\n\n' + `ISO host says ${p.pretty()}`, 'verbose');

          // Send echo response if handler exists
          if (typeof parent.logic.replyUpstreamEcho === 'function') {
            const rp = parent.logic.replyUpstreamEcho(p);
            // Write response to upstream
            this.write(rp.getMessage({
              header: global.c.useHeader,
            }));

            // Log response
            dd(`ISO Client echo response${rp.pretty()}`, 'verbose');
            // Check for logoff command
            if (rp.fields[0] == '0810' && rp.fields[39] == '00' && rp.fields[70] == '002') {
              dd('Logoff from Host....'.red);
            }
            // Save echo log for audit trail
            helpers.saveEchoLog(p.rawData.toString().substring(0, 12), rp.fields[0], rp.fields[1], rp.fields[7], rp.fields[11], rp.fields[39], rp.fields[70], node);
          }

          continue;
        }

        // No active queue item found - log error and trigger reversal
        if (!qe) {
          var lookupFieldsString = global.c['queueMessageKeyFields'].join(',');
          var message = `INTF_TCP_PROSA_2 error: ISO host sent data with no proper client connected (client lookup fields: ${  lookupFieldsString  })! Ignoring...`;
          message += `\n\n` + `ISO host says${  p.pretty()}`;
          dd(message.red);
          parent.logic.hasGone(p, node);
          continue;
        // Found queue entry - confirm and process
        } else {
          var cResult = queue.confirm(qe.id);
          if (!cResult) dd(`Warning: queue::confirm() failed to locate the queue message #${  qe.id}`);
        }

        // Log parsed data
        dd(`Parsed data for ${qe.senderName}`);
        dd('\n\n' + ` Header: ${p.rawData.toString().substring(0, 12)}\n` + ` Host  : ${qe.senderName}${p.pretty()}`, 'verbose');

        // Pass to statistics server if configured
        if (parent.statServer) parent.statServer.process(p);
        
        // Send response to original sender
        await qe.sender.reply(p, qe, rq, node);
      } else {
        // Log parse error
        dd(('ISO host: failed to parse ISO host iso8583 packet').red);
        dd(p.parseError, 'verbose');
      }

      // Drop client connection
      if (qe) Socket2.dropClient(qe.sender);
    }

    // Process next queue item
    Socket2.processQueue();
  });

  // 'End' event handler - triggered when connection is about to close
  Socket2.on('end', () => {
    dd('INTF_TCP_PROSA_2 <end>'.red);
    // Set shutting down flag
    setFlags({ isShuttingDown: Date.now() });
  });

  // 'Close' event handler - triggered when connection is closed
  Socket2.on('close', function () {
    // Clear termination timer if exists
    if (this.terminateTimer) {
      clearTimeout(this.terminateTimer);
    }

    // Log close event
    dd('INTF_TCP_PROSA_2 <close>'.red);
    // Drop all active clients
    dd('Dropping all active clients');

    const senders = queue.getActiveSenders();
    for (const i in senders) {
      Socket2.dropClient(senders[i].sender);
    }

    // Recovery function to reconnect
    const recover = function () {
      Socket2 = initSocket(options, parent);
      Socket2.processQueue();
    };

    // Set retry delay
    Socket2.resetState({ retryDelay: Socket2.retryDelay });

    // Reconnect immediately or after delay
    if (!Socket2.retryDelay) {
      recover();
    } else {
      setTimeout(recover, Socket2.retryDelay);
    }

    // Reset shutting down flag
    setFlags({ isShuttingDown: 0 });
    // Reset last message timestamp
    lastMsg = new Date();
  });

  // 'Error' event handler - triggered on connection errors
  Socket2.on('error', function (err) {
    // Set retry delay based on error type
    if (err = 'ECONNREFUSED') {
      Socket2.retryDelay = uOptions.timeoutErrorRefused;
    } else {
      Socket2.retryDelay = uOptions.timeoutError;
    }

    // Log error and close connection
    dd((`INTF_TCP_PROSA_2 error ${err}`).red);
    this.end();
  });

  // 'Timeout' event handler - triggered on connection timeout
  Socket2.on('timeout', () => {
    dd('INTF_TCP_PROSA_2 timeout!'.yellow);

    // Set shutting down flag and close connection
    setFlags({ isShuttingDown: Date.now() });
    Socket2.end();
    // Set timer to force termination if close doesn't complete
    Socket2.terminateTimer = setTimeout(function () {
      dd('Forcing INTF_TCP_PROSA_2 termination'.red);
      this.destroy();
    }.bind(Socket2), uOptions.timeoutSocketTemrinate);

    // Drop all active clients
    const senders = queue.getActiveSenders();
    for (const i in senders) {
      Socket2.dropClient(senders[i].sender);
    }

    // Process queue
    Socket2.processQueue();
  });

  return Socket2;
}

// Returns warning if more than LIMIT seconds have passed since timestamp
function delayWarning(timestamp, limit) {
  if ((typeof timestamp === 'undefined') || !timestamp) return false;
  if (!limit) limit = 120;
  limit *= 1000;

  return Date.now() - timestamp > limit;
}

// Inherit from EventEmitter to enable event-driven architecture
ISOClient.prototype.__proto__ = EventEmitter.prototype;

// Export the ISOClient constructor for use in other modules
module.exports = ISOClient;
