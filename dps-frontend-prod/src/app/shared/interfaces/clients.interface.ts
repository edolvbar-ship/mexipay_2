export interface ClientsInterface {
    status: string;
    data: dataClientsInterface[];
}

export interface dataClientsInterface {
    id_client: number;
    name: string;
    id_persona: number;
    razon_social: string;
    rfc: string;
    representative: string;
    url: string;
    description: string;
    agente: string;
    contact_cliente: string;
    rol_contact: string;
    email_contact: string;
    tel1_contact: string;
    tel2_contact: string;
    mobile_contact: string;
    id_direccion: number;
    id_datos_bancarios: number;
    creation_date: string;
    last_update: string;
    deleted_at: any;
}

export interface createNewClienteInterface {
    id_persona: number;
    name: string;
    razon_social: string;
    rfc: string;
    representative: string;
    url: string;
    description: string;
    agente: string;
    contact_cliente: string;
    rol_contact: string;
    email_contact: string;
    tel1_contact: string;
    tel2_contact: string;
    mobile_contact: string;
    dir: Dir;
    banco: Banco;
}

export interface Dir {
    calle: string;
    no_ext: number;
    no_int: string;
    colonia: string;
    alcaldia: string;
    cp: string;
    id_country: number;
    id_state: number;
}

export interface Banco {
    banco: string;
    tarjeta: string;
    no_cuenta: string;
    clabe: string;
}


export interface ShowDataClient {
    Id: number,
    'Nombre Cliente': string,
    'Razon Social': string,
    'Representante Legal': string,
    RFC: string,
    'Página Web': string,
    'Descripción': string,
    Agente: string,
    'Contacto de Cliente': string,
    'Rol de Contacto': string,
}