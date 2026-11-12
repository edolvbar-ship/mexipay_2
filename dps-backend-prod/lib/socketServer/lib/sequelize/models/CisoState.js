const { INTEGER, STRING, DATE, TEXT, NOW } = require('sequelize').DataTypes;

module.exports = sequelize  =>{
  return sequelize.define('ciso_state',{
    id_state:{
      type:           INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    name:               STRING( 100 ),
    alpha_2_code:       STRING( 2 ),
    alpha_3_code:       STRING( 3 ),
    creation_date:      { type: DATE, defaultValue: NOW },
    last_update:      { type: DATE, defaultValue: NOW },
  },{
    tableName: 'ciso_state',
    paranoid: false,
    timestamps: false,
  })
}

