module.exports = (sequelize,type) => {
  return sequelize.define('merchant',{
    idmerchant: {
      type: type.DataTypes.TINYINT,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },
    name_merchant: {
      type: type.DataTypes.STRING(400),
      allowNull: false,
    },
    mcc_idmcc: {
      type: type.DataTypes.TINYINT,
      allowNull: false
    },
    afiliation_number: {
      type: type.DataTypes.STRING(45),
      allowNull: false,
    },
    representative: {
      type: type.DataTypes.STRING(45),
      allowNull: true,
    },
    alias_name: {
      type: type.DataTypes.STRING(400),
      allowNull: true,
    },
    url_merchant: type.DataTypes.STRING(150),
    rfc_merchant: type.DataTypes.STRING(45),
    description: type.DataTypes.STRING(2000),
    agente_comercial: type.DataTypes.STRING(1000),
    contact_merchant: type.DataTypes.STRING(1000),
    rol_contact: type.DataTypes.STRING(1000),
    email_contact: type.DataTypes.STRING(150),
    tel1_contact: type.DataTypes.STRING(45),
    tel2_contact: type.DataTypes.STRING(45),
    mobile_contact: type.DataTypes.STRING(20),
    token_activation: type.DataTypes.STRING(45),
    use_moreterminals: {
      type: type.DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 0,
    },
    active: {
      type: type.DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 0,
    },
    create_date: {
      type: type.DataTypes.DATE,
      defaultValue: type.fn('now')
    },
    last_update: {
      type: type.DataTypes.DATE,
      defaultValue: type.fn('now')
    }, 
    id_profile_transaction: {
      type: type.DataTypes.TINYINT,
      allowNull: true,
    },
    MSI: {
      type: type.DataTypes.TEXT('long'),
      allowNull: true
    }
  },{
    tableName:'merchant',
    createdAt: 'create_date',
    last_update: 'last_update',
    paranoid: true,
    timestamps: false
  });
}
