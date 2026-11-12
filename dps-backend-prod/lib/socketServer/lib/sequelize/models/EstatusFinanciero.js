module.exports = (sequelize , type) =>{
  return sequelize.define('estatus_financiero',{
    id:{
      type:           type.INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    status:           type.DataTypes.STRING(10),
  },{
    tableName: 'estatus_financiero',
    timestamps: true
  })
}