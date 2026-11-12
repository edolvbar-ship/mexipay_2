/**
 * @file Client management routes.
 * PCI DSS 4.0: Req 7.1.1 / 7.2.1 (access control), Req 10.2.1 (audit logging), Req 12.4 (user account management).
 */
const express       = require('express');
const router        = express.Router();
const { validate }  = require('express-validation')

const clientCtrl  = require('../../../controllers/SPA/Clients/index.controller')
const validator   = require('../../../controllers/SPA/Clients/clientsValidation')

/** Returns client data. */
router.post('/get' , clientCtrl.get )
/** Creates a new client. */
router.post('/', clientCtrl.create )
/** Updates an existing client. */
router.post('/update', clientCtrl.edit )
/** Deletes a client (validated). */
router.post('/delete', validate(validator.deleteClientValidation) , clientCtrl.delete )

module.exports = router;