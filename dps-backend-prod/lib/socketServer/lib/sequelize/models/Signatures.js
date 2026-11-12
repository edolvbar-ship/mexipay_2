module.exports = (sequelize , type) =>{
  return sequelize.define('signatures',{
    id:{
      type:           type.INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    id_iso_message:               type.DataTypes.INTEGER,
    signature:               type.DataTypes.BLOB,
    created_at:        {type: type.DataTypes.DATE, defaultValue: type.fn('now') },
    updated_at:        {type: type.DataTypes.DATE, defaultValue: type.fn('now') },
    deleted_at:        type.DataTypes.DATE,


  },{
    tableName: 'signatures',
    paranoid:   true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  })
}