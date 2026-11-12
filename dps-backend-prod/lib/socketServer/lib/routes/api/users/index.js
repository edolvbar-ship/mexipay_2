/**
 * @file User management routes.
 * PCI DSS 4.0: Req 8.1.6 / 8.2.1 (user identity management), Req 7.1.1 (access control), Req 10.2.1 (audit logging).
 */
const express = require('express');
const router = express.Router();
const userController = require('../../../controllers/user.controller');
/** Lists users. */
router.get('/', userController.users);
/** Returns a user by ID. */
router.get('/:id', userController.userById);
/** Creates a user. */
router.post('/', userController.createUser);
/** Updates a user. */
router.put('/:id', userController.updateUser);
/** Deletes a user. */
router.delete('/:id', userController.deleteUser);
module.exports = router;
