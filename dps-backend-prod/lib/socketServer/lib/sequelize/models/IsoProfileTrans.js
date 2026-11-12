module.exports = (sequelize , type) =>{
  return sequelize.define('iso_profile_transaction',{
    id_profile_transaction:{
      type:           type.INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    hex_value:                type.DataTypes.STRING(14),
    name:                type.DataTypes.STRING(50),
    creation_date:      {type: type.DataTypes.DATE, defaultValue: type.fn('now') },
    last_update:      {type: type.DataTypes.DATE, defaultValue: type.fn('now') }

  },{
    tableName: 'iso_profile_transaction',
    timestamps: false
  })
}