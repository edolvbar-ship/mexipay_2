/**
 * @file Payment link management routes.
 * Supports link creation, listing, merchant selection, and distribution by email/SMS/WhatsApp.
 * PCI DSS 4.0: Req 4.2.1 (CHD in transit), Req 7.1.1 (merchant-scoped access), Req 10.2.1 (audit logging).
 */
const express       = require('express');
const router        = express.Router();
const { validate }  = require('express-validation');
const { check } = require('express-validator');

const ctrl    = require('../../../controllers/SPA/Links/links.controller')
const validator   = require('../../../controllers/SPA/Links/validator')

/** Creates a new payment link (validated). */
router.post('/',validate(validator.createLinkDto), ctrl.get );
/** Lists all payment links. */
router.post('/get', ctrl.getAllLinks );
/** Lists payment links filtered by parameters. */
router.post('/links', ctrl.getAllLinksByParams );
/** Returns merchants eligible for payment link creation (with selia_id). */
router.get('/merchants', ctrl.getMerchantsForLinks );
/** Sends a payment link by email. */
router.post('/email',
    check('email', 'Correo no válido').isEmail(),
    check('token', 'Valor no válido').not().isEmpty(),
    ctrl.sentByEmail );

/** Sends a payment link by SMS. */
router.post('/sms', 
    check(['token', 'to'], 'Valores requeridos').not().isEmpty(),
    ctrl.sentBySms );

/** Sends a payment link by WhatsApp. */
router.post('/whatsapp', 
  check(['token', 'to'], 'Valores requeridos').not().isEmpty(),
  ctrl.sentByWhatsapp );

module.exports = router;