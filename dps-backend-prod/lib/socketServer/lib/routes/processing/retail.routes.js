/**
 * @file Retail processing routes.
 * Handles charge, reverse, refund, and cancel transactions via ISO 8583 messages.
 * PCI DSS 4.0: Req 3.4 (CHD handling), Req 4.2.1 (secure transmission), Req 10.2.1 (audit logging), Req 11.3.1 (secure processing).
 */
const router            = require('express').Router();
const { parserJsonIso } = require('../../services/tx.service.pro');

/** Retail charge. */
router.post("/charge",                (req, res) => {parserJsonIso(req, res, 200, "00", "03", "1",  "4");});

/** Retail reversal. */
router.post("/reverse/:id",           (req, res) => {parserJsonIso(req, res, 420, "16", "03", "1", "16");});

/** Retail refund. */
router.post("/refund/:id",            (req, res) => {parserJsonIso(req, res, 220, "20", "03", "1",  "7");});

/** Retail cancellation. */
router.post("/cancel/:id",            (req, res) => {parserJsonIso(req, res, 220, "02", "03", "1",  "6");});

module.exports = router;