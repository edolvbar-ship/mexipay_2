export interface ProcessorResponse {
    data: ProcessorDataInterface[]
    pagination: any
}

export interface ProcessorDataInterface {
    id_processor: string
    fiid: string
    name: string
    reqApiKey: string
    tags: string
    creation_date: string
}

export interface ProcessorTableInterface {
    id: string
    "Fiid": string
    "Nombre": string
    "Fecha creación": string
}