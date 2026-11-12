/**
 * @file Authenticated merchant API routes for SMS/WhatsApp notifications and payment-link sharing.
 * All routes require merchant validation and TKA authentication.
 * PCI DSS 4.0: Req 8.2.1 / 8.3.2 (merchant authentication), Req 4.2.1 (message data in transit).
 */
const { IsValidTka , isMerchantValid }    = require('../lib/auth');
const ctrl                                = require('../controllers/api_notifications.controller');
const express                             = require('express');
const router                              = express.Router();
const { verifyToken } = require('../../../App-TDM/src/lib/helpers');

const { check } = require('express-validator');


// Authorization
/** Enforces merchant identity validation on all routes. */
router.use(isMerchantValid);
/** Enforces TKA token validation on all routes. */
router.use(IsValidTka);

// Routes
router.post('/sms', [
        check(['trace_id', 'authorization', 'id'], 'Valor requeridos').not().isEmpty(), 
        check('numbers').isArray()
        .withMessage('El campo numbers debe ser un arreglo de números.'),
        check('numbers.*').isNumeric()
        .withMessage('Todos los elementos en el arreglo numbers deben ser números.')
    ],
    ctrl.sendSms );

router.post('/whatsapp', 
    [
        check(['trace_id', 'authorization', 'id','to'], 'Valor requeridos').not().isEmpty(),   
    ],
    ctrl.sendWhatsapp );

router.post('/whatsapp/paymentlink', 
    [ check(['message', 'to'], 'Valor requeridos').not().isEmpty() ],
    ctrl.sendPaymentLinkByWhatSapp );

router.post('/sms/paymentlink', [
        check(['message'], 'Valor requeridos').not().isEmpty(),
        check('numbers').isArray()
        .withMessage('El campo numbers debe ser un arreglo de números.')
    ],
    ctrl.sendPaymentLinkBySms );

    

module.exports = router;