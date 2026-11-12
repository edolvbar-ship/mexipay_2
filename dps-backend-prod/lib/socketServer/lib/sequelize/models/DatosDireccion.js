const { INTEGER, STRING } = require('sequelize').DataTypes;

const createForeignKey = (model, key) => ({
  type: INTEGER,
  references: { model, key }
});

module.exports = sequelize =>{
  return sequelize.define('datos_direccion',{
    id:{
      type:           INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    calle:            STRING(40),
    no_ext:           STRING(40),
    no_int:           STRING(40),
    colonia:          STRING(40),
    alcaldia:         STRING(40),
    ciudad:           STRING(40),
    id_state:         createForeignKey('ciso_state', 'id_state'),
    cp:               STRING(40),
    pais:             STRING(40),
    id_country:       createForeignKey('ciso_country', 'id_country'),
  }, {
    tableName: 'datos_direccion'
  })
}