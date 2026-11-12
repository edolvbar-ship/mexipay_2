module.exports = (sequelize , type) =>{
  return sequelize.define('iso_esquema_transactional',{
    id_esquema_transactional:{
      type:           type.INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    esquema:                 type.DataTypes.STRING(45),
    description:             type.DataTypes.STRING(45),
    creation_date:        {type: type.DataTypes.DATE, defaultValue: type.fn('now') },
    last_update:          {type: type.DataTypes.DATE, defaultValue: type.fn('now') },
  },{
    tableName: 'iso_esquema_transactional',
    createdAt: 'creation_date',
      updatedAt: 'last_update',
      deletedAt: 'deletedAt',
      paranoid: true,
      timestamps: true,
  })
}