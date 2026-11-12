module.exports = (sequelize , type) =>{
  return sequelize.define('iso_logical_network',{
    id_ln:{
      type:           type.INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    ln:                   type.DataTypes.STRING(4),
    name:                 type.DataTypes.STRING(50),
    creation_date:        {type: type.DataTypes.DATE, defaultValue: type.fn('now') },
    last_update:          {type: type.DataTypes.DATE, defaultValue: type.fn('now') },
  },{
    tableName: 'iso_logical_network',
    createdAt: 'creation_date',
    updatedAt: 'last_update',
    deletedAt: 'deletedAt',
    paranoid: true,
    timestamps: true,
  })
}