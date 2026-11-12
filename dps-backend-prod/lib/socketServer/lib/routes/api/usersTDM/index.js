/**
 * @file TDM user management routes.
 * PCI DSS 4.0: Req 8.1.6 (user account management), Req 7.1.1 (access control), Req 10.2.1 (audit logging).
 */
const express   = require('express');
const router    = express.Router();
const userController = require('../../../controllers/userTDM.controller')
// Routes
/** Lists TDM users. */
router.get('/', userController.list)
/** Creates a TDM user. */
router.post('/', userController.create)
/** Deletes a TDM user. */
router.delete('/:id', userController.delete)
/** Updates a TDM user. */
router.put('/:id', userController.update)
/** Returns a TDM user by ID. */
router.get('/:id', userController.getById)

module.exports = router;