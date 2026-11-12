/**
 * @file Transactional profile management routes.
 * PCI DSS 4.0: Req 7.1.1 / 7.2.1 (access control), Req 10.2.1 (audit logging), Req 12.3.1 (configuration).
 */
const express   = require('express');
const router    = express.Router();
const transactionalProfileController = require('../../../controllers/transactionalProfiles.controller')
// Routes

/** Returns catalogs for transactional profiles. */
router.get('/catalogs', transactionalProfileController.catalogsList)

/** Lists transactional profiles. */
router.get('/', transactionalProfileController.list)
/** Returns transactional profile details. */
router.get('/:id', transactionalProfileController.detail)
/** Creates a transactional profile. */
router.post('/', transactionalProfileController.create)
/** Deletes a transactional profile. */
router.delete('/:id', transactionalProfileController.delete)
/** Updates a transactional profile. */
router.put('/:id', transactionalProfileController.update)

module.exports = router;