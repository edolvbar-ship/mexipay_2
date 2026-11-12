/**
 * @file Ecommerce processing routes.
 * Handles charge, cancel, refund, reverse, pre-authorization and post-authorization ecommerce transactions.
 * PCI DSS 4.0: Req 3.4 (CHD handling), Req 4.2.1 (secure CHD in transit), Req 8.2.1 / 8.3.2 (3DS session authentication), Req 10.2.1 (audit logging), Req 11.3.1 (secure processing).
 */
const router = require('express').Router();
const { parserJsonIso } = require('../../services/tx.service.pro');
const { seccion } = require('../../services/3ds.service');

/** Ecommerce charge (requires 3DS session). */
router.post('/charge',seccion, (req, res) => {
  parserJsonIso(req, res, 200, '00', '09', '1', '4');
});
/** Ecommerce cancellation. */
router.post('/cancel/:id', (req, res) => {
  parserJsonIso(req, res, 220, '02', '09', '1', '6');
});
/** Ecommerce refund. */
router.post('/refund/:id', (req, res) => { parserJsonIso(req, res, 200, '20', '09', '1', '7'); });
/** Ecommerce reversal. */
router.post('/reverse/:id', (req, res) => { 
  parserJsonIso(req, res, 420, '00', '09', '1', '16'); 
});
/** Ecommerce pre-authorization. */
router.post('/preauth', (req, res) => { parserJsonIso(req, res, 200, '00', '09', '0', '18'); });
/** Ecommerce post-authorization (capture). */
router.post('/postauth/:id', (req, res) => { parserJsonIso(req, res, 220, '20', '03', "1", "19"); });


module.exports = router;