module.exports = (sequelize , type) =>{
  return sequelize.define('iso_api_log',{
    id_log:{
      type:           type.INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    id_transaction:     type.DataTypes.INTEGER,
    id_request:         type.DataTypes.STRING(50),
    uri:                type.DataTypes.STRING(100),
    method:             type.DataTypes.STRING(5),
    request:             type.DataTypes.STRING(2000),
    response:             type.DataTypes.STRING(2000),
    entry_time:            {type: type.DataTypes.DATE, defaultValue: type.fn('now') },
    exit_time:             {type: type.DataTypes.DATE, defaultValue: type.fn('now') },
    creation_date:        {type: type.DataTypes.DATE, defaultValue: type.fn('now') }
  },{
    tableName: 'iso_api_log',
    paranoid: false,
    timestamps: false,
  })
}