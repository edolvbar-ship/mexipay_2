/**
 * @file Merchant listing and detail routes.
 * Detail endpoint requires TKA authentication.
 * PCI DSS 4.0: Req 8.2.1 / 8.3.2 (authentication), Req 7.1.1 (access control).
 */
const express = require('express');

const { IsValidTka } = require('../lib/auth');
const merchantCntrl = require('../controllers/merchant.controller');

const router = express.Router();

/** Lists merchants. */
router.get('/list', merchantCntrl.list);
/** Returns a specific merchant by ID; requires TKA token validation. */
router.get('/:id', IsValidTka, merchantCntrl.getByIdMerchant);

module.exports = router;
