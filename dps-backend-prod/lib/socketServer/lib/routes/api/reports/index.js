/**
 * @file SPA report generation routes (liquidation, chargebacks, tickets, POS JSON, status reports).
 * PCI DSS 4.0: Req 7.1.1 (access control), Req 10.2.1 (audit logging), Req 3.4 (sensitive report data).
 */
const express       = require('express');
const router        = express.Router();
const { validate }  = require('express-validation')

const ctrl    = require('../../../controllers/reportes.controller')
const validator   = require('../../../controllers/SPA/Reports/validator')

/** Returns liquidation report (validated). */
router.post('/liquidation', validate( validator.liquidation), ctrl.getReportLiquidation )
/** Returns chargebacks report (validated). */
router.post('/chargebacks', validate( validator.liquidation), ctrl.getContracargo )
/** Returns tickets report (validated). */
router.post('/tickets', validate( validator.liquidation), ctrl.getTickets )
/** Returns POS JSON report (validated). */
router.post('/posJson', validate( validator.liquidation), ctrl.getPosJson )

/** Generates status reports. */
router.post('/estados/make', ctrl.makeStados);


module.exports = router;