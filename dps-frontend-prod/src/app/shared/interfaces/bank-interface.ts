export interface BankResponse {
    data: BankDataInterface[]
    pagination: any
}

export interface BankDataInterface {
    id_acqbank: string
    fiid: string
    id_acquirer?: string
    name: string
    creation_date: string
    last_update?: string
    deletedAt?: any
}

export interface BankTableInterface {
    id: string
    "Fiid": string
    "Nombre": string
    "Fecha creación": string
}