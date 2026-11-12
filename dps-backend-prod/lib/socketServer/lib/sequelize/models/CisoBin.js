module.exports = (sequelize , type) =>{
  return sequelize.define('ciso_bin',{
    id_bin:{
      type:           type.INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    bin:                type.DataTypes.STRING(10),
    id_issbank:         type.DataTypes.INTEGER,
    id_card_product:    type.DataTypes.INTEGER,
    id_card_type:       type.DataTypes.INTEGER,
    id_processor:       type.DataTypes.INTEGER,
    id_brand:           type.DataTypes.INTEGER,
    '3DS':           type.DataTypes.INTEGER,
    creation_date:      {type: type.DataTypes.DATE, defaultValue: type.fn('now') },
    last_update:        {type: type.DataTypes.DATE, defaultValue: type.fn('now') }
  },{
    tableName: 'ciso_bin',
    timestamps: false
  })
}