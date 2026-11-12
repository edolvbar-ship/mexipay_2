module.exports = (sequelize , type) =>{
  return sequelize.define('bnrg_url_dest',{
    id_bnrg_url_dest:{
      type:           type.INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    url:                  type.DataTypes.STRING(50),
    id_iso_processor:     {type: type.DataTypes.INTEGER },
    creation_date:        {type: type.DataTypes.DATE, defaultValue: type.fn('now') },
    last_update:          {type: type.DataTypes.DATE, defaultValue: type.fn('now') }
  },{
    tableName: 'bnrg_url_dest',
    createdAt: 'creation_date',
      updatedAt: 'last_update',
      deletedAt: 'deletedAt',
      paranoid: true,
      timestamps: true,
  })
}