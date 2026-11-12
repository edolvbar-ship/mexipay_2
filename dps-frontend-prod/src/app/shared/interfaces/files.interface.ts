export interface FilesResponse {
    data: FilesDataInterface[]
    pagination: any
}

export interface FilesDataInterface {
    id: string,
    id_cliente: string,
    tipo_archivo: string,
    porcentaje: string,
    status: string,
    descripcion: string,
    nombre: string,
    error: string,
    respuesta: string,
    created_at: string,
    updated_at?: string,
    deleted_at?: any,
    Fecha: string,
  
}

export interface FilesTableInterface {
    id: string,
    Fecha: string,
    Nombre: string,
    Porcentaje: string,
    Estatus: string,
    error:string,
    respuesta:string
}