const validator = {};
const { Joi } = require('express-validation')

validator.createLinkDto = {
  body: Joi.object({
    id_comercio: Joi.string()
      .required(),
    concepto: Joi.string()
              .min(1)
              .required(),
    monto: Joi.number()
    .required(),
    fecha: Joi.object({
      year: Joi.string()
      .pattern(/^\d{4}$/)
      .message({
        "string.pattern.base": "El campo year debe tener una longitud de 4 caracteres numericos."
      })
      .required(),
      month: Joi.string().required()
      .pattern(/0[1-9]|1[0-2]/)
      .message({
        "string.pattern.base": "El campo month debe tener una longitud de 2 caracteres numericos entre el 01 y el 12."
      }),
      day: Joi.string().required()
      .pattern(/(0[1-9]|[12]\d|3[01])/)
      .message({
        "string.pattern.base": "El valor ingresado en el campo day no es valido."
      }),
    })
  }),
}

validator.getLinks = {
  body: Joi.object({
    id: Joi.number(),
    page: Joi.number()
          .min(1),
    limit: Joi.number()
         .min(1),
  })
}


module.exports = validator;
