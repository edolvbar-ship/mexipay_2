export interface AuthResetData {
    EMAIL: string;
    type: string;
}

export interface AuthResetResponse {
    error: boolean;
    response: string;
    data: AuthResetData;
}

export interface AuthCreateNewPass {
    tkn: string
    type: string
    password: string
}

export interface AuthCreateNewPassResponse {
    error: boolean
    message: string
}