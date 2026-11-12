export interface TransactionalProfileResponse {
    data: TransactionalProfileDataInterface[]
    pagination: any
}

export interface TransactionalProfileDataInterface {
    id_profile_transaction: string
    hex_value: string
    name: string
    creation_date: string
    last_update?: string
    decoded?: any
}

export interface TransactionalProfileTableInterface {
    id: string
    "Nombre": string
    "Fecha creación": string
    "Fecha actualización": string
    decoded?: any
}
