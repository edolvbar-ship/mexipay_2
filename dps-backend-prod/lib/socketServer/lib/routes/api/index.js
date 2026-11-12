/**
 * @file v2 API route aggregator for MSI and merchant management modules.
 * Applies JWT authentication to protected sub-routes.
 * PCI DSS 4.0: Req 8.2.1 / 8.3.2 (authentication), Req 7.1.1 / 7.2.1 (access control).
 */
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middlewares/jtwAuth.middleware');

// Apply authentication to all MSI-related routes
/** Mounts role management routes (JWT protected). */
router.use('/roles', verifyToken, require('./roles'));
/** Mounts user management routes (JWT protected). */
router.use('/users', verifyToken, require('./users'));
/** Mounts profile management routes (JWT protected). */
router.use('/profiles', verifyToken, require('./profiles'));
/** Mounts MCC operations routes (JWT protected). */
router.use('/mcc-operations', verifyToken, require('./mcc-operations/mcc-operations.routes'));
/** Mounts MSI BIN range routes (public or protected downstream). */
router.use('/msi-bins', require('./msi-bins.routes'));
/** Mounts MSI template routes (JWT protected). */
router.use('/msi-templates', verifyToken, require('./msi-templates.routes'));
/** Mounts MSI report routes (JWT protected). */
router.use('/msi-reports', verifyToken, require('./msi-reports.routes'));
/** Mounts MSI system config routes (JWT protected). */
router.use('/msi', verifyToken, require('./msi-system-config.routes'));
/** Mounts MSI operations routes (JWT protected). */
router.use('/msi', verifyToken, require('./msi-operations.routes'));
/** Mounts MSI merchant routes (JWT protected). */
router.use('/msi', verifyToken, require('./msi-merchants.routes'));
/** Mounts merchant CRUD routes (JWT protected). */
router.use('/merchants', verifyToken, require('./merchant/index'));

module.exports = router;
