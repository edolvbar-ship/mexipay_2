/**
 * @file Car rental processing routes.
 * Maps car rental transaction types (charge, checkin, checkout, rentin, rentout, reauthorize, reverse, refund, cancel) to ISO 8583 messages.
 * PCI DSS 4.0: Req 3.4 (CHD handling), Req 4.2.1 (secure transmission), Req 10.2.1 (audit logging), Req 11.3.1 (secure processing).
 */
const router            = require('express').Router();
const { parserJsonIso } = require('../../services/tx.service.pro');

// Note: no charge service is present in car routes; charge service is handled by hotel/moto services.

/** Car rental charge. */
router.post("/charge",      (req, res) => {parserJsonIso(req, res, 200, "00", "03", "0",  "4");});
/** Car rental check-in. */
router.post("/checkin",         (req, res) => {parserJsonIso(req, res, 200, "00", "03", "0", "11");});
/** Car rental check-out. */
router.post("/checkout/:id",    (req, res) => {parserJsonIso(req, res, 220, "00", "03", "1", "12");});
/** Car rental rent-in. */
router.post("/rentin",          (req, res) => {parserJsonIso(req, res, 200, "00", "03", "0", "13");});
/** Car rental rent-out. */
router.post("/rentout/:id",     (req, res) => {parserJsonIso(req, res, 220, "02", "03", "1", "15");});
/** Car rental reauthorization. */
router.post("/reauthorize/:id", (req, res) => {parserJsonIso(req, res, 200, "00", "03", "0", "14");});
/** Car rental reversal. */
router.post("/reverse/:id",     (req, res) => {parserJsonIso(req, res, 420, "00", "03", "1", "16");});
/** Car rental refund. */
router.post("/refund/:id",      (req, res) => {parserJsonIso(req, res, 200, "20", "03", "1",  "7");});
/** Car rental cancellation. */
router.post("/cancel/:id",      (req, res) => {parserJsonIso(req, res, 220, "02", "03", "1",  "6");});

module.exports = router;

// car, hotel, retail (default), bar, moto, restaurant