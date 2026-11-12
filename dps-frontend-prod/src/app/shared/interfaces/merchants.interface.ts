export interface MerchantsInterface {
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
    visa_pymnt_facilitator?: string
    mc_pymnt_facilitator?: string
    amex_pymnt_facilitator?: string
    visa_indpnt_sales_org?: string
    mc_indpnt_sales_org?: string
    id_bnrg_channel?: string
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
    id_url_destino?: number
    id_direccion: number
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
    afiliation_link?: string
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
    bank: string
    mcc: string
    mcc_desc: string
    logical_network: string
    client_name: string
    db_banco: string
    db_tarjeta: string
    db_cuenta: string
    db_clabe: string
    t_credito: string
    t_debito: string
    t_amex: string
    selia_id?: number // Added selia_id
}

export interface ProcessorInfoInterface {
    whitelabel_broxel?: {
        tkr: string,
        merchant: string
    };

    [key: string]: {
        [key: string]: string
    } | undefined;

    //otherProcessor: {} | undefined
}

export interface ShowMerchantsInterface{
    Id: number,
    'Token Activación': string,
    Cliente: string,
    'Nombre Comercio': string,
    'Afiliación': string,
    'Banco Adquirente': string,
    'Red Lógica': string,
    'Representante Legal': string,
    'Página Web': string,
    RFC: string,
    'Descripción': string,
    'Selia ID'?: string, // Added Selia ID
}
