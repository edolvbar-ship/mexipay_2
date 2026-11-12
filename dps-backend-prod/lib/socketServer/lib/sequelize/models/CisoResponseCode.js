module.exports = (sequelize , type) =>{
  return sequelize.define('ciso_response_code',{
    id_response_code:{
      type:           type.INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    iso_code:               type.DataTypes.STRING(4),
    description:            type.DataTypes.STRING(80),
    device_description:     type.DataTypes.STRING(80),
    creation_date:          {type: type.DataTypes.DATE, defaultValue: type.fn('now') },
    // last_update:        type.DataTypes.DATE
  },{
    tableName: 'ciso_response_code',
    timestamps: false
  })
}