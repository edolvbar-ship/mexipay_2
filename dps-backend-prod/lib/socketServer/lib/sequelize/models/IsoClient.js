module.exports = (sequelize , type) =>{
  return sequelize.define('iso_client',{
    id_client:{
      type:           type.INTEGER,
      primaryKey:     true,
      autoIncrement:  true
    },
    name: {
      type: type.DataTypes.STRING(45),
      allowNull: false,
      unique: {
        agrs: 'name',
        msg: 'El nombre de cliente debe ser único'
      }
    },
    id_persona: {
      type: type.DataTypes.INTEGER,
      references:{
        model:'tipo_persona',
        key: 'id_tipo_persona'
      },
    },
    razon_social: type.DataTypes.STRING(400),
    rfc: type.DataTypes.STRING(45),
    representative: type.DataTypes.STRING(45),
    url: type.DataTypes.STRING(150),
    description: type.DataTypes.STRING(2000),
    agente: type.DataTypes.STRING(1000),
    contact_cliente: type.DataTypes.STRING(1000),
    rol_contact: type.DataTypes.STRING(1000),
    email_contact: type.DataTypes.STRING(150),
    tel1_contact: type.DataTypes.STRING(45),
    tel2_contact: type.DataTypes.STRING(45),
    mobile_contact: type.DataTypes.STRING(20),
    id_direccion: {
      type: type.DataTypes.INTEGER,
      references:{
        model: 'datos_direccion',
        key:  'id'
      }
    },
    id_datos_bancarios: {
      type: type.DataTypes.INTEGER,
      references:{
        model: 'datos_bancarios',
        key:  'id'
      }
    },
    creation_date: {
      type: type.DataTypes.DATE,
      defaultValue: type.fn('now')
    },
    last_update: {
      type: type.DataTypes.DATE,
      defaultValue: type.fn('now')
    },
    deleted_at: type.DataTypes.DATE,
  }, {
    tableName: 'iso_client',
    paranoid:   true,
    timestamps: true,
    deletedAt: 'deleted_at',
    createdAt: 'creation_date',
    updatedAt: 'last_update',
  })
}