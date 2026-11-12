/**
 * @file Bar processing routes.
 * Handles pre-authorization style ISO 8583 transactions (checkin, checkout, reauthorize, reverse, refund, cancel) for bar operations.
 * PCI DSS 4.0: Req 3.4 (CHD handling), Req 4.2.1 (secure transmission), Req 10.2.1 (audit logging), Req 11.3.1 (secure processing logic).
 */
const router            = require('express').Router();
const { parserJsonIso } = require('../../services/tx.service.pro');

// Note: operative charge is not present here because ISO8583 is used to register the transaction
// and its status, not to charge the customer. The actual charge is committed in ecommerce routes.

/** Bar check-in (pre-authorization). */
router.post("/checkin",                  (req, res) => {parserJsonIso(req, res, 200, "00", "03", "0", "10");});
/** Bar check-out (capture). */
router.post("/checkout/:id",             (req, res) => {parserJsonIso(req, res, 220, "00", "03", "1", "12");});
/** Bar reauthorization. */
router.post("/reauthorize/:id",          (req, res) => {parserJsonIso(req, res, 200, "00", "03", "0", "11");});
/** Bar reversal. */
router.post("/reverse/:id",              (req, res) => {parserJsonIso(req, res, 420, "00", "03", "1", "16");});
/** Bar refund. */
router.post("/refund/:id",               (req, res) => {parserJsonIso(req, res, 200, "20", "03", "1",  "7");});
/** Bar cancellation. */
router.post("/cancel/:id",               (req, res) => {parserJsonIso(req, res, 220, "02", "03", "1",  "6");}); 

module.exports = router;

