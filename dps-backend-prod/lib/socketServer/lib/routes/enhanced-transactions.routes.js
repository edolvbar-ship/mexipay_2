/**
 * @file Enhanced transaction query/export routes.
 * Provides filtered, paginated, and exportable transaction data with user-scoped access control.
 * PCI DSS 4.0: Req 7.1.1 / 7.1.2 (user-scoped access), Req 8.2.1 / 8.3.2 (JWT authentication), Req 10.2.1 (audit logging).
 */
const express = require('express');
const router = express.Router();
const EnhancedTransactionsService = require('../services/enhanced-transactions.service');
const { verifyToken } = require('../middlewares/jtwAuth.middleware');

const enhancedTransactionsService = new EnhancedTransactionsService();

// GET /api/enhanced-transactions - Get transactions with filtering and pagination
router.get('/', verifyToken, async (req, res) => {
  try {
    // Map req.user to req.userInfo for service compatibility
    req.userInfo = {
      isAdmin: req.user.is_admin === 1,
      idClient: req.user.id_cliente,
      idProfile: req.user.id_profile,
      id: req.user.id || req.user.id_user  // Use id from JWT, fallback to id_user
    };

    const result = await enhancedTransactionsService.getTransactions(req.query, req.userInfo);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error in GET /enhanced-transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// GET /api/enhanced-transactions/stats - Get transaction statistics
router.get('/stats/summary', verifyToken, async (req, res) => {
  try {
    // Map req.user to req.userInfo for service compatibility
    req.userInfo = {
      isAdmin: req.user.is_admin === 1,
      idClient: req.user.id_cliente,
      idProfile: req.user.id_profile,
      id: req.user.id || req.user.id_user  // Use id from JWT, fallback to id_user
    };

    const result = await enhancedTransactionsService.getTransactionStats(req.query, req.userInfo);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error in GET /enhanced-transactions/stats:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// GET /api/enhanced-transactions/summary - Get transaction summary for dashboard
router.get('/summary', verifyToken, async (req, res) => {
  try {
    // Map req.user to req.userInfo for service compatibility
    req.userInfo = {
      isAdmin: req.user.is_admin === 1,
      idClient: req.user.id_cliente,
      idProfile: req.user.id_profile,
      id: req.user.id || req.user.id_user  // Use id from JWT, fallback to id_user
    };

    const dateRange = {
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    const result = await enhancedTransactionsService.getTransactionSummary(req.userInfo, dateRange);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error in GET /enhanced-transactions/summary:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// GET /api/enhanced-transactions/merchants - Get user's accessible merchants
router.get('/merchants/list', verifyToken, async (req, res) => {
  try {
    // Map req.user to req.userInfo for service compatibility
    req.userInfo = {
      isAdmin: req.user.is_admin === 1,
      idClient: req.user.id_cliente,
      idProfile: req.user.id_profile,
      id: req.user.id || req.user.id_user  // Use id from JWT, fallback to id_user
    };

    const merchants = await enhancedTransactionsService.getUserMerchants(req.userInfo);
    
    res.json({
      success: true,
      data: merchants
    });
  } catch (error) {
    console.error('Error in GET /enhanced-transactions/merchants:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// GET /api/enhanced-transactions/validate/:id - Validate access to transaction
router.get('/validate/:id', verifyToken, async (req, res) => {
  try {
    // Map req.user to req.userInfo for service compatibility
    req.userInfo = {
      isAdmin: req.user.is_admin === 1,
      idClient: req.user.id_cliente,
      idProfile: req.user.id_profile,
      id: req.user.id || req.user.id_user  // Use id from JWT, fallback to id_user
    };

    const hasAccess = await enhancedTransactionsService.validateTransactionAccess(req.params.id, req.userInfo);
    
    res.json({
      success: true,
      hasAccess
    });
  } catch (error) {
    console.error('Error in GET /enhanced-transactions/validate/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// GET /api/enhanced-transactions/:id - Get specific transaction by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    // Map req.user to req.userInfo for service compatibility
    req.userInfo = {
      isAdmin: req.user.is_admin === 1,
      idClient: req.user.id_cliente,
      idProfile: req.user.id_profile,
      id: req.user.id || req.user.id_user  // Use id from JWT, fallback to id_user
    };

    const result = await enhancedTransactionsService.getTransactionById(req.params.id, req.userInfo);
    
    if (!result.success) {
      if (result.statusCode === 404) {
        return res.status(404).json(result);
      }
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error in GET /enhanced-transactions/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// POST /api/enhanced-transactions/export - Export transactions with filters
router.post('/export', verifyToken, async (req, res) => {
  try {
    // Map req.user to req.userInfo for service compatibility
    req.userInfo = {
      isAdmin: req.user.is_admin === 1,
      idClient: req.user.id_cliente,
      idProfile: req.user.id_profile,
      id: req.user.id || req.user.id_user  // Use id from JWT, fallback to id_user
    };

    const result = await enhancedTransactionsService.exportTransactions(req.body, req.userInfo);
    
    // If result is a string or buffer (CSV data), send as file download
    if (typeof result === 'string' || Buffer.isBuffer(result)) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="enhanced-transactions_${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(result);
    }
    
    // If result is an object with success property, handle accordingly
    if (result && typeof result === 'object') {
      if (!result.success) {
        return res.status(400).json(result);
      }
      
      if (result.data && (typeof result.data === 'string' || Buffer.isBuffer(result.data))) {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="enhanced-transactions_${new Date().toISOString().split('T')[0]}.csv"`);
        return res.send(result.data);
      }
    }
    
    // Fallback
    res.json(result);
  } catch (error) {
    console.error('Error in POST /enhanced-transactions/export:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// POST /api/enhanced-transactions/bulk-export - Bulk export with advanced options
router.post('/bulk-export', verifyToken, async (req, res) => {
  try {
    // Map req.user to req.userInfo for service compatibility
    req.userInfo = {
      isAdmin: req.user.is_admin === 1,
      idClient: req.user.id_cliente,
      idProfile: req.user.id_profile,
      id: req.user.id || req.user.id_user  // Use id from JWT, fallback to id_user
    };

    const { transactionIds, exportOptions } = req.body;

    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Transaction IDs are required'
      });
    }

    const result = await enhancedTransactionsService.bulkExportTransactions(transactionIds, exportOptions, req.userInfo);

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Handle file download response
    if (typeof result === 'string' || Buffer.isBuffer(result)) {
      res.setHeader('Content-Type', exportOptions.format === 'csv' ? 'text/csv' : 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="transactions_bulk_${new Date().toISOString().split('T')[0]}.${exportOptions.format}"`);
      return res.send(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error in POST /enhanced-transactions/bulk-export:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;
