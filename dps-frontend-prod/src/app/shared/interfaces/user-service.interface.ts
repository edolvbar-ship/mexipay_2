export interface UserServiceInterface {
    message: string
    users: UserServiceUserInterface[]
}

export interface UserServiceUserInterface {
    id_user: number
    id_profile: number
    id_cliente?: number | null;
    is_admin: number
    username: string
    name: string
    last_name: string
    sur_name: string
    mail: string
    telephone: string
    picture: string
    password: string
    change_password: any
    online: number
    updated_at: string
    token_pwd?: string
    intento: number
    created_at?: string
    cliente?: ClienteServiceUserInterface
}

export interface ClienteServiceUserInterface {
    id_client: number
    name: string
    id_persona: number
    razon_social: string
    rfc: string
    representative: string
    url: string
    description: string
    agente: string
    contact_cliente: string
    rol_contact: string
    email_contact: string
    tel1_contact: string
    tel2_contact: string
    mobile_contact: string
    id_direccion: number
    id_datos_bancarios: number
    creation_date: string
    last_update: string
    deleted_at: any
}

export interface ShowUserSecurityInterface {
    Id: number,
    Cliente: string | undefined, 
    'Nombre de Usuario': string,
    Nombre: string,
    Apellido: string,
    'E-mail': string,
    Creado: string | undefined,
    'Teléfono': string
}

export interface newUserInterface {
    id_profile: number
    id_cliente: number
    username: string
    name: string
    last_name: string
    sur_name: string
    mail: string
    telephone: string
    picture: string
    password: string
    change_password: any
    online: number
    intento: number
}

export interface UserServiceUserInterface {
    last_name: string;
    telephone: string;
    name: string;
    mail: string;
}
