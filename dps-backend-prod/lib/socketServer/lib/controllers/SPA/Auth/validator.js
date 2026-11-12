// File: /Users/andresgutierrez/Companies/Programmer City/Clients/Isela Vazquez - Proyecto Construccion de APIs/SourceCode/UltimateCode/migration/gw-backend/lib/socketServer/lib/controllers/SPA/Auth/validator.js
const validator = {};
const { Joi } = require('express-validation')

// CREAR CLIENTE
validator.login = {
    body: Joi.object({
        username: Joi.string()
            .required(),
        password: Joi.string()
            .required()
    }),
}

validator.resetPassword = {
    body: Joi.object({
        username: Joi.string()
            .required(),
        type_app: Joi.number()
            .optional()
    }),
}

validator.resetPasswordProcess = {
    body: Joi.object({
        tkn: Joi.string()
            .required(),
        type: Joi.number()
            .required(),
        password: Joi.string()
            .required()
    }),
}


module.exports = validator;