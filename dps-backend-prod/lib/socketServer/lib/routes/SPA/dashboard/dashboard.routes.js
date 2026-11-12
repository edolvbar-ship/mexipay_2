
/**
 * @file SPA dashboard routes protected by JWT.
 * PCI DSS 4.0: Req 8.2.1 / 8.3.2 (authentication), Req 7.1.1 (access control), Req 10.2.1 (audit logging).
 */
const express                             = require('express');
const router                              = express.Router();
const { verifyToken }                     = require('../../../middlewares/jtwAuth.middleware')
const dashboardCtrl                       = require('../../../controllers/SPA/Dashboard/dashboard.controller')

/** Enforces JWT authentication on all dashboard routes. */
router.use(verifyToken)

// Routes
/** Returns dashboard/profile data for the authenticated user. */
router.post('/' , dashboardCtrl.getDataProfile );



module.exports = router;