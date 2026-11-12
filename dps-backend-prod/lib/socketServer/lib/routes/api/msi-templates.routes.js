/**
 * @file MSI template management routes.
 * Supports template CRUD and bulk application to merchants.
 * PCI DSS 4.0: Req 7.1.1 / 7.2.1 (access control), Req 10.2.1 (audit logging), Req 12.3.1 (configuration management).
 */
const router = require('express').Router();
const MsiTemplatesController = require('../../controllers/msi/msi-templates.controller');

/** Gets all MSI templates. */
router.get('/', MsiTemplatesController.getTemplates);

/** Gets only active MSI templates. */
router.get('/active', MsiTemplatesController.getActiveTemplates);

/** Gets a specific MSI template. */
router.get('/:id_template', MsiTemplatesController.getTemplate);

/** Creates a new MSI template. */
router.post('/', MsiTemplatesController.createTemplate);

/** Updates an MSI template. */
router.put('/:id_template', MsiTemplatesController.updateTemplate);

/** Deletes an MSI template. */
router.delete('/:id_template', MsiTemplatesController.deleteTemplate);

/** Applies a template to merchants. */
router.post('/:id_template/apply', MsiTemplatesController.applyTemplateToMerchants);

module.exports = router;
