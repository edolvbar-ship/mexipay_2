/**
 * @file MSI BIN range management routes.
 * Handles Mexican BIN ranges for monthly interest-free installment eligibility.
 * PCI DSS 4.0: Req 3.4 / 3.5.1 (PAN/BIN data protection), Req 7.1.1 (access control), Req 10.2.1 (audit logging).
 */
const router = require('express').Router();
const MsiBinsController = require('../../controllers/msi/msi-bins.controller');

/** Gets all national BIN ranges. */
router.get('/national', MsiBinsController.getNationalBins);

/** Adds a new national BIN range. */
router.post('/national', MsiBinsController.addNationalBin);

/** Updates a BIN range. */
router.put('/:id_msi_bin', MsiBinsController.updateBinRange);

/** Removes a BIN range. */
router.delete('/:id_msi_bin', MsiBinsController.removeNationalBin);

/** Checks BIN eligibility for MSI. */
router.post('/check-eligibility', MsiBinsController.checkBinEligibility);

module.exports = router;
