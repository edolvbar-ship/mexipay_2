export interface TicketsInterface {
    data: TicketsDataInterface[]
  }

  export interface TicketDownloadInterface {
    data: string,
    path:string,
    pathApi: string,
    blob?: Blob
  }

  export interface TicketEmailInterface {
    email: string,
    id: string,
    trace_id: string,
    authorization: string,
    "AID"?: string,
    "ARQC"?: string
  }

  export interface TicketEmailResponseInterface {
    error?: string,
    msg: string
  }

  export interface ShowDataTicket {
    'Fecha': string,
    'Hora': string,
    'Banco adquirente': string,
    comercio: string,
    'afiliación': string,
    'No. Referencia': string,
    'Monto': string,
    '4 Dígitos': string,
    'Mesero': string,
    metadata?: {
      originalData: string
    }
  }
  
  export interface TicketsDataInterface {
    id_message: number
    trace_number: string
    name_merchant: string
    terminal?: string
    id_operation: number
    msg_type: string
    reference_number: string
    amount: string
    resp_code?: string
    authorization?: string
    bin?: string
    last4?: string
    draft_capture: string
    entry_mode: string
    reverse_code?: string
    tran_date?: string
    tran_time?: string
    capture_date?: string
    reference_number_ant: string
    card_type?: string
    folio: string
    more_info: MoreInfo
    track2: string
    card_acceptor: string
    creation_date: string
    estatus_f: number
    signature?: Signature
    bin_info: any
    tipo_operacion: TipoOperacion
    codigo_resp?: CodigoResp
    merchant_por_id: MerchantPorId
    finalMount: string
    fecha: string
    F1: string
    F2: string
  }
  
  export interface MoreInfo {
    iva: number
    merchant_data: MerchantData
    client_data: ClientData
    tipo_tx: string
    object: any
    auth?: string
    metodo?: string
    emv_tags?: string
    tip?: string
    waiter?: string
    autoReverseInfo?: AutoReverseInfo
  }
  
  export interface MerchantData {
    name_merchant: string
    afiliation_number: string
    subafiliation_number: string
    ln_agregador: string
    visa_pymnt_facilitator?: string
    mc_pymnt_facilitator?: string
    amex_pymnt_facilitator?: string
    visa_indpnt_sales_org?: string
    mc_indpnt_sales_org?: string
    taza_credito: string
    taza_debito: string
    taza_amex: string
    tasa_credito_b: string
    tasa_debito_b: string
    tasa_amex_b: string
    tasa_credito_c: string
    tasa_debito_c: string
    tasa_amex_c: string
    tasa_credito_d: string
    tasa_debito_d: string
    tasa_amex_d: string
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
    retencion: string
    "3DS": number
    "3DS_KEY": string
    MSI: string
    afiliation_link?: string
    id_medio_link: any
    apiKey: any
    datos_direccion: DatosDireccion
    iso_logical_network: IsoLogicalNetwork
    isoMcc: IsoMcc
    esquema_transaccional: EsquemaTransaccional
  }
  
  export interface DatosDireccion {
    id: number
    calle: string
    no_ext: string
    no_int: string
    colonia: string
    alcaldia: string
    ciudad?: string
    id_state: number
    cp: string
    pais?: string
    id_country: number
    createdAt: string
    updatedAt: string
  }
  
  export interface IsoLogicalNetwork {
    id_ln: number
    ln: string
    name: string
    creation_date: string
    last_update: string
    deletedAt: any
  }
  
  export interface IsoMcc {
    id_mcc: number
    mcc: string
    description: string
    active: boolean
    create_date: string
    last_update: string
    deletedAt: any
  }
  
  export interface EsquemaTransaccional {
    id_esquema_transactional: number
    esquema: string
    description: string
    creation_date: string
    last_update: string
    deletedAt: any
  }
  
  export interface ClientData {
    name: string
  }
  
  export interface AutoReverseInfo {
    fld125: string
    fld43: string
  }
  
  export interface Signature {
    id: number
  }
  
  export interface TipoOperacion {
    id_operation: number
    name: string
    code: string
  }
  
  export interface CodigoResp {
    id_response_code: number
    iso_code: string
    description: string
    device_description: string
  }
  
  export interface MerchantPorId {
    id_merchant: number
    id_client: number
    name_merchant: string
    afiliation_number: string
    active: number
    afiliation_link?: string
    taza_credito: string
    taza_debito: string
    taza_amex: string
    tasa_credito_b: string
    tasa_debito_b: string
    tasa_amex_b: string
    tasa_credito_c: string
    tasa_debito_c: string
    tasa_amex_c: string
    tasa_credito_d: string
    tasa_debito_d: string
    tasa_amex_d: string
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
    datos_direccion: DatosDireccion2
    banco_adq: BancoAdq
    iso_client_dt: IsoClientDt
  }
  
  export interface DatosDireccion2 {
    id: number
    calle: string
    no_ext: string
    no_int: string
    colonia: string
    alcaldia: string
    ciudad?: string
    id_state: number
    cp: string
    pais?: string
    id_country: number
  }
  
  export interface BancoAdq {
    id_acqbank: number
    fiid: string
    id_acquirer: any
    name: string
    last_update: string
    deletedAt: any
  }
  
  export interface IsoClientDt {
    id_client: number
    name: string
    id_persona: number
    razon_social: string
    rfc: string
    representative: string
    url: string
    description: string
    agente: string
    contact_cliente: string
    rol_contact: string
    email_contact: string
    tel1_contact: string
    tel2_contact: string
    mobile_contact: string
    id_direccion: number
    id_datos_bancarios: number
    last_update: string
    deleted_at: any
  }
  