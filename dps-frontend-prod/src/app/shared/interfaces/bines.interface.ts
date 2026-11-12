export interface BinesResponse {
    data: BinesDataInterface[]
    pagination: any
}

export interface BinesDataInterface {
    "3DS": string
    id_bin: string
    bin: string
    id_issbank: string
    bank: string
    id_card_product: string
    product: string
    id_card_type: string
    type: string
    id_processor: string
    processor_name: string
    id_brand: string
    brand: string
    creation_date: string
}

export interface BinesTableInterface {
    id: string
    Bin: string
    Banco: string
    Producto: string
    Tipo: string
    Procesador: string
    Marca: string
    "3ds": string
    "Fecha Creación": string
}