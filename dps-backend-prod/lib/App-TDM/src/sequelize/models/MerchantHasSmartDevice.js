module.exports = (sequelize,type) => {
  return sequelize.define('merchant_has_smart_device',{
    merchant_idmerchant: {
      type: type.DataTypes.TINYINT,
      autoIncrement: false
    },
    smart_device_idsmtdevice: {
      type: type.DataTypes.TINYINT,
      primaryKey: true,
      autoIncrement: false
    },
    create_date: {
      type: type.DataTypes.DATE,
      defaultValue: type.fn('now')
    },
    last_update: {
      type: type.DataTypes.DATE,
      defaultValue: type.fn('now')
    }
  }, {
    tableName:'merchant_has_smart_device',
    timestamps: false,
    last_update: 'last_update',
    createdAt: 'create_date',
    paranoid: true
  });
}