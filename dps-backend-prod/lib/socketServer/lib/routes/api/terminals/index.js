/**
 * @file Terminal management routes.
 * PCI DSS 4.0: Req 7.1.1 (device access control), Req 10.2.1 (audit logging), Req 12.3.1 (device configuration).
 */
const express   = require('express');
const router    = express.Router();
const terminals = require('./../../../controllers/terminals.controller')
// Routes
/** Lists terminals. */
router.post('/', terminals.getTerminals);
/** Removes a device from a terminal. */
router.post('/removeDeviceTerminal', terminals.removeDeviceTerminalAPI);


module.exports = router;