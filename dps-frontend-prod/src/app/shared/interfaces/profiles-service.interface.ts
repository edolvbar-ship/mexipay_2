export interface ProfilesServiceInterface {
    status: string
    data: DataProfilesServiceInterface[]
    message: string
}

export interface DataProfilesServiceInterface {
    id_profile: number
    profile_name: string 
    admin: number
    comments: string
    datos_bancarios: number
    created_at?: string
    deleted_at: any
    last_update: any
}

export interface ShowProfilesInterfaces {
    Id: number,
    Nombre: string,
    Comentarios: string,
    Creado: string | null
}