module.exports = (db) => {
  db.userHasSmartDevice.hasOne(db.smartDevice,{sourceKey: 'smart_device_idsmtdevice', foreignKey: 'idsmtdevice', as: 'smart_device'});
  db.userHasSmartDevice.hasOne(db.user,{sourceKey: 'user_iduser',foreignKey: 'iduser', as: 'user'});
  db.smartDevicehasTerminalDevice.hasOne(db.smartDevice,{sourceKey: 'smart_device_idsmtdevice', foreignKey: 'idsmtdevice', as: "smart_device"});
  db.merchantHasUser.hasOne(db.merchant,{sourceKey: 'merchant_idmerchant',foreignKey: 'idmerchant',as: 'merchant'});
  db.merchantHasSmartDevice.hasOne(db.merchant,{sourceKey: 'merchant_idmerchant',foreignKey: 'idmerchant',as: 'merchant'});
  return db;
}