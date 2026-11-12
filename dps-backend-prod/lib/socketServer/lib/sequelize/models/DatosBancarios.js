module.exports = (sequelize , type) =>{
  return sequelize.define('datos_bancarios',{
    id:{
      type:           type.INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    banco:              type.DataTypes.STRING(10),
    tarjeta:            type.DataTypes.STRING(45),
    no_cuenta:          type.DataTypes.STRING(45),
    clabe:              type.DataTypes.STRING(45),
  }, { tableName: 'datos_bancarios' })
}