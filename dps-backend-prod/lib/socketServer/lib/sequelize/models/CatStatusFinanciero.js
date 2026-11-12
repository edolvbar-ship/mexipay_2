module.exports = (sequelize , type) =>{
  return sequelize.define('cat_status_financiero',{
    id:{
      type:           type.INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    status:                 type.DataTypes.STRING(100),
    created_at:        {type: type.DataTypes.DATE, defaultValue: type.fn('now') },
    updated_at:          {type: type.DataTypes.DATE, defaultValue: type.fn('now') },
    deleted_at:          {type: type.DataTypes.DATE, defaultValue: null }
  },{
    tableName: 'cat_status_financiero',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
    paranoid: true,
    timestamps: true,
  })
}