module.exports = (sequelize, type) => {
  return sequelize.define('profile_resources', {
    id: {
      type: type.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    id_profile: {
      type: type.DataTypes.INTEGER,
      references: {
        model: 'user_profile',
        key: 'id_profile'
      }
    },
    id_resource: {
      type: type.DataTypes.INTEGER,
      references: {
        model: 'resources',
        key: 'id'
      }
    },
    icon: type.DataTypes.STRING(30),
    father_resource: type.DataTypes.INTEGER,
    resource_name: type.DataTypes.STRING(50),
    resource_url: type.DataTypes.STRING(50),
    create: { type: type.DataTypes.INTEGER, defaultValue: 0 },
    edit: { type: type.DataTypes.INTEGER, defaultValue: 0 },
    delete: { type: type.DataTypes.INTEGER, defaultValue: 0 },
    select: { type: type.DataTypes.INTEGER, defaultValue: 0 },
    // allowed_methods: { type: type.DataTypes.JSON, defaultValue: [] }
  }, {
    tableName: 'profile_resources',
    timestamps: true,
    paranoid: false
  });
};
