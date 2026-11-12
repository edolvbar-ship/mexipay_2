/**
 * @file Gateway admin utility routes (e.g., database migrations).
 * PCI DSS 4.0: Req 7.1.1 (admin access control), Req 10.2.1 (audit logging for schema changes).
 */
const express = require('express');
const router = express.Router();
const db = require('../sequelize/init');

/** Runs database migrations. Should be protected by admin authentication. */
router.post('/migrate', (req,res)=>{
  require('../sequelize/migrations/index')(req,res);
})

module.exports = router;