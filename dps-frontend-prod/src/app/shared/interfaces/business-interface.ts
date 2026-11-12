export interface BusinessResponse {
    data: BusinessDataInterface[]
    pagination: any
}

export interface BusinessDataInterface {
    id_mcc: string
    mcc: string
    description: string
    active: string
    create_date: string
    last_update?: string
    deletedAt?: any
}

export interface BusinessTableInterface {
    id: string
    "Giro": string
    "Descripción": string
    "Fecha creación": string
}