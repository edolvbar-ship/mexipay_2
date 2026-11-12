module.exports = (sequelize , type) =>{
  return sequelize.define('contracargos',{
    id:{
      type:           type.INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    afiliacion:               type.DataTypes.STRING(15),
    tarjeta:               type.DataTypes.STRING(16),
    tipo_cc:               type.DataTypes.STRING(10),

    referencia:               type.DataTypes.STRING(50),
    monto:               type.DataTypes.STRING(16),
    autorizacion:               type.DataTypes.STRING(16),
    fecha:               type.DataTypes.DATE,
    razon:               type.DataTypes.STRING(10),
    comentarios:               type.DataTypes.STRING(500),
    folio:               type.DataTypes.STRING(40),
    referencia_b:               type.DataTypes.STRING(40),
    data_merchant:               type.DataTypes.STRING(4000),

    created_at:        {type: type.DataTypes.DATE, defaultValue: type.fn('now') },
    updated_at:        {type: type.DataTypes.DATE, defaultValue: type.fn('now') },
    fecha_cargo:        {type: type.DataTypes.DATE, defaultValue: type.fn('now') },


  },{
    tableName: 'contracargos',
    paranoid: false,
    timestamps: false,
  })
}