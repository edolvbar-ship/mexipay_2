module.exports = (sequelize, type) => {
  return sequelize.define('session',{
    idsession: {
      type: type.DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: type.DataTypes.BIGINT,
      allowNull: false,
    },
    session_uuid: {
      type: type.DataTypes.STRING(50),
      allowNull: true,
      defaultValue: type.UUIDV4,
    },
    smart_device_idsmtdevice: {
      type: type.DataTypes.BIGINT,
      allowNull: true
    },
    expire: {
      type: type.DataTypes.STRING(50),

    },
    active: {
      type: type.DataTypes.TINYINT,
      allowNull: false,
    },
    create_date: {
      type: type.DataTypes.STRING(50),
      allowNull: false,
    },
    last_update: {
      type: type.DataTypes.STRING(50),
      allowNull: false,
    }, 
  },{
    tableName:'session',
    paranoid: false,
    timestamps: false,
  })
} 