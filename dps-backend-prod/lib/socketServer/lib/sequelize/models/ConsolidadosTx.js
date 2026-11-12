module.exports = (sequelize , type) =>{
  return sequelize.define('consolidados_tx',{
    id:{
      type:           type.INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    id_merchant:      type.DataTypes.INTEGER,
    name_merchant:    type.DataTypes.STRING(100),
    id_client:        type.DataTypes.INTEGER,
    name_client:      type.DataTypes.STRING(100),
    bin:              type.DataTypes.STRING(10),
    operacion:        type.DataTypes.STRING(100),
    auth_type:        type.DataTypes.STRING(50),
    respuesta:        type.DataTypes.STRING(50),
    count:            type.DataTypes.INTEGER,
    analysis_date:    type.DataTypes.STRING(100),
    created_at:        {type: type.DataTypes.DATE, defaultValue: type.fn('now') },

  },{
    tableName: 'consolidados_tx',
    paranoid: false,
    timestamps: false,
  })
}