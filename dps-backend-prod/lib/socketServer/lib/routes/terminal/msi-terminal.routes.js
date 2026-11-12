/**
 * @file MSI terminal webservice routes.
 * Handles MSI configuration and BIN validation requests from payment terminals.
 * PCI DSS 4.0: Req 8.2.1 / 8.3.2 (terminal token authentication), Req 3.4 / 3.5.1 (BIN data protection), Req 10.2.1 (audit logging), Req 12.3.1 (device configuration).
 */
const router = require('express').Router();
const { verifyToken } = require('../../middlewares/jtwAuth.middleware');
const MsiTerminalController = require('../../controllers/terminal/msi-terminal.controller');

/** Enforces JWT authentication on all terminal MSI routes. */
router.use(verifyToken);

/** Gets MSI configuration for a terminal. */
router.post('/msi-config', MsiTerminalController.getMsiConfig);

/** Updates MSI configuration from a terminal. */
router.put('/msi-config', MsiTerminalController.updateMsiConfig);

/** Validates a BIN for MSI eligibility. */
router.post('/validate-bin', MsiTerminalController.validateBin);

module.exports = router;
