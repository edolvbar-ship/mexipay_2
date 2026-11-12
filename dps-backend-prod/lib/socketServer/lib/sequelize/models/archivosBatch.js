module.exports = (sequelize , type) =>{
    return sequelize.define('archivos_batch',{
      id:{
        type:           type.INTEGER,
        primaryKey:     true,
        autoIncrement:  true
      },
      id_cliente:               type.DataTypes.INTEGER,
      tipo_archivo:               type.DataTypes.INTEGER,
      porcentaje:               type.DataTypes.FLOAT,
      status:               type.DataTypes.INTEGER,
      descripcion:               type.DataTypes.STRING,
      nombre:               type.DataTypes.STRING,
      error:               type.DataTypes.TEXT,
      respuesta:               type.DataTypes.TEXT,
      file:               type.DataTypes.BLOB,

      created_at:        {type: type.DataTypes.DATE, defaultValue: type.fn('now') },
      updated_at:        {type: type.DataTypes.DATE, defaultValue: type.fn('now') },
      deleted_at:        type.DataTypes.DATE,
  
  
    },{
      tableName: 'archivos_batch',
      paranoid:   true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
    })
  }