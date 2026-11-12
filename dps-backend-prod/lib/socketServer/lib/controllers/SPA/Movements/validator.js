const validator = {};
const { Joi } = require('express-validation')

validator.movements = {
  body: Joi.object({
    id: Joi.number()
        .integer(),
    page: Joi.number()
        .integer()
        .min(1)
        .required(),
    limit: Joi.number()
        .integer()
        .min(1)
        .required(),
    start_date: Joi.date()
        .iso(),
    end_date: Joi.date()
        .iso(),
    order: Joi.string()
        .valid('asc', 'desc'),
    id_merchant: Joi.number()
    .integer()
    .min(1)
  }),
}


module.exports = validator;