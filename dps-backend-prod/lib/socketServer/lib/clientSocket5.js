/**
 * PCI DSS 4.0 Requirements Coverage:
 * 
 * 1.2.1 - Network Security Controls:
 * - TCP socket server for client connections (line 10)
 * - Connection timeout configuration (line 17)
 * - Connection denial mechanism (lines 5-6, 11-14)
 * 
 * 2.2.1 - Custom Software Development:
 * - Input validation via safe logging (lines 41-45)
 * - Conditional logging based on dangerous mode (lines 41-45)
 * - Message queue management for transaction processing
 * 
 * 3.3 - End-User Access to Cardholder Data:
 * - Safe logging of ISO messages to prevent cardholder data exposure (lines 41-45)
 * - Truncation of sensitive data in logs (line 44)
 * 
 * 4.1 - Use Strong Cryptography:
 * - Note: This file uses plain TCP sockets - consider TLS for production
 * - Data transmission without encryption (security concern)
 * 
 * 6.2.3 - Protect Remote Access:
 * - Client identification via remote address and port (line 16)
 * - Connection timeout to prevent hanging connections (line 17)
 * 
 * 8.2.1 - Identification and Authentication:
 * - No authentication mechanism implemented (security concern)
 * - Accepts connections from any client
 * 
 * 8.3.1 - Access Control:
 * - Connection denial flag (lines 5-6, 80-82)
 * - No role-based access control
 * 
 * 10.2.1 - Audit Trail:
 * - Connection logging (line 18)
 * - Data receipt logging (line 39)
 * - Socket event logging (end, close, error, timeout)
 * 
 * 10.2.2 - Audit Log Retention:
 * - Logs sent to console/dd function - retention depends on log management
 * 
 * 10.2.3 - Audit Trail Review:
 * - All socket events logged for monitoring
 * - Queue message ID tracking for transaction correlation
 * 
 * 11.3.1 - Periodic Testing:
 * - No built-in health checks or monitoring
 * 
 * 12.3.1 - Vulnerability Management:
 * - No input sanitization beyond safe logging
 * - No rate limiting or DoS protection
 */

// Import required modules
var helpers     = require('../../../lib/helpers');
var net         = require('net');

// Main function to create a TCP socket server for client connections
// upstream: ISOClient instance to forward data to
// c: configuration object containing clientTimeout settings
function clientSocket5(upstream, c) {
  // Flag to stop accepting new connections
  this.noMore = false;

  // Store reference to parent object for use in nested functions
  var parent = this;

  // Create TCP server to listen for incoming client connections
  var server = net.createServer(function (socket) {
    // Check if new connections should be denied
    if (parent.noMore) {
      socket.end();
      return;
    }

    // Assign a unique name to the socket based on client's IP and port
    socket.name = socket.remoteAddress + ':' + socket.remotePort;
    
    // Set socket timeout if configured
    if (c.clientTimeout) socket.setTimeout(c.clientTimeout * 1000);
    
    // Log that a new client has connected
    dd(('Client ' + socket.name + ' connected').yellow);

    // Custom method: reply to the client with a message
    // Triggered by upstream processor when response is ready
    socket.reply = function(p) {
      this.write(p.getRawMessage());
      return true;
    }

    // Custom method: handle queue timeout
    socket.queueTimeout = function() {
      this.end();
    }

    // Custom method: check if socket is closed
    socket.isClosed = function() {
      return !this.writable;
    }

    // Event handler: 'data' - triggered when client sends data
    socket.on('data', function (data) {
      // Log that data was received with byte count
      dd(('Client ' + socket.name + ' sent data (' + data.length + 'b)').yellow);

      // Log the message content safely
      // If dangerous mode is enabled, log full message
      // Otherwise, log only first 8 bytes to avoid exposing sensitive data
      if (global.c['dangerous']) {
        dd(('[' + helpers.safeLog(data, ['isoMessage']) + ']').cyan, 'verbose');
      } else {
        dd(('[' + (helpers.safeLog(data, ['isoMessage'])).substring(0,8) + '...]').cyan, 'verbose');
      }

      // Forward the incoming payload to the upstream processor
      if (!upstream.sendData(socket, data)) this.end();
    });

    // Event handler: 'end' - triggered when client initiates connection close
    socket.on('end', function () {
      dd(('Client ' + socket.name + ' <end> event').yellow);
    });

    // Event handler: 'close' - triggered when socket is fully closed
    socket.on('close', function() {
      dd(('Client ' + socket.name + ' <close> event').yellow);

      // Notify upstream processor if this socket had a queued message
      if (socket.queueMessageId) {
        upstream.hasGone(socket.queueMessageId);
      }
    });

    // Event handler: 'error' - triggered on socket errors
    socket.on('error', function(err) {
      dd('Client <error> ' + err);
    });

    // Event handler: 'timeout' - triggered when socket timeout expires
    socket.on('timeout', function(err) {
      dd('Client ' + socket.name + ' <socket timeout>');
      this.end();
    });
  });

  // Event handler: server error
  server.on('error', function(err) {
    dd('Socket server <error> ' + err);
  });

  // Method to deny new connections
  server.deny = function() {
    parent.noMore = true;
  }

  return server;
};

// Export the clientSocket5 function for use in other modules
module.exports = clientSocket5;