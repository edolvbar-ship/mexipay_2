module.exports = (sequelize , type) =>{
  return sequelize.define('iso_brand',{
    id_brand:{
      type:           type.INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    name:                type.DataTypes.STRING(30),
    creation_date:      {type: type.DataTypes.DATE, defaultValue: type.fn('now') }
  },{
    tableName: 'iso_brand',
    timestamps: false
  })
}