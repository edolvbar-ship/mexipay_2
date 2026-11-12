module.exports = (sequelize , type) =>{
  return sequelize.define('tipo_persona',{
    id_tipo_persona:{
      type:           type.INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    name:                 type.DataTypes.STRING(50),
    creation_date:        {type: type.DataTypes.DATE, defaultValue: type.fn('now') },
    last_update:          {type: type.DataTypes.DATE, defaultValue: type.fn('now') }
  },{
    tableName: 'tipo_persona',
    createdAt: 'creation_date',
    updatedAt: 'last_update',
    deletedAt: 'deletedAt',
      paranoid: true,
      timestamps: true,
  })
}