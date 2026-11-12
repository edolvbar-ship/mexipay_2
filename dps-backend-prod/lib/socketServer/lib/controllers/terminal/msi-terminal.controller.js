// MSI Terminal Webservice Controller
// Handles MSI configuration requests from payment terminals

const db = require('../../sequelize/init');

class MsiTerminalController {
  
  /**
   * Get MSI configuration for terminal
   * Used by terminals to retrieve current MSI settings
   */
  static async getMsiConfig(req, res) {
    try {
      const { id_merchant, terminal_id, auth_token } = req.body;
      
      console.log(`[MSI Terminal] Getting MSI config for merchant ${id_merchant}, terminal ${terminal_id}`);
      
      // Validate terminal authentication (simplified for now)
      if (!auth_token) {
        return res.status(401).json({
          success: false,
          error: 'Authentication token required'
        });
      }
      
      // Validate merchant exists and is active
      const merchant = await db.merchant.findOne({
        where: { id_merchant, active: 1, deleted_at: null }
      });
      
      if (!merchant) {
        return res.status(404).json({
          success: false,
          error: 'Merchant not found or inactive'
        });
      }
      
      // Parse MSI configuration
      const msiConfig = JSON.parse(merchant.MSI || '[]');
      
      // Get MSI-enabled operations for this merchant
      const [operations] = await db.seq.query(`
        SELECT mo.id_operation, mo.msi_enabled
        FROM mcc_operations mo
        JOIN iso_mcc im ON im.mcc = mo.mcc_code
        JOIN merchant m ON m.id_mcc = im.id_mcc
        WHERE m.id_merchant = ${id_merchant} AND mo.active = 1
      `);
      
      const enabledOperations = operations.filter(op => op.msi_enabled === 1);
      
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        data: {
          id_merchant: merchant.id_merchant,
          name_merchant: merchant.name_merchant,
          terminal_id: terminal_id,
          msi_config: {
            enabled: msiConfig.length > 0,
            national_only: true,
            token_q6_supported: true,
            months_options: msiConfig.map(plan => parseInt(plan.type)),
            min_amounts: msiConfig.reduce((acc, plan) => {
              acc[plan.type] = parseFloat(plan.min_mount);
              return acc;
            }, {}),
            enabled_operations: enabledOperations.map(op => ({
              id_operation: op.id_operation,
              name: op.name_operation,
              msi_enabled: op.msi_enabled === 1
            }))
          },
          mexican_bin_ranges: [
            { start: '400000', end: '499999', brand: 'Visa' },
            { start: '510000', end: '559999', brand: 'Mastercard' },
            { start: '340000', end: '349999', brand: 'Amex' }
          ],
          last_updated: merchant.updatedAt
        }
      });
      
    } catch (error) {
      console.error('[MSI Terminal] Error getting MSI config:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Update MSI configuration from terminal
   * Used by terminals to update minimum amounts and settings
   */
  static async updateMsiConfig(req, res) {
    try {
      const { id_merchant, terminal_id, auth_token, msi_updates } = req.body;
      
      console.log(`[MSI Terminal] Updating MSI config for merchant ${id_merchant}, terminal ${terminal_id}`);
      
      // Validate terminal authentication
      if (!auth_token) {
        return res.status(401).json({
          success: false,
          error: 'Authentication token required'
        });
      }
      
      // Validate merchant exists and is active
      const merchant = await db.merchant.findOne({
        where: { id_merchant, active: 1, deleted_at: null }
      });
      
      if (!merchant) {
        return res.status(404).json({
          success: false,
          error: 'Merchant not found or inactive'
        });
      }
      
      // Validate msi_updates structure
      if (!Array.isArray(msi_updates)) {
        return res.status(400).json({
          success: false,
          error: 'msi_updates must be an array'
        });
      }
      
      // Get current MSI configuration
      const currentMsi = JSON.parse(merchant.MSI || '[]');
      
      // Update MSI configuration with new minimum amounts
      const updatedMsi = currentMsi.map(plan => {
        const update = msi_updates.find(u => u.months === parseInt(plan.type));
        if (update) {
          // Validate minimum amount
          if (update.min_amount < 0) {
            throw new Error(`Invalid minimum amount for ${update.months} months`);
          }
          
          return {
            ...plan,
            min_mount: update.min_amount.toString()
          };
        }
        return plan;
      });
      
      // Update merchant MSI configuration
      await merchant.update({ 
        MSI: JSON.stringify(updatedMsi)
      });
      
      console.log(`[MSI Terminal] MSI config updated successfully for merchant ${id_merchant}`);
      
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        data: {
          id_merchant: merchant.id_merchant,
          terminal_id: terminal_id,
          message: 'MSI configuration updated successfully',
          updated_config: updatedMsi,
          updated_by: 'terminal'
        }
      });
      
    } catch (error) {
      console.error('[MSI Terminal] Error updating MSI config:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
      });
    }
  }
  
  /**
   * Validate BIN for MSI eligibility
   * Used by terminals to check if a card BIN is eligible for MSI
   */
  static async validateBin(req, res) {
    try {
      const { bin, id_merchant, terminal_id, auth_token } = req.body;
      
      console.log(`[MSI Terminal] Validating BIN ${bin} for merchant ${id_merchant}`);
      
      // Validate authentication
      if (!auth_token) {
        return res.status(401).json({
          success: false,
          error: 'Authentication token required'
        });
      }
      
      // Mexican BIN ranges (hardcoded for now)
      const mexicanBinRanges = [
        { start: '400000', end: '499999', brand: 'Visa' },
        { start: '510000', end: '559999', brand: 'Mastercard' },
        { start: '340000', end: '349999', brand: 'Amex' }
      ];
      
      // Check if BIN is Mexican
      const isMexican = mexicanBinRanges.some(range => 
        bin >= range.start && bin <= range.end
      );
      
      // Get BIN info
      const binInfo = mexicanBinRanges.find(range => 
        bin >= range.start && bin <= range.end
      );
      
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        data: {
          bin: bin,
          is_mexican: isMexican,
          is_msi_eligible: isMexican,
          bin_info: binInfo ? {
            brand: binInfo.brand,
            range: `${binInfo.start}-${binInfo.end}`
          } : null,
          merchant_id: id_merchant,
          terminal_id: terminal_id
        }
      });
      
    } catch (error) {
      console.error('[MSI Terminal] Error validating BIN:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

module.exports = MsiTerminalController;
