//
// This file contains basic logic for sending the system-specific (PROSA) auto-reversal messages
//
var iso8583Packet    = require('../../../../lib/iso8583-packet');
var moment           = require('moment');
var helpers          = require("../../../../lib/helpers");
var maxRetry = 10;
var rq = '';

function Iso8583Logic(upstream) {
  this.upstream = upstream;
  this.name = 'Iso8583.Logic';
  this.queueMessageId = null;
}

Iso8583Logic.prototype.hasGone = function(qe, node) {
  console.log('(BANREGIO) Iso8583Logic.hasGone');
  if (rq && (qe.messageTypeId == 210 || qe.messageTypeId == 230)) {
    if(qe.fields[39] != '00') {
      helpers.saveIsoMessage(16, qe.messageTypeId, rq.fields[11], rq.fields[37], rq.fields[4], qe.fields[39], qe.fields[38],
      '', '', '', rq.fields[22], '', rq.fields[13], rq.fields[12], rq.fields[17], rq.fields[63], qe.fields[63], rq.fields[43], node); 
    }
    else {     
      helpers.saveIsoMessage(16, qe.messageTypeId, rq.fields[11], rq.fields[37], rq.fields[4], qe.fields[39], qe.fields[38], 
      '', '', '', rq.fields[22], '', rq.fields[13], rq.fields[12], rq.fields[17], rq.fields[63], qe.fields[63], rq.fields[43], node); 

      var p = new iso8583Packet(qe.fields);
      p.setFields({
        0: '0420',
        7: helpers.fechaUTC(), 
      11: helpers.randomString(6,1),
      43: rq.fields[43],
      63: rq.fields[63],
      90: rq.messageTypeId + rq.fields[37] + rq.fields[13] + rq.fields[12] + '00' + rq.fields[17] + '0000000000',
      123: '                    ',
      126: rq.fields[126]
      });

      this.upstream.sendData(this, p, {
        parent:     qe,
        delayTime: timeout,
        comment: 'Has Gone Auto-Reversal message. Merchant: ' + qe.fields[42] + '; terminal: ' +  qe.fields[41] + '; stan: ' + qe.fields[11],
        updateQueueMessageId: true
      });
    }
  }
  
  if (!qe.isSystemSender && !qe.isProcessed) {
    return;
  }

  var now = moment(new Date());
  this.name = 'Iso8583.Logic #' + qe.id;

  if (qe.retryCount == maxRetry) {
    dd(('Warning: reached max retry count for ' + qe.senderName + '. Giving up!\n' + qe.packet.pretty()).yellow);

    return;
  }

  if (qe.packet.hasErrors()) {
    dd('Iso8583.Logic: message contains check errors. Will not process');

    return;
  }

  // Purchase 200
  if (qe.packet.messageTypeId == 200) {
    rq = qe.packet;
    if (!qe.packet.getField(37)) {
      dd('Error: unconfirmed 200 messages has no track2 data. Will not do auto-reversal');

      return;
    }

    dd('Sending auto-reversal message. Merchant: ' + qe.packet.getField(42) + '; terminal: ' +  qe.packet.getField(41) + '; stan: ' + qe.packet.getField(11));

  // Auto-Reverse 420
  } else if (qe.packet.messageTypeId == 420 && qe.isSystemSender) {
    if (!qe.retryCount) {
      var timeout = 0
    } else if (qe.retryCount == 1) {
      var timeout = 2000;
    } else if (qe.retryCount < 8) {
      var timeout = 10000;
    } else {
      var timeout = 300000;
    }

    var p = new iso8583Packet(qe.packet);
    p.setFields({
      7: now.format("MMDDHHmmss")                    // Data & Time, Transmission
    });

    this.upstream.sendData(this, p, {
                      parent:     qe,
                      delayTime: timeout,
                      comment: 'Repeating auto-reversal message. Merchant: ' + qe.packet.getField(42) + '; terminal: ' +  qe.packet.getField(41) + '; stan: ' + qe.packet.getField(11) + '. Attempt ' + (qe.retryCount + 1),
                      updateQueueMessageId: true
                    });
  } 
};

// Use this method to send a message each time the upstream connection is being established
Iso8583Logic.prototype.onConnect = function() {
  var now = moment(new Date());
  var p = new iso8583Packet();
  p.setFields({
    0:   '0800',
    7:   helpers.fechaUTC(),                    // Data & Time, Transmission
    11:  helpers.randomString(6,1),
    70: '001'
  });
  
  dd(('Logon Sent...').green), 'info';
  dd(('[' + helpers.safeLog(p.getMessage(), ['isoMessage']).substring(0,20) + '...]').cyan, 'verbose');

  this.upstream.sendData(this, p);

  return true;
};

Iso8583Logic.prototype.queueTimeout = function() {
  console.log('(BANREGIO) Iso8583Logic.queueTimeout');

  this.upstream.hasGone(this.queueMessageId);
};

Iso8583Logic.prototype.isClosed = function() {
  return false;
};

Iso8583Logic.prototype.end = function() {

};

Iso8583Logic.prototype.reply = function(p, qe, rq, node) {
  console.log('(BANREGIO) Iso8583Logic.reply');

  if (!p.isSystemFaulty) {
    dd(this.name + ' got proper reply');
    if (p.messageTypeId == 430)
      helpers.saveIsoMessage(16, p.messageTypeId, p.fields[11], p.fields[37], p.fields[4], p.fields[39], p.fields[38], '', '', '', p.fields[22], '', p.fields[13], p.fields[12], qe.packet.fields[17], qe.packet.fields[63], p.fields[63], qe.fields[43],  node); 

    if(p.messageTypeId == 810 || p.messageTypeId == 800)
      helpers.saveEchoLog(p.rawData.toString().substring(0,12), p.fields[0], p.fields[1], p.fields[7], p.fields[11], p.fields[39], p.fields[70], node);
  } else {
    dd(`Warning: ${this.name} got system faulty reply`);
    this.hasGone(qe);
  }
  
  return true;
};

Iso8583Logic.prototype.replyUpstreamEcho = function(p) {
  var now = moment(new Date());

  p.setFields({
    0: '0810',
    7:  helpers.fechaUTC(), 
    39: '00'
  });

  p.unsetFields([24, 42]);

  return p;
};

Iso8583Logic.prototype.sendUpstreamEcho = function() {
  var p = new iso8583Packet();

  p.setFields({
    0: '0800',
    7: helpers.fechaUTC(), 
   11: helpers.randomString(6,1),
   70: '301'
  });

  dd(('Echo Sent...').green), 'info';
  dd(('[' + helpers.safeLog(p.getMessage(), ['isoMessage']).substring(0,20) + '...]').cyan, 'verbose');

  this.upstream.sendData(this, p);

  return true;
};

module.exports = Iso8583Logic;
