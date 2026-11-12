module.exports = (sequelize, type) => {
  return sequelize.define('smart_device', {
    idsmtdevice: {
      type: type.DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },
    uuid: {
      type: type.DataTypes.STRING(40),
      allowNull: false,
      primaryKey: false
    },
    app_version: {
      type: type.DataTypes.STRING(10),
      allowNull: false,
    },
    type_os: type.DataTypes.STRING(10),
    os_version: type.DataTypes.STRING(10),
    active: type.DataTypes.TINYINT,
    create_date: {
      type: type.DataTypes.DATE,
      defaultValue: type.fn('now')
    },
    last_update: {
      type: type.DataTypes.DATE,
      defaultValue: type.fn('now')
    }
  }, {
    tableName:'smart_device',
    createdAt: 'create_date',
    last_update: 'last_update',
    paranoid: false,
    timestamps: false
  })
}