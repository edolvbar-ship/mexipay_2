/**
 * @file Consolidation routes for generating consolidated files and seeding consolidation data.
 * PCI DSS 4.0: Req 10.2.1 (audit logging), Req 7.1.1 (access control for financial data).
 */
const express = require('express');
const router  = express.Router();
const { scriptConsolidados, render, makeFile } = require('../controllers/consolidados.controller');
// Routes
/** Renders the consolidation view. */
router.get('/', render);

/** Generates a consolidated file for a specific day and client. */
router.get('/make/file/:day/:cliente', makeFile)

/** Seeds/post consolidation data. */
router.post('/postAll/consolidate/seed', scriptConsolidados);

module.exports = router;