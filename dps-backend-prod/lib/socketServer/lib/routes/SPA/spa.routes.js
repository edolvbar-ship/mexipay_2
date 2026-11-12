
/**
 * @file SPA (Single Page Application) top-level route aggregator.
 * Mounts auth, dashboard, merchant, and consolidate sub-routes.
 * PCI DSS 4.0: Req 7.1.1 / 7.2.1 (role-based access control), Req 8.2.1 (authentication).
 */
const express                             = require('express');
const router                              = express.Router();

// Routes
/** Mounts SPA authentication routes (sign-in, reset-password, /me). */
router.use('/auth',      require('./auth/auth.routes'));
/** Mounts SPA dashboard routes. */
router.use('/dashboard',  require('./dashboard/dashboard.routes') );
/** Mounts SPA merchant routes. */
router.use('/merchant',  require('./merchants/merchants.routes') );
/** Mounts SPA consolidate routes. */
router.use('/consolidate',  require('./consolidate/consolidate.routes') );


module.exports = router;