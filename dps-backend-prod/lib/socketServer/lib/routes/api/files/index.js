/**
 * @file File processing and report file routes.
 * Handles liquidation, chargebacks, tickets, POS JSON, and generic file uploads.
 * PCI DSS 4.0: Req 7.1.1 (access control), Req 10.2.1 (audit logging), Req 11.3.1 (file handling security).
 */
const express       = require('express');
const router        = express.Router();
const { validate }  = require('express-validation');

const multer              = require('multer');
const upload              = multer({dest: 'tmp'});

const ctrl    = require('../../../controllers/reportes.controller');
const filesCtrl    = require('../../../controllers/files.controller');

const validator   = require('../../../controllers/SPA/Reports/validator')

/** Generates liquidation report. */
router.post('/liquidation', validate( validator.liquidation), ctrl.getReportLiquidation )
/** Generates chargebacks report. */
router.post('/chargebacks', validate( validator.liquidation), ctrl.getContracargo )
/** Generates tickets report. */
router.post('/tickets', validate( validator.liquidation), ctrl.getTickets )
/** Generates POS JSON report. */
router.post('/posJson', validate( validator.liquidation), ctrl.getPosJson )

/** Returns files by type. */
router.post('/getDT', filesCtrl.getFilesByType )

/** Processes uploaded files (multiparty). */
router.post('/process', upload.array('file'), filesCtrl.processFile )

/** Returns a file by ID. */
router.get('/:id', filesCtrl.getFileById )



module.exports = router;