/**
 * @file Authenticated merchant API routes for transaction data, signatures, and payment links.
 * All routes require merchant validation (isMerchantValid) and TKA authentication (IsValidTka).
 * PCI DSS 4.0: Req 8.2.1 / 8.3.2 (merchant authentication), Req 7.1.1 (access control).
 */
const { IsValidTka , isMerchantValid }    = require('../lib/auth');
const ctrl                                = require('../controllers/api_auth.controller');
const linkController = require('../controllers/link.controller');
const express                             = require('express');
const router                              = express.Router();
const { verifyToken } = require('../../../App-TDM/src/lib/helpers');


// Authorization
/** Enforces merchant identity validation on all routes. */
router.use(isMerchantValid);
/** Enforces TKA token validation on all routes. */
router.use(IsValidTka);


// Routes
router.post('/getTxData', ctrl.getTx );
router.post('/getTXApp',verifyToken, ctrl.getTxApp );
router.post('/saveSignature', ctrl.saveSignature );
router.post('/getSignature', ctrl.getSignature );
// API PARA GENERAR LINK DE PAGO
router.post('/generateLinkPayout',verifyToken,linkController.generateLink);
router.post('/getLinksData',verifyToken,linkController.getLinksData);
router.post('/sendLink',verifyToken,linkController.sendLink);



module.exports = router;