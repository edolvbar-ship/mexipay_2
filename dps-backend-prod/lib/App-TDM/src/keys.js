const PROD = (process.env.SSL) ? ((process.env.SSL == 'true') ? true : false) : true   // SE PONE EN TRUE PARA AGREGAR EL SSL A LAS CONSULTA 

const database = {
    connectionLimit: 10,
    user: process.env.DB_USER_TDM,
    password: process.env.DB_PASSWORD_TDM,
    host: process.env.DB_HOST_TDM,
    database: process.env.DB_NAME_TDM,
    port: process.env.DB_PORT_TDM,
    timezone: 'local' //process.env.TZ
}

if (PROD) {
    database.ssl = {
        rejectUnauthorized: false
    }
}


module.exports = {
    database
};