module.exports = (sequelize, type) => {
  return sequelize.define('roles', {
    id_role: {
      type: type.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: type.DataTypes.STRING(50),
    comments: type.DataTypes.STRING(255),
  }, {
    tableName: 'roles',
    timestamps: true,
    paranoid: true
  });
};
