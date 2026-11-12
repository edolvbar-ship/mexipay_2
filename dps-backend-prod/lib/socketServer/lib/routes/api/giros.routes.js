/**
 * @file Giro (business line) management routes.
 * All routes require JWT authentication.
 * PCI DSS 4.0: Req 8.2.1 / 8.3.2 (authentication), Req 7.1.1 (access control), Req 10.2.1 (audit logging).
 */
const express = require('express');
const router = express.Router();
const giroCtrl = require('../controllers/SPA/Giros/giros.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');

// Apply authentication middleware to all routes
/** Enforces JWT authentication on all giro routes. */
router.use(authenticateToken);

/** Lists all giros. */
router.get('/', giroCtrl.getGiros);
/** Returns a giro by ID. */
router.get('/:id', giroCtrl.getGiroById);
/** Creates a new giro. */
router.post('/', giroCtrl.createGiro);
/** Updates a giro. */
router.put('/:id', giroCtrl.updateGiro);
/** Deletes a giro (soft delete). */
router.delete('/:id', giroCtrl.deleteGiro);

module.exports = router;
