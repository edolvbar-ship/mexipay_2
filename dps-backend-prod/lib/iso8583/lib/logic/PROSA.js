/* eslint-disable no-sequences */
/* eslint-disable no-unused-expressions */
/* eslint-disable no-redeclare */
/* eslint-disable no-var */
/* eslint-disable new-cap */
/* eslint-disable vars-on-top */
/* eslint-disable block-scoped-var */
/* eslint-disable no-use-before-define */
/* eslint-disable no-undef */
/* eslint-disable eqeqeq */
//
// This file contains basic logic for sending the system-specific (PROSA) auto-reversal messages
// lib/iso8583/lib/logic/PROSA.js
const moment = require('moment');
const iso8583Packet = require('../../../iso8583-packet');
const helpers = require('../../../helpers');
const db = require('../../../socketServer/lib/sequelize/init');

const maxRetry = 10;
let rq = '';

function Iso8583Logic(upstream) {
  this.upstream = upstream;
  this.name = 'Iso8583.Logic';
  this.queueMessageId = null;
}

Iso8583Logic.prototype.hasGone = async function (qe, node, isTimeOut = true) {
  let rq = await db.isoMessage.findOne({where: { 'trace_number': qe.fields[11] }});
  this.rq = rq;
  if (rq && (qe.messageTypeId == 210 || qe.messageTypeId == 230)) {
    const autoReverseInfo = rq.more_info ? JSON.parse(rq.more_info).autoReverseInfo : null;
    if (qe.fields[39] != '00') {
      helpers.saveIsoMessage(
        rq.id_operation,
        qe.messageTypeId,
        rq.trace_number,
        rq.reference_number,
        rq.amount,
        qe.fields[39],
        qe.fields[38],
        '',
        '',
        '',
        rq.entry_mode,
        '',
        rq.tran_date,
        rq.tran_time,
        rq.capture_date,
        rq.tkn_data_63_rq,
        qe.fields[63],
        autoReverseInfo?.fld43 || '',
        node,
        {},
        null,
        rq.more_info
      );
    } else {
      
      helpers.saveIsoMessage(
        rq.id_operation,
        qe.messageTypeId,
        rq.trace_number,
        rq.reference_number,
        rq.amount,
        qe.fields[39],
        qe.fields[38],
        '',
        '',
        '',
        rq.entry_mode,
        '',
        rq.tran_date,
        rq.tran_time,
        rq.capture_date,
        rq.tkn_data_63_rq,
        qe.fields[63],
        autoReverseInfo?.fld43 || '',
        node,
        {},
        null,
        rq.more_info
      );

      const p = new iso8583Packet(qe.fields);
      p.setFields({
        0: '0420',
        7: helpers.fechaUTC(),
        11: helpers.randomString(6, 1),
        39: isTimeOut ? '68': '91',
        43: autoReverseInfo?.fld43 || '',
        63: rq.tkn_data_63_rq,
        90: `0${rq.msg_type.slice(-3) + rq.reference_number + rq.tran_date + rq.tran_time}00${rq.capture_date}0000000000`,
        123: '                    ',
        125: autoReverseInfo?.fld125 || qe.fields[125],
        126: '00000000000000000000000000000000000000',
      });

      this.upstream.sendData(this, p, {
        parent: qe,
        delayTime: timeout,
        comment: `Has Gone Auto-Reversal message. Merchant: ${qe.fields[42]}; terminal: ${qe.fields[41]}; stan: ${qe.fields[11]}`,
        updateQueueMessageId: true,
      });
    }
  }

  if (!qe.isSystemSender && !qe.isProcessed) {
    return;
  }

  const now = moment(new Date());
  this.name = `Iso8583.Logic #${qe.id}`;

  if (qe.retryCount == maxRetry) {
    dd((`Warning: reached max retry count for ${qe.senderName}. Giving up!\n${qe.packet.pretty()}`).yellow);

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

    dd(`Sending auto-reversal message. Merchant: ${qe.packet.getField(42)}; terminal: ${qe.packet.getField(41)}; stan: ${qe.packet.getField(11)}`);

    // Auto-Reverse 420
  } else if (qe.packet.messageTypeId == 420 && qe.isSystemSender) {
    if (!qe.retryCount) {
      var timeout = 0;
    } else if (qe.retryCount == 1) {
      var timeout = 2000;
    } else if (qe.retryCount < 8) {
      var timeout = 10000;
    } else {
      var timeout = 300000;
    }

    var p = new iso8583Packet(qe.packet);
    p.setFields({
      7: now.format('MMDDHHmmss'), // Data & Time, Transmission
    });

    this.upstream.sendData(this, p, {
      parent: qe,
      delayTime: timeout,
      comment: `Repeating auto-reversal message. Merchant: ${qe.packet.getField(42)}; terminal: ${qe.packet.getField(41)}; stan: ${qe.packet.getField(11)}. Attempt ${qe.retryCount + 1}`,
      updateQueueMessageId: true,
    });
  }
};

// Use this method to send a message each time the upstream connection is being established
// eslint-disable-next-line func-names
Iso8583Logic.prototype.onConnect = function () {
  const now = moment(new Date());
  const p = new iso8583Packet();
  p.setFields({
    0: '0800',
    7: helpers.fechaUTC(), // Data & Time, Transmission
    11: helpers.randomString(6, 1),
    70: '001',
  });

  dd((`[${helpers.safeLog(p.getMessage(), ['isoMessage']).substring(0, 20)}...]`).cyan, 'verbose');

  this.upstream.sendData(this, p);

  return true;
};

Iso8583Logic.prototype.queueTimeout = function () {
  this.upstream.hasGone(this.queueMessageId);
};

Iso8583Logic.prototype.isClosed = function () {
  return false;
};

Iso8583Logic.prototype.end = function () {

};

Iso8583Logic.prototype.reply = function (p, qe, rq, node) {
  if (!p.isSystemFaulty) {
    dd(`${this.name} got proper reply`);

    if (p.messageTypeId == 430) {
      helpers.saveIsoMessage(
        16,
        p.messageTypeId,
        p.fields[11],
        p.fields[37],
        p.fields[4],
        p.fields[39],
        p.fields[38],
        '',
        '',
        '',
        p.fields[22],
        '',
        p.fields[13],
        p.fields[12],
        qe.packet.fields[17],
        qe.packet.fields[63],
        p.fields[63],
        qe.packet.fields[43],
        node,
        {},
        null,
        this.rq.more_info
      );
    }

    if (p.messageTypeId == 810 || p.messageTypeId == 800) {
      helpers.saveEchoLog(p.rawData.toString().substring(0, 12), p.fields[0], p.fields[1], p.fields[7], p.fields[11], p.fields[39], p.fields[70], node);
    }
  } else {
    dd(`Warning: ${this.name} got system faulty reply`);
    this.hasGone(qe);
  }

  return true;
};

Iso8583Logic.prototype.replyUpstreamEcho = function (p) {
  const now = moment(new Date());

  p.setFields({
    0: '0810',
    7: helpers.fechaUTC(),
    39: '00',
  });

  p.unsetFields([24, 42]);

  return p;
};

Iso8583Logic.prototype.sendUpstreamEcho = function () {
  const p = new iso8583Packet();

  p.setFields({
    0: '0800',
    7: helpers.fechaUTC(),
    11: helpers.randomString(6, 1),
    70: '301',
  });

  dd(('Echo Sent...').green), 'info';
  dd((`[${helpers.safeLog(p.getMessage(), ['isoMessage']).substring(0, 20)}...]`).cyan, 'verbose');

  this.upstream.sendData(this, p);

  return true;
};

module.exports = Iso8583Logic;
