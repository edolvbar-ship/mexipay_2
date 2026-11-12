
/**
 * @file SPA consolidate routes protected by JWT.
 * PCI DSS 4.0: Req 8.2.1 / 8.3.2 (authentication), Req 10.2.1 (audit logging).
 */
const express                             = require('express');
const router                              = express.Router();
const { verifyToken }                     = require('../../../middlewares/jtwAuth.middleware')
const controller                       = require('../../../controllers/SPA/Consolidate/index.controller')

/** Enforces JWT authentication on all consolidate routes. */
router.use(verifyToken)

// Routes
/** Renders consolidation data for the SPA. */
router.post('/' , controller.render );



module.exports = router;