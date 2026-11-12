/**
 * @file BIN (Bank Identification Number) catalog routes.
 * Supports CRUD, upload, and lookup by BIN code.
 * PCI DSS 4.0: Req 3.4 (BIN protection), Req 7.1.1 (access control), Req 10.2.1 (audit logging).
 */
const express   = require('express');
const fileUpload = require('express-fileupload');
const router    = express.Router();
const binesController = require('../../../controllers/bines.controller');

/** Enables file upload middleware for BIN catalog imports. */
router.use(fileUpload());

// Routes
/** Lists BIN catalogs. */
router.get('/catalogs', binesController.listCatalogs);

/** Lists BIN entries. */
router.get('/', binesController.list);
/** Returns BIN details by ID. */
router.get('/:id', binesController.detail);
/** Creates a new BIN entry. */
router.post('/', binesController.create);
/** Deletes a BIN entry. */
router.delete('/:id', binesController.delete);
/** Updates a BIN entry. */
router.put('/:id', binesController.update);
/** Uploads a BIN catalog file. */
router.post('/upload-file', binesController.uploadFile);
/** Returns BIN details by code. */
router.get('/:code/code', binesController.detailByCode);

module.exports = router;