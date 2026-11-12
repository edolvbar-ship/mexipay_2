export interface PersonTypeResponse {
    data: PersonTypeDataInterface[]
    pagination: any
}

export interface PersonTypeDataInterface {
    id_tipo_persona: string
    name: string
    creation_date: string
    last_update?: string
    deletedAt?: any
}


export interface PersonTypeTableInterface {
    id: string
    "Nombre": string
    "Fecha creación": string
}