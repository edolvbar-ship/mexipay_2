const validator = {};
const { Joi } = require('express-validation')

validator.create = {
  body: Joi.object({
    cliente: Joi.number()
      .required(),
    persona: Joi.string()
      .required(),
    razon_social: Joi.string()
      .required(),
    nombre_comercio: Joi.string()
      .required(),
    url_comercio: Joi.string()
      .required(),
    url_comercio: Joi.string()
      .required(),
    rfc: Joi.string()
      .required(),
    representante: Joi.string()
      .required(),
    agente_comercial: Joi.string()
      .required(),
    descripcion: Joi.string()
      .required(),
    id_esquema: Joi.string()
      .required(),
    numero_afilacion: Joi.number()
      .required(),
    numero_subafiliacion: Joi.string(),
    id_giro: Joi.number()
      .required(),
    id_banco_adq: Joi.number()
      .required(),
    id_red_logica: Joi.number()
      .required(),
    id_procesador: Joi.number()
      .required(),
    id_medio: Joi.string()
      .required(),
    id_perfil_transaccional: Joi.number()
      .required(),
    nombre_contacto: Joi.string()
      .required(),
    rol_contacto: Joi.string()
      .required(),
    email_contacto: Joi.string()
      .required(),
    tel1_contacto: Joi.string(),
    tel2_contacto: Joi.string(),
    celular: Joi.string(),
    activo: Joi.boolean(),
    tasas: Joi.object({
      banco: Joi.object({
        credito: Joi.number().required(),
        debito: Joi.number().required(),
        amex: Joi.number().required(),
      }),
      agregador: Joi.object({
        credito: Joi.number().required(),
        debito: Joi.number().required(),
        amex: Joi.number().required(),
      }),
      comercio: Joi.object({
        credito: Joi.number().required(),
        debito: Joi.number().required(),
        amex: Joi.number().required(),
      }),
    }).required(),
    comisiones: Joi.object({
      credito: Joi.number().required(),
      debito: Joi.number().required(),
      amex: Joi.number().required(),
    }).required(),
    id_url_destino: Joi.number()
      .required(),
    serie_terminal: Joi.boolean()
      .required(),
    transaccion: Joi.object({
      min: Joi.number(),
      max: Joi.number(),
    }),
    monto_min_tx: Joi.boolean()
      .required(),
    link_pago: Joi.object({
      link_afiliacion: Joi.string(),
      id_medio: Joi.string()
    }),
    msi: Joi.array()
      .items({
        type: Joi.number().valid(3,6,9,12,18).required(),
        min_mount:  Joi.number().required(),
        percent:   Joi.number().required(),
      }),
    direccion: Joi.object({
      alcaldia: Joi.string().required(),
      ciudad: Joi.string().required(),
      calle: Joi.string().required(),
      no_exterior: Joi.string().required(),
      no_interior: Joi.string(),
      colonia: Joi.string().required(),
      codigo_postal: Joi.string().required(),
      pais: Joi.string().required(),
    }).required(),
    datos_bancarios: Joi.object({
      banco: Joi.string().required(),
      tarjeta: Joi.string(),
      no_cuenta: Joi.string(),
      clabe: Joi.string().required(),
    }).required()
    
  }),
}
validator.edit = {
  body: Joi.object({
    id_merchant: Joi.number().required(),
    cliente: Joi.number()
      .required(),
    persona: Joi.number()
      .required(),
    razon_social: Joi.string()
      .required(),
    nombre_comercio: Joi.string()
      .required(),
    url_comercio: Joi.string()
      .required(),
    url_comercio: Joi.string()
      .required(),
    rfc: Joi.string()
      .required(),
    representante: Joi.string()
      .required(),
    agente_comercial: Joi.string()
      .required(),
    descripcion: Joi.string()
      .required(),
    id_esquema: Joi.string()
      .required(),
    numero_afilacion: Joi.number()
      .required(),
    numero_subafiliacion: Joi.string(),
    id_giro: Joi.number()
      .required(),
    id_banco_adq: Joi.number()
      .required(),
    id_red_logica: Joi.number()
      .required(),
    id_procesador: Joi.number()
      .required(),
    id_medio: Joi.string()
      .required(),
    id_perfil_transaccional: Joi.number()
      .required(),
    nombre_contacto: Joi.string()
      .required(),
    rol_contacto: Joi.string()
      .required(),
    email_contacto: Joi.string()
      .required(),
    tel1_contacto: Joi.string(),
    tel2_contacto: Joi.string(),
    celular: Joi.string(),
    activo: Joi.boolean(),
    tasas: Joi.object({
      banco: Joi.object({
        credito: Joi.number().required(),
        debito: Joi.number().required(),
        amex: Joi.number().required(),
      }),
      agregador: Joi.object({
        credito: Joi.number().required(),
        debito: Joi.number().required(),
        amex: Joi.number().required(),
      }),
      comercio: Joi.object({
        credito: Joi.number().required(),
        debito: Joi.number().required(),
        amex: Joi.number().required(),
      }),
    }).required(),
    comisiones: Joi.object({
      credito: Joi.number().required(),
      debito: Joi.number().required(),
      amex: Joi.number().required(),
    }).required(),
    id_url_destino: Joi.number()
      .required(),
    serie_terminal: Joi.boolean()
      .required(),
    transaccion: Joi.object({
      min: Joi.number(),
      max: Joi.number(),
    }),
    monto_min_tx: Joi.boolean()
      .required(),
    link_pago: Joi.object({
      link_afiliacion: Joi.string(),
      id_medio: Joi.string()
    }),
    msi: Joi.array()
      .items({
        type: Joi.number().valid(3,6,9,12,18).required(),
        min_mount:  Joi.number().required(),
        percent:   Joi.number().required(),
      }),
    direccion: Joi.object({
      alcaldia: Joi.string().required(),
      ciudad: Joi.string().required(),
      calle: Joi.string().required(),
      no_exterior: Joi.string().required(),
      no_interior: Joi.string(),
      colonia: Joi.string().required(),
      codigo_postal: Joi.string().required(),
      pais: Joi.string().required(),
    }).required(),
    datos_bancarios: Joi.object({
      banco: Joi.string().required(),
      tarjeta: Joi.string(),
      no_cuenta: Joi.string(),
      clabe: Joi.string().required(),
    }).required()
    
  }),
}
validator.delete = {
  body: Joi.object({
    id_merchant: Joi.number().required()
  })
}


module.exports = validator;
