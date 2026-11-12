module.exports = (sequelize,type) => {
  return sequelize.define('user_has_smart_device',{
    user_iduser: {
      type: type.DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: false,
    },
    smart_device_idsmtdevice: {
      type: type.DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: false,
    },
    create_date:        {type: type.DataTypes.DATE, defaultValue: type.fn('now') },
    last_update:          {type: type.DataTypes.DATE, defaultValue: type.fn('now') },
  },{
    tableName: 'user_has_smart_device',
    createdAt: 'create_date',
    updatedAt: 'last_update',
    paranoid: true,
    timestamps: false,
  }
  )
}