/**
 * MCC Operations Service
 * Manages merchant operations based on MCC (Merchant Category Code)
 *
 * PCI DSS 4.0 Requirements Covered:
 * - Req 7.1: Implements role-based access to operations based on merchant MCC
 * - Req 7.2: Restricts operations to those authorized for specific merchant categories
 * - Req 12.3: Ensures merchants only access operations appropriate to their business category
 * - Req 10.2: Logs device registrations for audit trail
 */

const db = require('../sequelize/init');
const pool = require("../database");

/**
 * Get operations available for a merchant based on their MCC (Merchant Category Code)
 * Operations are determined by exact MCC code matching from the giros list
 * PCI DSS 4.0: Req 7.1 & 7.2 - Returns only operations authorized for merchant's MCC
 * @param {string} id_merchant - Merchant identifier
 * @returns {Promise<object>} Merchant info, MCC category, and authorized operations
 */
const getOperationsByMerchantMcc = async (id_merchant) => {
  try {
    // Get merchant with their MCC
    const merchant = await db.merchant.findOne({
      where: {
        id_merchant: id_merchant,
        active: 1,
        deleted_at: null
      },
      include: [{
        model: db.isoMcc,
        as: 'isoMcc',
        attributes: ['id_mcc', 'mcc', 'description'],
        required: false
      }]
    });

    if (!merchant) {
      throw new Error("Merchant not found");
    }

    if (!merchant.id_mcc) {
      // Return empty operations if no MCC assigned
      return {
        merchant: {
          id_merchant: merchant.id_merchant,
          name_merchant: merchant.name_merchant,
          id_mcc: null,
          mcc: null,
          mcc_description: null
        },
        operations: []
      };
    }

    const mccCode = merchant.isoMcc.mcc;

    // Get operations for this exact MCC code
    const operations = await db.mccOperations.findAll({
      where: {
        active: 1,
        mcc_code: mccCode
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
        id_mcc: merchant.id_mcc,
        mcc: mccCode,
        mcc_description: merchant.isoMcc.description
      },
      operations: operations,
      mcc_category: getMccCategory(mccCode)
    };
  } catch (error) {
    console.error('Error getting operations by merchant MCC:', error);
    throw error;
  }
};

/**
 * Determine MCC category based on MCC code
 */
function getMccCategory(mccCode) {
  const prefix = mccCode.substring(0, 3);
  
  // Special handling for exact MCC 581 to differentiate Restaurant vs Bar
  if (prefix === '581') {
    // Default to restaurant operations for MCC 581
    // Bar operations can be determined by merchant type or specific flags
    return {
      code: 'FOOD_58X',
      name: 'Restaurants & Food Services',
      description: 'Restaurants, fast food, bars, catering services',
      category_code: 'FOOD_58X',
      backend_route: 'restaurant'
    };
  }
  
  if (prefix >= '300' && prefix < '400') {
    return {
      code: 'SERVICES_3XX',
      name: 'Travel & Entertainment',
      description: 'Airlines, lodging, car rental, travel agencies',
      category_code: 'SERVICES_3XX',
      backend_route: 'car'
    };
  } else if (prefix >= '400' && prefix < '500') {
    return {
      code: 'TRANSPORT_4XX', 
      name: 'Transportation Services',
      description: 'Transportation, railroads, bus lines, taxis, ferries',
      category_code: 'TRANSPORT_4XX',
      backend_route: null // No specific backend route yet
    };
  } else if ((prefix >= '500' && prefix < '600') && prefix < '581') {
    return {
      code: 'RETAIL_5XX',
      name: 'Retail Stores',
      description: 'Department stores, grocery stores, specialty retail',
      category_code: 'RETAIL_5XX',
      backend_route: 'retail'
    };
  } else if (prefix >= '700' && prefix < '800') {
    return {
      code: 'BUSINESS_7XX',
      name: 'Business Services',
      description: 'Hotels, motels, business services, equipment rental',
      category_code: 'BUSINESS_7XX',
      backend_route: 'hotel'
    };
  } else if (prefix >= '800' && prefix < '900') {
    return {
      code: 'PROFESSIONAL_8XX',
      name: 'Professional Services & Healthcare',
      description: 'Medical services, education, professional services',
      category_code: 'PROFESSIONAL_8XX',
      backend_route: null // No specific backend route yet
    };
  } else {
    return {
      code: 'OTHER',
      name: 'Other Services',
      description: 'Miscellaneous services and other categories',
      category_code: 'OTHER',
      backend_route: null
    };
  }
}

/**
 * Register a smart device for MCC operations
 * PCI DSS 4.0: Req 10.2 - Logs device registration events for audit trail
 * @param {object} deviceInfo - Device information for registration
 * @returns {Promise<object>} Registration result
 */
const registerDevice = async (deviceInfo) => {
  try {
    // Simulate device registration with enhanced response handling
    const registrationResult = {
      success: true,
      message: 'Device registered successfully for MCC operations',
      deviceId: deviceInfo.deviceId,
      deviceType: deviceInfo.deviceType,
      operationCode: deviceInfo.operationCode,
      mccRange: deviceInfo.mccRange,
      registeredAt: new Date(),
      status: 'active'
    };

    console.log('📱 Smart device registered:', registrationResult);
    return registrationResult;
  } catch (error) {
    console.error('❌ Device registration failed:', error);
    return {
      success: false,
      message: 'Device registration failed',
      error: {
        code: error.code || 'DEVICE_REG_ERROR',
        details: error.message || 'Unknown registration error',
        timestamp: new Date().toISOString()
      }
    };
  }
};

module.exports = {
  getOperationsByMerchantMcc,
  getMccCategory,
  registerDevice
};
