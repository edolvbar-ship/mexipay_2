module.exports = (sequelize , type) =>{
  return sequelize.define('iso_mcc',{
    id_mcc:{
      type:           type.INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    mcc:                 type.DataTypes.STRING(45),
    description:         type.DataTypes.STRING(300),
    active:             { type: type.DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    create_date:        {type: type.DataTypes.DATE, defaultValue: type.fn('now') },
    last_update:          {type: type.DataTypes.DATE, defaultValue: type.fn('now') }
  },{
    tableName: 'iso_mcc',
    createdAt: 'create_date',
    updatedAt: 'last_update',
    deletedAt: 'deletedAt',
    paranoid: true,
    timestamps: true,
  })
}