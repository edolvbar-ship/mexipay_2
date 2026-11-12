var iso8583Packet = require('../../../lib/iso8583-packet');
var helpers = require('../../../lib/helpers');
var net = require('net');

// Configuration with defaults matching your log and PROSA 8-second timeout
const CONFIG = {
    maxQueue: parseInt(process.env.QUEUE_MAX_SIZE) || 150,
    queueTimeout: (parseInt(process.env.QUEUE_TIMEOUT) || 8) * 1000,
    queueShortTimeout: (parseInt(process.env.QUEUE_SHORT_TIMEOUT) || 3) * 1000,
    maxRetries: parseInt(process.env.QUEUE_MAX_RETRIES) || 3,
    backoffBase: parseInt(process.env.QUEUE_BACKOFF_BASE) || 250,
};

function queue(c) {
    this.q = {};
    this.busyTerminals = {};

    var queueMemory = require('./storage/queueMemory.js');
    this.q = new queueMemory();

    // Merge configuration, prioritizing environment variables unless c is provided
    // this.config = c ? { ...CONFIG, ...c } : { ...CONFIG };
    this.config = { ...CONFIG };

    // Log configuration for debugging
    console.log(
        `QUEUE INIT: maxQueue=${this.config.maxQueue}, ` +
        `queueTimeout=${this.config.queueTimeout}ms, queueShortTimeout=${this.config.queueShortTimeout}ms, ` +
        `maxRetries=${this.config.maxRetries}, backoffBase=${this.config.backoffBase}ms`
    );
}

// Adds message to queue
queue.prototype.addMessage = function (sender, msg, params, errReturn) {
    if (!params) params = {};
    var isSystemSender = false;
    if (!sender) {
        console.error('QUEUE ERROR: addMessage called without sender');
        throw new Error('Queue addMessage no sender');
    }

    var currentCount = this.getCount();
    console.log('QUEUE ADD: Current queue count: ' + currentCount + '/' + this.config.maxQueue);

    if (currentCount >= this.config.maxQueue) {
        console.error('QUEUE ERROR: Max queue length reached (' + this.config.maxQueue + ')');
        throw new Error('Reached max queue length');
    }

    var senderName;
    if (typeof sender == 'object' && sender.constructor.name == 'Socket') {
        senderName = sender.name;
        console.log('QUEUE ADD: Sender type: Socket, name: ' + senderName);
    } else if (typeof sender == 'object' && sender.constructor.name == 'IncomingMessage') {
        senderName = sender.originalUrl;
        console.log('QUEUE ADD: Sender type: HTTP Request, URL: ' + senderName);
    } else if (typeof sender == 'object' && sender.constructor.name == 'Object') {
        senderName = sender.name;
        console.log('QUEUE ADD: Sender type: Object, name: ' + senderName);
    } else if (typeof sender == 'object' && sender.constructor.name == 'Iso8583Logic') {
        senderName = sender.name;
        isSystemSender = true;
        console.log('QUEUE ADD: Sender type: System, name: ' + senderName);
    } else {
        console.log('QUEUE ADD: Unknown sender type: ' + (typeof sender) + ', constructor: ' + sender.constructor.name);
        senderName = 'unknown';
    }

    var p = new iso8583Packet(msg);

    if (p.isExpired && !isSystemSender) {
        console.error('QUEUE ERROR: Iso8583 packet is expired. Won\'t queue!');
        if (Array.isArray(errReturn)) errReturn.push('Packet is expired!');
        return false;
    }
    if (p.parseError || p.checkErrors.length) {
        console.error('QUEUE ERROR: ' + (p.parseError ? 'Failed to parse iso8583 packet' : 'Iso8583 packet contains errors') + '. Won\'t queue!');
        if (Array.isArray(errReturn)) {
            errReturn.push(p.parseError ? 'Failed to parse packet!' : p.checkErrors);
        }
        return false;
    }

    var stan = p.getField(11);
    var terminalId = p.getField(41);
    console.log(
        '================================================================================================\n' +
        'QUEUE PACKET: Header: ' + p.rawData.toString().substring(0,12) + '\n' +
        'QUEUE PACKET: Host: ' + senderName + '\n' +
        'ISO8583 Message Details:\n' + p.pretty() + '\n' +
        '================================================================================================\n' +
        'QUEUE PACKET: STAN=' + stan + ', TerminalId=' + terminalId
    );

    var parentQueueItem = params.hasOwnProperty('parent') ? params['parent'] : null;
    var delayTime = params.hasOwnProperty('delayTime') && params['delayTime'] ? params['delayTime'] : 0;
    var comment = params.hasOwnProperty('comment') && params['comment'] ? params['comment'] : null;

    var item = {
        isProcessed: 0,
        delayUntil: delayTime ? Date.now() + delayTime : 0,
        createdAt: Date.now(),
        retryCount: parentQueueItem && parentQueueItem.hasOwnProperty('retryCount') ? parentQueueItem['retryCount'] + 1 : 0,
        stan: stan,
        terminalId: terminalId,
        messageTypeGroup: p.messageTypeGroup,
        sender: sender,
        senderName: senderName,
        isSystemSender: isSystemSender,
        packet: p,
        comment: comment
    };

    if (item.retryCount > this.config.maxRetries) {
        console.error('QUEUE ERROR: Item ' + stan + ' exceeded max retries (' + this.config.maxRetries + ')');
        throw new Error('Exceeded max retries');
    }

    console.log('QUEUE ADD: Writing to queue ' + senderName + ' [current count: ' + currentCount + ']');
    console.log('QUEUE ADD: Delay until: ' + (delayTime ? new Date(item.delayUntil).toISOString() : 'immediate'));

    item.id = this.q.addMessage(item);
    if (!item.id) {
        console.error('QUEUE ERROR: Failed to assign item ID for STAN=' + stan);
        throw new Error('Failed to assign item ID');
    }

    var timeout = parentQueueItem ? this.config.queueShortTimeout : this.config.queueTimeout;
    console.log('QUEUE ADD: Setting timeout for item ' + item.id + ' to ' + timeout + 'ms');

    item.timeoutTimer = setTimeout(function() {
        this.queueTimeout(item.id);
    }.bind(this), timeout + delayTime);

    console.log('QUEUE ADD: Successfully added item ' + item.id + ' to queue');
    return item;
};

// Handles queue timeout
queue.prototype.queueTimeout = function (itemId) {
//    console.log('======================= QUEUE TIMEOUT TRIGGERED =======================');
    var item = this.getById(itemId);

    if (!item) {
//        console.error('QUEUE TIMEOUT ERROR: Item ' + itemId + ' not found in queue');
        return;
    }

//    console.log(
//        'QUEUE TIMEOUT: Item ' + itemId + ' - ' + item.senderName + '\n' +
//        'QUEUE TIMEOUT: STAN=' + item.stan + ', TerminalId=' + item.terminalId + '\n' +
//        'QUEUE TIMEOUT: Created at: ' + new Date(item.createdAt).toISOString() + '\n' +
//        'QUEUE TIMEOUT: Current time: ' + new Date().toISOString() + '\n' +
//        'QUEUE TIMEOUT: Elapsed time: ' + (Date.now() - item.createdAt) + 'ms'
//    );

    var isSenderClosed = true;
    var senderType = 'unknown';

    if (item.sender) {
        senderType = item.sender.constructor.name;
//        console.log('QUEUE TIMEOUT: Sender type: ' + senderType);

        if (typeof item.sender.isClosed === 'function') {
            isSenderClosed = item.sender.isClosed();
//            console.log('QUEUE TIMEOUT: sender.isClosed() = ' + isSenderClosed);
        } else if (item.sender.destroyed !== undefined) {
            isSenderClosed = item.sender.destroyed;
//            console.log('QUEUE TIMEOUT: sender.destroyed = ' + isSenderClosed);
        } else if (item.sender.readyState !== undefined) {
            isSenderClosed = item.sender.readyState !== 'open';
//            console.log('QUEUE TIMEOUT: sender.readyState = ' + item.sender.readyState);
        } else {
//            console.log('QUEUE TIMEOUT: Cannot determine sender closed status - no isClosed/destroyed/readyState method');
        }
    } else {
//        console.log('QUEUE TIMEOUT: Sender object is null or undefined');
    }

    if (item && !isSenderClosed && item.retryCount < this.config.maxRetries) {
//        console.log('QUEUE TIMEOUT: Retrying item ' + itemId + ' (retry ' + (item.retryCount + 1) + '/' + this.config.maxRetries + ')');
        var backoffDelay = this.config.backoffBase * Math.pow(2, item.retryCount);
        this.q.remove(itemId);
        this.addMessage(item.sender, item.packet.rawData, {
            parent: item,
            delayTime: backoffDelay,
            comment: 'Retry ' + (item.retryCount + 1) + ' after timeout'
        }, []);
    } else {
//        console.log('QUEUE TIMEOUT: Dropping item ' + itemId + ' - ' + (isSenderClosed ? 'sender disconnected' : 'max retries reached'));
        this.confirm(itemId);
        if (!isSenderClosed && typeof item.sender.queueTimeout === 'function') {
            item.sender.queueTimeout();
        }
    }

//    console.log('QUEUE TIMEOUT: Checking host interface connections...');
    if (this.parent) {
//        console.log('QUEUE TIMEOUT: Parent object exists');
        if (this.parent.socket1) {
            var socket1Status = 'unknown';
            if (this.parent.socket1.connected !== undefined) {
                socket1Status = this.parent.socket1.connected ? 'connected' : 'disconnected';
            } else if (this.parent.socket1.destroyed !== undefined) {
                socket1Status = this.parent.socket1.destroyed ? 'destroyed' : 'active';
            }
//            console.log('QUEUE TIMEOUT: socket1 status: ' + socket1Status);
            this.parent.socket1.processQueue();
        }
//         else {
//            console.log('QUEUE TIMEOUT: socket1 is not available');
//        }

        if (this.parent.socket2) {
            var socket2Status = 'unknown';
            if (this.parent.socket2.connected !== undefined) {
                socket2Status = this.parent.socket2.connected ? 'connected' : 'disconnected';
            } else if (this.parent.socket2.destroyed !== undefined) {
                socket2Status = this.parent.socket2.destroyed ? 'destroyed' : 'active';
            }
//            console.log('QUEUE TIMEOUT: socket2 status: ' + socket2Status);
            this.parent.socket2.processQueue();
        } else {
//            console.log('QUEUE TIMEOUT: socket2 is not available');
        }
    }
//    else {
//        console.log('QUEUE TIMEOUT ERROR: Parent object is not available');
//    }
//    console.log('======================= QUEUE TIMEOUT COMPLETE =======================');
};

// Get queue item by id
queue.prototype.getById = function (id) {
    return this.q.getById(id);
};

// Fetch messages ready to process
queue.prototype.fetchToProcess = function () {
    var result = [];
    var elements = this.q.getMessages();
//    console.log('QUEUE FETCH: Checking ' + Object.keys(elements).length + ' items for processing');

    for (var i in elements) {
        var qe = elements[i];
        var isBusyTerminal = this.checkTerminalIsBusy(qe.terminalId);
//        console.log(
//            'QUEUE FETCH: Item ' + qe.id + ' - processed: ' + qe.isProcessed + ', delayUntil: ' + qe.delayUntil +
//            ', currentTime: ' + Date.now() + ', terminalBusy: ' + isBusyTerminal
//        );

        if (
            !qe.isProcessed &&
            Date.now() >= qe.delayUntil &&
            (!global.c['queueLockTerminal'] || !isBusyTerminal)
        ) {
            qe.isProcessed = 1;
            if (global.c['queueLockTerminal']) {
                console.log('QUEUE FETCH: Taking terminal ' + qe.terminalId + ' for item ' + qe.id);
                this.takeTerminal(qe.terminalId, qe.id);
            }
            result.push(qe);
        }
    }

//    console.log('QUEUE FETCH: Returning ' + result.length + ' items ready for processing');
    return result;
};

// Check if terminal is busy
queue.prototype.checkTerminalIsBusy = function (terminalId) {
    var isBusy = (terminalId == '0000000000000000') ? false : this.busyTerminals.hasOwnProperty(terminalId);
//    console.log('QUEUE CHECK TERMINAL: ' + terminalId + ' is busy: ' + isBusy);
//    if (isBusy) {
//        console.log('QUEUE CHECK TERMINAL: Terminal ' + terminalId + ' is busy with item ' + this.busyTerminals[terminalId]);
//    }
    return isBusy;
};

// Mark terminal as busy
queue.prototype.takeTerminal = function (terminalId, key) {
//    console.log('QUEUE TAKE TERMINAL: Taking terminal ' + terminalId + ' for item ' + key);
    this.busyTerminals[terminalId] = key;
};

// Release terminal
queue.prototype.releaseTerminal = function (terminalId, key) {
//    console.log('QUEUE RELEASE TERMINAL: Releasing terminal ' + terminalId + ' with the key ' + key);
    if (key && this.busyTerminals.hasOwnProperty(terminalId) && this.busyTerminals[terminalId] != key) {
//        console.log('QUEUE RELEASE TERMINAL: Terminal ' + terminalId + ' is assigned to key ' + this.busyTerminals[terminalId] + '. Nothing to do.');
        return false;
    } else if (!this.busyTerminals.hasOwnProperty(terminalId)) {
//        console.log('QUEUE RELEASE TERMINAL: Terminal ' + terminalId + ' is not assigned');
        return false;
    } else {
        delete this.busyTerminals[terminalId];
//        console.log('QUEUE RELEASE TERMINAL: Successfully released terminal ' + terminalId);
        return true;
    }
};

// Confirm queue item
queue.prototype.confirm = function (id) {
    var item = this.getById(id);
    if (!item) {
        console.log('QUEUE CONFIRM ERROR: Item ' + id + ' not found');
        return null;
    }

    console.log('QUEUE CONFIRM: Confirming item ' + id + ' - ' + item.senderName);
    if (item.timeoutTimer) {
        console.log('QUEUE CONFIRM: Clearing timeout timer for item ' + id);
        clearTimeout(item.timeoutTimer);
    }

    if (global.c['queueLockTerminal']) {
        console.log('QUEUE CONFIRM: Releasing terminal ' + item.terminalId + ' for item ' + id);
        this.releaseTerminal(item.terminalId, id);
    }

    this.q.confirm(id);
    console.log('QUEUE CONFIRM: Successfully confirmed item ' + id);
    return item;
};

// Return the list of client currently waiting for result
queue.prototype.getActiveSenders = function () {
    return this.q.getActiveSenders();
};

// Retrieves an item with corresponding stan and terminalId from the list of active items in queue
queue.prototype.getActiveByPacket = function (p) {
    var pretenders = [];
    var elements = this.q.getMessages();
    console.log('QUEUE GET ACTIVE: Searching for matching packet in ' + Object.keys(elements).length + ' items');

    for (var i in elements) {
        var qe = elements[i];
        var messageIdentified = true;

        for (var j in global.c['queueMessageKeyFields']) {
            var id = global.c['queueMessageKeyFields'][j];
            if (!p.getField(id) || p.getField(id) != qe.packet.getField(id)) {
                messageIdentified = false;
                break;
            }
        }

        if (messageIdentified && qe.isProcessed) {
            if (!qe.isSystemSender) {
                pretenders.push(qe);
            } else if (qe.messageTypeGroup == p.messageTypeGroup) {
                pretenders.push(qe);
            }
        }
    }

    console.log('QUEUE GET ACTIVE: Found ' + pretenders.length + ' matching items');
    if (pretenders.length == 1) {
        return pretenders[0];
    } else if (pretenders.length > 1) {
        pretenders = this.solveConflict(p, pretenders);
        if (pretenders[0]['score'] != pretenders[1]['score']) var solveResult = 'success'; else var solveResult = 'failed';
        console.log('QUEUE GET ACTIVE: Solved queue conflict with ' + pretenders.length + ' pretenders [' + solveResult + ']');
        return pretenders[0];
    } else {
        console.log('QUEUE GET ACTIVE: No matching items found');
        return null;
    }
};

// Solves conflict and tries to return the most corresponding pretender
queue.prototype.solveConflict = function (p, pretenders) {
    for (var i in pretenders) {
        if (!pretenders[i].hasOwnProperty('score')) pretenders[i]['score'] = 0;
        if (pretenders[i]['packet']['messageTypeGroup'] == p.messageTypeGroup) {
            pretenders[i]['score'] += 10;
        }
        if (p.messageTypeGroup == 2) {
            if (pretenders[i]['packet'].getField(4) == p.getField(4)) {
                pretenders[i]['score'] += 1;
            }
        }
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
queue.prototype.getCount = function () {
    var count = this.q.getCount();
    console.log('QUEUE COUNT: Total=' + count + ', Pending=' + this.getPendingCount());
    return count;
};

// Check if the queue is empty
queue.prototype.isEmpty = function () {
    return this.q.isEmpty();
};

// Returns queue keys
queue.prototype.getKeys = function () {
    return this.q.getKeys();
};

// Get pending messages count
queue.prototype.getPendingCount = function () {
    return this.q.getPendingCount();
};

module.exports = queue;