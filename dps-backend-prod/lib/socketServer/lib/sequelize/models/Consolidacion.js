const { DataTypes } = require('sequelize');

module.exports = sequelize => {
  const modelo = sequelize.define('consolidacion', {
    id_consolidacion:{
      type:           DataTypes.INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    id_merchant: {
      type: DataTypes.INTEGER,
      references:{
        model: 'merchant',
        key: 'id_merchant'
      }
    },
    id_client: {
      type: DataTypes.INTEGER,
    },
    bin: DataTypes.STRING(6),
    amount: DataTypes.STRING(12),
    reference_number: DataTypes.STRING(16),
    old_reference_number: DataTypes.STRING(16),
    authorization: DataTypes.STRING(8),
    status: {
      type: DataTypes.INTEGER,
      defaultValue: 2
    },
    t_medio: DataTypes.ENUM(['debit', 'credit', 'internacional']),
    taza_credito: {
      type: DataTypes.STRING(10),
      defaultValue: 0
    },
    taza_debito: {
      type: DataTypes.STRING(10),
      defaultValue: 0
    },
    taza_amex: {
      type: DataTypes.STRING(10),
      defaultValue: 0
    },
    tasa_credito_b: {
      type: DataTypes.STRING(10),
      defaultValue: 0
    },
    tasa_debito_b: {
      type: DataTypes.STRING(10),
      defaultValue: 0
    },
    tasa_amex_b: {
      type: DataTypes.STRING(10),
      defaultValue: 0
    },
    tasa_credito_c: {
      type: DataTypes.STRING(10),
      defaultValue: 0
    },
    tasa_debito_c: {
      type: DataTypes.STRING(10),
      defaultValue: 0
    },
    tasa_amex_c: {
      type: DataTypes.STRING(10),
      defaultValue: 0
    },
    tasa_credito_d: {
      type: DataTypes.STRING(10),
      defaultValue: 0
    },
    tasa_debito_d: {
      type: DataTypes.STRING(10),
      defaultValue: 0
    },
    tasa_amex_d: {
      type: DataTypes.STRING(10),
      defaultValue: 0
    },
    msi: {
      type: DataTypes.BOOLEAN,
      defaultValue: 0
    },
    retencion: {
      type:DataTypes.STRING(10),
      defaultValue:'0.00',
      comment: "retencion en garantia en %"},
    isLink: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    tx_at: {
      type: DataTypes.DATE,
    },
  }, {
    tableName: 'consolidacion',
    timestamps: false
  })

  return modelo;
}