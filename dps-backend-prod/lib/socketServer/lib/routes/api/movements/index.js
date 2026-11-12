/**
 * @file Transaction movements and reporting routes.
 * Provides movements, summaries, cache control, reports, and enhanced transaction exports.
 * PCI DSS 4.0: Req 7.1.1 / 7.1.2 (user-scoped transaction access), Req 10.2.1 (audit logging).
 */
const express       = require('express');
const router        = express.Router();
const { validate }  = require('express-validation')

const controller    = require('../../../controllers/SPA/Movements/movements.pro.controller')
const ctrl          = require('../../../controllers/reportes.controller')
const validator   = require('../../../controllers/SPA/Movements/validator')

/** Returns movements based on validated filters. */
router.post('/',validate(validator.movements), controller.get )

/** Returns movement summary. */
router.post('/summary', controller.getMovements )
/** Returns cache status. */
router.post('/cache-status', controller.cacheStatus);
/** Warms the movements cache. */
router.post('/warm-cache', controller.warmCache);
/** Direct movement query bypassing cache. */
router.post('/direct', controller.getMovementsDirect);

/** Returns full liquidation report. */
router.post('/all',  ctrl.getReportLiquidation )
/** Returns POS JSON report. */
router.post('/posjson', ctrl.getPosJson )
/** Returns chargebacks report. */
router.post('/chargebacks',  ctrl.getContracargo )
/** Returns tickets report. */
router.post('/tickets', ctrl.getTickets )

// Enhanced transactions routes
/** Mounts enhanced transaction query/export routes. */
router.use('/enhanced-transactions', require('../../../routes/enhanced-transactions.routes'));

// Direct export route as fallback
/** Direct fallback for enhanced transaction export. */
router.post('/enhanced-transactions/export', require('../../../controllers/enhanced-transactions.controller').exportTransactions);

module.exports = router;