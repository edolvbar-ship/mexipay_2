const { INTEGER, STRING, DATE, TEXT, JSON} = require('sequelize').DataTypes;


const createForeignKey = (model, key) => ({
  type: INTEGER,
  references: { model, key }
});

const createStringField = (length, defaultValue, comment) => ({
  type: STRING(length),
  defaultValue,
  comment
});

module.exports = sequelize =>{
  return sequelize.define('merchant', {
    id_merchant: {
        type: INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    id_client: {
        type: INTEGER,
        references: {
            model: 'iso_client',
            key: 'id_client'
        }
    },
    id_persona: {
        type: INTEGER,
        references: {
            model: 'tipo_persona',
            key: 'id_tipo_persona'
        }
    },
    id_esquema: {
        type: INTEGER,
        references: {
            model: 'iso_esquema_transactional',
            key: 'id_esquema_transactional'
        }
    },
    razon_social: STRING(400),
    name_merchant: STRING(17),
    url_merchant:         STRING(150),
    rfc_merchant:         STRING(45),
    representative:       STRING(45),
    agente_comercial:     STRING(1000),
    description:          STRING(2000),
    afiliation_number:    STRING(10),
    subafiliation_number: STRING(10),
    id_mcc: createForeignKey('iso_mcc', 'id_mcc'),
    id_giro: createForeignKey('iso_giro', 'id_giro'),
    id_acqbank: createForeignKey('iso_acquirer_bank', 'id_acqbank'),
    id_processor: createForeignKey('iso_processor', 'id_processor'),
    ln_agregador: {
        type: STRING(4),
        references: {
          model: 'iso_agregador' ,
          key: 'logicalName',
        }
    },
    visa_pymnt_facilitator: STRING(11),
    mc_pymnt_facilitator: STRING(11),
    amex_pymnt_facilitator: STRING(11),
    visa_indpnt_sales_org: STRING(11),
    mc_indpnt_sales_org: STRING(11),
    id_direccion: createForeignKey('datos_direccion', 'id'),
    id_datos_bancarios: createForeignKey('datos_bancarios', 'id'),

    id_modo_transaccion: createForeignKey('bnrg_modo_transac', 'id_bnrg_modo_transac'),
    id_url_destino: createForeignKey('bnrg_url_dest', 'id_bnrg_url_dest'),
    id_bnrg_channel: STRING(45),
    id_ln: INTEGER,
    id_profile_transaction: INTEGER,
    contact_merchant: STRING(1000),
    rol_contact: STRING(1000),
    email_contact: STRING(150),
    tel1_contact: STRING(45),
    tel2_contact: STRING(45),
    mobile_contact: STRING(20),
    use_moreterminals: INTEGER(4),
    active: INTEGER(4),
    processor_info: JSON,
    token_activation: STRING(45),
    taza_credito: STRING(5),
    taza_debito: STRING(5),
    taza_amex: STRING(5),

    // New fields
    tasa_credito_b: createStringField(10, '0.00', "tasa credito del comercio en %"),
    tasa_debito_b: createStringField(10, '0.00', "tasa débito del comercio en %"),
    tasa_amex_b: createStringField(10, '0.00', "tasa amex del comercio en %"),
    tasa_credito_c: createStringField(10, '0.00', "tasa agregador de credito en %"),
    tasa_debito_c: createStringField(10, '0.00', "tasa agregador de debito en %"),
    tasa_amex_c: createStringField(10, '0.00', "tasa agregador de amex en %"),
    tasa_credito_d: createStringField(10, '0.00', "comision de credito en $"),
    tasa_debito_d: createStringField(10, '0.00', "comision de debito en $"),
    tasa_amex_d: createStringField(10, '0.00', "comision de amex en $"),

    taza_link_credito: STRING(5),
    taza_link_debito: STRING(5),
    taza_link_amex: STRING(5),

    // New fields
    tasa_link_credito_b: createStringField(10, '0.00', "tasa credito del comercio en %"),
    tasa_link_debito_b: createStringField(10, '0.00', "tasa débito del comercio en %"),
    tasa_link_amex_b: createStringField(10, '0.00', "tasa amex del comercio en %"),
    tasa_link_credito_c: createStringField(10, '0.00', "tasa agregador de credito en %"),
    tasa_link_debito_c: createStringField(10, '0.00', "tasa agregador de debito en %"),
    tasa_link_amex_c: createStringField(10, '0.00', "tasa agregador de amex en %"),
    tasa_link_credito_d: createStringField(10, '0.00', "comision de credito en $"),
    tasa_link_debito_d: createStringField(10, '0.00', "comision de debito en $"),
    tasa_link_amex_d: createStringField(10, '0.00', "comision de amex en $"),

    retencion: createStringField(10, '0.00', "retencion en garantia en %"),
    '3DS': INTEGER,
    '3DS_KEY': {
      type: TEXT,
      allowNull: true
    },
    //'3DS_FORCE': INTEGER,
    serie_terminal: STRING(20),
    MSI: TEXT,
    afiliation_link: STRING(20),
    id_medio_link: STRING(20),
    max: INTEGER,
    min: INTEGER,
    apiKey: TEXT,

    id_fiscal_address: createForeignKey('datos_direccion', 'id'),
    id_tax_regime: createForeignKey('tax_regimens', 'id'),
    
    with_invoices: INTEGER,
    
    // FIN NUEVOS CAMPOS

    // Add selia_id field
    selia_id: {
        type: INTEGER,
        allowNull: true,
        comment: 'Selia identifier for the merchant'
    },

    last_update: {
      type: DATE,
      defaultValue: sequelize.fn('now')
    },
    creation_date: {
        type: DATE,
        defaultValue: sequelize.fn('now')
    },
    deleted_at: DATE
  },{
    tableName: 'merchant',
    timestamps: false
  })
}