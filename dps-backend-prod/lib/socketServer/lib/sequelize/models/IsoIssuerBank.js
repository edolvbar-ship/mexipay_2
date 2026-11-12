module.exports = (sequelize , type) =>{
  return sequelize.define('iso_issuer_bank',{
    id_issbank:{
      type:           type.INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    fiid:                type.DataTypes.STRING(4),
    name:               type.DataTypes.STRING(250),
    creation_date:      {type: type.DataTypes.DATE, defaultValue: type.fn('now') },
    last_update:        {type: type.DataTypes.DATE, defaultValue: type.fn('now') }
  },{
    tableName: 'iso_issuer_bank',
    createdAt: 'creation_date',
    updatedAt: 'last_update',
    paranoid: false,
    timestamps: true,
  })
}