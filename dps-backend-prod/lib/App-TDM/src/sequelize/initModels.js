module.exports = (sequelize,Sequelize, db) => {

  db.userHasSmartDevice = require('./models/UserHasSmartDevice')(sequelize,Sequelize)
  db.smartDevice = require('./models/SmartDevice')(sequelize,Sequelize);
  db.user = require('./models/User')(sequelize,Sequelize);
  db.session = require('./models/Session')(sequelize,Sequelize);
  db.smartDevicehasTerminalDevice = require('./models/SmartDeviceHasTerminalDevice')(sequelize,Sequelize);
  db.merchantHasUser = require('./models/MerchantHasUser')(sequelize,Sequelize);
  db.merchant = require('./models/Merchant')(sequelize,Sequelize);
  db.merchantHasSmartDevice = require('./models/MerchantHasSmartDevice')(sequelize,Sequelize);
  db.terminalDevice = require('./models/TerminalDevice')(sequelize,Sequelize);
  return db;
}