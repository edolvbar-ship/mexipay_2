const validator = {};
const { Joi } = require('express-validation')

validator.liquidation = {
  body: Joi.object({
    fechas: Joi.string().required()
  }),
}


module.exports = validator;
