/**
 * @file MSI reporting and analytics routes.
 * PCI DSS 4.0: Req 7.1.1 (access control), Req 10.2.1 (audit logging), Req 3.4 (sensitive report data).
 */
const router = require('express').Router();
const MsiReportsController = require('../../controllers/msi/msi-reports.controller');

/** Generates an MSI report. */
router.post('/generate', MsiReportsController.generateReport);

/** Gets MSI summary statistics. */
router.get('/summary', MsiReportsController.getSummary);

module.exports = router;
