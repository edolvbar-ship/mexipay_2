/**
 * @file MSI system configuration routes.
 * Manages global MSI settings.
 * PCI DSS 4.0: Req 7.1.1 (admin access control), Req 10.2.1 (audit logging), Req 12.3.1 (secure configuration).
 */
const router = require('express').Router();
const MsiSystemConfigController = require('../../controllers/msi/msi-system-config.controller');

/** Gets MSI system configuration. */
router.get('/system-config', MsiSystemConfigController.getSystemConfig);

/** Updates MSI system configuration. */
router.put('/system-config', MsiSystemConfigController.updateSystemConfig);

module.exports = router;
