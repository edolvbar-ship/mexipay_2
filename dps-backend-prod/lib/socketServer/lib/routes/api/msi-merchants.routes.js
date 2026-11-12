/**
 * @file MSI merchant configuration routes.
 * Handles MSI template assignment and merchant configuration history.
 * PCI DSS 4.0: Req 7.1.1 (merchant access control), Req 10.2.1 (audit logging), Req 12.3.1 (configuration management).
 */
const router = require('express').Router();
const MsiMerchantsController = require('../../controllers/msi/msi-merchants.controller');

/** Gets all merchants with MSI configuration. */
router.get('/merchants', MsiMerchantsController.getMerchantsWithMsi);

/** Gets MSI configuration history for a merchant. */
router.get('/merchants/:id_merchant/history', MsiMerchantsController.getMerchantConfigHistory);

/** Assigns an MSI template to a merchant. */
router.post('/merchants/:id_merchant/templates/:id_template', MsiMerchantsController.assignTemplateToMerchant);

/** Removes an MSI template from a merchant. */
router.delete('/merchants/:id_merchant/templates/:id_template', MsiMerchantsController.removeTemplateFromMerchant);

module.exports = router;
