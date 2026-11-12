const { NOW } = require('sequelize');

module.exports = (sequelize , type) =>{
  return sequelize.define('tresds', {
    id_tresds: {
      type:           type.INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    referencia_tx: type.DataTypes.STRING(12),
    sessionToken: type.DataTypes.STRING(70),
    url: type.DataTypes.STRING(150),
    transactionID: type.DataTypes.STRING(150),
    transStatus: type.DataTypes.STRING(1),
    eci: type.DataTypes.STRING(2),
    acsTransID: type.DataTypes.STRING(40),
    dsTransID: type.DataTypes.STRING(40),
    threeDSServerTransID: type.DataTypes.STRING(40),
    authenticationValue: type.DataTypes.STRING(28),
    body: type.DataTypes.JSON,
    'commerce-name': type.DataTypes.STRING(17),
    'system-fiid': type.DataTypes.STRING(6),
    mcc: type.DataTypes.STRING(5),
    'commerce-id': type.DataTypes.INTEGER,
    'X-Time': type.DataTypes.STRING(15),
    'X-Auth': type.DataTypes.STRING,
    createdAt: {
      type: type.DataTypes.DATE,
      defaultValue: type.fn('now')
    },
    updatedAt: {
      type: type.DataTypes.DATE,
      defaultValue: NOW
    },
    deletedAt: type.DataTypes.DATE,
  }, {
    tableName: 'tresds',
    paranoid:   true,
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    deletedAt: 'deletedAt',
  })
}