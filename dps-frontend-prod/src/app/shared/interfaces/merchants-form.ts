export interface MerchantFomrInterface {
    id_cliente: number
    id_tipo_persona: number
    razon_social: string
    nombre_comercio: string
    url_comercio: string
    rfc: string
    representante: string
    agente_comercial: string
    descripcion: string
    id_esquema_transaccional: number
    numero_afilacion: string
    numero_subafiliacion: string
    mcc: number
    acqbank: number
    id_red_logica: number
    id_procesador: number
    ln_agregador: string
    visa_payment_facilitator_id: string
    mc_payment_facilitator_id: string
    amex_payment_facilitator_id: string
    visa_independent_sales_organization_id: string
    mc_independent_sales_organization_id: string
    id_perfil_transaccional: number
    nombre_contacto: string
    rol_contacto: string
    email_contacto: string
    tel1_contacto: string
    tel2_contacto: string
    celular: string
    use_moreterminals: any
    active: boolean
    retencion: number
    taxRegimen: number
    withInvoices: number
    direccion: Direccion
    direccion_fiscal: DireccionFiscal
    datos_bancarios: DatosBancarios
    tasas: Tasas
    comisiones: Comisiones
    tasasLinks: TasasLinks
    comisionesLink: ComisionesLink
    url_dest: number
    "3DS": number
    "3DS_KEY": string
    serie_terminal: string
    max_tx: string
    min_tx: number
    afiliation_link: string
    id_medio_link: string
    msi: any[]
    same_address: boolean
    selia_id?: number // Added selia_id
  }

  export interface Direccion {
    calle: string
    no_exterior: string
    no_interior: string
    colonia: string
    id_estado: number
    alcaldia: string
    codigo_postal: string
    id_pais: number
  }

  export interface DireccionFiscal {
    calle: string
    no_exterior: string
    no_interior: string
    colonia: string
    id_estado: number
    alcaldia: string
    codigo_postal: string
    id_pais: number
  }

  export interface DatosBancarios {
    banco: string
    clabe: string
    tarjeta: string
    no_cuenta: string
  }

  export interface Tasas {
    banco: Banco
    agregador: Agregador
    comercio: Comercio
  }

  export interface Banco {
    credito: number
    debito: number
    amex: number
  }

  export interface Agregador {
    credito: number
    debito: number
    amex: number
  }

  export interface Comercio {
    credito: number
    debito: number
    amex: number
  }

  export interface Comisiones {
    credito: number
    debito: number
    amex: number
  }

  export interface TasasLinks {
    banco: Banco2
    agregador: Agregador2
    comercio: Comercio2
  }

  export interface Banco2 {
    credito: number
    debito: number
    amex: number
  }

  export interface Agregador2 {
    credito: number
    debito: number
    amex: number
  }

  export interface Comercio2 {
    credito: number
    debito: number
    amex: number
  }

  export interface ComisionesLink {
    credito: number
    debito: number
    amex: number
  }

  export interface editMerchantInterface {
    same_address: boolean
    id_merchant: number
    id_client: number
    id_persona: number
    razon_social: string
    name_merchant: string
    url_merchant: string
    rfc_merchant: string
    representative: string
    agente_comercial: string
    description: string
    id_esquema: number
    afiliation_number: string
    subafiliation_number: string
    id_mcc: number
    id_acqbank: number
    id_ln: number
    id_processor: number
    ln_agregador: string
    visa_pymnt_facilitator: string
    mc_pymnt_facilitator: string
    amex_pymnt_facilitator: string
    visa_indpnt_sales_org: string
    mc_indpnt_sales_org: string
    id_bnrg_channel: any
    id_profile_transaction: number
    contact_merchant: string
    rol_contact: string
    email_contact: string
    tel1_contact: string
    tel2_contact: string
    mobile_contact: string
    use_moreterminals: any
    active: number
    token_activation: string
    taza_credito: string
    taza_debito: string
    taza_amex: string
    last_update: string
    creation_date: string
    tasa_credito_b: string
    tasa_debito_b: string
    tasa_amex_b: string
    tasa_credito_c: string
    tasa_debito_c: string
    tasa_amex_c: string
    id_modo_transaccion: any
    id_url_destino: any
    id_direccion: number
    id_fiscal_address: number
    id_datos_bancarios: number
    tasa_credito_d: string
    tasa_debito_d: string
    tasa_amex_d: string
    cybersource: number
    "3DS": number
    "3DS_KEY": string
    serie_terminal: string
    deleted_at: any
    max: number
    min: number
    MSI: string
    id_medio_link: any
    afiliation_link: any
    apiKey: any
    retencion: string
    taza_link_credito: string
    taza_link_debito: string
    taza_link_amex: string
    tasa_link_credito_b: string
    tasa_link_debito_b: string
    tasa_link_amex_b: string
    tasa_link_credito_c: string
    tasa_link_debito_c: string
    tasa_link_amex_c: string
    tasa_link_credito_d: string
    tasa_link_debito_d: string
    tasa_link_amex_d: string
    id_tax_regime: number
    with_invoices: number
    bank: string
    mcc: string
    mcc_desc: string
    logical_network: string
    client_name: string
    db_banco: string
    db_tarjeta: string
    db_cuenta: string
    db_clabe: string
    dd_calle: string
    dd_no_ext: string
    dd_no_int: string
    dd_colonia: string
    dd_alcaldia: string
    dd_ciudad: any
    dd_cp: string
    dd_pais: number
    dd_state: number
    df_calle: string
    df_no_ext: string
    df_no_int: string
    df_colonia: string
    df_alcaldia: string
    df_ciudad: string
    df_cp: string
    df_pais: number
    df_state: number
    t_credito: string
    t_debito: string
    t_amex: string
    selia_id?: number // Added selia_id
  }
