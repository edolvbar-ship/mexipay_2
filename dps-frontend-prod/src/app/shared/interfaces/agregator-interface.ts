export interface AgregatorResponse {
    data: AgregatorDataInterface[]
    pagination: any
}

export interface AgregatorDataInterface {
    id: string
    logicalName: string
    name: string
    creation_date: string
    last_update?: string
    deletedAt?: any
}

export interface AgregatorTableInterface {
    id: string
    "ID Agregador": string
    "Nombre": string
    "Fecha creación": string
}