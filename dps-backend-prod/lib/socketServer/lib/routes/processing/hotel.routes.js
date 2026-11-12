/**
 * @file Hotel processing routes.
 * Handles hotel transaction types (checkin, checkout, reauthorize, reverse, refund, cancel) via ISO 8583 messages.
 * PCI DSS 4.0: Req 3.4 (CHD handling), Req 4.2.1 (secure transmission), Req 10.2.1 (audit logging), Req 11.3.1 (secure processing).
 */
const router            = require('express').Router();
const { parserJsonIso } = require('../../services/tx.service.pro');

/** Hotel check-in (pre-authorization). */
router.post('/checkin', (req, res) => {
    parserJsonIso(req, res, 200, "00", "03", "0", "10")  // CHECK IN
});

/** Hotel check-out (capture). */
router.post('/checkout/:id', (req, res) => {
    parserJsonIso(req, res, 220, "00", "03", "1", "12")  // CHECK OUT
});

/** Hotel reauthorization. */
router.post('/reauthorize/:id', (req, res) => {
    parserJsonIso(req, res, 200, "00", "03", "0", "11")  // REAUTORIZACION
});

/** Hotel reversal. */
router.post("/reverse/:id",            (req, res) => {parserJsonIso(req, res, 420, "00", "03", "1", "16");});
/** Hotel refund. */
router.post("/refund/:id",             (req, res) => {parserJsonIso(req, res, 200, "20", "03", "1",  "7");});
/** Hotel cancellation. */
router.post("/cancel/:id",             (req, res) => {parserJsonIso(req, res, 220, "02", "03", "1",  "6");});

module.exports = router;