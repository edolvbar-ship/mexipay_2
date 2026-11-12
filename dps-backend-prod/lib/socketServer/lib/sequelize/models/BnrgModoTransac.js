module.exports = (sequelize , type) =>{
  return sequelize.define('bnrg_modo_transac',{
    id_bnrg_modo_transac:{
      type:           type.INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    bnrg_modo_trans:         type.DataTypes.STRING(3),
    description:             type.DataTypes.STRING(50),
    creation_date:        {type: type.DataTypes.DATE, defaultValue: type.fn('now') },
    last_update:          {type: type.DataTypes.DATE, defaultValue: type.fn('now') },
    deletedAt:          {type: type.DataTypes.DATE },
  },{
    tableName: 'bnrg_modo_transac',
    createdAt: 'creation_date',
      updatedAt: 'last_update',
      deletedAt: 'deletedAt',
      paranoid: true,
      timestamps: true,
  })
}