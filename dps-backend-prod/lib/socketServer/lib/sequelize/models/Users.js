const { DATE } = require('sequelize').DataTypes;
module.exports = (sequelize, type) => {
  return sequelize.define('users', {
    id_user: {
      type: type.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    id_profile: {
      type: type.DataTypes.INTEGER,
      defaultValue: 1,
      allowNull: false,
      references: {
        model: 'user_profile',
        key: 'id_profile'
      },
    },
    id_cliente: {
      type: type.DataTypes.INTEGER,
      defaultValue: null,
      allowNull: true,
      references: {
        model: 'iso_client',
        key: 'id_client'
      },
    },
    is_admin: type.DataTypes.INTEGER(2),
    // is_super_admin: { type: type.DataTypes.INTEGER(2), defaultValue: 0 },
    username: type.DataTypes.STRING(17),
    name: type.DataTypes.STRING(30),
    last_name: type.DataTypes.STRING(30),
    sur_name: type.DataTypes.STRING(30),
    mail: type.DataTypes.STRING(50),
    telephone: type.DataTypes.STRING(20),
    picture: type.DataTypes.STRING(25),
    password: type.DataTypes.STRING(60),
    change_password: type.DataTypes.INTEGER(11),
    online: type.DataTypes.INTEGER(1),
    updated_at: type.DataTypes.DATE,
    token_pwd: type.DataTypes.STRING(100),
    intento: type.DataTypes.INTEGER(11),
    // roles: { type: type.DataTypes.JSON, defaultValue: [] },
    created_at: { type: DATE, defaultValue: sequelize.fn('now') },
  }, {
    tableName: 'users',
    timestamps: false
  });
};
