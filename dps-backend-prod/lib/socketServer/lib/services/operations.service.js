/**
 * Operations Service
 * Manages merchant operations based on business giro (industry sector)
 *
 * PCI DSS 4.0 Requirements Covered:
 * - Req 7.1: Implements role-based access to operations based on merchant giro
 * - Req 7.2: Restricts operations to those authorized for specific merchant types
 * - Req 12.3: Ensures merchants only access operations appropriate to their business type
 */

const db = require('../../../sequelize/init');
const pool = require("../../../database");

/**
 * Get operations available to a merchant based on their giro
 * PCI DSS 4.0: Req 7.1 & 7.2 - Returns only operations authorized for merchant's business type
 * @param {string} id_merchant - Merchant identifier
 * @returns {Promise<object>} Merchant info and authorized operations
 */
const getOperationsByMerchantGiro = async (id_merchant) => {
  try {
    // Get merchant and their giro
    const merchant = await db.merchant.findOne({
      where: { 
        id_merchant: id_merchant,
        active: 1,
        deleted_at: null
      },
      include: [{
        model: db.isoGiro,
        as: 'giro',
        attributes: ['id_giro', 'name', 'code', 'description'],
        required: false
      }]
    });
    
    if (!merchant) {
      throw new Error("Merchant not found");
    }
    
    if (!merchant.id_giro) {
      // Return empty operations if no giro assigned
      return {
        merchant: {
          id_merchant: merchant.id_merchant,
          name_merchant: merchant.name_merchant,
          id_giro: null,
          giro: null
        },
        operations: []
      };
    }
    
    // Get operations for merchant's giro
    const operations = await db.processingOperations.findAll({
      where: { 
        id_giro: merchant.id_giro,
        active: 1 
      },
      order: [['display_order', 'ASC'], ['name', 'ASC']],
      attributes: [
        'id_operation', 'name', 'description', 'operation_code', 
        'msg_type', 'processing_code', 'requires_amount', 'requires_tip',
        'display_order', 'icon_name'
      ]
    });
    
    return {
      merchant: {
        id_merchant: merchant.id_merchant,
        name_merchant: merchant.name_merchant,
        id_giro: merchant.id_giro,
        giro: merchant.giro
      },
      operations: operations
    };
  } catch (error) {
    console.error('Error getting operations by merchant giro:', error);
    throw error;
  }
};

module.exports = {
  getOperationsByMerchantGiro
};
