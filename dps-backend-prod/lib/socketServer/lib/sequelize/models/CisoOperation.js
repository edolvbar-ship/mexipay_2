module.exports = (sequelize , type) =>{
  return sequelize.define('ciso_operation',{
    id_operation:{
      type:           type.INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    name:               type.DataTypes.STRING(30),
    code:               type.DataTypes.STRING(4),
    creation_date:        {type: type.DataTypes.DATE, defaultValue: type.fn('now') }
  },{
    tableName: 'ciso_operation',
    paranoid: false,
    timestamps: false,
  })
}