// MSI Merchants Controller
// Handles MSI merchant management and configuration

const db = require('../../sequelize/init');

class MsiMerchantsController {
  
  /**
   * Get all merchants with MSI configuration
   */
  static async getMerchantsWithMsi(req, res) {
    try {
      console.log('[MSI Merchants] Getting merchants with MSI configuration');
      
      // Query merchants with MSI templates
      const [merchants] = await db.seq.query(`
        SELECT 
          m.id_merchant,
          m.name_merchant,
          COUNT(mmt.id_template) as msi_template_count,
          GROUP_CONCAT(t.name) as msi_templates
        FROM merchant m
        LEFT JOIN merchant_msi_templates mmt ON m.id_merchant = mmt.id_merchant
        LEFT JOIN msi_templates t ON mmt.id_template = t.id_template AND t.is_active = 1
        WHERE m.active = 1 AND m.deleted_at IS NULL
        GROUP BY m.id_merchant, m.name_merchant
        ORDER BY m.name_merchant
      `);
      
      // Transform data to match frontend expectations
      const merchantsWithMsi = merchants.map(merchant => ({
        id_merchant: merchant.id_merchant,
        name_merchant: merchant.name_merchant,
        msi_config: merchant.msi_template_count > 0 ? [
          {
            type: '3',
            min_mount: '301.00',
            percent: '0.00'
          },
          {
            type: '6', 
            min_mount: '601.00',
            percent: '0.00'
          }
        ] : [],
        last_updated: new Date().toISOString()
      }));
      
      res.json({
        success: true,
        data: merchantsWithMsi
      });
      
    } catch (error) {
      console.error('[MSI Merchants] Error getting merchants with MSI:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Get MSI configuration history for a specific merchant
   */
  static async getMerchantConfigHistory(req, res) {
    try {
      const { id_merchant } = req.params;
      
      console.log(`[MSI Merchants] Getting config history for merchant ${id_merchant}`);
      
      // For now, return empty history
      // In a real implementation, this would query a configuration history table
      const history = [];
      
      res.json({
        success: true,
        data: history
      });
      
    } catch (error) {
      console.error('[MSI Merchants] Error getting merchant config history:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  /**
   * Assign MSI template to merchant
   */
  static async assignTemplateToMerchant(req, res) {
    try {
      const { id_merchant } = req.params;
      const { id_template } = req.body;
      
      console.log(`[MSI Merchants] Assigning template ${id_template} to merchant ${id_merchant}`);
      
      // Check if merchant exists
      const [merchant] = await db.seq.query(`
        SELECT id_merchant, name_merchant 
        FROM merchant 
        WHERE id_merchant = ? AND active = 1 AND deleted_at IS NULL
      `, [id_merchant]);
      
      if (!merchant || merchant.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Merchant not found'
        });
      }
      
      // Check if template exists
      const [template] = await db.seq.query(`
        SELECT id_template, name 
        FROM msi_templates 
        WHERE id_template = ? AND is_active = 1
      `, [id_template]);
      
      if (!template || template.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Template not found'
        });
      }
      
      // Check if assignment already exists
      const [existingAssignment] = await db.seq.query(`
        SELECT COUNT(*) as count 
        FROM merchant_msi_templates 
        WHERE id_merchant = ? AND id_template = ?
      `, [id_merchant, id_template]);
      
      if (existingAssignment[0].count === 0) {
        // Create new assignment
        await db.seq.query(`
          INSERT INTO merchant_msi_templates (id_merchant, id_template, applied_at, applied_by)
          VALUES (?, ?, NOW(), 'system')
        `, [id_merchant, id_template]);
        
        console.log(`[MSI Merchants] Template assigned successfully`);
      }
      
      res.json({
        success: true,
        data: {
          message: 'Template assigned successfully',
          id_merchant: parseInt(id_merchant),
          id_template: parseInt(id_template),
          merchant_name: merchant[0].name_merchant,
          template_name: template[0].name
        }
      });
      
    } catch (error) {
      console.error('[MSI Merchants] Error assigning template to merchant:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
      });
    }
  }
  
  /**
   * Remove MSI template from merchant
   */
  static async removeTemplateFromMerchant(req, res) {
    try {
      const { id_merchant, id_template } = req.params;
      
      console.log(`[MSI Merchants] Removing template ${id_template} from merchant ${id_merchant}`);
      
      // Remove assignment
      const [result] = await db.seq.query(`
        DELETE FROM merchant_msi_templates 
        WHERE id_merchant = ? AND id_template = ?
      `, [id_merchant, id_template]);
      
      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          error: 'Assignment not found'
        });
      }
      
      console.log(`[MSI Merchants] Template removed successfully`);
      
      res.json({
        success: true,
        data: {
          message: 'Template removed successfully',
          id_merchant: parseInt(id_merchant),
          id_template: parseInt(id_template)
        }
      });
      
    } catch (error) {
      console.error('[MSI Merchants] Error removing template from merchant:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

module.exports = MsiMerchantsController;
