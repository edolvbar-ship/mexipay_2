module.exports = (sequelize, type) => {
  return sequelize.define('terminal_device',{
    idterm_device: {
      type: type.DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    model_idmodel: {
      type: type.DataTypes.INTEGER,
      allowNull: false,
    },
    serial: {
      type: type.DataTypes.STRING(50),
      allowNull: false,
    },
    firmware: {
      type: type.DataTypes.STRING(45),
      allowNull: false,
    },
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
    tableName: 'terminal_device',
    createdAt: 'create_date',
    last_update: 'last_update',
    timestamps: false,
    paranoid:false
  })
}