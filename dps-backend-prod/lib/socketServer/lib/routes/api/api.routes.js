/**
 * @file Main v2 API routes aggregator.
 * Mounts public routes (auth, about), then applies JWT verification and activity logging to all subsequent routes.
 * PCI DSS 4.0: Req 8.2.1 / 8.3.2 (authentication), Req 7.1.1 / 7.2.1 (access control), Req 10.2.1 / 10.3.1 (audit logging).
 */
const express = require('express');
const router = express.Router();
const { ValidationError } = require('express-validation');
const { verifyToken } = require('../../middlewares/jtwAuth.middleware');

const db = require('../../sequelize/init'); // Your models file
const activityLogger = require('../../middlewares/activityLogger')(db);

// Public routes (no authentication)
/** Mounts public authentication routes. */
router.use('/auth', require('../SPA/auth/auth.routes'));
/** Mounts public/about routes. */
router.use('/about', require('./about/index'));

// Apply authentication and logging to all routes below
/** Enforces JWT verification on all routes below this point. */
router.use(verifyToken);
/** Attaches asynchronous activity logging to all routes below this point. */
router.use(activityLogger);

// All routes below automatically have auth + logging
/** Mounts client management routes. */
router.use('/clients', require('./clients/index'));
/** Mounts merchant routes. */
router.use('/merchants', require('./merchant/index'));
/** Mounts activity log routes. */
router.use('/activities', require('./activities/activityRoutes'));
/** Mounts terminal routes. */
router.use('/terminals', require('./terminals/index'));
/** Mounts movements/reporting routes. */
router.use('/movements', require('./movements/index'));
/** Mounts payment link routes. */
router.use('/link', require('./links/index'));
/** Mounts report routes. */
router.use('/reports', require('./reports/index'));
/** Mounts file/report processing routes. */
router.use('/files', require('./files/index'));
/** Mounts catalog routes. */
router.use('/catalogues', require('./catalogues/index'));
/** Mounts merchant routes (alternative path). */
router.use('/merchant', require('./merchant/index'));
/** Mounts profile/permission routes. */
router.use('/profiles', require('./profiles/index'));
/** Mounts user management routes. */
router.use('/users', require('./users/index'));
// router.use('/giros', require('./api/giros.routes'));
// router.use('/operations', require('./api/operations.routes.js'));
/** Mounts MCC operations routes. */
router.use('/mcc-operations', require('./mcc-operations/mcc-operations.routes'));

// Admin routes (admin-only access)
/** Mounts admin permission test routes. */
router.use('/admin', require('../admin/permission-test.routes'));
/** Mounts database explorer routes. */
router.use('/database-explorer', require('../admin/database-explorer.routes'));
/** Mounts TDM user routes. */
router.use('/usersTDM', require('./usersTDM/index'));
/** Mounts BIN catalog routes. */
router.use('/bines', require('./bines/index'));
/** Mounts transactional profile routes. */
router.use('/transactionalProfiles', require('./transactionalProfiles/index'));

/** Express error handler for express-validation errors. */
router.use(function(err, req, res, next) {
    if (err instanceof ValidationError)
        return res.status(err.statusCode).json(err)
    else if(err) {
        console.log(err)
        return res.status(500).json(err)
    }
    return next();
});

module.exports = router;