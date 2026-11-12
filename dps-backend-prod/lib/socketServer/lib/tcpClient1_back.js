/**
 * PCI DSS 4.0 Requirements Coverage:
 * 
 * 1.1 - Network Security Controls:
 * - TCP client connection (line 144) - Note: plain TCP, not TLS
 * - Connection timeout configuration (line 160)
 * 
 * 2.2.1 - Custom Software Development:
 * - Input validation via safe logging (lines 224-235)
 * - Error handling with reconnection logic (lines 383-393)
 * - Timeout handling (lines 396-412)
 * 
 * 3.3 - End-User Access to Cardholder Data:
 * - Safe logging of ISO messages (lines 224-235)
 * - Truncation of sensitive data in logs (line 232)
 * - Conditional logging based on dangerous mode
 * 
 * 4.1 - Use Strong Cryptography:
 * - Security concern: Plain TCP without encryption (line 144)
 * - No TLS/SSL - data transmitted in plaintext
 * 
 * 6.2.3 - Protect Remote Access:
 * - Host and port configuration (lines 145-146)
 * - Connection timeout to prevent hanging (line 160)
 * 
 * 8.2.1 - Identification and Authentication:
 * - No authentication mechanism
 * 
 * 8.3.1 - Access Control:
 * - No role-based access control
 * - Connection denial via flags
 * 
 * 10.2.1 - Audit Trail:
 * - Connection logging (lines 142, 152)
 * - Data receipt logging (lines 252-259)
 * - Echo logging (lines 280-298)
 * - Error logging (lines 391, 397)
 * 
 * 10.2.2 - Audit Log Retention:
 * - Logs sent to console - retention depends on log management
 * 
 * 10.2.3 - Audit Trail Review:
 * - All socket events logged
 * - Echo requests/responses logged
 * 
 * 11.3.1 - Periodic Testing:
 * - Echo mechanism for connection health (lines 129-138)
 * - Echo interval: 30 seconds (line 138)
 * 
 * 12.3.1 - Vulnerability Management:
 * - No input sanitization beyond safe logging
 * - No rate limiting
 */

// Import required modules for TCP socket communication and ISO8583 processing
var iso8583 = require('../../../lib/iso8583');  // ISO8583 base library
var iso8583Queue = require('../../../lib/iso8583-queue');  // ISO8583 message queue
var helpers = require('../../../lib/helpers');  // Helper utilities
var iso8583Packet = require('../../../lib/iso8583-packet');  // ISO8583 packet class
var net = require('net');  // TCP module for socket connections
var tls = require('tls');  // TLS module (imported but not used - plain TCP used instead)
var fs = require('fs');  // File system module
var colors = require('colors');  // Colors for console output
const { Console } = require('console');  // Console module
var EventEmitter = require('events').EventEmitter;  // EventEmitter for event-driven architecture
const { options } = require('./routes/auth.routes');  // Auth routes options

// Global variables for state management
var flags = {};  // Shared flags for connection state
var queue = null;  // Queue instance for ISO8583 messages
var lastMsg = new Date();  // Timestamp of last message for echo monitoring
var rq = '';  // Buffer for reversal messages
var node = '';  // Remote node address string

// User options with timeout defaults for reconnection and error handling
var uOptions = {
  // Delay time before reconnect after timeout error
  timeoutError: 3000,

  // Delay time before reconnect after connection refused error
  timeoutErrorRefused: 10000,

  // Delay before forced connection close
  timeoutSocketTerminate: 5000,

  // Timeout for ISO-host reply
  timeoutHostReply: 35000,

  // Timeout for Echo to ISOClient
  timeoutSendEcho: 15
};

// Sets flag values for connection state management
function setFlags (values) {
  // Merges values into flags object
  for (var key in values) {
    flags[key] = values[key];
  }
}

// Get flag value by key
function getFlag (key) {
  // Returns flag value or null if not found
  var value = flags.hasOwnProperty(key) ? flags[key] : null;
  return value;
}

// ISOClient constructor - creates a TCP client for payment processor communication
// Note: This is a backup version using plain TCP (not TLS)
// options: configuration object containing host, port, and timeout settings
function ISOClient (options) {
  // Initialize the TCP socket
  this.Socket1 = initSocket(options, this);

  // Load ISO8583 logic based on global syntax configuration
  var iso8583Logic = require('../../iso8583/lib/logic/' + global.defaultSyntax + '.js');
  this.logic = new iso8583Logic(this);

  // Initialize the ISO8583 message queue
  queue = new iso8583Queue(options);
  queue.parent = this;

  // Initialize statistics server if configured
  if (options.statServerPort1) {
    var iso8583StatServer = require('../../../lib/iso8583-statserver');
    this.statServer = new iso8583StatServer(options.statServerPort1);
  }

  // Notifies the ISOClient queue that a client has disconnected
  this.hasGone = function (queueMessageId) {
    // Confirm and get queue entry
    var qe = queue.confirm(queueMessageId);

    // Client queue item exists - handle the disconnection
    if (qe) {
      dd(('Warning: client ' + qe.senderName + ' [queue id ' + queueMessageId + '] terminated activity').yellow);
      // Trigger auto-reversal for pending transactions if enabled
      if (!global.c.noAutoReversal) {
        this.logic.hasGone(qe, node);
      }
    // Client queue item does not exist - log warning
    } else {
      dd(('Client with queue id ' + queueMessageId + ' terminated activity. No queue item was found').yellow);
    }

    // Process the queue
    this.Socket1.processQueue();
  }

  // Adds data to the queue for TCP processing
  this.sendData = function (sender, data, params, errReturn) {
    dd('**************************Sending data in httpClient1_back');
    // Default params if not provided
    if (!params) params = {};
 
    // Update last message timestamp
    lastMsg = new Date();
    
    // Try adding message to queue
    try {
      var item = queue.addMessage(sender, data, params, errReturn);
      if (!item) return false;
      dd('New queue item ' + item['id']);

      // Associate queue message ID with sender for tracking
      if (!sender.hasOwnProperty('queueMessageId') || !sender.queueMessageId || params.hasOwnProperty('updateQueueMessageId')) sender.queueMessageId = item['id'];
    } catch (ex) {
      // Log error and end sender on failure
      dd(('Error adding message to queue: ' + ex + '\n' + ex.stack).red);
      sender.end();
    }

    // Pass packet through statistics server if configured
    if (this.statServer) this.statServer.process(item.packet);

    // Process queue with delay if specified, otherwise immediately
    if (params.hasOwnProperty('delayTime') && params.delayTime) {
      setTimeout(function() { this.Socket1.processQueue() }.bind(this), params.delayTime);
    } else {
      this.Socket1.processQueue();
    }
    
   return true;
  }

    // Event listener for termination signal - graceful shutdown
    this.on('terminate', function() {
      // If queue is empty, quit immediately
      if (queue.isEmpty()) {
        dd('Warning: quitting...');
        global.flushAndQuit();
      } else {
        // Wait for queue to empty
        dd('Waiting for the queue to empty');

        this.on('emptyQueue', function() {
          dd('Warning: quitting...');
          global.flushAndQuit();
        });
      }
    }.bind(this));

    // Echo check interval - sends echo request if no activity for 30 seconds
    setInterval(function() {
      // Calculate seconds since last message
      var timmerlog = new Date() - lastMsg;
      var Seconds_from_T1_to_T2 = timmerlog / 1000;
      var Seconds_Between_Dates = Math.abs(Seconds_from_T1_to_T2);
  
      // Send echo if >29 seconds and no retry in progress
      if (Seconds_Between_Dates > 29 && flags.retryDelay == 0) {
        if (typeof this.logic.sendUpstreamEcho == 'function') this.logic.sendUpstreamEcho();
      }
    }.bind(this), 30000);
}

// Initializes TCP socket for connection to payment processor
// Note: Uses plain TCP (not TLS) - data transmitted in plaintext
function initSocket(options, parent) {
  dd(('Connecting to Server Host: ' + options.tcpClientHost1 + ':' + options.tcpClientHost1Port1).yellow);

  // Establish TCP connection
  Socket1 = net.createConnection({
    host: options.tcpClientHost1,
    port: options.tcpClientHost1Port1
  }, function () {
    // Set node address string
    node = (Socket1.remoteAddress + ':' + Socket1.remotePort);
    dd(('Connected to Server Host: ' + node + '!').green);

    // Call onConnect handler if defined
    if (typeof parent.logic.onConnect == 'function') parent.logic.onConnect();

    // Disable Nagle's algorithm for immediate sending
    Socket1.setNoDelay(true);
    // Reset connection state to connected
    Socket1.resetState({'isConnected': Date.now()});
    // Process queued messages
    Socket1.processQueue();

    // Set timeout if configured
    if (Socket1.options.upstreamTimeout) Socket1.setTimeout(Socket1.options.upstreamTimeout * 1000);
  });
  
  // Reset upstream status variables
  Socket1.resetState = function (values) {
    // Default to empty object
    if (!values) values = {};

    // 'Connected' flag is set when ISOClient is connected
    if(!values.hasOwnProperty('isConnected')) values['isConnected'] = 0;

    // 'Shutting down' flag is set when ISOClient is closing the connection
    if(!values.hasOwnProperty('isShuttingDown')) values['isShuttingDown'] = 0;

    // 'retryDelay' counter reflects the amount of seconds before reconnect
    if(!values.hasOwnProperty('retryDelay')) values['retryDelay'] = 0;

    // Update flags with new values
    setFlags(values);
  }

  // Initial state reset
  Socket1.resetState();
  // Attach options to socket
  Socket1.options = options;

  // Queue processor - handles ISO8583 messages and sends them to upstream
  Socket1.processQueue = function () {
    // Reset retry delay
    Socket1.retryDelay = 0;

    // Get queue counts
    var countPending = queue.getPendingCount();
    var countTotal = queue.getCount();

    // Log queue status
    dd('Processing queue [pending ' + countPending + ' / total ' + countTotal + ']');
    if (countTotal > 0) dd('Queue keys dump: ' + queue.getKeys().join(), 'verbose');

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
    if (Socket1._connecting) {
      dd('Waiting for ISOClient to connect...');
      return;
    }

    // Check if connection is shutting down
    if (getFlag('isShuttingDown')) {
      dd('Shutting down the connection. Stay tuned...');
      return;
    }

    // Fetch messages from queue for processing
    var messages = queue.fetchToProcess();

    // Use application buffering with Nagle disabled for performance
    var buf = [];

    // Process each message in the queue
    for (var i in messages) {
      var message = messages[i];
      if (message.comment) dd(message.comment);
      dd('Upstreaming data for ' + message.senderName);

      // Log message content safely
      if (global.c['dangerous']) {
        dd(('[' + helpers.safeLog(message.packet.getRawMessage({
                                                                  header: global.c['useHeader']
                                                              }), ['isoMessage']) + ']'), 'verbose');
        dd(('[' + helpers.safeLog(message.packet.getRawMessage({
                                                                  header: global.c['useHeader']
                                                              }), ['hex']) + ']'), 'verbose');
      } else {
        dd(('[' + helpers.safeLog(message.packet.getRawMessage({
                                                                  header: global.c['useHeader']
                                                              }), ['isoMessage']).substring(0,14) + '...]'), 'verbose');
      }     

      // Add raw message to buffer
      buf.push(message.packet.getRawMessage({
                                              header: global.c['useHeader']
                                            }));
    }
    // Set rq buffer for reversal transactions
    if(message && message.packet.messageTypeId == '0420') rq = Buffer.concat(buf);
    // Send concatenated buffer to upstream payment processor
    Socket1.write(Buffer.concat(buf));
  }

  // Drops a client connection - closes the connection
  Socket1.dropClient = function (client) {
    client.end();
  }

  // 'Data' event handler - triggered when upstream sends data
  Socket1.on('data', function (data) {
    // Log received data
    dd('Got data from ISO-host (' + data.length + 'b)');
    // Log verbose with safe data masking
    if (global.c['dangerous']) {
      dd(('[' + helpers.safeLog(data, ['isoMessage']) + ']').cyan, 'verbose');
      dd(('[' + helpers.safeLog(data, ['hex']) + ']').cyan, 'verbose');
    } else {
      dd(('[' + (helpers.safeLog(data, ['isoMessage'])).substring(0,14) + '...]').cyan, 'verbose');
    }

    // Multi-message flag for handling multiple messages in one packet
    var multiMessage = false;

    // Split data by header if configured
    if (global.c['useHeader']) {
      var packager = new iso8583(global.defaultSyntax);
      packetData = packager.config.processors.splitByHeader(data);

      if (packetData.length > 1) multiMessage = true;
    } else {
      packetData = [data];
    }

    // Process each packet in the data
    for (var index in packetData) {
      // Create ISO8583 packet from data
      var p = new iso8583Packet(packetData[index]);
      // Log multi-message packets
      if (multiMessage) dd(('[' + helpers.safeLog(packetData[index], ['isoMessage']) + ']'), 'verbose');

      var qe = null;

      // If packet parsed successfully
      if (!p.parseError) {
        // Handle echo request (0800)
        if (p.messageTypeId == '0800') {
          dd('ISO Client echo request');
          dd('\n\n' + 'ISO host says ' + p.pretty(), 'verbose');

          // Send echo response if handler exists
          if (typeof parent.logic.replyUpstreamEcho === 'function') {
            var rp = parent.logic.replyUpstreamEcho(p);
            // Write response to upstream
            this.write(rp.getMessage({
              header: global.c['useHeader']
            }));

            // Log response
            dd('ISO Client echo response' + rp.pretty(), 'verbose');
            // Check for logoff command
            if (rp.fields[0] == '0810' && rp.fields[39] == '00' && rp.fields[70] == '002'){
            dd('Logoff from Host....'.red);
            }
            // Save echo log for audit trail
            helpers.saveEchoLog(p.rawData.toString().substring(0,12), rp.fields[0], rp.fields[1], rp.fields[7], rp.fields[11], rp.fields[39], rp.fields[70], node);
          }

          continue;
        }

        // Get active queue entry for this packet
        var qe = queue.getActiveByPacket(p);

        // No active queue item found - log error and trigger reversal
        if (!qe) {
          var lookupFieldsString = global.c['queueMessageKeyFields'].join(',');
          var message = 'INTF_TCP_1 error: ISO host sent data with no proper client connected (client lookup fields: ' + lookupFieldsString + ')! Ignoring...';
          message += '\n\n' + 'ISO host says' + p.pretty();
          dd(message.red);
          parent.logic.hasGone(p, node);
          continue;
        // Found item with dead sender - log error
        } else if (qe.sender.destroyed) {
          message = 'INTF_TCP_1 error: ISO host sent data for closed! Ignoring...';
          message += '\n\n' + 'ISO host says' + p.pretty();
          dd(message.red);
          continue;
        // Found queue entry - confirm and process
        } else {
          var cResult = queue.confirm(qe.id);
          if (!cResult) dd('Warning: queue::confirm() failed to locate the queue message #' + qe.id);
        }

        // Log parsed data
        dd('Parsed data for ' + qe.senderName);
        dd('\n\n' + ' Header: ' + p.rawData.toString().substring(0,12) + '\n' + ' Host  : ' + qe.senderName + p.pretty() , 'verbose');

        // Pass to statistics server if configured
        if (parent.statServer) parent.statServer.process(p);
        
        // Send response to original sender
        qe.sender.reply(p, qe, rq, node);
      } else {
        // Log parse error
        dd(('ISO host: failed to parse ISO host iso8583 packet').red);
        dd(p.parseError, 'verbose');
      }

      // Drop client connection
      if (qe) Socket1.dropClient(qe.sender);
    }

    // Process next queue item
    Socket1.processQueue();
  });

  // 'End' event handler - triggered when connection is about to close
  Socket1.on('end', function () {
    dd('INTF_TCP_1 <end>'.red);
    // Set shutting down flag
    setFlags({'isShuttingDown': Date.now()});
  });

  // 'Close' event handler - triggered when connection is closed
  Socket1.on('close', function () {    
    // Clear termination timer if exists
    if (this.terminateTimer) {
      clearTimeout(this.terminateTimer);
    }

    // Log close event
    dd('INTF_TCP_1 <close>'.red);
    // Drop all active clients
    dd('Dropping all active clients');

    var senders = queue.getActiveSenders();
    for (var i in senders) {
      Socket1.dropClient(senders[i]['sender']);
    }

    // Recovery function to reconnect
    var recover = function() {
      Socket1 = initSocket(options, parent);
      Socket1.processQueue();
    }

    // Set retry delay
    Socket1.resetState({'retryDelay': Socket1.retryDelay});

    // Reconnect immediately or after delay
    if (!Socket1.retryDelay) {
      recover();
    } else {
      setTimeout(recover, Socket1.retryDelay);
    }

    // Reset shutting down flag
    setFlags({'isShuttingDown': 0});
    // Reset last message timestamp
    lastMsg = new Date();
  });

  // 'Error' event handler - triggered on connection errors
  Socket1.on('error', function (err) {
    // Set retry delay based on error type
    if (err = 'ECONNREFUSED') {
      Socket1.retryDelay = uOptions.timeoutErrorRefused;
    } else {
      Socket1.retryDelay = uOptions.timeoutError;
    }

    // Log error and close connection
    dd(('INTF_TCP_1 error ' + err).red);
    this.end();
  });

  // 'Timeout' event handler - triggered on connection timeout
  Socket1.on('timeout', function () {
    dd('INTF_TCP_1 timeout!'.yellow);

    // Set shutting down flag and close connection
    setFlags({'isShuttingDown': Date.now()});
    Socket1.end();
    // Set timer to force termination if close doesn't complete
    Socket1.terminateTimer = setTimeout(function() {
      dd('Forcing INTF_TCP_1 termination'.red);
      this.destroy();
    }.bind(Socket1), uOptions.timeoutSocketTemrinate);

    // Drop all active clients
    var senders = queue.getActiveSenders();
    for (var i in senders) {
      Socket1.dropClient(senders[i]['sender']);
    }

    // Process queue
    Socket1.processQueue();
  });

  return Socket1;
}

// Returns warning if more than LIMIT seconds have passed since timestamp
function delayWarning(timestamp, limit) {
  if ((typeof timestamp == 'undefined') || !timestamp) return false;
  if (!limit) limit = 120;
  limit *= 1000;

  return Date.now() - timestamp > limit;
}

// Inherit from EventEmitter to enable event-driven architecture
ISOClient.prototype.__proto__ = EventEmitter.prototype;

// Export the ISOClient constructor for use in other modules
module.exports = ISOClient;
