export interface UrlTargetResponse {
    data: UrlTargetDataInterface[]
    pagination: any
}

export interface UrlTargetDataInterface {
    id_bnrg_url_dest: string
    url: string
    creation_date: string
    last_update?: string
    deletedAt?: any
}

export interface UrlTargetTableInterface {
    id: string
    "URL": string
    "Fecha creación": string
    "Fecha actualización": string
}