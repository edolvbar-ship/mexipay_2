// MSI Templates Controller
// Handles MSI template management for payment processing

require('dotenv').config();
const db = require('../../sequelize/init');

class MsiTemplatesController {
  // GET /api/msi-templates - Get all MSI templates
  static async getTemplates(req, res) {
    try {
      const templates = await db.msiTemplate.findAll({
        include: [{
          model: db.merchant,
          as: 'merchants',
          attributes: ['id_merchant', 'name_merchant'],
          through: { attributes: [] }
        }],
        order: [['created_at', 'DESC']]
      });

      // Add merchants_count to each template
      const templatesWithCounts = templates.map(template => {
        const templateData = template.toJSON();
        templateData.merchants_count = templateData.merchants ? templateData.merchants.length : 0;
        return templateData;
      });

      res.json(templatesWithCounts);
    } catch (error) {
      console.error('Error getting MSI templates:', error);
      res.status(500).json({ 
        error: 'Error getting MSI templates',
        details: error.message 
      });
    }
  }

  // GET /api/msi-templates/:id_template - Get specific MSI template
  static async getTemplate(req, res) {
    try {
      const { id_template } = req.params;
      
      const template = await db.msiTemplate.findByPk(id_template, {
        include: [{
          model: db.merchant,
          as: 'merchants',
          attributes: ['id_merchant', 'name_merchant'],
          through: { attributes: [] }
        }]
      });

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const templateData = template.toJSON();
      templateData.merchants_count = templateData.merchants ? templateData.merchants.length : 0;

      res.json(templateData);
    } catch (error) {
      console.error('Error getting MSI template:', error);
      res.status(500).json({ 
        error: 'Error getting MSI template',
        details: error.message 
      });
    }
  }

  // POST /api/msi-templates - Create new MSI template
  static async createTemplate(req, res) {
    try {
      const templateData = req.body;
      
      const template = await db.msiTemplate.create({
        name: templateData.name,
        description: templateData.description,
        plans: templateData.plans || [],
        national_only: templateData.national_only || true,
        token_q6_supported: templateData.token_q6_supported || false,
        is_default: templateData.is_default || false,
        is_active: templateData.is_active || true,
        created_by: req.user?.id_user || 'system'
      });

      res.status(201).json(template);
    } catch (error) {
      console.error('Error creating MSI template:', error);
      res.status(500).json({ 
        error: 'Error creating MSI template',
        details: error.message 
      });
    }
  }

  // PUT /api/msi-templates/:id_template - Update MSI template
  static async updateTemplate(req, res) {
    try {
      const { id_template } = req.params;
      const updateData = req.body;
      
      const template = await db.msiTemplate.findByPk(id_template);
      
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      await template.update({
        ...updateData,
        updated_at: new Date()
      });

      res.json(template);
    } catch (error) {
      console.error('Error updating MSI template:', error);
      res.status(500).json({ 
        error: 'Error updating MSI template',
        details: error.message 
      });
    }
  }

  // DELETE /api/msi-templates/:id_template - Delete MSI template
  static async deleteTemplate(req, res) {
    try {
      const { id_template } = req.params;
      
      const template = await db.msiTemplate.findByPk(id_template);
      
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      await template.destroy();

      res.json({ message: 'Template deleted successfully' });
    } catch (error) {
      console.error('Error deleting MSI template:', error);
      res.status(500).json({ 
        error: 'Error deleting MSI template',
        details: error.message 
      });
    }
  }

  // POST /api/msi-templates/:id_template/apply - Apply template to merchants
  static async applyTemplateToMerchants(req, res) {
    try {
      const { id_template } = req.params;
      const { merchant_ids, overwrite_existing, send_notification } = req.body;
      
      const template = await db.msiTemplate.findByPk(id_template);
      
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      if (!merchant_ids || merchant_ids.length === 0) {
        return res.status(400).json({ error: 'No merchants selected' });
      }

      // Apply template to merchants - actual implementation
      let appliedCount = 0;
      const skippedCount = [];
      
      for (const merchantId of merchant_ids) {
        try {
          // Check if merchant exists and is active
          const merchant = await db.merchant.findOne({
            where: { id_merchant: merchantId, active: 1, deleted_at: null }
          });
          
          if (!merchant) {
            skippedCount.push({ merchantId, reason: 'Merchant not found or inactive' });
            continue;
          }
          
          // Check if template already assigned to this merchant
          if (!overwrite_existing) {
            const [existingAssignment] = await db.seq.query(`
              SELECT COUNT(*) as count 
              FROM merchant_msi_templates 
              WHERE id_merchant = ? AND id_template = ?
            `, [merchantId, id_template]);
            
            if (existingAssignment[0].count > 0) {
              skippedCount.push({ merchantId, reason: 'Template already assigned' });
              continue;
            }
          }
          
          // Remove existing assignments if overwrite is enabled
          if (overwrite_existing) {
            await db.seq.query(`
              DELETE FROM merchant_msi_templates WHERE id_merchant = ?
            `, [merchantId]);
          }
          
          // Assign template to merchant
          await db.seq.query({
            query: 'INSERT INTO merchant_msi_templates (id_merchant, id_template, applied_at, applied_by) VALUES (?, ?, NOW(), ?)',
            values: [merchantId, id_template, 'template-application']
          });
          
          appliedCount++;
          console.log(`✅ Applied template ${id_template} to merchant ${merchantId}`);
          
        } catch (error) {
          console.error(`Error applying template to merchant ${merchantId}:`, error.message);
          skippedCount.push({ merchantId, reason: error.message });
        }
      }
      
      res.json({ 
        message: 'Template application completed',
        template_id: id_template,
        template_name: template.name,
        total_merchants: merchant_ids.length,
        applied_count: appliedCount,
        skipped_count: skippedCount.length,
        skipped_details: skippedCount,
        overwrite_existing,
        send_notification
      });
    } catch (error) {
      console.error('Error applying template to merchants:', error);
      res.status(500).json({ 
        error: 'Error applying template to merchants',
        details: error.message 
      });
    }
  }

  // GET /api/msi-templates/active - Get only active templates
  static async getActiveTemplates(req, res) {
    try {
      const templates = await db.msiTemplate.findAll({
        where: { is_active: true },
        order: [['name', 'ASC']]
      });

      res.json(templates);
    } catch (error) {
      console.error('Error getting active MSI templates:', error);
      res.status(500).json({ 
        error: 'Error getting active MSI templates',
        details: error.message 
      });
    }
  }
}

module.exports = MsiTemplatesController;
