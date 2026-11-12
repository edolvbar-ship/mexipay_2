export interface TransactionSchemaResponse {
    data: TransactionSchemaDataInterface[]
    pagination: any
}

export interface TransactionSchemaDataInterface {
    id_esquema_transactional: string
    esquema: string
    description: string
    creation_date: string
    last_update?: string
    deletedAt?: any
}

export interface TransactionSchemaTableInterface {
    id: string
    "Esquema": string
    "Descripción": string
    "Fecha creación": string
}