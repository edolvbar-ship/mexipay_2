export interface PosJsonInterface {
    data: PosJsonInterfaceData[]
  }
  
  export interface PosJsonInterfaceData {
    id_log: string
    id_transaction: any
    id_request: string
    uri: string
    method: string
    request: string
    response: string
    entry_time: string
    exit_time: string
    creation_date: string
    fecha_hora: string
    fecha_: string
    hora_: string
    f_i: string
    f_f: string
  }


  export interface PosJsonTableInterface {
    id: string
    "Nombre": string
    "Fecha creación": string
}