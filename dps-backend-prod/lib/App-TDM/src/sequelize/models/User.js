module.exports = (sequelize,type) => {
  return sequelize.define('user',{
    iduser: {
      type: type.DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },
    first_name: type.DataTypes.STRING(1024),
    last_name: type.DataTypes.STRING(1024),
    last_name2: type.DataTypes.STRING(1024),
    email: type.DataTypes.STRING(150),
    password: type.DataTypes.STRING(512),
    last_pwd_update: type.DataTypes.DATE,
    active: type.DataTypes.TINYINT,
    create_date: {
      type: type.DataTypes.DATE,
      defaultValue: type.fn('now'),
    },
    last_update: {
      type: type.DataTypes.DATE,
      defaultValue: type.fn('now'),
    },
    token_pwd: type.DataTypes.STRING(100),
  }, {
    tableName: 'user',
    createdAt: 'create_date',
    last_update: 'last_update',
    timestamps: false,
    paranoid: false,
  }
  )
}