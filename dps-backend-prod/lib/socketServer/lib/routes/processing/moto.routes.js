/**
 * @file MOTO (Mail Order/Telephone Order) processing routes.
 * Handles MOTO charge, cancel, refund, and reverse transactions via ISO 8583 messages.
 * PCI DSS 4.0: Req 3.4 (CHD handling), Req 4.2.1 (secure transmission), Req 8.1.6 (MOTO user controls), Req 10.2.1 (audit logging).
 */
const router = require('express').Router();
const { parserJsonIso } = require('../../services/tx.service.pro');

/** MOTO charge. */
router.post("/charge", (req, res) => { parserJsonIso(req, res, 200, "00", "08", "1", "4"); });
/** MOTO cancellation. */
router.post("/cancel/:id", (req, res) => { parserJsonIso(req, res, 220, "02", "08", "1", "6"); });
/** MOTO refund. */
router.post("/refund/:id",              (req, res) => {parserJsonIso(req, res, 200, "20", "08", "1",  "7");});
/** MOTO reversal. */
router.post("/reverse/:id", (req, res) => { parserJsonIso(req, res, 420, "00", "08", "1", "16"); });

module.exports = router;