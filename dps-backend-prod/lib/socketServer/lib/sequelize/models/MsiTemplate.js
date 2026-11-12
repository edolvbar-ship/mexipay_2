const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const MsiTemplate = sequelize.define('MsiTemplate', {
    id_template: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    plans: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: []
    },
    national_only: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    token_q6_supported: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    is_default: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    created_by: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'msi_templates',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['name']
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['is_default']
      }
    ]
  });

  MsiTemplate.associate = (models) => {
    // Many-to-many relationship with merchants
    MsiTemplate.belongsToMany(models.Merchant, {
      through: 'merchant_msi_templates',
      foreignKey: 'id_template',
      otherKey: 'id_merchant',
      as: 'merchants'
    });
  };

  return MsiTemplate;
};
