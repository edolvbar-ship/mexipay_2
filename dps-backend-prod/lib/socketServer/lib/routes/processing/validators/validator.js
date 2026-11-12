/**
 * @file Processing request validators.
 * Defines Joi validation schemas for transaction processing endpoints.
 * PCI DSS 4.0: Req 11.3.1 (input validation), Req 4.2.1 (secure request handling).
 */
const validator = {};
const { Joi } = require('express-validation')

/** Charge request validation schema. */
validator.charge = {
  body: Joi.object({
    isoType: Joi.string().required(),
  })
}

module.exports = validator;