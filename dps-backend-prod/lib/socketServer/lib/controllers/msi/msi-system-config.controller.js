// MSI System Configuration Controller
// Handles global MSI system settings and configuration

const db = require('../../sequelize/init');

class MsiSystemConfigController {
  
  /**
   * Get MSI system configuration
   */
  static async getSystemConfig(req, res) {
    try {
      console.log('[MSI System Config] Getting system configuration');
      
      // For now, return default configuration
      // In a real implementation, this would come from a database table
      const systemConfig = {
        national_only: true,
        token_q6_supported: false,
        default_months: [3, 6, 9, 12, 18],
        min_transaction_amount: 300,
        max_months_allowed: 18,
        enable_auto_detection: true,
        bin_validation_enabled: true
      };
      
      res.json({
        success: true,
        data: systemConfig
      });
      
    } catch (error) {
      console.error('[MSI System Config] Error getting system config:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Update MSI system configuration
   */
  static async updateSystemConfig(req, res) {
    try {
      const configData = req.body;
      
      console.log('[MSI System Config] Updating system configuration:', configData);
      
      // Validate configuration data
      const { national_only, token_q6_supported, default_months, min_transaction_amount, max_months_allowed, enable_auto_detection, bin_validation_enabled } = configData;
      
      // Basic validation
      if (typeof national_only !== 'boolean' || 
          typeof token_q6_supported !== 'boolean' ||
          typeof enable_auto_detection !== 'boolean' ||
          typeof bin_validation_enabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'Invalid boolean values in configuration'
        });
      }
      
      if (!Array.isArray(default_months) || default_months.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Default months must be a non-empty array'
        });
      }
      
      if (typeof min_transaction_amount !== 'number' || min_transaction_amount < 0) {
        return res.status(400).json({
          success: false,
          error: 'Min transaction amount must be a positive number'
        });
      }
      
      if (typeof max_months_allowed !== 'number' || max_months_allowed < 1 || max_months_allowed > 24) {
        return res.status(400).json({
          success: false,
          error: 'Max months allowed must be between 1 and 24'
        });
      }
      
      // In a real implementation, this would save to a database table
      // For now, just return success
      console.log('[MSI System Config] System configuration updated successfully');
      
      res.json({
        success: true,
        data: {
          message: 'System configuration updated successfully',
          config: configData
        }
      });
      
    } catch (error) {
      console.error('[MSI System Config] Error updating system config:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
      });
    }
  }
}

module.exports = MsiSystemConfigController;
