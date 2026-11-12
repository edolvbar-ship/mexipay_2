/**
 * @file MSI operations configuration routes.
 * PCI DSS 4.0: Req 7.1.1 (access control), Req 10.2.1 (audit logging), Req 12.3.1 (configuration management).
 */
const router = require('express').Router();
const MsiOperationsController = require('../../controllers/msi/msi-operations.controller');

/** Gets all MSI operations. */
router.get('/operations', MsiOperationsController.getOperations);

/** Updates an MSI operation. */
router.put('/operations/:id_operation', MsiOperationsController.updateOperation);

module.exports = router;
