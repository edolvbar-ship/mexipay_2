/**
 * @file User activity log routes.
 * PCI DSS 4.0: Req 10.2.1 / 10.3.1 (audit trail access), Req 7.1.1 (user-scoped access).
 */
const express = require('express');
const router = express.Router();
const activityController = require('../../../controllers/userActivityLogger.controller');

console.log('🚀 V2 Activities routes loaded');

/** Returns the authenticated user's own activities. */
router.get('/my-activities', (req, res, next) => {
    console.log('🎯 V2 my-activities route hit with URL:', req.originalUrl);
    console.log('📋 Query parameters:', req.query);
    next();
}, activityController.getUserActivities);

/** Returns recent activity log entries. */
router.get('/recent', activityController.getRecentActivities);
/** Returns all activity log entries (admin scope). */
router.get('/all', activityController.getAllActivities);

module.exports = router;
