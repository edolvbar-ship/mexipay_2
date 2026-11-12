const db = require("./init")

module.exports = async (req,res) =>{
  let querys = [
    {name:'add_root_column_to_id_profile',  query: 'ALTER TABLE user_profile ADD root INTEGER DEFAULT 0', column:'root'},
    {name:'iso_message_default_date' ,      query: 'ALTER TABLE iso_message MODIFY COLUMN creation_date datetime DEFAULT CURRENT_TIMESTAMP NULL'},
    {name:'add_column_isAdmin_users' ,      query: 'ALTER TABLE users ADD is_admin INT DEFAULT 0 NOT NULL'},
    {name:'modify_column_cliente_null' ,    query: 'ALTER TABLE users MODIFY COLUMN id_cliente int(11) DEFAULT NULL NULL'},
    {name:'add_reference_number_ant_iso_m', query: 'ALTER TABLE iso_message ADD reference_number_ant varchar(16) NULL', column: 'reference_number_ant'},
    {name:'modify_reference_number',        query: 'MODIFY COLUMN reference_number varchar(12) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL NULL'},
    {name:'modify_reference_number_ant',    query: 'MODIFY COLUMN reference_number_ant varchar(12) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL NULL'},
    {name:'add_card_type_iso_message',      query: 'ALTER TABLE iso_message ADD card_type varchar(2) DEFAULT "00" NULL', column: 'card_type'},
    {name:'add_datos_bancarios_iso_m',      query: 'ALTER TABLE user_profile ADD datos_bancarios INT DEFAULT 0 NOT NULL', column: 'datos_bancarios'},
    {name:'add_table_migrations',               query: 'CREATE TABLE migrations (    id BIGINT auto_increment NOT NULL,    migration varchar(300) NOT NULL,    error varchar(300) NULL,    created_at DATE DEFAULT CURRENT_TIMESTAMP NOT null,    primary KEY(id)  )  ENGINE=InnoDB  DEFAULT CHARSET=utf8mb4  COLLATE=utf8mb4_general_ci'},
    {name:'add_column_cybersource',             query: 'ALTER TABLE merchant ADD cybersource INTEGER DEFAULT 0 NOT NULL'},
    {name:'add_column_serieTemrinal_merchant',  query: 'ALTER TABLE merchant ADD serie_terminal varchar(20) DEFAULT 00000000000000000000 NOT NULL'},
    {name:'add_log_login_table',          query: 'CREATE TABLE log_login (id BIGINT KEY auto_increment NOT NULL,ip varchar(30) NOT NULL,id_user INT NOT NULL,created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL)'},
    {name:'add_updatedAt_users',          query: 'ALTER TABLE users ADD updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL'},
    {name:'add_online_users',             query: 'ALTER TABLE users ADD online INT DEFAULT 0 NOT NULL'},
    {name:'add_contracargo_table',        query: 'CREATE TABLE contracargos (	id BIGINT KEY auto_increment NULL,	afiliacion varchar(15) NOT NULL,	tarjeta varchar(16) NOT NULL,	referencia varchar(50) NOT NULL,	monto FLOAT NOT NULL,	autorizacion varchar(50) NOT NULL,	fecha DATE NULL,	razon varchar(10) NOT NULL,	tipo_cc varchar(10) NOT NULL,	comentarios varchar(500) NULL,	folio varchar(40) NOT NULL,	referencia_b varchar(40) NOT NULL,	data_merchant LONG VARCHAR NOT NULL,	created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,	updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL)'},
    {name:'add_intento_to_users',         query: 'ALTER TABLE users ADD intento INT DEFAULT 0 NOT NULL'},
    {name:'add_tokenpwd_to_users',        query: 'ALTER TABLE users ADD token_pwd varchar(100) NULL'},
    {name:'add_fecha_cargo_to_contracargos',         query: 'ALTER TABLE contracargos ADD fecha_cargo DATE NOT NULL'},
    {name:'add_folio_to_isomessage',      query: 'ALTER TABLE iso_message ADD folio varchar(13) NOT NULL'},
    {name:'add_deleted_at_merchant',      query: 'ALTER TABLE merchant ADD deleted_at DATETIME NULL'},
    {name:'add_deleted_at_resources',     query: 'ALTER TABLE resources ADD deletedAt DATETIME NULL'},
    {name:'add_more_info_tx',             query: 'ALTER TABLE iso_message ADD more_info LONGTEXT NULL'},
    {name:'add_tokenpwd_to_TDM_users',    query: 'ALTER TABLE '+process.env.DB_NAME_TDM+'.user ADD token_pwd varchar(100) NULL'},
    {name:'add_max_to_merchant',          query: 'ALTER TABLE merchant ADD max INTEGER NULL'},
    {name:'add_min_to_merchant',          query: 'ALTER TABLE merchant ADD min INTEGER NULL'},
    {name:'edit_max_merchant',            query: 'ALTER TABLE merchant MODIFY COLUMN max FLOAT(11,2) DEFAULT NULL NULL'},
    {name:'edit_min_merchant',             query: 'ALTER TABLE merchant MODIFY COLUMN min FLOAT(11,2) DEFAULT NULL NULL'},
    {name:'add_profile_trans_to_TDM_merchant',      query: 'ALTER TABLE '+process.env.DB_NAME_TDM+'.merchant ADD id_profile_transaction INTEGER NULL'},
    {name:'modify_hex_value_length_profile_trans',  query: 'ALTER TABLE iso_profile_transaction MODIFY COLUMN hex_value varchar(14) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL'},
    {name:'create_status_financiero',               query: 'CREATE TABLE cat_status_financiero ( id bigint KEY auto_increment NOT NULL, status varchar(100) NOT NULL, created_at DATETIME NULL, updated_at DATETIME NULL, deleted_at DATETIME NULL ) '},
    {name:'create_signatures',                      query: 'CREATE TABLE signatures ( id BIGINT KEY auto_increment NOT NULL, id_iso_message INT NULL, signature MEDIUMBLOB NOT NULL, created_at DATETIME NULL, updated_at DATETIME NULL,deleted_at DATETIME NULL ) '},
    {name:'add_merchant_sdhtd',                      query: 'ALTER TABLE '+process.env.DB_NAME_TDM+'.smart_device_has_terminal_device ADD id_merchant INTEGER NULL '},
    {name:'add_links_pago',                      query: `CREATE TABLE links_pago (
      id INTEGER unsigned KEY auto_increment NOT NULL,
      token varchar(100) NOT NULL,
      id_user INTEGER NOT NULL,
      id_merchant INTEGER NOT NULL,
      concepto varchar(100) NOT NULL,
      monto DECIMAL(10,2) NOT NULL,
      expire_date DATETIME NULL,
      status INTEGER DEFAULT 1 NULL,
      info_adicional MEDIUMTEXT NULL,
      created_at DATETIME NULL,
      updated_at DATETIME NULL,
      deleted_at DATETIME NULL
    )`},

    {name:'add_archivos_batch',                      query: `CREATE TABLE archivos_batch (
      id BIGINT auto_increment NOT NULL,
      id_cliente INT NULL,
      tipo_archivo INT NOT NULL COMMENT 'Tipo de archivo batch',
      porcentaje FLOAT DEFAULT 0 NOT NULL COMMENT 'Porcentaje',
      status INT DEFAULT 0 NOT NULL,
      descripcion varchar(100) NULL,
      nombre varchar(100) NOT NULL,
      error LONGTEXT NULL,
      respuesta LONGTEXT NULL,
      file LONGBLOB NOT NULL COMMENT 'Archivo a procesar',
      created_at DATETIME NULL,
      updated_at DATETIME NULL,
      deleted_at DATETIME NULL,
      CONSTRAINT archivos_batch_pk PRIMARY KEY (id)
    )`},
    {name:'add_msi_to_merchant', query:'ALTER TABLE merchant ADD MSI varchar(50) NULL'},
    {name:'add_afiliation_link', query:'ALTER TABLE merchant ADD afiliation_link varchar(100) NULL'},
    {name:'add_mediopago_link', query:'ALTER TABLE merchant ADD id_medio_link varchar(50) null'},
    {name:'add_deletedat_cliente', query:'ALTER TABLE iso_client ADD deleted_at DATETIME null'},
    {name:'add_consolidados_dt', query:`CREATE TABLE consolidados_tx (
      id BIGINT KEY auto_increment NOT NULL,
      id_merchant BIGINT NOT NULL,
      name_merchant varchar(100) NOT NULL,
      id_client BIGINT NOT NULL,
      name_client varchar(100) NOT NULL,
      bin varchar(10) NOT NULL,
      operacion varchar(100) NOT NULL,
      auth_type varchar(50) NOT NULL,
      respuesta varchar(50) NOT NULL,
      count BIGINT NOT NULL,
      analysis_date varchar(100) NOT NULL,
      created_at DATETIME NOT NULL
    )`},
    {name: 'longTextToMSIMerchant', query:"ALTER TABLE merchant MODIFY COLUMN MSI LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL NULL"}



    
    

    
  ]
  
  
    let errors = [];
    for (const row of querys) {
      const m = await db.migrations.findOne({where:{ migration: row.name }});
      if(!m){
        let e = null
        try {
          await db.seq.query(row.query);
        } catch (error) {
          dd(error.stack, 'error');
          e = error;
        }
        await db.seq.query('INSERT INTO migrations (migration,error) VALUES (?, ?)',{ replacements: [row.name, JSON.stringify(e)] } );
      }
    }

  res.json({status: 200 , errors})
}