/**
 * @file Merchant API routes for CRUD and MSI configuration management.
 * PCI DSS 4.0: Req 7.1.1 / 7.2.1 (access control), Req 10.2.1 (audit logging), Req 12.3.1 (configuration management).
 */
const express       = require('express');
const router        = express.Router();
const { validate }  = require('express-validation')

const merchantController    = require('../../../controllers/SPA/Merchants/merchants.api.controller')
const validator   = require('../../../controllers/SPA/Merchants/validator')

/** Lists merchants. */
router.get('/', merchantController.getMerchants )
/** Returns merchant details by ID. */
router.get('/:id', merchantController.getMerchantById )
/** Creates a merchant. */
router.post('/', merchantController.createMerchant )
/** Edits a merchant. */
router.post('/edit', merchantController.editMerchant )
/** Deletes a merchant (validated). */
router.post('/delete', validate( validator.delete), merchantController.deleteMerchant )
/** Returns merchant info by parameters. */
router.post('/get', merchantController.getinfo)
/** Returns MSI configuration for a merchant. */
router.get('/:id_merchant/msi-config', merchantController.getMsiConfig)
/** Updates MSI configuration for a merchant. */
router.put('/:id_merchant/msi-config', merchantController.updateMsiConfig)

module.exports = router;