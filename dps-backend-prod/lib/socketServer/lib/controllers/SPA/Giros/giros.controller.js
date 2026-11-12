const giroCtrl = {};

const db = require('../../../sequelize/init');
const pool = require("../../../database");

giroCtrl.getGiros = async (req, res) => {
  try {
    const isAdmn = req.user.is_admin;
    let giros;
    
    if (isAdmn == 1) {
      giros = await db.isoGiro.findAll({
        where: { active: 1 },
        order: [['name', 'ASC']]
      });
    } else {
      // For non-admin users, we could implement client-specific filtering if needed
      giros = await db.isoGiro.findAll({
        where: { active: 1 },
        order: [['name', 'ASC']]
      });
    }
    
    res.json(giros);
  } catch (error) {
    console.error('Error getting giros:', error);
    res.status(500).json({
      status: "error",
      data: error.message
    });
  }
};

giroCtrl.getGiroById = async (req, res) => {
  try {
    const { id } = req.params;
    const giro = await db.isoGiro.findOne({
      where: { id_giro: id, active: 1 }
    });
    
    if (!giro) {
      return res.status(404).json({
        status: "error",
        data: "Giro not found"
      });
    }
    
    res.json(giro);
  } catch (error) {
    console.error('Error getting giro:', error);
    res.status(500).json({
      status: "error",
      data: error.message
    });
  }
};

giroCtrl.createGiro = async (req, res) => {
  try {
    const { name, description, code } = req.body;
    
    // Check if giro already exists
    const existingGiro = await db.isoGiro.findOne({
      where: { 
        name: name,
        active: 1 
      }
    });
    
    if (existingGiro) {
      return res.status(400).json({
        status: "error",
        data: "Giro with this name already exists"
      });
    }
    
    const newGiro = await db.isoGiro.create({
      name,
      description,
      code,
      active: 1,
      updated_at: new Date()
    });
    
    res.status(201).json({
      status: "success",
      data: newGiro
    });
  } catch (error) {
    console.error('Error creating giro:', error);
    res.status(500).json({
      status: "error",
      data: error.message
    });
  }
};

giroCtrl.updateGiro = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, code, active } = req.body;
    
    const giro = await db.isoGiro.findOne({
      where: { id_giro: id }
    });
    
    if (!giro) {
      return res.status(404).json({
        status: "error",
        data: "Giro not found"
      });
    }
    
    // Check if another giro with the same name exists
    if (name && name !== giro.name) {
      const existingGiro = await db.isoGiro.findOne({
        where: { 
          name: name,
          id_giro: { [db.Sequelize.Op.ne]: id },
          active: 1 
        }
      });
      
      if (existingGiro) {
        return res.status(400).json({
          status: "error",
          data: "Giro with this name already exists"
        });
      }
    }
    
    await giro.update({
      name: name || giro.name,
      description: description || giro.description,
      code: code || giro.code,
      active: active !== undefined ? active : giro.active,
      updated_at: new Date()
    });
    
    res.json({
      status: "success",
      data: giro
    });
  } catch (error) {
    console.error('Error updating giro:', error);
    res.status(500).json({
      status: "error",
      data: error.message
    });
  }
};

giroCtrl.deleteGiro = async (req, res) => {
  try {
    const { id } = req.params;
    
    const giro = await db.isoGiro.findOne({
      where: { id_giro: id }
    });
    
    if (!giro) {
      return res.status(404).json({
        status: "error",
        data: "Giro not found"
      });
    }
    
    // Soft delete
    await giro.update({
      active: 0,
      updated_at: new Date()
    });
    
    res.json({
      status: "success",
      data: "Giro deleted successfully"
    });
  } catch (error) {
    console.error('Error deleting giro:', error);
    res.status(500).json({
      status: "error",
      data: error.message
    });
  }
};

module.exports = giroCtrl;
