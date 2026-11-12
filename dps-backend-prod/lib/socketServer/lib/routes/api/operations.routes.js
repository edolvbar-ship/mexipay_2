/**
 * @file Giro/operation catalog routes.
 * All routes require token authentication.
 * PCI DSS 4.0: Req 7.1.1 / 7.2.1 (access control), Req 8.2.1 / 8.3.2 (authentication), Req 10.2.1 (audit logging).
 */
const express = require('express');
const router = express.Router();
const operationsCtrl = require('../controllers/SPA/Operations/operations.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');

/** Enforces token authentication on all operations routes. */
router.use(authenticateToken);

/** Gets all operations, optionally filtered by giro. */
router.get('/', operationsCtrl.getOperations);

/** Gets an operation by ID. */
router.get('/:id', operationsCtrl.getOperationById);

/** Gets operations by giro ID. */
router.get('/giro/:id_giro', operationsCtrl.getOperationsByGiro);

/** Gets operations by merchant's giro. */
router.get('/merchant/:id_merchant', operationsCtrl.getOperationsByMerchantGiro);

/** Creates a new operation. */
router.post('/', operationsCtrl.createOperation);

/** Updates an operation. */
router.put('/:id', operationsCtrl.updateOperation);

/** Deletes an operation (soft delete). */
router.delete('/:id', operationsCtrl.deleteOperation);

module.exports = router;
