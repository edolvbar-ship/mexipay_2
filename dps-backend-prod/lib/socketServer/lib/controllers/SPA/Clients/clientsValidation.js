const validator = {};
const { Joi } = require('express-validation')

// CREAR CLIENTE
validator.createClientValidation = {
  body: Joi.object({
    name: Joi.string()
      .required(),
    id_persona: Joi.number()
      .required()
  }),
}

validator.updateClientValidation = {
  body: Joi.object({
    id: Joi.number()
      .required(),
    name: Joi.string()
      .required()
  }),
}

validator.deleteClientValidation = {
  body: Joi.object({
    id: Joi.number()
      .required()
  }),
}


module.exports = validator;
