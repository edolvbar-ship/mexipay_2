module.exports = (sequelize , type) =>{
  return sequelize.define('processing_operations',{
    id_operation:{
      type:           type.INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    id_giro: {
      type: type.INTEGER,
      references: {
        model: 'iso_giro',
        key: 'id_giro'
      }
    },
    name:               type.DataTypes.STRING(100),
    description:        type.DataTypes.STRING(500),
    operation_code:     type.DataTypes.STRING(20), // e.g., 'CHECK_IN', 'CHECK_OUT', 'RENT_IN', etc.
    msg_type:           type.DataTypes.STRING(4),  // ISO 8583 message type (e.g., '0200', '0220')
    processing_code:     type.DataTypes.STRING(6),  // ISO processing code
    requires_amount:    {type: type.DataTypes.INTEGER, defaultValue: 1}, // 0 = no amount, 1 = amount required
    requires_tip:       {type: type.DataTypes.INTEGER, defaultValue: 0}, // 0 = no tip, 1 = tip optional, 2 = tip required
    active:             {type: type.DataTypes.INTEGER, defaultValue: 1},
    display_order:      {type: type.DataTypes.INTEGER, defaultValue: 0},
    icon_name:          type.DataTypes.STRING(50), // icon identifier for frontend
    creation_date:      {type: type.DataTypes.DATE, defaultValue: type.fn('now') },
    updated_at:         {type: type.DataTypes.DATE, defaultValue: type.fn('now') }
  },{
    tableName: 'processing_operations',
    paranoid: false,
    timestamps: false,
  })
}
