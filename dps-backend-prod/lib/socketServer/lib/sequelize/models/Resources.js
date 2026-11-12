module.exports = (sequelize, type) => {
  return sequelize.define('resources', {
    id: {
      type: type.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    icon: type.DataTypes.STRING(30),
    father_resource: type.DataTypes.INTEGER,
    resource_name: type.DataTypes.STRING(50),
    resource_url: type.DataTypes.STRING(50),
    isF: { type: type.DataTypes.INTEGER, defaultValue: 0 },
    isConfig: { type: type.DataTypes.INTEGER, defaultValue: 0 },
    isCrud: { type: type.DataTypes.INTEGER, defaultValue: 0 },
    isGroup: { type: type.DataTypes.INTEGER, defaultValue: 0 },
    justPage: { type: type.DataTypes.INTEGER, defaultValue: 0 }
  }, {
    tableName: 'resources',
    timestamps: true,
    paranoid: true
  });
};
