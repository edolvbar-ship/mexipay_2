module.exports = (sequelize , type) =>{
  return sequelize.define('iso_giro',{
    id_giro:{
      type:           type.INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    name:               type.DataTypes.STRING(100),
    description:        type.DataTypes.STRING(500),
    code:               type.DataTypes.STRING(10),
    active:             {type: type.DataTypes.INTEGER, defaultValue: 1},
    creation_date:      {type: type.DataTypes.DATE, defaultValue: type.fn('now') },
    updated_at:         {type: type.DataTypes.DATE, defaultValue: type.fn('now') }
  },{
    tableName: 'iso_giro',
    paranoid: false,
    timestamps: false,
  })
}
