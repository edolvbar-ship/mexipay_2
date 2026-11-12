export interface LogicalNetworkResponse {
    data: LogicalNetworkDataInterface[]
    pagination: any
}

export interface LogicalNetworkDataInterface {
    id_ln: string
    ln: string
    name: string
    creation_date: string
    last_update?: string
    deletedAt?: any
}

export interface LogicalNetworkTableInterface {
    id: string
    "Red Lógica": string
    "Nombre": string
    "Fecha creación": string
}