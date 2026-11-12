module.exports = db => {
  const { 
    isoMessage, 
    cisoBin, 
    cisoRespCode, 
    merchant, 
    cisoOperation, 
    signatures, 
    isoBrand, 
    isoProcessor, 
    isoCardTypes, 
    isoIssuerBank, 
    isoClient, 
    tipoPersona, 
    datosDireccion, 
    datosBancarios, 
    isoAcquiererBank, 
    bnrgUrlDest, 
    isoProfileTrans, 
    users, 
    profileUsers, 
    profileResources, 
    resources, 
    linksPago, 
    consolidacion, 
    bnrgModoTransac, 
    cisoState, 
    cisoCountry,
    activityLog,
    seliaErrorCode,
    isoGiro,
    processingOperations,
    msiTemplate
   } = db;

  // RELACIONES DE LOS MODELOS
  isoMessage.hasOne(cisoBin, { sourceKey: 'bin', foreignKey: 'bin', as: 'bin_info', constraints: false });
  isoMessage.hasOne(cisoRespCode, { constraints: false, sourceKey: 'resp_code', foreignKey: 'iso_code', as: 'codigo_resp' });
  isoMessage.hasOne(merchant, { constraints: false, sourceKey: 'name_merchant', foreignKey: 'id_merchant', as: 'merchant' });
  isoMessage.hasOne(merchant, { constraints: false, sourceKey: 'name_merchant', foreignKey: 'id_merchant', as: 'merchant_por_id' });
  isoMessage.hasOne(cisoOperation, { constraints: false, sourceKey: 'id_operation', foreignKey: 'id_operation', as: 'tipo_operacion' });
  isoMessage.hasOne(signatures, { constraints: false, sourceKey: 'id_message', foreignKey: 'id_iso_message', as: 'signature' });

  // cisoBin
  cisoBin.hasOne(isoBrand, { sourceKey: 'id_brand', foreignKey: 'id_brand', as: 'tipo_tarjeta' });
  cisoBin.hasOne(isoProcessor, { sourceKey: 'id_processor', foreignKey: 'id_processor', as: 'procesador' });
  cisoBin.hasOne(isoCardTypes, { constraints: false, sourceKey: 'id_card_type', foreignKey: 'id_card_type', as: 'tipo_producto' });
  cisoBin.hasOne(isoIssuerBank, { constraints: false, sourceKey: 'id_issbank', foreignKey: 'id_issbank', as: 'banco_emisor' });

  //isoClient
  isoClient.hasOne(datosDireccion, { constraints: false, sourceKey: 'id_direccion', foreignKey: 'id', as: 'datos_direccion' });
  isoClient.hasOne(datosBancarios, { constraints: false, sourceKey: 'id_datos_bancarios', foreignKey: 'id', as: 'datos_bancarios' });

  //datosDireccion
  datosDireccion.hasOne(cisoCountry, {sourceKey: 'id_country', foreignKey: 'id_country', as: 'country'});
  datosDireccion.hasOne(cisoState, {sourceKey: 'id_state', foreignKey: 'id_state', as: 'state'});

  // merchant 
  merchant.hasOne(isoClient, { constraints: false, sourceKey: 'id_client', foreignKey: 'id_client', as: 'iso_client_dt' });
  merchant.hasOne(tipoPersona, { constraints: false, sourceKey: 'id_persona', foreignKey: 'id_tipo_persona', as: 'tipo_persona_dt' });
  merchant.hasOne(datosDireccion, { constraints: false, sourceKey: 'id_direccion', foreignKey: 'id', as: 'datos_direccion' });
  merchant.hasOne(datosBancarios, { constraints: false, sourceKey: 'id_datos_bancarios', foreignKey: 'id', as: 'datos_bancarios' });
  merchant.hasOne(isoAcquiererBank, { constraints: false, sourceKey: 'id_acqbank', foreignKey: 'id_acqbank', as: 'banco_adq' });
  merchant.hasOne(isoProfileTrans, { constraints: false, sourceKey: 'id_profile_transaction', foreignKey: 'id_profile_transaction', as: 'profile_trans' });
  merchant.hasOne(isoProcessor, { constraints: false, sourceKey: 'id_processor', foreignKey: 'id_processor', as: 'procesador' });
  merchant.hasOne(db.isoLogicalNetwork, {constraints: false, sourceKey: 'id_ln', foreignKey: 'id_ln', as: 'iso_logical_network' });
  merchant.hasOne(db.isoMcc, {constraints: false, sourceKey: 'id_mcc', foreignKey: 'id_mcc', as: 'isoMcc' });
  merchant.hasOne(db.isoEsquemaTrans, {constraints: false, sourceKey: 'id_esquema', foreignKey: 'id_esquema_transactional', as: 'esquema_transaccional' });
  merchant.hasOne(db.taxRegimen, {constraints: false, sourceKey: 'id_tax_regime', foreignKey: 'id', as: 'tax_regimens' });
  merchant.hasOne(datosDireccion, {constraints: false, sourceKey: 'id_fiscal_address', foreignKey: 'id', as: 'fiscal_address' });
  merchant.hasOne(bnrgUrlDest, { constraints: false, sourceKey: 'id_url_destino', foreignKey: 'id_bnrg_url_dest', as: 'url_destino' });
  merchant.hasOne(isoGiro, {constraints: false, sourceKey: 'id_giro', foreignKey: 'id_giro', as: 'giro' });
  
  // GIRO AND OPERATIONS ASSOCIATIONS
  isoGiro.hasMany(processingOperations, { foreignKey: 'id_giro', as: 'operations' });
  processingOperations.belongsTo(isoGiro, { foreignKey: 'id_giro', as: 'iso_giro' });
	
  // USER
  users.hasOne(profileUsers, { constraints: false, sourceKey: 'id_profile', foreignKey: 'id_profile', as: 'profile_user' });
  users.hasOne(isoClient, { constraints: false, sourceKey: 'id_cliente', foreignKey: 'id_client', as: 'cliente' });
// User HAS MANY ActivityLogs
    users.hasMany(activityLog, {
        foreignKey: 'userId',
        as: 'activityLogs'  // Better alias
    });

// ActivityLog BELONGS TO User
    activityLog.belongsTo(users, {
        foreignKey: 'userId',
        targetKey: 'id_user', // Match users table primary key
        as: 'user'
    });

  profileResources.hasOne(profileUsers, { constraints: false, sourceKey: 'id_profile', foreignKey: 'id_profile', as: 'perfil_user' });
  profileResources.hasOne(resources, { constraints: false, sourceKey: 'id_resource', foreignKey: 'id', as: 'resource' });

  profileUsers.hasMany(profileResources, { constraint: false, sourceKey: 'id_profile', foreignKey: 'id_profile', as: 'resources_profile' });

  linksPago.hasOne(merchant, { constraints: false, sourceKey: 'id_merchant', foreignKey: 'id_merchant', as: 'merchant' });
    // LINKS PAGO ASSOCIATIONS

    // // ADD THIS NEW ASSOCIATION FOR SELIA ERROR CODES
    // linksPago.belongsTo(seliaErrorCode, {
    // foreignKey: 'selia_response_code',
    // targetKey: 'codigo',
    // as: 'selia_error_detail',
    // constraints: false
    // });


  consolidacion.hasOne(merchant, { constraints: false, sourceKey: 'id_merchant', foreignKey: 'id_merchant' });
  consolidacion.hasOne(isoClient, { constraints: false, sourceKey: 'id_client', foreignKey: 'id_client' });

  merchant.hasOne(bnrgModoTransac, { constraints: false, sourceKey: 'id_modo_transaccion', foreignKey: 'id_bnrg_modo_transac', as: 'modo_transac' });

  // MSI Template relationships
  merchant.belongsToMany(msiTemplate, {
    through: 'merchant_msi_templates',
    foreignKey: 'id_merchant',
    otherKey: 'id_template',
    as: 'msiTemplates',
    timestamps: false
  });

  msiTemplate.belongsToMany(merchant, {
    through: 'merchant_msi_templates',
    foreignKey: 'id_template',
    otherKey: 'id_merchant',
    as: 'merchants',
    timestamps: false
  });

  return db;
}
