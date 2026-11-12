const db        = require("../../../sequelize/init");
const userCtrl  = {};

userCtrl.render = async (req, res, next) => {
  //controllers/SPA/Consolidate/index.controller.js 
  const consolidate = await db.consolidadosTx.findAll();
  
  return res.json( consolidate );
}

module.exports = userCtrl;