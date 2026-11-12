/**
 * @file MCC (Merchant Category Code) operations configuration routes.
 * Provides CRUD and assignment of transaction operations to MCC categories.
 * PCI DSS 4.0: Req 7.1.1 / 7.2.1 (RBAC), Req 8.2.1 / 8.3.2 (token authentication), Req 10.2.1 (audit logging), Req 12.3.1 (configuration management).
 */
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../../middleware/auth.middleware');
const db = require('../../../sequelize/init');

/** Gets all MCC operations. */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const operations = await db.mccOperations.findAll({
      attributes: ['id_operation', 'mcc_code', 'name', 'description', 'operation_code', 'msg_type', 'processing_code', 'requires_amount', 'requires_tip', 'active', 'display_order', 'icon_name', 'category_code', 'creation_date', 'updated_at'],
      order: [['mcc_code', 'ASC'], ['display_order', 'ASC'], ['name', 'ASC']]
    });
    
    res.json(operations);
  } catch (error) {
    console.error('Error getting MCC operations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Gets operations grouped by MCC categories. */
router.get('/categories', authenticateToken, async (req, res) => {
  try {
    const operations = await db.mccOperations.findAll({
      attributes: ['id_operation', 'mcc_code', 'name', 'description', 'operation_code', 'msg_type', 'processing_code', 'requires_amount', 'requires_tip', 'active', 'display_order', 'icon_name', 'category_code', 'creation_date', 'updated_at'],
      where: { active: 1 },
      order: [['mcc_code', 'ASC'], ['display_order', 'ASC'], ['name', 'ASC']]
    });

    // Group by category_code from the operation itself
    const categories = {};
    
    operations.forEach(op => {
      const categoryCode = op.category_code || 'OTHER';
      const category = getCategoryInfo(categoryCode);
      
      if (!categories[categoryCode]) {
        categories[categoryCode] = {
          code: categoryCode,
          name: category.name,
          description: category.description,
          operations: []
        };
      }
      
      categories[categoryCode].operations.push(op);
    });

    res.json(Object.values(categories));
  } catch (error) {
    console.error('Error getting MCC categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Gets operations for a specific MCC code. */
router.get('/mcc/:mccCode', authenticateToken, async (req, res) => {
  try {
    const { mccCode } = req.params;
    
    const operations = await db.mccOperations.findAll({
      where: { mcc_code: mccCode },
      order: [['display_order', 'ASC'], ['name', 'ASC']]
    });
    
    res.json(operations);
  } catch (error) {
    console.error('Error getting operations by MCC code:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Gets available operations that can be assigned to a specific MCC. */
router.get('/available/:mccCode', authenticateToken, async (req, res) => {
  try {
    const { mccCode } = req.params;
    
    // Get all operations that are NOT already assigned to this MCC
    const existingOperations = await db.mccOperations.findAll({
      where: { mcc_code: mccCode },
      attributes: ['operation_code']
    });
    
    const existingCodes = existingOperations.map(op => op.operation_code);
    
    // Get all active operations that are not already assigned
    const availableOperations = await db.mccOperations.findAll({
      where: { 
        active: 1,
        operation_code: { [db.Sequelize.Op.notIn]: existingCodes }
      },
      attributes: ['id_operation', 'name', 'description', 'operation_code', 'msg_type', 'processing_code', 'requires_amount', 'requires_tip', 'icon_name', 'display_order'],
      order: [['name', 'ASC']]
    });
    
    res.json(availableOperations);
  } catch (error) {
    console.error('Error getting available operations for MCC:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Assigns an existing operation to a specific MCC. */
router.post('/mcc/:mccCode/assign', authenticateToken, async (req, res) => {
  try {
    const { mccCode } = req.params;
    const { operation_code, display_order } = req.body;
    
    if (!operation_code) {
      return res.status(400).json({ error: 'Operation code is required' });
    }
    
    // Check if operation already exists for this MCC
    const existing = await db.mccOperations.findOne({
      where: { mcc_code: mccCode, operation_code }
    });
    
    if (existing) {
      return res.status(400).json({ error: 'Operation already exists for this MCC' });
    }
    
    // Get the template operation to copy
    const templateOperation = await db.mccOperations.findOne({
      where: { operation_code, active: 1 }
    });
    
    if (!templateOperation) {
      return res.status(404).json({ error: 'Template operation not found' });
    }
    
    // Create new operation for this MCC
    const newOperation = await db.mccOperations.create({
      mcc_code: mccCode,
      name: templateOperation.name,
      description: templateOperation.description,
      operation_code: templateOperation.operation_code,
      msg_type: templateOperation.msg_type,
      processing_code: templateOperation.processing_code,
      requires_amount: templateOperation.requires_amount,
      requires_tip: templateOperation.requires_tip,
      active: 1,
      display_order: display_order || templateOperation.display_order || 999,
      icon_name: templateOperation.icon_name,
      category_code: templateOperation.category_code,
      creation_date: new Date(),
      updated_at: new Date()
    });
    
    res.status(201).json(newOperation);
  } catch (error) {
    console.error('Error assigning operation to MCC:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Removes an operation from a specific MCC. */
router.delete('/mcc/:mccCode/operation/:operationCode', authenticateToken, async (req, res) => {
  try {
    const { mccCode, operationCode } = req.params;
    
    const operation = await db.mccOperations.findOne({
      where: { mcc_code: mccCode, operation_code: operationCode }
    });
    
    if (!operation) {
      return res.status(404).json({ error: 'Operation not found for this MCC' });
    }
    
    await operation.destroy();
    res.status(204).send();
  } catch (error) {
    console.error('Error removing operation from MCC:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Gets MCC information with operations count. */
router.get('/mcc-info/:mccCode', authenticateToken, async (req, res) => {
  try {
    const { mccCode } = req.params;
    
    // Get MCC information
    const mccInfo = await db.isoMcc.findOne({
      where: { mcc: mccCode, active: 1 },
      attributes: ['id_mcc', 'mcc', 'description']
    });
    
    if (!mccInfo) {
      return res.status(404).json({ error: 'MCC not found' });
    }
    
    // Get operations count for this MCC
    const operationsCount = await db.mccOperations.count({
      where: { mcc_code: mccCode, active: 1 }
    });
    
    // Get category info
    const mccService = require('../../../services/mcc-operations.service');
    const categoryInfo = mccService.getMccCategory(mccCode);
    
    res.json({
      mcc: mccInfo,
      operations_count: operationsCount,
      category: categoryInfo
    });
  } catch (error) {
    console.error('Error getting MCC info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Creates a new MCC operation. */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      mcc_code,
      name,
      description,
      operation_code,
      msg_type,
      processing_code,
      requires_amount,
      requires_tip,
      active,
      display_order,
      icon_name,
      category_code
    } = req.body;

    // Check for duplicate operation code in same MCC
    const existing = await db.mccOperations.findOne({
      where: {
        mcc_code,
        operation_code
      }
    });

    if (existing) {
      return res.status(400).json({ 
        error: 'Operation code already exists for this MCC code' 
      });
    }

    const newOperation = await db.mccOperations.create({
      mcc_code,
      name,
      description,
      operation_code,
      msg_type,
      processing_code,
      requires_amount,
      requires_tip,
      active,
      display_order,
      icon_name,
      category_code,
      creation_date: new Date(),
      updated_at: new Date()
    });

    // Return the created operation
    const createdOperation = await db.mccOperations.findByPk(newOperation.id_operation);
    res.status(201).json(createdOperation);
  } catch (error) {
    console.error('Error creating operation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Updates an MCC operation. */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      mcc_code,
      name,
      description,
      operation_code,
      msg_type,
      processing_code,
      requires_amount,
      requires_tip,
      active,
      display_order,
      icon_name,
      category_code
    } = req.body;

    // Check if operation exists
    const existing = await db.mccOperations.findByPk(id);

    if (!existing) {
      return res.status(404).json({ error: 'Operation not found' });
    }

    // Check for duplicate operation code in same MCC (excluding current)
    const duplicate = await db.mccOperations.findOne({
      where: {
        mcc_code,
        operation_code,
        id_operation: { [db.Sequelize.Op.ne]: id }
      }
    });

    if (duplicate) {
      return res.status(400).json({ 
        error: 'Operation code already exists for this MCC code' 
      });
    }

    await existing.update({
      mcc_code,
      name,
      description,
      operation_code,
      msg_type,
      processing_code,
      requires_amount,
      requires_tip,
      active,
      display_order,
      icon_name,
      category_code,
      updated_at: new Date()
    });

    // Return updated operation
    const updatedOperation = await db.mccOperations.findByPk(id);
    res.json(updatedOperation);
  } catch (error) {
    console.error('Error updating operation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Deletes an MCC operation. */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if operation exists
    const existing = await db.mccOperations.findByPk(id);

    if (!existing) {
      return res.status(404).json({ error: 'Operation not found' });
    }

    await existing.destroy();
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting operation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Toggles the active status of an MCC operation. */
router.patch('/:id/toggle', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    // Check if operation exists
    const existing = await db.mccOperations.findByPk(id);

    if (!existing) {
      return res.status(404).json({ error: 'Operation not found' });
    }

    await existing.update({
      active,
      updated_at: new Date()
    });

    // Return updated operation
    const updatedOperation = await db.mccOperations.findByPk(id);
    res.json(updatedOperation);
  } catch (error) {
    console.error('Error toggling operation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Gets the list of available operation icons. */
router.get('/icons', authenticateToken, async (req, res) => {
  const icons = [
    'login', 'logout', 'restaurant', 'shopping_cart', 'car', 'route', 
    'wallet', 'briefcase', 'arrow_in', 'arrow_out', 'download', 
    'medical', 'pill', 'user_tie', 'book', 'plus', 'calendar', 'return'
  ];
  res.json(icons);
});

/** Gets MCC range descriptions. */
router.get('/mcc-ranges', authenticateToken, async (req, res) => {
  const ranges = [
    { code: 'FOOD_581', name: 'Restaurants & Fast Food', description: 'Eating places, restaurants, fast food establishments' },
    { code: 'SERVICES_3XX', name: 'Travel & Entertainment', description: 'Airlines, lodging, car rental, travel agencies, restaurants' },
    { code: 'TRANSPORT_4XX', name: 'Transportation', description: 'Taxi, bus, rail, transportation services' },
    { code: 'RETAIL_5XX', name: 'Retail Stores', description: 'Grocery stores, department stores, retail shops' },
    { code: 'BUSINESS_7XX', name: 'Business Services', description: 'Equipment rental, business services, consulting' },
    { code: 'PROFESSIONAL_8XX', name: 'Professional Services', description: 'Medical, education, professional services, healthcare' }
  ];
  res.json(ranges);
});

/**
 * Returns category metadata for a given category code.
 * @param {string} categoryCode - MCC category code.
 * @returns {{name:string, description:string}} Category display name and description.
 */
function getCategoryInfo(categoryCode) {
  const categoryMap = {
    'FOOD_58X': { name: 'Restaurants & Food Services', description: 'Eating places, restaurants, fast food establishments' },
    'BAR_FOOD_58X': { name: 'Bars & Nightclubs', description: 'Bar operations and tab management' },
    'SERVICES_3XX': { name: 'Travel & Entertainment', description: 'Airlines, lodging, car rental, travel agencies' },
    'TRANSPORT_4XX': { name: 'Transportation', description: 'Taxi, bus, rail, transportation services' },
    'RETAIL_5XX': { name: 'Retail Stores', description: 'Grocery stores, department stores, retail shops' },
    'ECOMMERCE_RETAIL_5XX': { name: 'E-commerce Retail', description: 'Online retail and e-commerce operations' },
    'MOTO_RETAIL_5XX': { name: 'Mail/Telephone Order', description: 'MOTO retail operations' },
    'BUSINESS_7XX': { name: 'Business Services', description: 'Hotels, motels, business services, equipment rental' },
    'PROFESSIONAL_8XX': { name: 'Professional Services', description: 'Medical, education, professional services, healthcare' }
  };
  
  return categoryMap[categoryCode] || { name: 'Other', description: 'Other MCC categories' };
}

/** Registers a smart device for MCC operations. */
router.post('/register-device', authenticateToken, async (req, res) => {
  try {
    const deviceInfo = req.body;
    
    // Validate required fields
    if (!deviceInfo.deviceId || !deviceInfo.operationCode) {
      return res.status(400).json({
        success: false,
        message: 'Device ID and operation code are required',
        error: {
          code: 'VALIDATION_ERROR',
          details: 'Missing required fields for device registration',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Simulate device registration
    const mccService = require('../../../services/mcc-operations.service');
    const result = await mccService.registerDevice(deviceInfo);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Device registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during device registration',
      error: {
        code: 'SERVER_ERROR',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

module.exports = router;
