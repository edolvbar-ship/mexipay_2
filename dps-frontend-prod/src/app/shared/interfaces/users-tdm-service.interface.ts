export interface UsersTDMServiceInterface {
    message: string
    users: DataUsersTDMServiceInterface[]
}

export interface DataUsersTDMServiceInterface {
  iduser: any;
  first_name: string;
  last_name: string;
  last_name2: string;
  email: string;
  last_pwd_update: string;
  create_date: string;
  last_update: string;
  token_pwd: string | null;
  estado: string;
  password?: string;   // Hacer opcional
  active?: boolean;    // Hacer opcional
}


export interface CreateNewTDMOnterface {
  apellido: string,
  apellido_2: string | null,
  email: string,
  estado: boolean,
  name: string, 
  password: string
}

export interface ShowTDMDataInterface {
  Id: string | number
  Nombre: string
  "Apellido Paterno": string
  "Apellido Materno": string
  "E-mail": string
  Estado: string
  Creado: string
}