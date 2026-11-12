const { DataTypes, fn } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('cat_iso3166', {
    id:{
      type:           DataTypes.INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    country: DataTypes.STRING(100),
    alpha2: DataTypes.STRING(2),
    alpha3: DataTypes.STRING(3),
    created_at: {
      type: DataTypes.DATE,
      defaultValue: fn('now')
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: fn('now')
    },
    deleted_at: {
      type: DataTypes.DATE,
      defaultValue: null
    }
  }, {
    tableName: 'cat_iso3166',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
    paranoid: true,
    timestamps: true,
  })
}