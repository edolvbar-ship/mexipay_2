export interface DevicesInterface {
    data: DataDevicesInterface[]
}

export interface DataDevicesInterface {
    id_merchant: number
    name_merchant: string
    name: string
    afiliation_number: string
    serial: string
    firmware: string
    app_version: string
    os_version: string
    type_os: string
    uuid: string
    active: number
    email: string
    iduser: number
    smart_device_idsmtdevice: number
    terminal_device_idterm_device: number
}

export interface ShowDevicesDataInterface {
    Cliente: string
    Comercio: string
    Afiliación: string
    Dispositivo: string
    SO: string
    Terminal: string
    Usuario: string
}
