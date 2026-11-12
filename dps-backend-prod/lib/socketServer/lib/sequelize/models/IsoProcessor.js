module.exports = (sequelize , type) =>{
  return sequelize.define('iso_processor',{
    id_processor:{
      type:           type.INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    fiid: type.DataTypes.STRING(4),
    name: type.DataTypes.STRING(30),
    reqApiKey:  {
      type: type.DataTypes.INTEGER,
      defaultValue: 0
    },
    tags:  {
      type: type.DataTypes.STRING(200),
      defaultValue: 'none'
    },
    creation_date:      {type: type.DataTypes.DATE, defaultValue: type.fn('now') },
    last_update:          {type: type.DataTypes.DATE, defaultValue: type.fn('now') },
    deletedAt:            {type: type.DataTypes.DATE, AllowNull: true },
    
  },{
    tableName: 'iso_processor',
    timestamps: true,
    createdAt: 'creation_date',
    updatedAt: 'last_update',
    deletedAt: 'deletedAt',
    paranoid: true,
  })
}