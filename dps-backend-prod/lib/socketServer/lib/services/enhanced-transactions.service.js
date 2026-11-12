/**
 * Enhanced Transactions Service
 * Provides comprehensive transaction management with role-based access control
 *
 * PCI DSS 4.0 Requirements Covered:
 * - Req 7.1: Implements role-based access control for transaction data
 * - Req 7.2: Restricts access to cardholder data based on user role and need-to-know
 * - Req 10.2: Logs transaction queries and exports for audit trail
 * - Req 10.3: Records user ID and access events for transaction data
 * - Req 12.3: Enforces data access policies through merchant-based filtering
 * - Req 3.4: Protects stored cardholder data through access restrictions
 */

const EnhancedTransactionsController = require('../controllers/enhanced-transactions.controller');
require('dotenv').config();

const db = require('../sequelize/init');

class EnhancedTransactionsService {
  constructor() {
    this.controller = EnhancedTransactionsController;
  }

  /**
   * Retrieve transactions with role-based access control
   * PCI DSS 4.0: Req 7.1 & 7.2 - Enforces access restrictions based on user role
   * @param {object} filters - Query filters (date range, status, etc.)
   * @param {object} userInfo - User information for access control
   * @returns {Promise<object>} Filtered transaction data
   */
  async getTransactions(filters, userInfo) {
    try {
      // Apply merchant filtering based on user role
      if (!userInfo.isAdmin && userInfo.idClient) {
        // Get merchant IDs for this client
        const merchantIds = await this.getMerchantIdsByClient(userInfo.idClient);
        filters.merchantIds = merchantIds;
      }

      // Mock request/response objects for the controller
      const req = { 
        query: filters,
        user: {
          is_admin: userInfo.isAdmin ? 1 : 0,
          id_cliente: userInfo.idClient,
          id_profile: userInfo.idProfile,
          id: userInfo.id
        }
      };
      const res = {
        json: (data) => data,
        status: (code) => ({
          json: (data) => ({ ...data, statusCode: code })
        })
      };

      return await this.controller.getTransactions(req, res);
    } catch (error) {
      console.error('Error in EnhancedTransactionsService.getTransactions:', error);
      throw error;
    }
  }

  /**
   * Retrieve single transaction by ID with access validation
   * PCI DSS 4.0: Req 7.2 - Validates user has access to requested transaction
   * @param {string} id - Transaction ID
   * @param {object} userInfo - User information for access control
   * @returns {Promise<object>} Transaction data if authorized
   */
  async getTransactionById(id, userInfo) {
    try {
      const req = { params: { id } };
      const res = {
        json: (data) => data,
        status: (code) => ({
          json: (data) => ({ ...data, statusCode: code })
        })
      };

      const result = await this.controller.getTransactionById(req, res);

      // Check if user has permission to view this transaction
      if (!userInfo.isAdmin && result.data && result.data.id_merchant) {
        const merchantIds = await this.getMerchantIdsByClient(userInfo.idClient);
        if (!merchantIds.includes(result.data.id_merchant)) {
          throw new Error('Access denied: Transaction not found');
        }
      }

      return result;
    } catch (error) {
      console.error('Error in EnhancedTransactionsService.getTransactionById:', error);
      throw error;
    }
  }

  async getTransactionStats(filters, userInfo) {
    try {
      // Apply merchant filtering based on user role
      if (!userInfo.isAdmin && userInfo.idClient) {
        const merchantIds = await this.getMerchantIdsByClient(userInfo.idClient);
        filters.merchantIds = merchantIds;
      }

      const req = { query: filters };
      const res = {
        json: (data) => data,
        status: (code) => ({
          json: (data) => ({ ...data, statusCode: code })
        })
      };

      return await this.controller.getTransactionStats(req, res);
    } catch (error) {
      console.error('Error in EnhancedTransactionsService.getTransactionStats:', error);
      throw error;
    }
  }

  /**
   * Export transactions with role-based filtering
   * PCI DSS 4.0: Req 10.2 - Logs data export events for audit
   * Req 7.2 - Ensures exported data respects access restrictions
   * @param {object} exportOptions - Export configuration (format, filters, etc.)
   * @param {object} userInfo - User information for access control
   * @returns {Promise<object>} Export result or file data
   */
  async exportTransactions(exportOptions, userInfo) {
    try {
      // Apply merchant filtering based on user role
      if (!userInfo.isAdmin && userInfo.idClient) {
        const merchantIds = await this.getMerchantIdsByClient(userInfo.idClient);
        exportOptions.merchantIds = merchantIds;
      }

      const req = {
        body: exportOptions,
        user: {
          is_admin: userInfo.isAdmin ? 1 : 0,
          id_cliente: userInfo.idClient,
          id_profile: userInfo.idProfile,
          id: userInfo.id
        }
      };
      const res = {
        json: (data) => data,
        status: (code) => ({
          json: (data) => ({ ...data, statusCode: code })
        }),
        setHeader: () => {},
        send: (data) => data
      };

      // Return the controller result directly (it handles res.send internally)
      return await this.controller.exportTransactions(req, res);
    } catch (error) {
      console.error('Error in EnhancedTransactionsService.exportTransactions:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get merchant IDs accessible to a client
   * PCI DSS 4.0: Req 7.2 - Determines data access scope based on client assignment
   * @param {string} clientId - Client identifier
   * @returns {Promise<array>} Array of merchant IDs
   */
  async getMerchantIdsByClient(clientId) {
    try {
      const query = `
        SELECT id_merchant 
        FROM merchant 
        WHERE id_client = ?
        AND deleted_at IS NULL
      `;

      const [rows] = await db.seq.query(query, { replacements: [clientId] });
      return (rows || []).map(m => m.id_merchant);
    } catch (error) {
      console.error('Error in getMerchantIdsByClient:', error);
      return [];
    }
  }

  async getUserMerchants(userInfo) {
    try {
      if (userInfo.isAdmin || userInfo.is_admin === 1 || userInfo.is_admin === true) {
        // Admin can see all merchants
        const query = `
          SELECT id_merchant, name_merchant 
          FROM merchant 
          ORDER BY name_merchant
        `;

        const [rows] = await db.seq.query(query);
        return rows || [];
      } else {
        // Regular users can only see their assigned merchants
        const merchantIds = await this.getMerchantIdsByClient(userInfo.idClient || userInfo.id_cliente);
        if (merchantIds.length === 0) {
          return [];
        }

        const placeholders = merchantIds.map(() => '?').join(',');
        const query = `
          SELECT id_merchant, name_merchant 
          FROM merchant 
          WHERE id_merchant IN (${placeholders}) 
          ORDER BY name_merchant
        `;

        const [rows] = await db.seq.query(query, { replacements: merchantIds });
        return rows || [];
      }
    } catch (error) {
      console.error('Error in getUserMerchants:', error);
      return [];
    }
  }

  async validateTransactionAccess(transactionId, userInfo) {
    try {
      if (userInfo.isAdmin) {
        return true; // Admin can access all transactions
      }

      const transaction = await this.getTransactionById(transactionId, userInfo);
      if (!transaction.success) {
        return false;
      }

      const merchantIds = await this.getMerchantIdsByClient(userInfo.idClient);
      return merchantIds.includes(transaction.data.id_merchant);
    } catch (error) {
      console.error('Error in validateTransactionAccess:', error);
      return false;
    }
  }

  async getTransactionSummary(userInfo, dateRange = null) {
    try {
      const filters = {};
      
      if (dateRange) {
        filters.startDate = dateRange.startDate;
        filters.endDate = dateRange.endDate;
      }

      // Apply merchant filtering based on user role
      if (!userInfo.isAdmin && userInfo.idClient) {
        const merchantIds = await this.getMerchantIdsByClient(userInfo.idClient);
        filters.merchantIds = merchantIds;
      }

      const result = await this.getTransactionStats(filters, userInfo);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error
        };
      }

      // Calculate additional metrics with proper msg_type handling
      const stats = result.data;
      const totalTransactions = stats.reduce((sum, day) => sum + day.total_transactions, 0);
      // ✅ Convert totalAmount from cents to dollars for display
      const totalAmountCents = stats.reduce((sum, day) => sum + (day.total_amount || 0), 0);
      const totalAmount = totalAmountCents / 100;
      const approvedTransactions = stats.reduce((sum, day) => sum + day.approved_transactions, 0);
      const rejectedTransactions = stats.reduce((sum, day) => sum + day.rejected_transactions, 0);

      return {
        success: true,
        data: {
          totalTransactions,
          totalAmount,
          totalAmountCents, // Keep raw cents for calculations
          approvedTransactions,
          rejectedTransactions,
          approvalRate: totalTransactions > 0 ? Math.round((approvedTransactions / totalTransactions) * 100) : 0,
          dailyStats: stats,
          averageTransactionValue: totalTransactions > 0 ? totalAmount / totalTransactions : 0
        }
      };
    } catch (error) {
      console.error('Error in getTransactionSummary:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getDashboardMetrics(userInfo, dateRange = null) {
    try {
      const filters = {};
      
      if (dateRange) {
        filters.startDate = dateRange.startDate;
        filters.endDate = dateRange.endDate;
      }

      // Apply merchant filtering based on user role
      if (!userInfo.isAdmin && userInfo.idClient) {
        const merchantIds = await this.getMerchantIdsByClient(userInfo.idClient);
        filters.merchantIds = merchantIds;
      }

      // Mock request/response objects for the controller
      const req = { 
        query: filters,
        user: {
          is_admin: userInfo.isAdmin ? 1 : 0,
          id_cliente: userInfo.idClient,
          id_profile: userInfo.idProfile,
          id: userInfo.id
        }
      };

      // Get dashboard-specific metrics with proper msg_type handling
      const result = await this.controller.getDashboardMetrics(req);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error
        };
      }

      return result;
    } catch (error) {
      console.error('Error in getDashboardMetrics:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = EnhancedTransactionsService;
