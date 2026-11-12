// lib/socketServer/lib/sequelize/models/IsoMessage.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize, type) => {
  return sequelize.define('iso_message',{
    id_message:{
      type: DataTypes.INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    trace_number: {
      type: DataTypes.STRING(10),
      primaryKey: true
    },
    name_merchant: {
      type:           DataTypes.STRING(17),
    },
    terminal:             type.DataTypes.STRING(40),
    id_operation:         type.DataTypes.INTEGER,
    msg_type:             type.DataTypes.STRING(4),
    reference_number:     type.DataTypes.STRING(16),
    amount:               type.DataTypes.STRING(12),
    resp_code:            type.DataTypes.STRING(12),
    authorization:        type.DataTypes.STRING(8),
    bin:                  {
      type: DataTypes.STRING(12),
    },
    last4:                type.DataTypes.STRING(12),
    draft_capture:        type.DataTypes.STRING(1),
    entry_mode:           type.DataTypes.STRING(4),
    reverse_code:         type.DataTypes.STRING(4),
    tran_date:            type.DataTypes.STRING(4),
    tran_time:            type.DataTypes.STRING(6),
    capture_date:         type.DataTypes.STRING(4),
    tkn_data_63_rq:       type.DataTypes.STRING(999),
    tkn_data_63_rp:       type.DataTypes.STRING(999),
    node:                 type.DataTypes.STRING(25),
    reference_number_ant: type.DataTypes.STRING(16),
    card_type: type.DataTypes.STRING(2),
    folio: type.DataTypes.STRING(15),
    more_info: type.DataTypes.TEXT,
    track2: DataTypes.STRING(),
    card_acceptor: type.DataTypes.STRING(40),
    creation_date:        type.DataTypes.DATE,
    estatus_f:            { type: type.DataTypes.INTEGER , defaultValue: 1 }
  },
  {
    tableName: 'iso_message',
    timestamps: false,
    indexes: [
      {
        'fields': ['creation_date']
      }
    ]
  })
}