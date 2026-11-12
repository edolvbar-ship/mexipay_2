export interface MovementsAllInterface {
    reg: Reg
    Fecha: string
    Hora: string
    Cliente: string
    Comercio: string
    Afilación: string
    TipoProd: string
    idTrans: string
    Estatus: string
    EstatusF: string
    Método: string
    Terminal: string
    TipoT: string
    Autorización: string
    Monto: string
    MPHS1: string
    IVA1: string
    TotalC1: string
    MPHS2: string
    IVA2: string
    TotalC2: string
    tbanco: string
    TotalC: string
    TotalI: string
    GranT: string
    TotalFinal: string
    propina: string
    mesero: string
    msi_months: string
    entryMode: string
}

export interface Reg {
    id_message: number
    trace_number: string
    name_merchant: string
    terminal: string
    id_operation: number
    msg_type: string
    reference_number: string
    amount: string
    resp_code: string
    authorization: any
    bin: any
    last4: string
    draft_capture: string
    entry_mode: string
    reverse_code: any
    tran_date: string
    tran_time: string
    capture_date: string
    reference_number_ant: string
    card_type: string
    folio: string
    more_info: string
    track2: string
    card_acceptor: any
    creation_date: string
    estatus_f: number
    signature: any
    bin_info: any
    tipo_operacion: TipoOperacion
    codigo_resp: CodigoResp
    merchant_por_id: MerchantPorId
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
    afiliation_link: any
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
    datos_direccion: DatosDireccion
    banco_adq: BancoAdq
    iso_client_dt: IsoClientDt
}

export interface DatosDireccion {
    id: number
    calle: string
    no_ext: string
    no_int: string
    colonia: string
    alcaldia: string
    ciudad: string
    id_state: number
    cp: string
    pais: string
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
