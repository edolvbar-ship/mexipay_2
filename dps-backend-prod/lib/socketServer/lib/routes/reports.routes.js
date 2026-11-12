/**
 * @file Report and ticket generation routes.
 * PCI DSS 4.0: Req 10.2.1 (audit logging), Req 7.1.1 (access control for transaction reports).
 */
const router            = require('express').Router();
const reportController  = require('../controllers/reportes.controller');


/** Generates and returns a transaction ticket. */
router.post('/getTicket', reportController.getTicket);

/** Generates status reports. */
router.post('/estados/make', reportController.makeStados);
/** Returns consolidated data for a specific day and client. */
router.get('/consolidation/:day/:cliente', reportController.getConsolidation);

module.exports = router;