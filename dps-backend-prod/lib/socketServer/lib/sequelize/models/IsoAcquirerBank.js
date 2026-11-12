module.exports = (sequelize , type) =>{
  return sequelize.define('iso_acquirer_bank',{
    id_acqbank:{
      type:           type.INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    fiid:                 type.DataTypes.STRING(4),
    id_acquirer:          type.DataTypes.STRING(11),
    name:                 type.DataTypes.STRING(50),
    creation_date:        {type: type.DataTypes.DATE, defaultValue: type.fn('now') },
    last_update:          {type: type.DataTypes.DATE, defaultValue: type.fn('now') },
  },{
    tableName: 'iso_acquirer_bank',
    createdAt: 'creation_date',
    updatedAt: 'last_update',
    deletedAt: 'deletedAt',
    paranoid: true,
    timestamps: true,
  })
}