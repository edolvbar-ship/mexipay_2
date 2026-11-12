const operationsCtrl = {};

const db = require('../../../sequelize/init');
const pool = require("../../../database");

operationsCtrl.getOperations = async (req, res) => {
  try {
    const { id_giro } = req.query;
    let whereCondition = { active: 1 };
    
    if (id_giro) {
      whereCondition.id_giro = id_giro;
    }
    
    const operations = await db.processingOperations.findAll({
      where: whereCondition,
      include: [{
        model: db.isoGiro,
        as: 'iso_giro',
        attributes: ['id_giro', 'name', 'code']
      }],
      order: [['display_order', 'ASC'], ['name', 'ASC']]
    });
    
    res.json(operations);
  } catch (error) {
    console.error('Error getting operations:', error);
    res.status(500).json({
      status: "error",
      data: error.message
    });
  }
};

operationsCtrl.getOperationById = async (req, res) => {
  try {
    const { id } = req.params;
    const operation = await db.processingOperations.findOne({
      where: { id_operation: id, active: 1 },
      include: [{
        model: db.isoGiro,
        as: 'iso_giro',
        attributes: ['id_giro', 'name', 'code']
      }]
    });
    
    if (!operation) {
      return res.status(404).json({
        status: "error",
        data: "Operation not found"
      });
    }
    
    res.json(operation);
  } catch (error) {
    console.error('Error getting operation:', error);
    res.status(500).json({
      status: "error",
      data: error.message
    });
  }
};

operationsCtrl.getOperationsByGiro = async (req, res) => {
  try {
    const { id_giro } = req.params;
    
    // Verify giro exists
    const giro = await db.isoGiro.findOne({
      where: { id_giro: id_giro, active: 1 }
    });
    
    if (!giro) {
      return res.status(404).json({
        status: "error",
        data: "Giro not found"
      });
    }
    
    const operations = await db.processingOperations.findAll({
      where: { 
        id_giro: id_giro,
        active: 1 
      },
      order: [['display_order', 'ASC'], ['name', 'ASC']]
    });
    
    res.json({
      giro: giro,
      operations: operations
    });
  } catch (error) {
    console.error('Error getting operations by giro:', error);
    res.status(500).json({
      status: "error",
      data: error.message
    });
  }
};

operationsCtrl.getOperationsByMerchantGiro = async (req, res) => {
  try {
    const { id_merchant } = req.params;
    
    // Get merchant and their giro
    const merchant = await db.merchant.findOne({
      where: { 
        id_merchant: id_merchant,
        active: 1,
        deleted_at: null
      }
    });
    
    if (!merchant) {
      return res.status(404).json({
        status: "error",
        data: "Merchant not found"
      });
    }
    
    if (!merchant.id_giro) {
      return res.status(400).json({
        status: "error",
        data: "Merchant has no giro assigned"
      });
    }
    
    // Get operations for merchant's giro
    const operations = await db.processingOperations.findAll({
      where: { 
        id_giro: merchant.id_giro,
        active: 1 
      },
      order: [['display_order', 'ASC'], ['name', 'ASC']]
    });
    
    res.json({
      merchant: {
        id_merchant: merchant.id_merchant,
        name_merchant: merchant.name_merchant,
        id_giro: merchant.id_giro
      },
      operations: operations
    });
  } catch (error) {
    console.error('Error getting operations by merchant giro:', error);
    res.status(500).json({
      status: "error",
      data: error.message
    });
  }
};

operationsCtrl.createOperation = async (req, res) => {
  try {
    const { 
      id_giro, name, description, operation_code, msg_type, 
      processing_code, requires_amount, requires_tip, display_order, icon_name 
    } = req.body;
    
    // Verify giro exists
    const giro = await db.isoGiro.findOne({
      where: { id_giro: id_giro, active: 1 }
    });
    
    if (!giro) {
      return res.status(400).json({
        status: "error",
        data: "Giro not found"
      });
    }
    
    // Check if operation code already exists for this giro
    const existingOperation = await db.processingOperations.findOne({
      where: { 
        id_giro: id_giro,
        operation_code: operation_code,
        active: 1 
      }
    });
    
    if (existingOperation) {
      return res.status(400).json({
        status: "error",
        data: "Operation with this code already exists for this giro"
      });
    }
    
    const newOperation = await db.processingOperations.create({
      id_giro,
      name,
      description,
      operation_code,
      msg_type,
      processing_code,
      requires_amount: requires_amount !== undefined ? requires_amount : 1,
      requires_tip: requires_tip !== undefined ? requires_tip : 0,
      display_order: display_order || 0,
      icon_name: icon_name || null,
      active: 1,
      updated_at: new Date()
    });
    
    res.status(201).json({
      status: "success",
      data: newOperation
    });
  } catch (error) {
    console.error('Error creating operation:', error);
    res.status(500).json({
      status: "error",
      data: error.message
    });
  }
};

operationsCtrl.updateOperation = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      id_giro, name, description, operation_code, msg_type, 
      processing_code, requires_amount, requires_tip, display_order, icon_name, active 
    } = req.body;
    
    const operation = await db.processingOperations.findOne({
      where: { id_operation: id }
    });
    
    if (!operation) {
      return res.status(404).json({
        status: "error",
        data: "Operation not found"
      });
    }
    
    // If changing giro, verify new giro exists
    if (id_giro && id_giro !== operation.id_giro) {
      const giro = await db.isoGiro.findOne({
        where: { id_giro: id_giro, active: 1 }
      });
      
      if (!giro) {
        return res.status(400).json({
          status: "error",
          data: "Giro not found"
        });
      }
    }
    
    // Check if another operation with the same code exists for this giro
    if (operation_code && (id_giro !== operation.id_giro || operation_code !== operation.operation_code)) {
      const targetGiro = id_giro || operation.id_giro;
      const existingOperation = await db.processingOperations.findOne({
        where: { 
          id_giro: targetGiro,
          operation_code: operation_code,
          id_operation: { [db.Sequelize.Op.ne]: id },
          active: 1 
        }
      });
      
      if (existingOperation) {
        return res.status(400).json({
          status: "error",
          data: "Operation with this code already exists for this giro"
        });
      }
    }
    
    await operation.update({
      id_giro: id_giro || operation.id_giro,
      name: name || operation.name,
      description: description || operation.description,
      operation_code: operation_code || operation.operation_code,
      msg_type: msg_type || operation.msg_type,
      processing_code: processing_code || operation.processing_code,
      requires_amount: requires_amount !== undefined ? requires_amount : operation.requires_amount,
      requires_tip: requires_tip !== undefined ? requires_tip : operation.requires_tip,
      display_order: display_order !== undefined ? display_order : operation.display_order,
      icon_name: icon_name !== undefined ? icon_name : operation.icon_name,
      active: active !== undefined ? active : operation.active,
      updated_at: new Date()
    });
    
    res.json({
      status: "success",
      data: operation
    });
  } catch (error) {
    console.error('Error updating operation:', error);
    res.status(500).json({
      status: "error",
      data: error.message
    });
  }
};

operationsCtrl.deleteOperation = async (req, res) => {
  try {
    const { id } = req.params;
    
    const operation = await db.processingOperations.findOne({
      where: { id_operation: id }
    });
    
    if (!operation) {
      return res.status(404).json({
        status: "error",
        data: "Operation not found"
      });
    }
    
    // Soft delete
    await operation.update({
      active: 0,
      updated_at: new Date()
    });
    
    res.json({
      status: "success",
      data: "Operation deleted successfully"
    });
  } catch (error) {
    console.error('Error deleting operation:', error);
    res.status(500).json({
      status: "error",
      data: error.message
    });
  }
};

module.exports = operationsCtrl;
