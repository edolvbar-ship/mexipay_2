module.exports = (sequelize , type) =>{
  return sequelize.define('invoices',{
    id:{
      type:           type.INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    id_merchant:    type.DataTypes.INTEGER,
    month:          type.DataTypes.INTEGER,
    year:           type.DataTypes.INTEGER,
    details:        type.DataTypes.TEXT,
    created_at:     {
        type: type.DataTypes.DATE, 
        defaultValue: type.fn('now') 
    },
    updated_at:     {
        type: type.DataTypes.DATE, 
        defaultValue: type.fn('now') 
    }
  },{
    tableName: 'invoices',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  })
}