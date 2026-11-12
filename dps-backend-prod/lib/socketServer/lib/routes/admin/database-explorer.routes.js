/**
 * @file Admin database explorer routes.
 * Provides read-only schema inspection, record CRUD, batch operations, and SQL query/export capabilities.
 * All routes require admin authentication.
 * PCI DSS 4.0: Req 7.1.1 / 7.2.1 (admin access control), Req 8.2.1 / 8.3.2 (authentication), Req 10.2.1 (audit logging), Req 3.4 / 3.5.1 (sensitive data access).
 */
const express = require('express');
const router = express.Router();
const DatabaseExplorerController = require('../../controllers/admin/database-explorer.controller');
const { verifyAdmin } = require('../../middlewares/admin.middleware');

/** Enforces admin authentication on all database explorer routes. */
router.use(verifyAdmin);

// ============================================================================
// SCHEMA AND METADATA ROUTES
// ============================================================================

/** Gets all database tables. */
router.get('/tables', DatabaseExplorerController.getTables);

/** Gets database statistics. */
router.get('/stats', DatabaseExplorerController.getDatabaseStats);

/** Gets the schema (columns, relationships, indexes) for a table. */
router.get('/tables/:tableName/schema', DatabaseExplorerController.getTableSchema);

/** Gets enum values for a column. */
router.get('/tables/:tableName/columns/:columnName/enum', DatabaseExplorerController.getEnumValues);

// ============================================================================
// CRUD ROUTES
// ============================================================================

/** Gets records with pagination, filtering, and sorting. */
router.post('/tables/:tableName/records', DatabaseExplorerController.getRecords);

/** Gets a single record by ID. */
router.get('/tables/:tableName/records/:id', DatabaseExplorerController.getRecordById);

/** Creates a new record. */
router.post('/tables/:tableName/records', DatabaseExplorerController.createRecord);

/** Updates a record. */
router.put('/tables/:tableName/records/:id', DatabaseExplorerController.updateRecord);

/** Deletes a record. */
router.delete('/tables/:tableName/records/:id', DatabaseExplorerController.deleteRecord);

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/** Performs batch create/update/delete operations on a table. */
router.post('/tables/:tableName/batch', DatabaseExplorerController.batchOperation);

// ============================================================================
// RELATIONSHIPS
// ============================================================================

/** Gets related data for dropdowns. */
router.get('/tables/:tableName/related', DatabaseExplorerController.getRelatedData);

// ============================================================================
// ADVANCED FEATURES
// ============================================================================

/** Executes a read-only custom SQL query. */
router.post('/query', DatabaseExplorerController.executeQuery);

/** Exports database data. */
router.post('/export', DatabaseExplorerController.exportDatabase);

module.exports = router;
