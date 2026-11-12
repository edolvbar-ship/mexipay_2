/**
 * @file 3D Secure processing route aggregator.
 * Mounts ecommerce 3DS verification sub-routes.
 * PCI DSS 4.0: Req 8.2.1 / 8.3.2 (3DS authentication), Req 4.2.1 (secure CHD in transit).
 */
const router                              = require('express').Router();

/** Mounts 3DS ecommerce verification routes. */
router.use('/ext/ecommerce', require('./3ds.ecommerce.routes'))

module.exports = router;
