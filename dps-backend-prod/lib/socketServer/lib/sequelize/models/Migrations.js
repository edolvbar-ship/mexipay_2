module.exports = (sequelize , type) =>{
  return sequelize.define('migrations',{
    id:{
      type:           type.INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    migration:        type.DataTypes.STRING(300),
    error:            type.DataTypes.STRING(300),
    created_at:        type.DataTypes.DATE
  },{
    tableName: 'migrations',
    timestamps: false
  })
}