module.exports = (sequelize,type) => {
  return sequelize.define('smart_device_has_terminal_device',{
    smart_device_idsmtdevice: {
      type: type.DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true,
    },
    terminal_device_idterm_device: {
      type: type.DataTypes.BIGINT,
      allowNull: false,
    },
    create_date: {
      type: type.DataTypes.DATE,
      defaultValue: type.fn('now')
    },
    last_update: {
      type: type.DataTypes.DATE,
      defaultValue: type.fn('now')
    },
    id_merchant: {
      type: type.DataTypes.BIGINT,
      allowNull: false,
    },
  }, {
    tableName:'smart_device_has_terminal_device',
    createdAt: 'create_date',
    last_update: 'last_update',
    paranoid: true,
    timestamps: false
  })
}