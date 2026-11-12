const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../../middleware/auth.middleware');
const db = require('../../../sequelize/init');

// Get all MCC operations
router.get('/', authenticateToken, async (req, res) => {
  try {
    const operations = await db.mccOperations.findAll({
      attributes: ['id_operation', 'mcc_range_start', 'mcc_range_end', 'name', 'description', 'operation_code', 'msg_type', 'processing_code', 'requires_amount', 'requires_tip', 'active', 'display_order', 'icon_name', 'creation_date', 'updated_at'],
      order: [['mcc_range_start', 'ASC'], ['display_order', 'ASC'], ['name', 'ASC']]
    });
    
    res.json(operations);
  } catch (error) {
    console.error('Error getting MCC operations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get operations grouped by MCC categories
router.get('/categories', authenticateToken, async (req, res) => {
  try {
    const operations = await db.mccOperations.findAll({
      attributes: ['id_operation', 'mcc_range_start', 'mcc_range_end', 'name', 'description', 'operation_code', 'msg_type', 'processing_code', 'requires_amount', 'requires_tip', 'active', 'display_order', 'icon_name', 'creation_date', 'updated_at'],
      where: { active: 1 },
      order: [['mcc_range_start', 'ASC'], ['display_order', 'ASC'], ['name', 'ASC']]
    });

    // Group by MCC ranges
    const categories = {};
    
    operations.forEach(op => {
      const rangeKey = op.mcc_range_end ? `${op.mcc_range_start}-${op.mcc_range_end}` : op.mcc_range_start;
      const category = getCategoryInfo(op.mcc_range_start);
      
      if (!categories[category.code]) {
        categories[category.code] = {
          code: category.code,
          name: category.name,
          description: category.description,
          operations: []
        };
      }
      
      categories[category.code].operations.push(op);
    });

    res.json(Object.values(categories));
  } catch (error) {
    console.error('Error getting MCC categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get operations for specific MCC range
router.get('/range', authenticateToken, async (req, res) => {
  try {
    const { mcc_range_start, mcc_range_end } = req.query;
    
    let whereClause = { mcc_range_start };
    
    if (mcc_range_end) {
      whereClause[db.Sequelize.Op.or] = [
        { mcc_range_end: mcc_range_end },
        { mcc_range_end: null }
      ];
    }
    
    const operations = await db.mccOperations.findAll({
      where: whereClause,
      order: [['display_order', 'ASC'], ['name', 'ASC']]
    });
    
    res.json(operations);
  } catch (error) {
    console.error('Error getting operations by range:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new operation
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      mcc_range_start,
      mcc_range_end,
      name,
      description,
      operation_code,
      msg_type,
      processing_code,
      requires_amount,
      requires_tip,
      active,
      display_order,
      icon_name
    } = req.body;

    // Check for duplicate operation code in same range
    const [existing] = await pool.query(`
      SELECT id_operation FROM mcc_operations 
      WHERE mcc_range_start = ? AND operation_code = ?
    `, [mcc_range_start, operation_code]);

    if (existing.length > 0) {
      return res.status(400).json({ 
        error: 'Operation code already exists in this MCC range' 
      });
    }

    const [result] = await pool.query(`
      INSERT INTO mcc_operations (
        mcc_range_start, mcc_range_end, name, description, operation_code,
        msg_type, processing_code, requires_amount, requires_tip,
        active, display_order, icon_name, creation_date, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      mcc_range_start, mcc_range_end, name, description, operation_code,
      msg_type, processing_code, requires_amount, requires_tip,
      active, display_order, icon_name
    ]);

    // Return the created operation
    const [newOperation] = await pool.query(`
      SELECT * FROM mcc_operations WHERE id_operation = ?
    `, [result.insertId]);

    res.status(201).json(newOperation[0]);
  } catch (error) {
    console.error('Error creating operation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update operation
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      mcc_range_start,
      mcc_range_end,
      name,
      description,
      operation_code,
      msg_type,
      processing_code,
      requires_amount,
      requires_tip,
      active,
      display_order,
      icon_name
    } = req.body;

    // Check if operation exists
    const [existing] = await pool.query(`
      SELECT id_operation FROM mcc_operations WHERE id_operation = ?
    `, [id]);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Operation not found' });
    }

    // Check for duplicate operation code in same range (excluding current)
    const [duplicate] = await pool.query(`
      SELECT id_operation FROM mcc_operations 
      WHERE mcc_range_start = ? AND operation_code = ? AND id_operation != ?
    `, [mcc_range_start, operation_code, id]);

    if (duplicate.length > 0) {
      return res.status(400).json({ 
        error: 'Operation code already exists in this MCC range' 
      });
    }

    await pool.query(`
      UPDATE mcc_operations SET
        mcc_range_start = ?, mcc_range_end = ?, name = ?, description = ?,
        operation_code = ?, msg_type = ?, processing_code = ?,
        requires_amount = ?, requires_tip = ?, active = ?,
        display_order = ?, icon_name = ?, updated_at = NOW()
      WHERE id_operation = ?
    `, [
      mcc_range_start, mcc_range_end, name, description, operation_code,
      msg_type, processing_code, requires_amount, requires_tip,
      active, display_order, icon_name, id
    ]);

    // Return the updated operation
    const [updatedOperation] = await pool.query(`
      SELECT * FROM mcc_operations WHERE id_operation = ?
    `, [id]);

    res.json(updatedOperation[0]);
  } catch (error) {
    console.error('Error updating operation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete operation
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if operation exists
    const [existing] = await pool.query(`
      SELECT id_operation FROM mcc_operations WHERE id_operation = ?
    `, [id]);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Operation not found' });
    }

    await pool.query(`
      DELETE FROM mcc_operations WHERE id_operation = ?
    `, [id]);

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting operation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Toggle operation active status
router.patch('/:id/toggle', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    // Check if operation exists
    const [existing] = await pool.query(`
      SELECT id_operation FROM mcc_operations WHERE id_operation = ?
    `, [id]);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Operation not found' });
    }

    await pool.query(`
      UPDATE mcc_operations SET active = ?, updated_at = NOW() WHERE id_operation = ?
    `, [active, id]);

    // Return the updated operation
    const [updatedOperation] = await pool.query(`
      SELECT * FROM mcc_operations WHERE id_operation = ?
    `, [id]);

    res.json(updatedOperation[0]);
  } catch (error) {
    console.error('Error toggling operation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get available icons
router.get('/icons', authenticateToken, async (req, res) => {
  const icons = [
    'login', 'logout', 'restaurant', 'shopping_cart', 'car', 'route', 
    'wallet', 'briefcase', 'arrow_in', 'arrow_out', 'download', 
    'medical', 'pill', 'user_tie', 'book', 'plus', 'calendar', 'return'
  ];
  res.json(icons);
});

// Get MCC range descriptions
router.get('/mcc-ranges', authenticateToken, async (req, res) => {
  const ranges = [
    { code: 'SERVICES_3XX', name: 'Travel & Entertainment', description: 'Airlines, lodging, car rental, travel agencies, restaurants' },
    { code: 'TRANSPORT_4XX', name: 'Transportation', description: 'Taxi, bus, rail, transportation services' },
    { code: 'RETAIL_5XX', name: 'Retail Stores', description: 'Grocery stores, department stores, retail shops' },
    { code: 'BUSINESS_7XX', name: 'Business Services', description: 'Equipment rental, business services, consulting' },
    { code: 'PROFESSIONAL_8XX', name: 'Professional Services', description: 'Medical, education, professional services, healthcare' }
  ];
  res.json(ranges);
});

// Helper function to get category info
function getCategoryInfo(mccStart) {
  const prefix = parseInt(mccStart);
  if (prefix >= 300 && prefix < 400) {
    return { code: 'SERVICES_3XX', name: 'Travel & Entertainment', description: 'Airlines, lodging, car rental, travel agencies, restaurants' };
  }
  if (prefix >= 400 && prefix < 500) {
    return { code: 'TRANSPORT_4XX', name: 'Transportation', description: 'Taxi, bus, rail, transportation services' };
  }
  if (prefix >= 500 && prefix < 600) {
    return { code: 'RETAIL_5XX', name: 'Retail Stores', description: 'Grocery stores, department stores, retail shops' };
  }
  if (prefix >= 700 && prefix < 800) {
    return { code: 'BUSINESS_7XX', name: 'Business Services', description: 'Equipment rental, business services, consulting' };
  }
  if (prefix >= 800 && prefix < 900) {
    return { code: 'PROFESSIONAL_8XX', name: 'Professional Services', description: 'Medical, education, professional services, healthcare' };
  }
  return { code: 'OTHER', name: 'Other', description: 'Other MCC categories' };
}

// Register smart device for MCC operations
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
