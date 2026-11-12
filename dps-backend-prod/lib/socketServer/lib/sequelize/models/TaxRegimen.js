const { INTEGER, STRING, DATE, TEXT, NOW, BOOLEAN} = require('sequelize').DataTypes;

module.exports = (sequelize) =>{
  return sequelize.define('tax_regimens',{
    id:{
      type:           INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    tax_code:           STRING( 10 ),
    description:        STRING( 250 ),
    is_moral:        { type: BOOLEAN, defaultValue: 0 },
    createdAt:      { type: DATE, defaultValue: NOW },
    updatedAt:      { type: DATE, defaultValue: NOW },
  },{
    tableName: 'tax_regimens',
    paranoid: false,
    timestamps: false,
  })
}
