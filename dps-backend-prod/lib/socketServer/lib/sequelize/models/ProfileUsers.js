
const { NOW } = require('sequelize');
module.exports = (sequelize , type) =>{
  return sequelize.define('user_profile',{
    id_profile:{
      type:           type.INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    profile_name:           type.DataTypes.STRING(30),
    admin:                  {type: type.DataTypes.INTEGER , allowNull: false, defaultValue: 0 },
    // root:                   {type: type.DataTypes.INTEGER , allowNull: false, defaultValue: 0 },
    comments:               type.DataTypes.STRING(40),
    datos_bancarios:               type.DataTypes.INTEGER,
    created_at:             { type: type.DataTypes.DATE, defaultValue: NOW },
    deleted_at:             type.DataTypes.DATE,
    last_update:            type.DataTypes.DATE
  },{
    tableName: 'user_profile',
    paranoid:   true,
    timestamps: true,
    deletedAt: 'deleted_at',
    createdAt: 'created_at',
    updatedAt: 'last_update',
  })
}