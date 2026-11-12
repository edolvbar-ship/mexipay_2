export interface TransactionModeResponse {
    data: TransactionModeDataInterface[]
    pagination: any
}

export interface TransactionModeDataInterface {
    id_bnrg_modo_transac: string
    bnrg_modo_trans: string
    description: string
    creation_date: string
    last_update?: string
    deletedAt?: any
}

export interface TransactionModeTableInterface {
    id: string
    "Modo": string
    "Descripción": string
    "Fecha creación": string
    "Fecha actualización": string
}