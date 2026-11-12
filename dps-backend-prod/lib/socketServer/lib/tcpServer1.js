/**
 * PCI DSS 4.0 Requirements Coverage:
 * 
 * 1.1 - Network Security Controls:
 * - TCP server for upstream connections (line 120)
 * - Connection timeout configuration (line 127)
 * - Single connection enforcement (lines 121-125)
 * 
 * 2.2.1 - Custom Software Development:
 * - Input validation via safe logging (lines 321-332)
 * - Error handling with connection cleanup (lines 227-236)
 * - Timeout handling (lines 239-255)
 * 
 * 3.3 - End-User Access to Cardholder Data:
 * - Safe logging of ISO messages (lines 321-332)
 * - Truncation of sensitive data in logs (line 329)
 * - Conditional logging based on dangerous mode
 * 
 * 4.1 - Use Strong Cryptography:
 * - Security concern: Plain TCP without encryption (line 120)
 * - No TLS/SSL - data transmitted in plaintext
 * 
 * 6.2.3 - Protect Remote Access:
 * - Port configuration (line 263)
 * - Connection timeout to prevent hanging (line 127)
 * - Single connection limit prevents concurrent connections
 * 
 * 8.2.1 - Identification and Authentication:
 * - No authentication mechanism
 * 
 * 8.3.1 - Access Control:
 * - No role-based access control
 * - Single connection enforcement
 * 
 * 10.2.1 - Audit Trail:
 * - Connection logging (lines 118, 257)
 * - Data receipt logging (lines 131-138)
 * - Error logging (lines 234, 240)
 * 
 * 10.2.2 - Audit Log Retention:
 * - Logs sent to console - retention depends on log management
 * 
 * 10.2.3 - Audit Trail Review:
 * - All socket events logged
 * - Connection state changes logged
 * 
 * 11.3.1 - Periodic Testing:
 * - No built-in health checks
 * 
 * 12.3.1 - Vulnerability Management:
 * - No input sanitization beyond safe logging
 * - No rate limiting
 */

// Import required modules for ISO8583 processing
var iso8583         = require('../../../lib/iso8583');
var iso8583Queue    = require('../../../lib/iso8583-queue');
var helpers         = require('../../../lib/helpers');
var iso8583Packet   = require('../../../lib/iso8583-packet');
var net             = require('net');
var colors          = require('colors');
var EventEmitter    = require('events').EventEmitter;

// Global flags object for connection state management
var flags = {};
// Global queue for message management
var queue = null;

// Upstream connection options and timeout configurations
var uOptions = {
  // Delay time before reconnect after timeout socket error (3 seconds)
  timeoutError:               3000,

  // Delay time before reconnect after connection refused socket error (10 seconds)
  timeoutErrorRefused:        10000,

  // Delay before forced connection close (5 seconds)
  timeoutSocketTerminate:     5000,

  // Timeout for ISO-host reply (35 seconds)
  timeoutHostReply:           35000
};

// Sets flags values - updates the global flags object with provided key-value pairs
function setFlags (values) {
  for (var key in values) {
    flags[key] = values[key];
  }
}

// Get flag value - retrieves a specific flag value from the global flags object
function getFlag (key) {
  var value = flags.hasOwnProperty(key) ? flags[key] : null;

  return value;
}

// Main tcpServer constructor - creates a TCP server for upstream connections
// options: configuration object containing port, timeouts, and other settings
function tcpServer (options) {
  // Initialize the socket with the provided options
  this.socket = initSocket(options, this);
  // Track the upstream connection (from payment processor/switch)
  socket.upstreamConnection = null;
  // Create a new ISO8583 message queue for managing pending transactions
  queue = new iso8583Queue(options);
  // Set the queue's parent reference to this server instance
  queue.parent = this;

  // If stat server port is configured, initialize the statistics server
  if (options.statServerPort1) {
    var iso8583StatServer = require('../../../lib/iso8583-statserver');
    this.statServer = new iso8583StatServer(options.statServerPort1);
  }

  // Notifies the upstream queue that a client has disconnected
  // queueMessageId: the ID of the queue entry associated with the client
  this.hasGone = function (queueMessageId) {
    // Confirm and remove the queue entry
    var qe = queue.confirm(queueMessageId);

    // Client queue item exists - handle the disconnection
    if (qe) {
      dd(('Warning: client ' + qe.senderName + ' [queue id ' + queueMessageId + '] terminated activity').yellow);
      // If auto-reversal is enabled, trigger reversal logic for the pending transaction
      if (!global.c.noAutoReversal) {
        var iso8583Logic = require('../../iso8583/lib/logic/' + global.defaultSyntax + '.js');
        var logic = new iso8583Logic(this);

        logic.hasGone(qe);
      }
    // Client queue item does not exist - log warning
    } else {
      dd(('Client with queue id ' + queueMessageId + ' terminated activity. No queue item was found').yellow);
    }

    // Process the queue to handle any pending messages
    this.socket.processQueue();
  };

  // Adds data to the queue for processing by the upstream connection
  // sender: the client socket that sent the data
  // data: the raw ISO8583 message data
  // params: optional parameters (e.g., delayTime for delayed processing)
  // errReturn: optional error callback function
  this.sendData = function (sender, data, params, errReturn) {
    
    dd('**************************Sending data in tcpServer1');

    // Initialize params object if not provided
    if (!params) params = {};

    try {
      // Add the message to the queue
      var item = queue.addMessage(sender, data, params, errReturn);
      if (!item) return false;
      dd('New queue item ' + item['id']);
      // Associate the queue message ID with the sender for tracking
      if (!sender.hasOwnProperty('queueMessageId') || !sender.queueMessageId) sender.queueMessageId = item['id'];
    } catch (ex) {
      // Log error and close the sender connection on queue add failure
      dd(('Error adding message to queue: ' + ex + '\n' + ex.stack).red);
      sender.end();
    }

    // Pass the packet through the statistics server if configured
    if (this.statServer) this.statServer.process(item.packet);

    // Process the queue immediately or after a delay if specified
    if (params.hasOwnProperty('delayTime') && params.delayTime) {
      setTimeout(function() { this.socket.processQueue() }.bind(this), params.delayTime);
    } else {
      this.socket.processQueue();
    }

    return true;
  };

  // Event listener for termination signal - graceful shutdown
  this.on('terminate', function() {
    // If queue is empty, immediately quit
    if (queue.isEmpty()) {
      dd('Warning: quitting...');
      global.flushAndQuit();
    } else {
      // If queue has messages, wait for it to empty before quitting
      dd('Waiting for the queue to empty');

      this.on('emptyQueue', function() {
        dd('Warning: quitting...');
        global.flushAndQuit();
      });
    }
  }.bind(this));
}

// Initialize the TCP server socket for upstream connections
// options: configuration object containing port and timeout settings
// parent: reference to the tcpServer instance
function initSocket(options, parent) {
  // Log that the server is listening for upstream connections
  dd(('Listening for upstream connection on port ' + options.tcpServerPort1).green);

  // Create TCP server to listen for incoming upstream connections from payment processor
  socket = net.createServer(function (connection) {
    // Enforce single connection - drop concurrent connections
    if (socket.upstreamConnection) {
      dd('Dropping concurrent upstream connection!'.red);
      connection.end();
      return;
    }

    // Set connection timeout if configured
    if (options.upstreamTimeout) connection.setTimeout(options.upstreamTimeout * 1000);

    // Event handler: 'data' - triggered when upstream sends us data (ISO8583 response)
    connection.on('data', async function (data) {
      // Log that data was received from the upstream host
      dd('Got data from ISO-host (' + data.length + 'b)');

      // Log the message content safely
      // If dangerous mode is enabled, log full message and hex dump
      // Otherwise, log only first 8 bytes to avoid exposing sensitive data
      if (global.c['dangerous']) {
        dd(('[' + helpers.safeLog(data, ['isoMessage']) + ']').cyan, 'verbose');
        dd(('[' + helpers.safeLog(data, ['hex']) + ']').cyan, 'verbose');
      } else {
        dd(('[' + (helpers.safeLog(data, ['isoMessage'])).substring(0,8) + '...]').cyan, 'verbose');
      }

      var multiMessage = false;

      // If using message headers, split the data by header to handle multiple messages
      if (global.c['useHeader']) {
        var packager = new iso8583(global.defaultSyntax);
        packetData = packager.config.processors.splitByHeader(data);

        if (packetData.length > 1) multiMessage = true;
      } else {
        packetData = [data];
      }

      // Process each packet in the data
      for (var index in packetData) {
        var p = new iso8583Packet(packetData[index]);
        if (multiMessage) dd(('[' + helpers.safeLog(packetData[index], ['isoMessage']) + ']'), 'verbose');

        var qe = null;

        // If packet parsed successfully, find the corresponding queue entry
        if (!p.parseError) {
          var qe = queue.getActiveByPacket(p);

          // No active queue item found - log error and ignore
          if (!qe) {
            var lookupFieldsString = global.c['queueMessageKeyFields'].join(',');
            var message = 'Upstream error: ISO host sent data with no proper client connected (client lookup fields: ' + lookupFieldsString + ')! Ignoring...';
            message += '\n\n' + 'ISO host says' + p.pretty();
            dd(message.red);

            return false;
            // Found item with dead sender - log error and ignore
          } else if (qe.sender.destroyed) {
            message = 'Upstream error: ISO host sent data for closed socket! Ignoring...';
            message += '\n\n' + 'ISO host says' + p.pretty();
            dd(message.red);

            return false;
            // Confirm and remove the queue message
          } else {
            var cResult = queue.confirm(qe.id);
            if (!cResult) dd('Warning: queue::confirm() failed to locate the queue message #' + qe.id);
          }

          dd(('Parsed data for ' + qe.senderName).green);
          dd('\n\n' + 'ISO host to ' + qe.senderName + p.pretty(), 'verbose');

          // Pass the packet through the statistics server if configured
          if (parent.statServer) parent.statServer.process(p);

          // Send the response back to the waiting client
          await qe.sender.reply(p, qe);
        } else {
          // Packet parsing failed - log error
          dd(('ISO host: failed to parse ISO host iso8583 packet').red);
          dd(p.parseError, 'verbose');
        }

        // Drop the client connection after sending the response
        if (qe) socket.dropClient(qe.sender);
      }

      // Process the queue to send any pending messages
      socket.processQueue();
    });

    // Event handler: 'end' - triggered when upstream initiates connection close
    connection.on('end', function () {
      dd('Upstream <end>'.red);

      // Set shutdown flag to prevent new messages
      setFlags({'isShuttingDown': Date.now()});
      socket.upstreamConnection = null;
    });

    // Event handler: 'close' - triggered when socket is fully closed
    connection.on('close', function () {
      // Clear the termination timer if it exists
      if (this.terminateTimer) {
        clearTimeout(this.terminateTimer);
      }

      dd('Upstream <close>'.red);
      dd('Dropping all active clients');

      // Drop all active client connections
      var senders = queue.getActiveSenders();
      for (var i in senders) {
        socket.dropClient(senders[i]['sender']);
      }

      // Reset socket state and clear upstream connection reference
      socket.resetState();
      socket.upstreamConnection = null;
    });

    // Event handler: 'error' - triggered on socket errors
    connection.on('error', function (err) {
      // Set retry delay based on error type
      if (err = 'ECONNREFUSED') {
        socket.retryDelay = uOptions.timeoutErrorRefused;
      } else {
        socket.retryDelay = uOptions.timeoutError;
      }

      dd(('Upstream socket error ' + err).red);
      this.end();
    });

    // Event handler: 'timeout' - triggered when connection timeout expires
    connection.on('timeout', function () {
      dd('Upstream timeout!'.yellow);

      // Set shutdown flag and close the connection
      setFlags({'isShuttingDown': Date.now()});
      socket.end();
      // Force socket termination after a delay if it doesn't close gracefully
      socket.terminateTimer = setTimeout(function() {
        dd('Forcing upstream socket termination'.red);
        this.destroy();
      }.bind(socket), uOptions.timeoutSocketTemrinate);

      // Drop all active client connections
      var senders = queue.getActiveSenders();
      for (var i in senders) {
        socket.dropClient(senders[i]['sender']);
      }

      // Process the queue to handle any pending messages
      socket.processQueue();
    });

    // Log successful upstream connection
    dd('Upstream connected'.green);
    // Set connected flag and store the connection reference
    this.resetState({'isConnected': Date.now()});
    socket.upstreamConnection = connection;
    // Process the queue to send any pending messages
    this.processQueue();
  });

  // Start listening on the configured port
  socket.listen(options.tcpServerPort1);
  
  // Reset upstream socket status variables
  // values: optional object with flag values to set
  socket.resetState = function (values) {
    if (!values) values = {};

    // 'Connected' flag is set when upstream socket is connected
    if(!values.hasOwnProperty('isConnected')) values['isConnected'] = 0;

    // 'Shutting down' flag is set when upstream socket is closing the connection
    if(!values.hasOwnProperty('isShuttingDown')) values['isShuttingDown'] = 0;

    setFlags(values);
  };

  // Initialize socket state
  socket.resetState();
  // Store options for later reference
  socket.options = options;

  // Queue processor - sends pending messages to the upstream connection
  socket.processQueue = function () {
    // Get queue statistics
    var countPending = queue.getPendingCount();
    var countTotal = queue.getCount();

    dd('Processing queue [pending ' + countPending + ' / total ' + countTotal + ']');
    if (countTotal > 0) dd('Queue keys dump: ' + queue.getKeys().join(), 'verbose');

    // If queue is empty, emit event and return
    if (!countTotal) {
      dd('The queue is empty');
      parent.emit('emptyQueue');

      return;
    }

    // Don't process if not connected
    if (!getFlag('isConnected')) {
      dd('Socket is not connected yet...'.yellow);
      return;
    }

    // Don't process if currently connecting
    if (socket._connecting) {
      dd('Waiting for upstream to connect...');
      return;
    }

    // Don't process if shutting down
    if (getFlag('isShuttingDown')) {
      dd('Shutting down the connection. Stay tuned...');
      return;
    }

    // Fetch messages to process from the queue
    var messages = queue.fetchToProcess();

    // Use application buffering together with Nagle disabled for performance
    var buf = [];

    // Build buffer with all messages to send
    for (var i in messages) {
      var message = messages[i];
      if (message.comment) dd(message.comment);
      dd('Upstreaming data for ' + message.senderName);

      // Log the message content safely
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

      // Add the raw message to the buffer
      buf.push(message.packet.getRawMessage({
                                              header: global.c['useHeader']
                                            }));
    }

    // Write all buffered messages to the upstream connection
    socket.upstreamConnection.write(Buffer.concat(buf));
  };

  // Drops a client connection - releases the client from the queue and closes the connection
  socket.dropClient = function (client) {
    client.end();
  };

  return socket;
}

// Returns a warning if more than LIMIT seconds have passed since timestamp
// timestamp: the timestamp to check
// limit: the time limit in seconds (default: 120)
function delayWarning(timestamp, limit) {
  if ((typeof timestamp == 'undefined') || !timestamp) return false;
  if (!limit) limit = 120;
  limit *= 1000;

  return Date.now() - timestamp > limit;
}

// Inherit from EventEmitter to enable event-driven architecture
tcpServer.prototype.__proto__ = EventEmitter.prototype;

// Export the tcpServer constructor for use in other modules
module.exports = tcpServer;
