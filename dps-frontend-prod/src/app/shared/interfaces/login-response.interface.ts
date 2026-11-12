export interface LoginResponseInterface {
    user: UserToken
    token: string
    license: License[]
}

export interface UserToken {
    id: number
    fullName: string
    name: string
    last_name: string
    mail: string
    is_admin: number
    username: string
    telephone: string
    id_profile: number
    id_cliente: number
    signAt: number
    iat: number
    exp: number
    }

export interface PerfilUser {
    id_profile: number
    profile_name: string
    admin: number
    comments: string
    datos_bancarios: number
    created_at: string
}

export interface License {
    id: number
    id_profile: number
    id_resource: number
    icon: any
    father_resource: any
    resource_name: any
    resource_url: any
    create: number
    edit: number
    delete: number
    select: number
    createdAt: string
    updatedAt: string
    perfil_user: PerfilUser
    resource: any
    child: any
}