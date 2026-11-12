module.exports = (sequelize,type) => {
  return sequelize.define('merchant_has_user',{
    merchant_idmerchant: {
      type: type.DataTypes.TINYINT,
      allowNull: false,
      primaryKey: true,
    },
    user_iduser: {
      type: type.DataTypes.TINYINT,
      allowNull: false,
    },
    create_date: {
      type: type.DataTypes.DATE,
      defaultValue: type.fn('now')
    },
    last_update: {
      type: type.DataTypes.DATE,
      defaultValue: type.fn('now')
    }, 
  },{
    tableName:'merchant_has_user',
    timestamps: false,
    last_update: 'last_update',
    createdAt: 'create_date',
    paranoid: true
  });
}