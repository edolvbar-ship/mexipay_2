
/**
 * @file SPA merchant routes protected by JWT.
 * PCI DSS 4.0: Req 8.2.1 / 8.3.2 (authentication), Req 7.1.1 / 7.2.1 (access control).
 */
const express                             = require('express');
const router                              = express.Router();
const { verifyToken }                     = require('../../../middlewares/jtwAuth.middleware')
const merchantCtrl                       = require('../../../controllers/SPA/Merchants/merchants.controller.js')

/** Enforces JWT authentication on all merchant routes. */
router.use(verifyToken)

// Routes
/** Returns merchant data for the SPA. */
router.post('/' , merchantCtrl.render );



module.exports = router;