/**
 * @file Top-level user-facing route aggregator.
 * Mounts the main API, reports, SPA, admin, render, and test transaction routes.
 * PCI DSS 4.0: Req 7.1.1 / 7.2.1 (access control), Req 8.2.1 / 8.3.2 (authentication).
 */
const express = require('express');
const { verifyToken } = require('../middlewares/jtwAuth.middleware');
const TlvClass = require('../controllers/classes/tlv.class');

const router = express.Router();

// API ROUTES
/** Mounts the main gateway API routes. */
router.use('/api', require('./api.routes'));

// REPORTES
/** Mounts report routes protected by JWT verification. */
router.use('/report', verifyToken, require('./reports.routes'));

// RUTAS PAGINA SPA
/** Mounts SPA (Single Page Application) routes. */
router.use('/SPA', require('./SPA/spa.routes'));

// ADMIN ROUTES
/** Mounts gateway admin utility routes. */
router.use('/gwAdmin', require('./gwAdmin.routes'));


// RENDER
/** Mounts static rendering routes (e.g., PDF tickets). */
router.use('/render', require('./render.routes'));

/** Test endpoint that sends multiple TLV transactions. */
router.post('/sendMultipleTx', async (req, res) => {
  const classAux = new TlvClass();
  classAux.ejecutarTxs(req.body.number ? req.body.number - 1 : 2, req);
  
  return res.send('transacciones mandadas revisar log...');
});

module.exports = router;
