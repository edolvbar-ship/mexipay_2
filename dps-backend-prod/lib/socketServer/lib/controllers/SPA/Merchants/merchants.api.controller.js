const authCtrlApi = {};

const db      = require('../../../sequelize/init');
const helpers = require("../../../lib/helpers");
const pool = require("../../../database");
const tdmClass          = require('../../classes/tdm.class');

const { makeid } = require('../../../lib/helpers');
const { ok } = require("assert");

authCtrlApi.getMerchants = async(req,res) => {
  let merchant = null
  const isAdmn = req.user.is_admin;
  if( isAdmn == 1){
      merchant = await pool.query(`SELECT A.*, B.name bank, C.mcc, C.description mcc_desc , iln.ln AS logical_network , ic.name client_name, 
      db.banco AS db_banco , db.tarjeta AS db_tarjeta, db.no_cuenta AS db_cuenta, db.clabe AS db_clabe,
      dd.calle AS dd_calle,
      dd.no_ext AS dd_no_ext,
      dd.no_int AS dd_no_int,
      dd.colonia AS dd_colonia,
      dd.alcaldia AS dd_alcaldia,
      dd.ciudad AS dd_ciudad,
      dd.cp AS dd_cp,
      dd.id_country AS dd_pais,
      dd.id_state AS dd_state,
      df.calle AS df_calle,
      df.no_ext AS df_no_ext,
      df.no_int AS df_no_int,
      df.colonia AS df_colonia,
      df.alcaldia AS df_alcaldia,
      df.ciudad AS df_ciudad,
      df.cp AS df_cp,
      df.id_country AS df_pais,
      df.id_state AS df_state
      FROM merchant A 
      LEFT JOIN datos_bancarios db ON db.id = A.id_datos_bancarios
      LEFT JOIN datos_direccion dd ON dd.id = A.id_direccion
      LEFT JOIN datos_direccion df ON df.id = A.id_fiscal_address
      JOIN iso_client ic ON ic.id_client = A.id_client
      JOIN iso_acquirer_bank B ON A.id_acqbank = B.id_acqbank 
      JOIN iso_mcc C ON A.id_mcc = C.id_mcc 
      JOIN iso_logical_network iln ON iln.id_ln = A.id_ln 
      WHERE A.deleted_at IS NULL  
      ORDER BY A.id_merchant`);
  }else{
      merchant = await pool.query(`SELECT A.*, B.name bank, C.mcc, C.description mcc_desc , iln.ln as logical_network, ic.name client_name,  
      db.banco as db_banco , db.tarjeta as db_tarjeta, db.no_cuenta as db_cuenta, db.clabe as db_clabe,
      dd.calle as dd_calle,
      dd.no_ext as dd_no_ext,
      dd.no_int as dd_no_int,
      dd.colonia as dd_colonia,
      dd.alcaldia as dd_alcaldia,
      dd.ciudad as dd_ciudad,
      dd.cp as dd_cp,
      dd.id_country as dd_pais,
      dd.id_state as dd_state,
      df.calle AS df_calle,
      df.no_ext AS df_no_ext,
      df.no_int AS df_no_int,
      df.colonia AS df_colonia,
      df.alcaldia AS df_alcaldia,
      df.ciudad AS df_ciudad,
      df.cp AS df_cp,
      df.id_country AS df_pais,
      df.id_state AS df_state
      FROM merchant A 
      LEFT JOIN datos_bancarios db ON db.id = A.id_datos_bancarios
      LEFT JOIN datos_direccion dd ON dd.id = A.id_direccion
      LEFT JOIN datos_direccion df ON df.id = A.id_fiscal_address
      JOIN iso_client ic ON ic.id_client = A.id_client
      JOIN iso_acquirer_bank B ON A.id_acqbank = B.id_acqbank 
      JOIN iso_mcc C ON A.id_mcc = C.id_mcc 
      JOIN iso_logical_network iln on iln.id_ln = A.id_ln
      WHERE A.id_client = ? 
      AND A.deleted_at IS NULL 
      order by A.id_merchant`,[req.user.id_cliente]);    
  }
  merchant.map(v=>{
      if(isAdmn){
          v.t_credito = v.tasa_credito_b;
          v.t_debito  = v.tasa_debito_b;
          v.t_amex    = v.tasa_amex_b;
      }else{
          v.t_credito = v.tasa_credito_b;
          v.t_debito  = v.tasa_debito_b;
          v.t_amex    = v.tasa_amex_b;
      }
  });
  res.json(merchant);
}


authCtrlApi.getMerchantById = async(req,res) => {
  let merchant = null
  const isAdmn = req.user.is_admin;
  if( isAdmn == 1){
      merchant = await pool.query(`SELECT A.*, B.name bank, C.mcc, C.description mcc_desc , iln.ln AS logical_network , ic.name client_name, 
      db.banco AS db_banco , db.tarjeta AS db_tarjeta, db.no_cuenta AS db_cuenta, db.clabe AS db_clabe,
      dd.calle AS dd_calle,
      dd.no_ext AS dd_no_ext,
      dd.no_int AS dd_no_int,
      dd.colonia AS dd_colonia,
      dd.alcaldia AS dd_alcaldia,
      dd.ciudad AS dd_ciudad,
      dd.cp AS dd_cp,
      dd.id_country AS dd_pais,
      dd.id_state AS dd_state,
      df.calle AS df_calle,
      df.no_ext AS df_no_ext,
      df.no_int AS df_no_int,
      df.colonia AS df_colonia,
      df.alcaldia AS df_alcaldia,
      df.ciudad AS df_ciudad,
      df.cp AS df_cp,
      df.id_country AS df_pais,
      df.id_state AS df_state
      FROM merchant A 
      LEFT JOIN datos_bancarios db ON db.id = A.id_datos_bancarios
      LEFT JOIN datos_direccion dd ON dd.id = A.id_direccion
      LEFT JOIN datos_direccion df ON df.id = A.id_fiscal_address
      JOIN iso_client ic ON ic.id_client = A.id_client
      JOIN iso_acquirer_bank B ON A.id_acqbank = B.id_acqbank 
      JOIN iso_mcc C ON A.id_mcc = C.id_mcc 
      JOIN iso_logical_network iln ON iln.id_ln = A.id_ln 
      WHERE A.deleted_at IS NULL AND A.id_merchant = ${ req.params.id}
      ORDER BY A.id_merchant`);
  }else{
      merchant = await pool.query(`SELECT A.*, B.name bank, C.mcc, C.description mcc_desc , iln.ln as logical_network, ic.name client_name,  
      db.banco as db_banco , db.tarjeta as db_tarjeta, db.no_cuenta as db_cuenta, db.clabe as db_clabe,
      dd.calle as dd_calle,
      dd.no_ext as dd_no_ext,
      dd.no_int as dd_no_int,
      dd.colonia as dd_colonia,
      dd.alcaldia as dd_alcaldia,
      dd.ciudad as dd_ciudad,
      dd.cp as dd_cp,
      dd.id_country as dd_pais,
      dd.id_state as dd_state,
      df.calle AS df_calle,
      df.no_ext AS df_no_ext,
      df.no_int AS df_no_int,
      df.colonia AS df_colonia,
      df.alcaldia AS df_alcaldia,
      df.ciudad AS df_ciudad,
      df.cp AS df_cp,
      df.id_country AS df_pais,
      df.id_state AS df_state
      FROM merchant A 
      LEFT JOIN datos_bancarios db ON db.id = A.id_datos_bancarios
      LEFT JOIN datos_direccion dd ON dd.id = A.id_direccion
      LEFT JOIN datos_direccion df ON df.id = A.id_fiscal_address
      JOIN iso_client ic ON ic.id_client = A.id_client
      JOIN iso_acquirer_bank B ON A.id_acqbank = B.id_acqbank 
      JOIN iso_mcc C ON A.id_mcc = C.id_mcc 
      JOIN iso_logical_network iln on iln.id_ln = A.id_ln
      WHERE A.id_client = ? 
      AND A.deleted_at IS NULL AND A.id_merchant = ${ req.params.id}
      order by A.id_merchant`,[req.user.id_cliente]);    
  }

  merchant.map(v=>{
      if(isAdmn){
          v.t_credito = v.tasa_credito_b;
          v.t_debito  = v.tasa_debito_b;
          v.t_amex    = v.tasa_amex_b;
      }else{
          v.t_credito = v.tasa_credito_b;
          v.t_debito  = v.tasa_debito_b;
          v.t_amex    = v.tasa_amex_b;
      }
  });

  const merchantResponse = (merchant.length > 0 ) ? merchant[0] : {} ; 
  return res.json(merchantResponse);
}


authCtrlApi.createMerchant = async(req,res) => {
  let data = req.body
  let aux = await db.merchant.findOne({where:{ name_merchant: data.nombre_comercio, deleted_at : null }});
    if(aux){
      return res.status(400).json({
        status: "error",
        data: "Ya existe un comercio con ese nombre"
      });
    } 
  direccion = { 
    calle: data.direccion.calle, 
    no_ext : data.direccion.no_exterior, 
    no_int: data.direccion.no_interior, 
    colonia:data.direccion.colonia,
    alcaldia:data.direccion.alcaldia, 
    ciudad: data.direccion.ciudad, 
    cp:data.direccion.codigo_postal, 
    pais:data.direccion.pais,
    id_state : data.direccion.id_estado,
    id_country : data.direccion.id_pais,
  }
  nueva_direccion = await db.datosDireccion.create(direccion)
  .catch(error => {
    res.status(500).json({
      status: "error",
      data: error.message
    })
  })
  datosBancarios = {
    banco: data.datos_bancarios.banco,
    clabe:  data.datos_bancarios.clabe,
    tarjeta: data.datos_bancarios.tarjeta,
    no_cuenta: data.datos_bancarios.no_cuenta
  }
  dato_bancario = await db.datosBancarios.create(datosBancarios);

  let fiscalAddressInfo  = nueva_direccion;

  if(!req.body.same_address){

    const fiscalAddress = { 
      calle:      (data?.direccion_fiscal?.calle) ? data.direccion_fiscal.calle   : data.direccion.calle, 
      no_ext:     (data?.direccion_fiscal?.no_exterior) ? data.direccion_fiscal.no_exterior   : data.direccion.no_exterior, 
      no_int:     (data?.direccion_fiscal?.no_interior) ? data.direccion_fiscal.no_interior   : data.direccion.no_interior, 
      colonia:    (data?.direccion_fiscal?.colonia) ? data.direccion_fiscal.colonia   : data.direccion.colonia,
      alcaldia:   (data?.direccion_fiscal?.alcaldia) ? data.direccion_fiscal.alcaldia   : data.direccion.alcaldia, 
      ciudad:     (data?.direccion_fiscal?.ciudad) ? data.direccion_fiscal.ciudad   : data.direccion.ciudad, 
      cp:         (data?.direccion_fiscal?.codigo_postal) ? data.direccion_fiscal.codigo_postal   : data.direccion.codigo_postal, 
      pais:       (data?.direccion_fiscal?.pais) ? data.direccion_fiscal.pais   : data.direccion.pais,
      id_state:   (data?.direccion_fiscal?.id_estado) ? data.direccion_fiscal.id_estado   : data.direccion.id_estado,
      id_country: (data?.direccion_fiscal?.id_pais) ? data.direccion_fiscal.id_pais   : data.direccion.id_pais,
    };
  
    fiscalAddressInfo  = await db.datosDireccion.create(fiscalAddress);

  }

  let tasas_banco = data.tasas.banco
  let tasas_agregador = data.tasas.agregador
  let tasas_comercios = data.tasas.comercio

  let link_tasas_banco      = data.tasasLinks.banco
  let link_tasas_agregador  = data.tasasLinks.agregador
  let link_tasas_comercios  = data.tasasLinks.comercio

  const arrMsi = data.msi

  db.merchant.create({
            id_client:              data.id_cliente,
            id_persona:             data.id_tipo_persona,
            razon_social:           data.razon_social,
            name_merchant:          data.nombre_comercio,
            url_merchant:           data.url_comercio,
            rfc_merchant:           data.rfc,
            representative:         data.representante,
            agente_comercial:       data.agente_comercial,
            description:            data.descripcion,
            id_esquema:             data.id_esquema_transaccional,
            afiliation_number:      data.numero_afilacion,
            subafiliation_number:   data.numero_subafiliacion,
            id_mcc:                 data.mcc,
            id_acqbank:             data.acqbank,
            id_ln:                  data.id_red_logica,
            id_processor:           data.id_procesador,
            ln_agregador:           data.ln_agregador,
            visa_pymnt_facilitator: data.visa_payment_facilitator_id,
            mc_pymnt_facilitator:   data.mc_payment_facilitator_id,
            amex_pymnt_facilitator: data.amex_payment_facilitator_id,
            visa_indpnt_sales_org:  data.visa_independent_sales_organization_id,
            mc_indpnt_sales_org:    data.mc_independent_sales_organization_id,
            id_profile_transaction: data.id_perfil_transaccional,
            contact_merchant:       data.nombre_contacto,
            rol_contact:            data.rol_contacto,
            email_contact:          data.email_contacto,
            tel1_contact:           data.tel1_contacto,
            tel2_contact:           data.tel2_contacto,
            mobile_contact:         data.celular,
            use_moreterminals:      data.use_moreterminals,
            retencion:              data.retencion,
            active:                 1,
            processor_info:{
              whitelabel_broxel: !!process.env.BROXEL_WHITELABEL_BASE_URL ?{
                tkr: data.processor_info.whitelabel_broxel.tkr,
                merchant: data.processor_info.whitelabel_broxel.merchant
              } : undefined,
            },
            token_activation:       makeid(16),
            taza_credito:           tasas_banco.credito,
            taza_debito:            tasas_banco.debito,
            taza_amex:              tasas_banco.amex,
            tasa_credito_b:         tasas_agregador.credito,
            tasa_debito_b:          tasas_agregador.debito,
            tasa_amex_b:            tasas_agregador.amex,
            tasa_credito_c:         tasas_comercios.credito,
            tasa_debito_c:          tasas_comercios.debito,
            tasa_amex_c:            tasas_comercios.amex,
            tasa_credito_d:         data.comisiones.credito,
            tasa_debito_d:          data.comisiones.debito,
            tasa_amex_d:            data.comisiones.amex,
            
            taza_link_credito:      link_tasas_banco.credito,
            taza_link_debito:       link_tasas_banco.debito,
            taza_link_amex:         link_tasas_banco.amex,
            tasa_link_credito_b:    link_tasas_agregador.credito,
            tasa_link_debito_b:     link_tasas_agregador.debito,
            tasa_link_amex_b:       link_tasas_agregador.amex,
            tasa_link_credito_c:    link_tasas_comercios.credito,
            tasa_link_debito_c:     link_tasas_comercios.debito,
            tasa_link_amex_c:       link_tasas_comercios.amex,
            tasa_link_credito_d:    data.comisionesLink.credito,
            tasa_link_debito_d:     data.comisionesLink.debito,
            tasa_link_amex_d:       data.comisionesLink.amex,

            id_tax_regime: data.taxRegimen == '' ? null : data.taxRegimen,
            id_fiscal_address: fiscalAddressInfo.id,
            with_invoices : data.withInvoices ? data.withInvoices : 0,

            id_url_destino:         data.url_dest,
            id_modo_transaccion:    data.transaction_mode,
            id_bnrg_channel:        data.id_medio,

            id_direccion:           nueva_direccion.id,
            id_datos_bancarios:     dato_bancario.id,
            '3DS':                  data['3DS'],
            '3DS_KEY':              data['3DS_KEY'],
            serie_terminal:     data.serie_terminal,
            max:              data.max_tx,
            min:              data.min_tx,
            MSI:              JSON.stringify(arrMsi) ,
            afiliation_link: (data.afiliation_link) ? data.afiliation_link : null,
            id_medio_link: data.id_medio_link ? data.id_medio_link : null,
            selia_id: data.selia_id ? data.selia_id : null, // ADDED SELIA_ID
            last_update:    new Date().toISOString(),
            creation_date:  new Date().toISOString(),
          })
          .then(async result =>{
            return res.json({status: ok, data: result});
          })
          .catch(error => {
            dd(error.stack, 'error');
            return res.status(500).json({status: "error", data: error.message})
          })
}


authCtrlApi.editMerchant = async(req,res) => {
  const data = req.body;
  let aux = await db.merchant.findOne({where:{ name_merchant: data.nombre_comercio, id_merchant: { [db.Sequelize.Op.ne]: data.id_comercio }  , deleted_at : null }});
  if(aux){
    return res.status(400).json({
      status: "error",
      data: "Ya existe un comercio con ese nombre"
    });
  }
  const merchant = await db.merchant.findOne({where:{id_merchant: data.id_comercio}, include:['profile_trans']});
  if(merchant == null){
    return res.status(404).json({status: "error", data: "Comercio no encontrado"})
  }
  const datos_bancarios = await db.datosBancarios.findOne({ where:{ id: merchant.id_datos_bancarios} });
  if(!(data.datos_bancarios === undefined)){
    datos_bancarios.banco = data.datos_bancarios.banco
    datos_bancarios.clabe = data.datos_bancarios.clabe
    datos_bancarios.tarjeta = data.datos_bancarios.tarjeta
    datos_bancarios.no_cuenta = data.datos_bancarios.no_cuenta
    datos_bancarios.save()
  }
  var dato_direccion = await db.datosDireccion.findOne({ where:{ id:merchant.id_direccion} });

  if (!(data.direccion === undefined)) {
    dato_direccion.alcaldia = data.direccion.alcaldia;
    dato_direccion.ciudad = data.direccion.ciudad;
    dato_direccion.calle = data.direccion.calle;
    dato_direccion.no_ext = data.direccion.no_exterior
    dato_direccion.no_int = data.direccion.no_interior
    dato_direccion.colonia = data.direccion.colonia;
    dato_direccion.cp = data.direccion.codigo_postal;
    dato_direccion.pais = data.direccion.pais;
    dato_direccion.id_state = data.direccion.id_estado;
    dato_direccion.id_country = data.direccion.id_pais;

    dato_direccion.save()

  }

  // fiscal address
  let fiscalAddressData = dato_direccion;

  const dataFiscalAddress = {
    calle:      (data?.direccion_fiscal?.calle) ? data.direccion_fiscal.calle   : data.direccion.calle,
    no_ext:     (data?.direccion_fiscal?.no_exterior) ? data.direccion_fiscal.no_exterior   : data.direccion.no_exterior,
    no_int:     (data?.direccion_fiscal?.no_interior) ? data.direccion_fiscal.no_interior   : data.direccion.no_interior,
    colonia:    (data?.direccion_fiscal?.colonia) ? data.direccion_fiscal.colonia   : data.direccion.colonia,
    alcaldia:   (data?.direccion_fiscal?.alcaldia) ? data.direccion_fiscal.alcaldia   : data.direccion.alcaldia,
    ciudad:     (data?.direccion_fiscal?.ciudad) ? data.direccion_fiscal.ciudad   : data.direccion.ciudad,
    cp:         (data?.direccion_fiscal?.codigo_postal) ? data.direccion_fiscal.codigo_postal   : data.direccion.codigo_postal,
    pais:       (data?.direccion_fiscal?.pais) ? data.direccion_fiscal.pais   : data.direccion.pais,
    id_state:   (data?.direccion_fiscal?.id_estado) ? data.direccion_fiscal.id_estado   : data.direccion.id_estado,
    id_country: (data?.direccion_fiscal?.id_pais) ? data.direccion_fiscal.id_pais   : data.direccion.id_pais,
  };

  if(!req.body.same_address){

    if(merchant.id_direccion == merchant.id_fiscal_address){

      dd(('merchant.controller.editMerchant1 Crea dirección fiscal').green);
      fiscalAddressData = await db.datosDireccion.create(dataFiscalAddress);

    }else{

      if (merchant.id_fiscal_address) {

        dd(('merchant.controller.editMerchant1 Actualiza dirección fiscal').green);
        await db.datosDireccion.update(dataFiscalAddress, {
          where: {
            id: merchant.id_fiscal_address,
          },
          returning: true,
        });

        fiscalAddressData = await db.datosDireccion.findOne({
          where: { id: merchant.id_fiscal_address },
        });
      } else{

        dd(('merchant.controller.editMerchant1 Crea dirección fiscal: pide diferente a fisica pero no tiene alguna seteada').green);
        fiscalAddressData = await db.datosDireccion.create(dataFiscalAddress);

      }

    }

  }

  const arrMsi = data.msi

  merchant.id_client=              data.id_cliente,
  merchant.id_persona=             data.id_tipo_persona,
  merchant.razon_social=           data.razon_social,
  merchant.name_merchant=          data.nombre_comercio,
  merchant.url_merchant=           data.url_comercio,
  merchant.rfc_merchant=           data.rfc,
  merchant.representative=         data.representante,
  merchant.agente_comercial=       data.agente_comercial,
  merchant.description=            data.descripcion,
  merchant.id_esquema=             data.id_esquema_transaccional,
  merchant.afiliation_number=      data.numero_afilacion,
  merchant.subafiliation_number=   data.numero_subafiliacion,
  merchant.id_mcc=                 data.mcc,
  merchant.id_acqbank=             data.acqbank,
  merchant.id_ln=                  data.id_red_logica,
  merchant.id_processor=           data.id_procesador,
  merchant.ln_agregador=           data.ln_agregador,
  merchant.visa_pymnt_facilitator= data.visa_payment_facilitator_id,
  merchant.mc_pymnt_facilitator=   data.mc_payment_facilitator_id,
  merchant.amex_pymnt_facilitator= data.amex_payment_facilitator_id,
  merchant.visa_indpnt_sales_org=  data.visa_independent_sales_organization_id,
  merchant.mc_indpnt_sales_org=    data.mc_independent_sales_organization_id,
  merchant.id_profile_transaction= data.id_perfil_transaccional,
  merchant.contact_merchant=       data.nombre_contacto,
  merchant.rol_contact=            data.rol_contacto,
  merchant.email_contact=          data.email_contacto,
  merchant.tel1_contact=           data.tel1_contacto,
  merchant.tel2_contact=           data.tel2_contacto,
  merchant.mobile_contact=         data.celular,
  merchant.use_moreterminals=      data.use_moreterminals
  merchant.id_medio_link=          data.id_medio_link
  merchant.active=                 data.active
  merchant.serie_terminal=         data.serie_terminal
  merchant.afiliation_link=        data.afiliation_link
  merchant['3DS']=                 data['3DS']
  merchant['3DS_KEY']=             data['3DS_KEY']
  merchant.max =              data.max_tx;
  merchant.min =              data.min_tx;
  merchant.selia_id =        data.selia_id ? data.selia_id : null; // ADDED SELIA_ID

  merchant.with_invoices = data.withInvoices ? data.withInvoices : 0 ;
  merchant.id_tax_regime = data.taxRegimen == '' ? null : data.taxRegimen;
  merchant.id_fiscal_address = fiscalAddressData.id;

  if(!!process.env.BROXEL_WHITELABEL_BASE_URL){
    let whitelabel_broxel = {
      tkr: data.processor_info.whitelabel_broxel.tkr,
      merchant: data.processor_info.whitelabel_broxel.merchant
    };
    if(merchant.processor_info && typeof merchant.processor_info == 'object'){
      merchant.processor_info = {
        ...merchant.processor_info,
        whitelabel_broxel
      };
    }else{
      merchant.processor_info = {
        whitelabel_broxel
      };
    }
  }


  if(!(data.tasas === undefined)) {
    if (!(data.tasas.banco === undefined)) {
      merchant.taza_credito=           parseFloat(data.tasas.banco.credito),
      merchant.taza_debito=            parseFloat(data.tasas.banco.debito),
      merchant.taza_amex=              parseFloat(data.tasas.banco.amex)
    }
    if (!(data.tasas.agregador === undefined)) {
      merchant.tasa_credito_b=         parseFloat(data.tasas.agregador.credito),
      merchant.tasa_debito_b=          parseFloat(data.tasas.agregador.debito),
      merchant.tasa_amex_b=            parseFloat(data.tasas.agregador.amex)
    }
    if (!(data.tasas.comercio === undefined)) {
      merchant.tasa_credito_c=         parseFloat(data.tasas.comercio.credito),
      merchant.tasa_debito_c=          parseFloat(data.tasas.comercio.debito),
      merchant.tasa_amex_c=            parseFloat(data.tasas.comercio.amex)
    }
  }
  if (!(data.comisiones === undefined)) {
    merchant.tasa_credito_d=         parseFloat(data.comisiones.credito),
    merchant.tasa_debito_d=          parseFloat(data.comisiones.debito),
    merchant.tasa_amex_d=            parseFloat(data.comisiones.amex)
  }

  // links
  if(!(data.tasasLinks === undefined)) {
    if (!(data.tasasLinks.banco === undefined)) {
      merchant.taza_link_credito=           parseFloat(data.tasasLinks.banco.credito),
      merchant.taza_link_debito=            parseFloat(data.tasasLinks.banco.debito),
      merchant.taza_link_amex=              parseFloat(data.tasasLinks.banco.amex)
    }
    if (!(data.tasas.agregador === undefined)) {
      merchant.tasa_link_credito_b=         parseFloat(data.tasasLinks.agregador.credito),
      merchant.tasa_link_debito_b=          parseFloat(data.tasasLinks.agregador.debito),
      merchant.tasa_link_amex_b=            parseFloat(data.tasasLinks.agregador.amex)
    }
    if (!(data.tasas.comercio === undefined)) {
      merchant.tasa_link_credito_c=         parseFloat(data.tasasLinks.comercio.credito),
      merchant.tasa_link_debito_c=          parseFloat(data.tasasLinks.comercio.debito),
      merchant.tasa_link_amex_c=            parseFloat(data.tasasLinks.comercio.amex)
    }
  }
  if (!(data.comisiones === undefined)) {
    merchant.tasa_link_credito_d=         parseFloat(data.comisionesLink.credito),
    merchant.tasa_link_debito_d=          parseFloat(data.comisionesLink.debito),
    merchant.tasa_link_amex_d=            parseFloat(data.comisionesLink.amex)
  }

  merchant.retencion=              parseFloat(data.retencion)
  merchant.id_url_destino=         data.url_dest,
  merchant.id_modo_transaccion =   data.transaction_mode,
  merchant.id_bnrg_channel     =   data.id_medio,

  merchant.MSI        = JSON.stringify(arrMsi);

  merchant.last_update = new Date();
  merchant.save().then(async (result)=> {
    const auxtdm = new tdmClass();
    const response = await auxtdm.updateMerchant(merchant);
    if(response.error){
        return res.status(500).json({status: "error", data: response.error});
    }
    return res.json({status: ok, data: { 
      comercio: merchant, 
      direccion: dato_direccion, 
      datos_bancarios: datos_bancarios,
      fiscalAddress : fiscalAddressData
    } });
  })
  .catch(err => {
    return res.status(500).json({status: "error", data: err.message})
  })
}


authCtrlApi.deleteMerchant = async(req,res) => {
    const { id_merchant } = req.body;
    var merchant = await db.merchant.findOne({where:{id_merchant: id_merchant}})
    if(merchant == null){
      return res.status(404).json({status: "error", data: "Comercio no encontrado"})
    }
    merchant.active = 0
    merchant.deleted_at = Date.now();
    merchant.save().then(async (result)=> {
      return res.json({status: ok, data: "Comercio eliminado correctamente"});
    }).catch(err => {
      return res.status(500).json({status: "error", data: err.message});
    });
}

authCtrlApi.getinfo = async (req,res) => {
  const afiliacion = req.headers['commerce-id'];
  const commerceName = req.headers['commerce-name'];
  const tms = req.headers['x-time'];
  const tka = req.headers['x-auth'];
  if(afiliacion == null || commerceName == null || tms == null || tka == null){
    return res.status(401).json({status: "error", data: "valida la información de tu comercio"});
  }
  const merchant = await db.merchant.findOne({
    where: {
      active: 1,
      afiliation_number: afiliacion,
      ...(commerceName && { name_merchant: commerceName }),
    },
  });
  if(merchant){
  const isvalid = await  helpers.validateTKA(merchant.token_activation,tms,afiliacion,tka);
  if(isvalid){
    return res.json({
      id_merchant: merchant.id_merchant,
      id_client: merchant.id_client,
      name_merchant: merchant.name_merchant,
    });
  } else {
    return res.status(401).json({status: "error", data: "valida tu información de comercio"});
  }
  } else {
    return res.status(401).json({status: "error", data: "valida la información de tu comercio"});
  }
}
authCtrlApi.getMsiConfig = async (req, res) => {
  try {
    const { id_merchant } = req.params;
    
    console.log(`[merchants.api.controller.js] Getting MSI config for merchant ${id_merchant}`);
    
    // Validate merchant exists and is active
    const merchant = await db.merchant.findOne({
      where: { id_merchant, active: 1, deleted_at: null }
    });
    
    if (!merchant) {
      return res.status(404).json({status: "error", data: "Comercio no encontrado o inactivo"});
    }
    
    // Get MSI configuration from merchant.MSI field (primary source)
    let msiConfig = JSON.parse(merchant.MSI || '[]');
    console.log(`[merchants.api.controller.js] MSI config from merchant.MSI:`, msiConfig);
    
    // If MSI is empty, try to get from assigned templates as fallback
    if (msiConfig.length === 0) {
      console.log(`[merchants.api.controller.js] No MSI config in merchant.MSI, checking templates...`);
      
      const [msiTemplates] = await db.seq.query(`
        SELECT mt.plans, mt.name as template_name, mt.national_only, mt.token_q6_supported
        FROM merchant_msi_templates mmt
        JOIN msi_templates mt ON mt.id_template = mmt.id_template
        WHERE mmt.id_merchant = ${id_merchant} AND mt.is_active = 1
      `);
      
      if (msiTemplates.length > 0) {
        // Use the first assigned template's configuration
        const template = msiTemplates[0];
        msiConfig = typeof template.plans === 'string' ? JSON.parse(template.plans || '[]') : (template.plans || []);
        console.log(`[merchants.api.controller.js] MSI config from template '${template.template_name}':`, msiConfig);
      } else {
        // No MSI templates assigned - try to auto-assign default template
        console.log(`[merchants.api.controller.js] No MSI templates found for merchant ${id_merchant}, attempting auto-assignment...`);
        
        try {
          // Get default MSI template
          const [defaultTemplate] = await db.seq.query(`
            SELECT id_template, name, plans
            FROM msi_templates 
            WHERE is_default = 1 AND is_active = 1
            LIMIT 1
          `);
          
          if (defaultTemplate.length > 0) {
            // Auto-assign default template to this merchant
            await db.seq.query({
              query: 'INSERT INTO merchant_msi_templates (id_merchant, id_template, applied_at, applied_by) VALUES (?, ?, NOW(), ?)',
              values: [id_merchant, defaultTemplate[0].id_template, 'auto-assign']
            });
            
            msiConfig = typeof defaultTemplate[0].plans === 'string' ? JSON.parse(defaultTemplate[0].plans || '[]') : (defaultTemplate[0].plans || []);
            console.log(`[merchants.api.controller.js] Auto-assigned default template '${defaultTemplate[0].name}' to merchant ${id_merchant}`);
          }
        } catch (assignError) {
          console.log(`[merchants.api.controller.js] Auto-assignment failed:`, assignError.message);
        }
      }
    }
    
    // Get MSI-enabled operations for this merchant
    const [operations] = await db.seq.query(`
      SELECT mo.id_operation, mo.msi_enabled, mo.name
      FROM mcc_operations mo
      JOIN iso_mcc im ON im.mcc = mo.mcc_code
      JOIN merchant m ON m.id_mcc = im.id_mcc
      WHERE m.id_merchant = ${id_merchant} AND mo.active = 1
    `);
    
    const enabledOperations = operations.filter(op => op.msi_enabled === 1);
    
    // Transform MSI config to match expected frontend format
    const transformedMsiConfig = msiConfig.map(plan => ({
      months: parseInt(plan.months || plan.type || 0),
      enabled: plan.enabled !== false, // Default to true if not specified
      min_amount: parseFloat(plan.min_amount || plan.min_mount || 0)
    })).filter(plan => plan.months > 0); // Filter out invalid plans
    
    // Calculate months_options and min_amounts from transformed config
    const months_options = transformedMsiConfig.length > 0 ? transformedMsiConfig.map(plan => plan.months) : [3, 6, 9, 12];
    const min_amounts = transformedMsiConfig.length > 0 ? transformedMsiConfig.reduce((acc, plan) => {
      acc[plan.months] = plan.min_amount;
      return acc;
    }, {}) : {3: 300, 6: 600, 9: 900, 12: 1200};
    
    res.json({
      id_merchant: merchant.id_merchant,
      name_merchant: merchant.name_merchant,
      msi_config: transformedMsiConfig,
      enabled: transformedMsiConfig.some(plan => plan.enabled), // MSI is enabled if any plan is enabled
      enabled_operations: enabledOperations,
      national_only: true,
      token_q6_supported: true,
      months_options: months_options,
      min_amounts: min_amounts,
      last_updated: merchant.updatedAt
    });
    
  } catch (error) {
    console.error('[merchants.api.controller.js] Error getting MSI config:', error);
    res.status(500).json({status: "error", data: "Error al obtener configuración MSI"});
  }
};

authCtrlApi.updateMsiConfig = async (req, res) => {
  try {
    const { id_merchant } = req.params;
    const { msi_updates } = req.body;
    
    console.log(`[merchants.api.controller.js] Updating MSI config for merchant ${id_merchant}:`, msi_updates);
    
    // Validate merchant exists and is active
    const merchant = await db.merchant.findOne({
      where: { id_merchant, active: 1, deleted_at: null }
    });
    
    if (!merchant) {
      return res.status(404).json({status: "error", data: "Comercio no encontrado o inactivo"});
    }
    
    // Validate msi_updates structure
    if (!Array.isArray(msi_updates)) {
      return res.status(400).json({status: "error", data: "msi_updates debe ser un arreglo"});
    }
    
    // Get current MSI configuration
    const currentMsi = JSON.parse(merchant.MSI || '[]');
    console.log(`[merchants.api.controller.js] Current MSI config:`, currentMsi);
    
    // Create updated MSI configuration based on the updates
    const updatedMsi = msi_updates.map(update => {
      // Validate minimum amount
      if (typeof update.min_amount !== 'number' || update.min_amount < 0) {
        throw new Error(`Monto mínimo inválido para ${update.months} meses`);
      }
      
      // Determine if plan is enabled (min_amount > 0 means enabled)
      const isEnabled = update.min_amount > 0;
      
      return {
        months: update.months.toString(),
        enabled: isEnabled,
        min_amount: update.min_amount.toString(),
        type: update.months.toString(),
        min_mount: update.min_amount.toString() // Keep for backward compatibility
      };
    });
    
    // Update merchant MSI configuration
    await merchant.update({ 
      MSI: JSON.stringify(updatedMsi)
    });
    
    console.log(`[merchants.api.controller.js] Updated MSI config:`, updatedMsi);
    
    res.json({
      status: "ok",
      data: {
        message: "Configuración MSI actualizada exitosamente",
        msi_config: updatedMsi
      }
    });
    
  } catch (error) {
    console.error('[merchants.api.controller.js] Error updating MSI config:', error);
    res.status(500).json({status: "error", data: error.message});
  }
};

module.exports = authCtrlApi;