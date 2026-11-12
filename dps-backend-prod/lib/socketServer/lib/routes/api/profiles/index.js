/**
 * @file Profile and resource/permission management routes.
 * All routes require JWT authentication.
 * PCI DSS 4.0: Req 7.1.1 / 7.2.1 (RBAC), Req 8.2.1 / 8.3.2 (authentication), Req 10.2.1 (audit logging).
 */
const express = require('express');
const router = express.Router();
const profileController = require('../../../controllers/profiles.controller');
const { verifyToken } = require('../../../middlewares/jtwAuth.middleware');

// Protect all routes with authentication
/** Enforces JWT authentication on all profile routes. */
router.use(verifyToken);

// Enhanced permission management routes (specific routes first)
/** Returns the permissions matrix. */
router.get('/matrix', profileController.getPermissionsMatrix);
/** Returns the full permissions matrix. */
router.get('/matrix/all', profileController.getPermissionsMatrix);
/** Returns profiles with resource counts. */
router.get('/with-count', profileController.getProfilesWithResourceCount);
/** Returns the permission dashboard view. */
router.get('/dashboard/view', profileController.getPermissionDashboard);

// Resource/Permission CRUD routes
/** Creates a resource permission. */
router.post('/resources', profileController.createResourcePermission);
/** Updates a resource permission. */
router.put('/resources/:id', profileController.updateResourcePermission);
/** Deletes a resource permission. */
router.delete('/resources/:id', profileController.deleteResourcePermission);

// Resource management routes (for the resources table itself)
/** Lists all resources. */
router.get('/resources/all', profileController.listAllResources);
/** Creates a resource. */
router.post('/resources/manage', profileController.createResource);
/** Updates a resource. */
router.put('/resources/manage/:id', profileController.updateResource);
/** Deletes a resource. */
router.delete('/resources/manage/:id', profileController.deleteResource);

// Legacy resource routes
/** Returns resources (legacy). */
router.get('/resources', profileController.allResounces);
/** Returns resources by profile ID (legacy). */
router.get('/resources/:id', profileController.allResouncesByProfileId);

// Basic CRUD routes (parameterized routes last)
/** Lists profiles. */
router.get('/', profileController.list);
/** Creates a new profile. */
router.post('/', profileController.saveNewProfile);
/** Returns profile details. */
router.get('/:id', profileController.details);
/** Updates a profile. */
router.put('/:id', profileController.updateProfile);
/** Deletes a profile. */
router.delete('/:id', profileController.deleteProfile);

module.exports = router;
