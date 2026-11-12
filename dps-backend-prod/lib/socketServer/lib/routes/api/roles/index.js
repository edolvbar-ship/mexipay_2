/**
 * @file Role (profile) management routes.
 * PCI DSS 4.0: Req 7.1.1 / 7.2.1 (RBAC), Req 10.2.1 (audit logging for role changes).
 */
const express = require('express');
const router = express.Router();
const profileController = require('../../../controllers/profiles.controller');
/** Lists roles. */
router.get('/', profileController.list);
/** Creates a role. */
router.post('/', profileController.saveNewProfile);
/** Returns role details. */
router.get('/:id', profileController.details);
/** Updates a role. */
router.put('/:id', profileController.updateProfile);
/** Deletes a role. */
router.delete('/:id', profileController.deleteProfile);
module.exports = router;
