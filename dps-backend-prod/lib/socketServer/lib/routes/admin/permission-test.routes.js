const express = require('express');
const router = express.Router();
const permissionTestController = require('../../controllers/admin/permission-test.controller');
const { verifyToken } = require('../../middlewares/jtwAuth.middleware');

// All routes require authentication
router.use(verifyToken);

// GET /api/v2/admin/permission-test/users - Get users for testing dropdown
router.get('/users', permissionTestController.getUsersForTesting.bind(permissionTestController));

// GET /api/v2/admin/permission-test/resource/:id - Test specific resource as user
// This endpoint accepts custom headers for testing:
// X-Test-User-ID: The user ID to test as
// X-Test-Mode: 'permission-check' (required)
router.get('/resource/:id', permissionTestController.testResourceAsUser.bind(permissionTestController));

module.exports = router;
