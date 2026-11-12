import { environment } from "@/environments/environment";


export const endpoints = {
    apiBaseUrl: environment.apiUrl,
    apiV01: 'api/v1',
    apiV02: 'api/v2',
    loginUri: 'auth',
    about: 'about',
    merchantUri: 'merchants',
    authReset: '/reset-password',
    authNewPs: '/reset-password-process',
    clients: 'clients',
    cards: 'bines',
    devices: 'terminals',
    users: 'users',
    profiles: 'profiles',
    usersTDM: 'usersTDM', 
    catalogos: 'catalogues',
    movements: 'movements',
    tickets: 'movements/tickets',
    downloadTicket: 'report/getTicket'
}

//TODO: clasificar enpoints, cada servicio debe tener su propio objeto

