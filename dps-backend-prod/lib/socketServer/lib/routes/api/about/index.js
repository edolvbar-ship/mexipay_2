
/**
 * @file Public API information/about routes.
 * PCI DSS 4.0: Req 12.3.1 (system documentation / versioning).
 */
const express       = require('express');
const router        = express.Router();

const aboutCtrl    = require('../../../controllers/SPA/About/about.controller')

/** Returns API information/versioning. */
router.get('/get-info', aboutCtrl.getInfo);



module.exports = router;