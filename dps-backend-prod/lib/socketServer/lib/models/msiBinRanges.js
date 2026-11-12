/**
 * @file Sequelize model for MSI (monthly interest-free installments) BIN ranges.
 * PCI DSS 4.0: Req 3.4 (BIN data is not sensitive cardholder data, but must be protected), Req 3.5.1 (data protection).
 */
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  /**
   * Sequelize model representing valid BIN ranges for MSI-promotion enabled cards.
   */
  class MsiBinRange extends Model {
    /**
     * Defines model associations.
     * @param {Object} models - Sequelize models registry.
     */
    static associate(models) {
      // No associations needed for this model
    }
  }

  MsiBinRange.init({
    id_msi_bin: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    bin_start: {
      type: DataTypes.STRING(6),
      allowNull: false,
      validate: {
        isNumeric: true,
        len: [6, 6]
      }
    },
    bin_end: {
      type: DataTypes.STRING(6),
      allowNull: false,
      validate: {
        isNumeric: true,
        len: [6, 6]
      }
    },
    bank_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    card_brand: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: [['Visa', 'Mastercard', 'Amex', 'Discover']]
      }
    },
    country_code: {
      type: DataTypes.STRING(2),
      allowNull: false,
      defaultValue: 'MX'
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
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
    sequelize,
    modelName: 'MsiBinRange',
    tableName: 'msi_bin_ranges',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['bin_start', 'bin_end']
      },
      {
        fields: ['card_brand']
      },
      {
        fields: ['country_code']
      },
      {
        fields: ['active']
      }
    ]
  });

  return MsiBinRange;
};
