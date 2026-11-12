const { INTEGER, STRING, DATE, NOW } = require('sequelize').DataTypes;

module.exports = ( sequelize ) =>{
  return sequelize.define('iso_agregador',{
    id:{
      type:           INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    logicalName:{
      type:           STRING(4),
    },    
    name:                 STRING(50),
    creation_date:        {type: DATE, defaultValue: NOW },
    last_update:          {type: DATE, defaultValue: NOW },
    deletedAt:            {type: DATE, AllowNull: true },
  },{
    tableName: 'iso_agregador',
    createdAt: 'creation_date',
    updatedAt: 'last_update',
    deletedAt: 'deletedAt',
    paranoid: true,
    timestamps: true,
    indexes: [
      {
        fields: ['logicalName']
      }
    ]
  })
}