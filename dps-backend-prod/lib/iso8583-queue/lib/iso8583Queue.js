var iso8583Packet    = require('../../../lib/iso8583-packet');
var helpers          = require('../../../lib/helpers');
var net              = require('net');

var maxQueue                = 150;
var queueTimeout            = 8000;
var queueShortTimeout       = 4000;

function queue(c) {
    this.q = {};
    this.busyTerminals = {};

    var queueMemory = require('./storage/queueMemory.js');

    this.q = new queueMemory();

    if (c) {
        maxQueue =          c.maxQueue;
        queueTimeout =      c.queueTimeout * 1000;
        queueShortTimeout = c.queueShortTimeout * 1000;
    }

    console.log('QUEUE INIT: maxQueue=' + maxQueue + ', queueTimeout=' + queueTimeout + 'ms, queueShortTimeout=' + queueShortTimeout + 'ms');
}

// Adds message to queue
queue.prototype.addMessage = function(sender, msg, params, errReturn) {
    var isSystemSender = false;
    if (!params) params = {};

    var parentQueueItem = params.hasOwnProperty('parent') ? params['parent'] : null;
    var delayTime = params.hasOwnProperty('delayTime') && params['delayTime'] ? params['delayTime'] : 0;
    var comment = params.hasOwnProperty('comment') && params['comment'] ? params['comment'] : null;

    if (!sender) {
        //console.log('QUEUE ERROR: addMessage called without sender');
        throw new Error('Queue addMessage no sender');
    }

    var currentCount = this.getCount();
    //console.log('QUEUE ADD: Current queue count: ' + currentCount + '/' + maxQueue);

    if (currentCount >= maxQueue) {
        //console.log('QUEUE ERROR: Max queue length reached (' + maxQueue + ')');
        throw new Error('Reached max queue length ');
    }

    if (typeof sender == 'object' && sender.constructor.name == 'Socket') {
        var senderName = sender.name;
        //console.log('QUEUE ADD: Sender type: Socket, name: ' + senderName);
    } else if (typeof sender == 'object' && sender.constructor.name == 'IncomingMessage') {
        var senderName = sender.originalUrl;
        //console.log('QUEUE ADD: Sender type: HTTP Request, URL: ' + senderName);
    } else if (typeof sender == 'object' && sender.constructor.name == 'Object') {
        var senderName = sender.name;
        //console.log('QUEUE ADD: Sender type: Object, name: ' + senderName);
    } else if (typeof sender == 'object' && sender.constructor.name == 'Iso8583Logic') {
        var senderName = sender.name;
        isSystemSender = true;
        //console.log('QUEUE ADD: Sender type: System, name: ' + senderName);
    } else {
        //console.log('QUEUE ADD: Unknown sender type: ' + (typeof sender) + ', constructor: ' + sender.constructor.name);
    }

    var p = new iso8583Packet(msg);

    if (!p.parseError && !p.checkErrors.length && !(p.isExpired && !isSystemSender)) {
//        console.log('================================================================================================');
        //console.log('QUEUE PACKET: Header: ' + p.rawData.toString().substring(0,12));
        //console.log('QUEUE PACKET: Host: ' + senderName);
//        console.log('ISO8583 Message Details:');
//        console.log(p.pretty());
//        console.log('================================================================================================');

        var stan = p.getField(11);
        var terminalId = p.getField(41);
        console.log('QUEUE PACKET: STAN=' + stan + ', TerminalId=' + terminalId);
    } else if (p.isExpired) {
        //console.log('QUEUE ERROR: Iso8583 packet is expired. Won\'t queue!');
        if (Array.isArray(errReturn)) errReturn.push('Packet is expired!');
        return false;
    } else if (p.parseError) {
        //console.log('QUEUE ERROR: Failed to parse iso8583 packet. Won\'t queue!');
        if (Array.isArray(errReturn)) errReturn.push('Failed to parse packet!');
        return false;
    } else {
        //console.log('QUEUE ERROR: Iso8583 packet contains errors. Won\'t queue!');
        if (Array.isArray(errReturn)) p.checkErrors.forEach(function(item) { errReturn.push(item); });
        return false;
    }

    var item = {
        isProcessed:        0,
        delayUntil:         delayTime ? Date.now() + delayTime : 0,
        createdAt:          Date.now(),
        retryCount:         parentQueueItem && parentQueueItem.hasOwnProperty('retryCount') ? parentQueueItem['retryCount'] + 1 : 0,
        stan:               stan,
        terminalId:         terminalId,
        messageTypeGroup:   p.messageTypeGroup,
        sender:             sender,
        senderName:         senderName,
        isSystemSender:     isSystemSender,
        packet:             p,
        comment:            comment
    };

    //console.log('QUEUE ADD: Writing to queue ' + senderName + ' [current count: ' + currentCount + ']');
    //console.log('QUEUE ADD: Delay until: ' + (delayTime ? new Date(item.delayUntil).toISOString() : 'immediate'));

    item['id'] = this.q.addMessage(item);

    var timeout = parentQueueItem ? queueShortTimeout : queueTimeout;
    //console.log('QUEUE ADD: Setting timeout for item ' + item['id'] + ' to ' + timeout + 'ms');

    item.timeoutTimer = setTimeout(function() {
        this.queueTimeout(item['id'])
    }.bind(this), timeout + delayTime);

    //console.log('QUEUE ADD: Successfully added item ' + item['id'] + ' to queue');
    return item;
}

// Handles queue timeout
queue.prototype.queueTimeout = function(itemId) {
    //console.log('======================= QUEUE TIMEOUT TRIGGERED =======================');
    var item = this.getById(itemId);

    if (!item) {
        //console.log('QUEUE TIMEOUT ERROR: Item ' + itemId + ' not found in queue');
        return;
    }

    //console.log('QUEUE TIMEOUT: Item ' + itemId + ' - ' + item.senderName);
    //console.log('QUEUE TIMEOUT: STAN=' + item.stan + ', TerminalId=' + item.terminalId);
    //console.log('QUEUE TIMEOUT: Created at: ' + new Date(item.createdAt).toISOString());
    //console.log('QUEUE TIMEOUT: Current time: ' + new Date().toISOString());
    //console.log('QUEUE TIMEOUT: Elapsed time: ' + (Date.now() - item.createdAt) + 'ms');

    // Enhanced connection checking with detailed logging
    var isSenderClosed = true;
    var senderType = 'unknown';

    if (item.sender) {
        senderType = item.sender.constructor.name;
        //console.log('QUEUE TIMEOUT: Sender type: ' + senderType);

        if (typeof item.sender.isClosed === 'function') {
            isSenderClosed = item.sender.isClosed();
            //console.log('QUEUE TIMEOUT: sender.isClosed() = ' + isSenderClosed);
        } else if (item.sender.destroyed !== undefined) {
            isSenderClosed = item.sender.destroyed;
            //console.log('QUEUE TIMEOUT: sender.destroyed = ' + item.sender.destroyed);
        } else if (item.sender.readyState !== undefined) {
            // For WebSocket-like objects
            isSenderClosed = item.sender.readyState !== 'open';
            //console.log('QUEUE TIMEOUT: sender.readyState = ' + item.sender.readyState);
        } else {
            //console.log('QUEUE TIMEOUT: Cannot determine sender closed status - no isClosed/destroyed/readyState method');
        }
    } else {
        //console.log('QUEUE TIMEOUT: Sender object is null or undefined');
    }

    if (item && !isSenderClosed) {
        //console.log('QUEUE TIMEOUT: Dropping the client ' + item.senderName + ' - sender still connected');
        this.confirm(itemId);
        if (typeof item.sender.queueTimeout === 'function') {
            item.sender.queueTimeout();
        } else {
            //console.log('QUEUE TIMEOUT WARNING: sender.queueTimeout() is not a function');
        }
    } else {
        //console.log('QUEUE TIMEOUT: The client ' + item.senderName + ' is already gone or disconnected');
        this.confirm(itemId);

        // Log host connection status
        //console.log('QUEUE TIMEOUT: Checking host interface connections...');
        if (this.parent) {
            //console.log('QUEUE TIMEOUT: Parent object exists');
            if (this.parent.socket1) {
                var socket1Status = 'unknown';
                if (this.parent.socket1.connected !== undefined) {
                    socket1Status = this.parent.socket1.connected ? 'connected' : 'disconnected';
                } else if (this.parent.socket1.destroyed !== undefined) {
                    socket1Status = this.parent.socket1.destroyed ? 'destroyed' : 'active';
                }
                //console.log('QUEUE TIMEOUT: socket1 status: ' + socket1Status);
                this.parent.socket1.processQueue();
            } else {
                //console.log('QUEUE TIMEOUT: socket1 is not available');
            }

            if (this.parent.socket2) {
                var socket2Status = 'unknown';
                if (this.parent.socket2.connected !== undefined) {
                    socket2Status = this.parent.socket2.connected ? 'connected' : 'disconnected';
                } else if (this.parent.socket2.destroyed !== undefined) {
                    socket2Status = this.parent.socket2.destroyed ? 'destroyed' : 'active';
                }
                //console.log('QUEUE TIMEOUT: socket2 status: ' + socket2Status);
                this.parent.socket2.processQueue();
            } else {
                //console.log('QUEUE TIMEOUT: socket2 is not available');
            }
        } else {
            //console.log('QUEUE TIMEOUT ERROR: Parent object is not available');
        }
    }
    //console.log('======================= QUEUE TIMEOUT COMPLETE =======================');
};

// Get queue item by id
queue.prototype.getById = function(id) {
    return this.q.getById(id);
};

// Returns messagess, ready to process
queue.prototype.fetchToProcess = function() {
    result = [];

    var elements = this.q.getMessages();
    //console.log('QUEUE FETCH: Checking ' + elements.length + ' items for processing');

    for (var i in elements) {
        var qe = elements[i];
        const isBusyTerminal = this.checkTerminalIsBusy(qe.terminalId);
        const lockTerminal = global.c['queueLockTerminal'];

        //console.log('QUEUE FETCH: Item ' + qe['id'] + ' - processed: ' + qe.isProcessed + ', delayUntil: ' + qe.delayUntil + ', currentTime: ' + Date.now() + ', terminalBusy: ' + isBusyTerminal);

        if (
            !qe.isProcessed && Date.now() >= qe.delayUntil
            &&
            (!lockTerminal || !isBusyTerminal)
        ) {
            qe.isProcessed = 1;
            if (global.c['queueLockTerminal']) {
                //console.log('QUEUE FETCH: Taking terminal ' + qe.terminalId + ' for item ' + qe['id']);
                this.takeTerminal(qe.terminalId, qe['id']);
            }

            result.push(qe);
        }
    }

    //console.log('QUEUE FETCH: Returning ' + result.length + ' items ready for processing');
    return result;
};

// Checks of currenlty there is no message with given terminal id in active state
queue.prototype.checkTerminalIsBusy = function(terminalId) {
    var isBusy = (terminalId == '0000000000000000') ? false : this.busyTerminals.hasOwnProperty(terminalId);
    //console.log('QUEUE CHECK TERMINAL: ' + terminalId + ' is busy: ' + isBusy);
    if (isBusy) {
        //console.log('QUEUE CHECK TERMINAL: Terminal ' + terminalId + ' is busy with item ' + this.busyTerminals[terminalId]);
    }
    return isBusy;
};

// Marks given terminal id as busy
queue.prototype.takeTerminal = function (terminalId, key) {
    //console.log('QUEUE TAKE TERMINAL: Taking terminal ' + terminalId + ' for item ' + key);
    this.busyTerminals[terminalId] = key;
};

// Marks given terminal id as available
queue.prototype.releaseTerminal = function(terminalId, key) {
    //console.log('QUEUE RELEASE TERMINAL: Releasing terminal ' + terminalId + ' with the key ' + key);

    // If terminal was takey by someone else -- do nothing
    if (key && this.busyTerminals.hasOwnProperty(terminalId) && this.busyTerminals[terminalId] != key) {
        //console.log('QUEUE RELEASE TERMINAL: Terminal ' + terminalId + ' is assigned to key ' + this.busyTerminals[terminalId] + '. Nothing to do.');
        return false;
    } else if (!this.busyTerminals.hasOwnProperty(terminalId)) {
        //console.log('QUEUE RELEASE TERMINAL: Terminal ' + terminalId + ' is not assigned');
        return false;
    } else {
        delete this.busyTerminals[terminalId];
        //console.log('QUEUE RELEASE TERMINAL: Successfully released terminal ' + terminalId);
        return true;
    }
};

queue.prototype.confirm = function(id) {
    var item = this.getById(id);

    if (item) {
        //console.log('QUEUE CONFIRM: Confirming item ' + id + ' - ' + item.senderName);

        var qe = {};

        if (item.timeoutTimer) {
            //console.log('QUEUE CONFIRM: Clearing timeout timer for item ' + id);
            clearTimeout(item.timeoutTimer);
        } else {
            //console.log('QUEUE CONFIRM: No timeout timer found for item ' + id);
        }

        for (var key in item) qe[key] = item[key];

        if (global.c['queueLockTerminal']) {
            //console.log('QUEUE CONFIRM: Releasing terminal ' + qe['terminalId'] + ' for item ' + id);
            this.releaseTerminal(qe['terminalId'], qe['id']);
        }

        this.q.confirm(id);
        //console.log('QUEUE CONFIRM: Successfully confirmed item ' + id);

        return qe;
    } else {
        //console.log('QUEUE CONFIRM ERROR: Item ' + id + ' not found');
        return null;
    }
};

// Return the list of client currently waiting for result
queue.prototype.getActiveSenders = function() {
    return this.q.getActiveSenders();
};

// Retrieves an item with corresponding stan and terminalId from the list of active items in queue
queue.prototype.getActiveByPacket = function(p) {
    var pretenders = [];

    var elements = this.q.getMessages();
    //console.log('QUEUE GET ACTIVE: Searching for matching packet in ' + elements.length + ' items');

    for (var i in elements) {
        var qe = elements[i];

        var messageIdentified = true;
        let QMKF = global.c['queueMessageKeyFields'];

        // Checking the key fields in the message queue
        for (var i in global.c['queueMessageKeyFields']) {
            var id = global.c['queueMessageKeyFields'][i];
            if (!p.getField(id) || p.getField(id) != qe.packet.getField(id)) {
                messageIdentified = false;
                break;
            }
        }

        if (messageIdentified && qe.isProcessed) {
            // Not system senders does not care of original packet mti group
            if (!qe.isSystemSender) {
                pretenders.push(qe);
                // System senders do care
            } else if (qe.messageTypeGroup == p.messageTypeGroup) {
                pretenders.push(qe);
            }
        }
    }

    //console.log('QUEUE GET ACTIVE: Found ' + pretenders.length + ' matching items');

    // We have one correct sender -- good news
    if (pretenders.length == 1) {
        return pretenders[0];
        // We have more than one senders, pretending to be the recipient -- need to solve problem
    } else if (pretenders.length > 1) {
        pretenders = this.solveConflict(p, pretenders);

        if (pretenders[0]['score'] != pretenders[1]['score']) var solveResult = 'success'; else var solveResult = 'failed';
        //console.log('QUEUE GET ACTIVE: Solved queue conflict with ' + pretenders.length + ' pretenders [' + solveResult + ']');

        return pretenders[0]
        // There is nobody to get the response
    } else {
        //console.log('QUEUE GET ACTIVE: No matching items found');
        return null;
    }
};

// Solves conflict and tries to return the most corresponding pretender
queue.prototype.solveConflict = function(p, pretenders) {
    for (var i in pretenders) {
        if (!pretenders[i].hasOwnProperty('score')) pretenders[i]['score'] = 0;

        // Score by message type group
        if (pretenders[i]['packet']['messageTypeGroup'] == p.messageTypeGroup) {
            pretenders[i]['score'] += 10;
        }

        // Score by transaction amount
        if (p.messageTypeGroup == 2) {
            if (pretenders[i]['packet'].getField(4) == p.getField(4)) {
                pretenders[i]['score'] += 1;
            }
        }

        // Score by pan
        if (pretenders[i]['packet']['messageTypeGroup'] == 2 && p.messageTypeId == '0210') {
            var pan = p.getField(2);
            var srcTrack = pretenders[i]['packet'].getField(35);

            if (pan && srcTrack) {
                var reg = new RegExp('^' + pan);
                if (srcTrack.match(pan)) {
                    pretenders[i]['score'] += 5;
                }
            }
        }
    }

    pretenders.sort(function (a, b) {
        if (a.score > b.score) return -1;
        if (a.score < b.score) return 1;
        return 0;
    });

    return pretenders;
};

// Get total queue messages count
queue.prototype.getCount = function() {
    var count = this.q.getCount();
    //console.log('QUEUE COUNT: Total=' + count + ', Pending=' + this.getPendingCount());
    return count;
};

// Check if the queue is empty
queue.prototype.isEmpty = function() {
    return this.q.isEmpty();
};

// Returns queue keys
queue.prototype.getKeys = function() {
    return this.q.getKeys();
};

// Get pending messages count
queue.prototype.getPendingCount = function() {
    return this.q.getPendingCount();
};

module.exports = queue;