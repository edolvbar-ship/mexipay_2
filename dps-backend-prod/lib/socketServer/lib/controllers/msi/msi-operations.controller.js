// MSI Operations Configuration Controller
// Handles MSI operations management and configuration

const db = require('../../sequelize/init');

class MsiOperationsController {
  
  /**
   * Get all MSI operations
   */
  static async getOperations(req, res) {
    try {
      console.log('[MSI Operations] Getting MSI operations');
      
      // For now, return default operations
      // In a real implementation, this would come from a database table
      const operations = [
        {
          id_operation: 1,
          name_operation: 'VENTA',
          msi_enabled: true,
          months_options: [3, 6, 9, 12],
          min_amounts: { 3: 301, 6: 601, 9: 901, 12: 1201 }
        },
        {
          id_operation: 2,
          name_operation: 'DEVOLUCIÓN',
          msi_enabled: false,
          months_options: [],
          min_amounts: {}
        },
        {
          id_operation: 3,
          name_operation: 'AUTORIZACIÓN',
          msi_enabled: true,
          months_options: [3, 6, 12],
          min_amounts: { 3: 350, 6: 650, 12: 1250 }
        }
      ];
      
      res.json({
        success: true,
        data: operations
      });
      
    } catch (error) {
      console.error('[MSI Operations] Error getting operations:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Update MSI operation configuration
   */
  static async updateOperation(req, res) {
    try {
      const { id_operation } = req.params;
      const operationData = req.body;
      
      console.log(`[MSI Operations] Updating operation ${id_operation}:`, operationData);
      
      // Validate operation data
      const { msi_enabled, months_options, min_amounts } = operationData;
      
      if (typeof msi_enabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'msi_enabled must be a boolean'
        });
      }
      
      if (!Array.isArray(months_options)) {
        return res.status(400).json({
          success: false,
          error: 'months_options must be an array'
        });
      }
      
      if (typeof min_amounts !== 'object' || min_amounts === null) {
        return res.status(400).json({
          success: false,
          error: 'min_amounts must be an object'
        });
      }
      
      // In a real implementation, this would save to a database table
      // For now, just return success
      console.log(`[MSI Operations] Operation ${id_operation} updated successfully`);
      
      res.json({
        success: true,
        data: {
          message: 'Operation updated successfully',
          id_operation: parseInt(id_operation),
          ...operationData
        }
      });
      
    } catch (error) {
      console.error('[MSI Operations] Error updating operation:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
      });
    }
  }
}

module.exports = MsiOperationsController;
