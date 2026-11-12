//const db = require('../sequelize/init');
//const helpers = require('./helpers');
//const tka = require('../lib/tka');
//const { v4: uuidv4 } = require('uuid');
//
//
//const authCtrlTkn = {};
//
//authCtrlTkn.isLoggedIn = async (req, res, next) => {
//  if (req.isAuthenticated()) {
//    req.session.perfil = await helpers.getLeftbar(req);
//    return next();
//  }
//  return res.status(403).json();
//};
//
//const getCheckOutTkr = async (afiliationNumber, commerceName = null, tokenAct = null) => {
//  const newCheckOutTkr = await db.merchant.findOne({
//    where: {
//      active: 1,
//      afiliation_number: afiliationNumber,
//      ...(commerceName && { name_merchant: commerceName }),
//      ...(tokenAct && { token_activation: tokenAct }),
//    },
//  });
//  return newCheckOutTkr?.token_activation ?? null;
//};
//
//authCtrlTkn.IsValidTka = async (req, res, next) => {
//    console.log('🔐 VALIDATING TKA AUTHENTICATION');
//
//    const {
//        'commerce-id': afiliacion,
//        'commerce-name': commerceName,
//        'x-time': tms,
//        'x-auth': tka,
//        'x-act': tkact
//    } = req.headers;
//
//    // Validate required headers
//    if (!afiliacion || !tms || (!tka && !tkact)) {
//        console.log('❌ Missing required headers');
//        return res.status(401).json({
//            error: 'Se requiere el nombre del comercio, el tiempo y el token de autenticación o el token de activación'
//        });
//    }
//
//    // Get TKR from database
//    const tkr = await getCheckOutTkr(afiliacion, commerceName, tkact);
//
//    if (!tkr) {
//        console.log('❌ TKR not found for merchant');
//        return res.status(401).json({
//            mensaje: 'Token de activación no válido o comercio no encontrado'
//        });
//    }
//
//    // Validate TKA
//    const isValidTKA = await helpers.validateTKA(tkr, tms, afiliacion, tka);
//
//    if (isValidTKA) {
//        console.log('✅ TKA validation successful');
//        return next();
//    }
//
//    console.log('❌ TKA validation failed');
//    const datos = { afiliacion, commerce_name: commerceName, tms, tka };
//    return res.status(401).json({
//        mensaje: 'Token no valido',
//        datos
//    });
//};
//
//function validateMSI(merchant, { body, txStatus }) {
//  console.log('Valida MSI');
//  try {
//    const msi = JSON.parse(merchant.MSI || '[]');
//    if (Array.isArray(msi) && msi.length > 0) {
//      if (typeof msi[0] === 'object') {
//        console.log('Verifica Promociónes MSI');
//        const selectedMSI = msi.find(plan => parseInt(plan.type) === parseInt(body.chargePlan.months));
//        console.log('Promoción seleccionada', selectedMSI)
//        if (selectedMSI) {
//          if (parseFloat(body.amount) < parseFloat(selectedMSI.min_mount)) {
//            txStatus.error = true;
//            txStatus.text = 'Monto mínimo de MSI no superado.';
//          }
//        }
//        else {
//          txStatus.error = true;
//          txStatus.text = 'Promoción a MSI no valida.';
//        }
//      } else if (typeof msi[0] === 'number' || typeof msi[0] === 'string') {
//        txStatus.error = true;
//        txStatus.text = 'MSI no habilitados al comercio.';
//      }
//    } else {
//      txStatus.error = true;
//      txStatus.text = 'MSI no habilitados al comercio.';
//    }
//  } catch (error) {
//    console.error(error);
//    txStatus.error = true;
//    txStatus.text = 'Error al procesar MSI.';
//  }
//}
//
//
//function validateAmount(merchant, { originalUrl, body, txStatus }) {
//  if (!originalUrl.includes('/postauth')) {
//    const amount = Number.parseFloat(body.amount);
//    const min = Number.parseFloat(merchant.min);
//    const max = Number.parseFloat(merchant.max);
//
//    if ((min && min > amount) || (max && max < amount)) {
//      txStatus.error = true;
//      txStatus.text = 'Monto fuera de rango.';
//    }
//  }
//}
//
//function validateMerchant(merchant, req, res, next) {
//  req.txStatus = {};
//
//  if (merchant.active == '1') {
//    if (merchant.afiliation_number == req.headers['commerce-id']) {
//      req.merchantData = JSON.parse(JSON.stringify(merchant));
//      if (req.txStatus.error) {
//        return res.json({
//          request_id: uuidv4(),
//          request_status: true,
//          http_code: 200,
//          resp_code: req.txStatus.text == 'Monto fuera de rango.' ? "65" :'05',
//          description: req.txStatus.text,
//          id: req.params.referencia,
//          binInformation: {
//            holder_name: req.body.cardInformation.holder_name,
//            last4: req.body.cardInformation.last4,
//            bin: req.body.cardInformation.bin,
//          },
//          emv_tags: "",
//          emvResponseCode: ""
//        });
//      }
//
//      return next();
//    }
//
//    return res.json({ mensaje: 'Afiliación incorrecta' })
//  }
//
//  return res.json({ mensaje: merchant.deleted_at ? 'Comercio no válido ->> isMerchantValid' : 'Comercio inactivo', })
//}
//
//authCtrlTkn.isMerchantValid = async (req, res, next) => {
//    return authCtrlTkn.isMerchantValidWithTKA(req, res, next);
//    // try {
//    //     // Validate required headers
//    //     const name_merchant = req.headers['commerce-name'];
//    //     const afiliation_number = req.headers['commerce-id'];
//    //
//    //     if (!name_merchant || typeof name_merchant !== 'string') {
//    //         return res.status(400).json({
//    //             mensaje: 'El encabezado commerce-name es requerido y debe ser una cadena válida'
//    //         });
//    //     }
//    //
//    //     if (!afiliation_number) {
//    //         return res.status(400).json({
//    //             mensaje: 'El encabezado commerce-id es requerido'
//    //         });
//    //     }
//    //
//    //     // Extract first commerce name if comma-separated
//    //     const merchantName = name_merchant.split(',')[0].trim();
//    //
//    //     // Query merchant with validation
//    //     const merchant = await db.merchant.findOne({
//    //         include: [
//    //             'modo_transac',
//    //             'url_destino',
//    //             'banco_adq',
//    //             'iso_client_dt',
//    //             'datos_direccion',
//    //             'iso_logical_network',
//    //             'isoMcc',
//    //             'esquema_transaccional',
//    //             'procesador'
//    //         ],
//    //         where: {
//    //             name_merchant: merchantName,
//    //             afiliation_number,
//    //             deleted_at: null
//    //         },
//    //     });
//    //
//    //     if (!merchant) {
//    //         return res.status(404).json({ mensaje: 'Comercio no válido -> isMerchantValid' });
//    //     }
//    //
//    //     // Proceed with merchant validation
//    //     validateMerchant(merchant, req, res, next);
//    // } catch (error) {
//    //     console.error('Error in isMerchantValid:', error);
//    //     return res.status(500).json({
//    //         mensaje: 'Error interno al validar el comercio',
//    //         error: error.message
//    //     });
//    // }
//};
//authCtrlTkn.isMerchantValidWithTKA = async (req, res, next) => {
//    try {
//        const {
//            'commerce-id': afiliation_number,
//            'x-time': tms,
//            'x-auth': tka
//        } = req.headers;
//
//        // Always required
//        if (!afiliation_number || !tms || !tka) {
//            return res.status(401).json({
//                mensaje: 'Encabezados de autenticación TKA requeridos'
//            });
//        }
//        // commerce-name is optional → only read it safely
//        const rawMerchantName = req.headers['commerce-name'] || req.headers['Commerce-Name'];
//        // if still nothing → undefined (perfectly fine)
//        const merchants = await db.merchant.findAll({
//            where: {
//                afiliation_number,
//                deleted_at: null,
//                active: 1
//            },
//            attributes: ['id_merchant', 'name_merchant', 'token_activation', 'id_processor'],
//            raw: true // cleaner output
//        });
//
//        if (merchants.length === 0) {
//            return res.status(404).json({ mensaje: 'Comercio no encontrado' });
//        }
//
//        let merchant;
//
//        if (merchants.length > 1) {
//            // Multiple merchants → name is REQUIRED
//            if (!rawMerchantName) {
//                return res.status(400).json({
//                    mensaje: 'Se requiere el nombre del comercio cuando existen múltiples sucursales activas'
//                });
//            }
//
//            const searchedName = rawMerchantName.split(',')[0].trim();
//
//            merchant = merchants.find(m => m.name_merchant === searchedName);
//
//            if (!merchant) {
//                console.log('Multiple merchants but name mismatch:', {
//                    affiliation: afiliation_number,
//                    sent: searchedName,
//                    available: merchants.map(m => m.name_merchant)
//                });
//                return res.status(404).json({ mensaje: 'Comercio no válido para esta afiliación' });
//            }
//        } else {
//            // Single merchant → name is optional and ignored even if sent
//            merchant = merchants[0];
//        }
//
//        console.log('Merchant validated:', {
//            id: merchant.id_merchant,
//            name: merchant.name_merchant,
//            affiliation: afiliation_number
//        });
//
//        // Validate TKA with the resolved merchant's token
//        const isValidTKA = await helpers.validateTKA(
//            merchant.token_activation,
//            tms,
//            afiliation_number,
//            tka
//        );
//
//        if (!isValidTKA) {
//            return res.status(401).json({ mensaje: 'Autenticación TKA fallida' });
//        }
//
//        // Attach resolved merchant and continue
////        validateMerchant(merchant, req, res, next);
// // Set merchantData on req object - PASS THE FULL MERCHANT OBJECT
//        req.merchantData = merchant;
//
//        // Also set these for backward compatibility
//        req.merchant = merchant;
//        req.merchantId = merchant.id_merchant;
//
//        // If you’re 100% sure validateMerchant does nothing else → just next()
//
//        return next();
//    } catch (error) {
//        console.error('Error in isMerchantValidWithTKA:', error);
//        return res.status(500).json({
//            mensaje: 'Error interno al validar el comercio',
//            error: error.message
//        });
//    }
//};
//
//// Helper to debug available merchant names
//async function getAvailableMerchantNames(afiliation_number) {
//    try {
//        const merchants = await db.merchant.findAll({
//            where: {
//                afiliation_number,
//                deleted_at: null
//            },
//            attributes: ['id_merchant', 'name_merchant', 'afiliation_number', 'id_processor']
//        });
//        return merchants.map(m => ({
//            id: m.id_merchant,
//            name: m.name_merchant,
//            processor: m.id_processor
//        }));
//    } catch (error) {
//        return `Error fetching merchants: ${error.message}`;
//    }
//}
//module.exports = authCtrlTkn;
const db = require('../sequelize/init');
const helpers = require('./helpers');
const tka = require('../lib/tka');
const { v4: uuidv4 } = require('uuid');


const authCtrlTkn = {};

/**
 * Verifies that the user has an active session.
 * If authenticated, enriches the session with the user's left sidebar.
 * PCI DSS 4.0: Req 8.1.6 (session management), Req 7.2.1 (role-based menu).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
authCtrlTkn.isLoggedIn = async (req, res, next) => {
  if (req.isAuthenticated()) {
    req.session.perfil = await helpers.getLeftbar(req);
    return next();
  }
  return res.status(403).json();
};

/**
 * Resolves the merchant's token_activation (TKR) used for TKA validation.
 * PCI DSS 4.0: Req 8.3.1 (authentication token), Req 7.1.1 (least privilege).
 * @param {string} afiliationNumber - Merchant affiliation number from header.
 * @param {string|null} [commerceName] - Optional merchant name.
 * @param {string|null} [tokenAct] - Optional activation token.
 * @returns {Promise<string|null>} The merchant token_activation or null.
 */
const getCheckOutTkr = async (afiliationNumber, commerceName = null, tokenAct = null) => {
  const newCheckOutTkr = await db.merchant.findOne({
    where: {
      active: 1,
      afiliation_number: afiliationNumber,
      ...(commerceName && { name_merchant: commerceName }),
      ...(tokenAct && { token_activation: tokenAct }),
    },
  });
  return newCheckOutTkr?.token_activation ?? null;
};

/**
 * Validates the TKA authentication token sent in the request headers.
 * Requires commerce-id, x-time, and either x-auth or x-act.
 * PCI DSS 4.0: Req 8.3.2 (strong authentication), Req 8.3.6 (token validation), Req 10.2.1 (audit failures).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
authCtrlTkn.IsValidTka = async (req, res, next) => {
    console.log('🔐 VALIDATING TKA AUTHENTICATION');

    const {
        'commerce-id': afiliacion,
        'commerce-name': commerceName,
        'x-time': tms,
        'x-auth': tka,
        'x-act': tkact
    } = req.headers;

    // Validate required headers
    if (!afiliacion || !tms || (!tka && !tkact)) {
        console.log('❌ Missing required headers');
        return res.status(401).json({
            error: 'Se requiere el nombre del comercio, el tiempo y el token de autenticación o el token de activación'
        });
    }

    // Get TKR from database
    const tkr = await getCheckOutTkr(afiliacion, commerceName, tkact);

    if (!tkr) {
        console.log('❌ TKR not found for merchant');
        return res.status(401).json({
            mensaje: 'Token de activación no válido o comercio no encontrado'
        });
    }

    // Validate TKA
    const isValidTKA = await helpers.validateTKA(tkr, tms, afiliacion, tka);

    if (isValidTKA) {
        console.log('✅ TKA validation successful');
        return next();
    }

    console.log('❌ TKA validation failed');
    const datos = { afiliacion, commerce_name: commerceName, tms, tka };
    return res.status(401).json({
        mensaje: 'Token no valido',
        datos
    });
};

/**
 * Validates the requested monthly interest-free installment (MSI) plan.
 * Checks that the plan exists for the merchant and that the amount meets the minimum.
 * PCI DSS 4.0: Req 6.4.1 (business logic validation), Req 6.5.2 (input validation).
 * @param {Object} merchant - Merchant configuration object.
 * @param {Object} options - Validation payload.
 * @param {Object} options.body - Transaction body.
 * @param {Object} options.txStatus - Mutable status object for error reporting.
 */
function validateMSI(merchant, { body, txStatus }) {
  console.log('Valida MSI');
  try {
    const msi = JSON.parse(merchant.MSI || '[]');
    if (Array.isArray(msi) && msi.length > 0) {
      if (typeof msi[0] === 'object') {
        console.log('Verifica Promociónes MSI');
        const selectedMSI = msi.find(plan => parseInt(plan.type) === parseInt(body.chargePlan.months));
        console.log('Promoción seleccionada', selectedMSI)
        if (selectedMSI) {
          if (parseFloat(body.amount) < parseFloat(selectedMSI.min_mount)) {
            txStatus.error = true;
            txStatus.text = 'Monto mínimo de MSI no superado.';
          }
        }
        else {
          txStatus.error = true;
          txStatus.text = 'Promoción a MSI no valida.';
        }
      } else if (typeof msi[0] === 'number' || typeof msi[0] === 'string') {
        txStatus.error = true;
        txStatus.text = 'MSI no habilitados al comercio.';
      }
    } else {
      txStatus.error = true;
      txStatus.text = 'MSI no habilitados al comercio.';
    }
  } catch (error) {
    console.error(error);
    txStatus.error = true;
    txStatus.text = 'Error al procesar MSI.';
  }
}


/**
 * Validates that the transaction amount is within the merchant's configured min/max range.
 * Skips validation for /postauth routes.
 * PCI DSS 4.0: Req 6.4.1 (business logic validation), Req 6.5.2 (input validation).
 * @param {Object} merchant - Merchant configuration object.
 * @param {Object} options - Validation payload.
 * @param {string} options.originalUrl - Request URL.
 * @param {Object} options.body - Transaction body.
 * @param {Object} options.txStatus - Mutable status object for error reporting.
 */
function validateAmount(merchant, { originalUrl, body, txStatus }) {
  if (!originalUrl.includes('/postauth')) {
    const amount = Number.parseFloat(body.amount);
    const min = Number.parseFloat(merchant.min);
    const max = Number.parseFloat(merchant.max);

    if ((min && min > amount) || (max && max < amount)) {
      txStatus.error = true;
      txStatus.text = 'Monto fuera de rango.';
    }
  }
}

/**
 * Verifies merchant is active and the affiliation number matches the request header.
 * Attaches the merchant object to req.merchantData and short-circuits on validation errors.
 * PCI DSS 4.0: Req 7.1.1 (access control), Req 7.1.2 (business need), Req 8.2.1 (identify users).
 * @param {Object} merchant - Merchant record from the database.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function validateMerchant(merchant, req, res, next) {
  req.txStatus = {};

  if (merchant.active == '1') {
    if (merchant.afiliation_number == req.headers['commerce-id']) {
      req.merchantData = JSON.parse(JSON.stringify(merchant));
      if (req.txStatus.error) {
        return res.json({
          request_id: uuidv4(),
          request_status: true,
          http_code: 200,
          resp_code: req.txStatus.text == 'Monto fuera de rango.' ? "65" :'05',
          description: req.txStatus.text,
          id: req.params.referencia,
          binInformation: {
            holder_name: req.body.cardInformation.holder_name,
            last4: req.body.cardInformation.last4,
            bin: req.body.cardInformation.bin,
          },
          emv_tags: "",
          emvResponseCode: ""
        });
      }

      return next();
    }

    return res.json({ mensaje: 'Afiliación incorrecta' })
  }

  return res.json({ mensaje: merchant.deleted_at ? 'Comercio no válido ->> isMerchantValid' : 'Comercio inactivo', })
}

/**
 * Entry point for merchant validation middleware.
 * Delegates to isMerchantValidWithTKA.
 * PCI DSS 4.0: Req 8.2.1 (identify users), Req 8.3.2 (authenticate access).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
authCtrlTkn.isMerchantValid = async (req, res, next) => {
    return authCtrlTkn.isMerchantValidWithTKA(req, res, next);
    // try {
    //     // Validate required headers
    //     const name_merchant = req.headers['commerce-name'];
    //     const afiliation_number = req.headers['commerce-id'];
    //
    //     if (!name_merchant || typeof name_merchant !== 'string') {
    //         return res.status(400).json({
    //             mensaje: 'El encabezado commerce-name es requerido y debe ser una cadena válida'
    //         });
    //     }
    //
    //     if (!afiliation_number) {
    //         return res.status(400).json({
    //             mensaje: 'El encabezado commerce-id es requerido'
    //         });
    //     }
    //
    //     // Extract first commerce name if comma-separated
    //     const merchantName = name_merchant.split(',')[0].trim();
    //
    //     // Query merchant with validation
    //     const merchant = await db.merchant.findOne({
    //         include: [
    //             'modo_transac',
    //             'url_destino',
    //             'banco_adq',
    //             'iso_client_dt',
    //             'datos_direccion',
    //             'iso_logical_network',
    //             'isoMcc',
    //             'esquema_transaccional',
    //             'procesador'
    //         ],
    //         where: {
    //             name_merchant: merchantName,
    //             afiliation_number,
    //             deleted_at: null
    //         },
    //     });
    //
    //     if (!merchant) {
    //         return res.status(404).json({ mensaje: 'Comercio no válido -> isMerchantValid' });
    //     }
    //
    //     // Proceed with merchant validation
    //     validateMerchant(merchant, req, res, next);
    // } catch (error) {
    //     console.error('Error in isMerchantValid:', error);
    //     return res.status(500).json({
    //         mensaje: 'Error interno al validar el comercio',
    //         error: error.message
    //     });
    // }
};
/**
 * Validates merchant identity and TKA authentication token.
 * Looks up the merchant by affiliation number and cleaned commerce name, then validates the TKA.
 * PCI DSS 4.0: Req 8.3.1 / 8.3.2 / 8.3.6 (authentication), Req 7.1.1 / 7.1.2 (authorization).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
authCtrlTkn.isMerchantValidWithTKA = async (req, res, next) => {
    try {
        // First validate TKA headers
        const {
            'commerce-id': afiliation_number,
            'commerce-name': name_merchant,
            'x-time': tms,
            'x-auth': tka
        } = req.headers;

        if (!tka || !tms || !name_merchant || !afiliation_number) {
          return res.status(401).json({
            mensaje: "Encabezados de autenticación TKA requeridos",
          });
        }

        // Extract merchant name (remove location info after comma)
        const merchantName = name_merchant.split(',')[0].trim();

        console.log('🔍 Merchant lookup:', {
            raw_name: name_merchant,
            searching_for: merchantName,
            affiliation: afiliation_number
        });

        const merchant = await db.merchant.findOne({
            include: [/* your includes */],
            where: {
                name_merchant: merchantName, // Exact match with cleaned name
                afiliation_number,
                deleted_at: null
            },
        });

        if (!merchant) {
            console.log('❌ Merchant not found:', {
                searched_name: merchantName,
                affiliation: afiliation_number,
                available_names: await getAvailableMerchantNames(afiliation_number)
            });
            return res.status(404).json({ mensaje: 'Comercio no válido' });
        }

        console.log('✅ Merchant found:', {
            id: merchant.id_merchant,
            name: merchant.name_merchant,
            processor: merchant.id_processor
        });

        // Validate TKA using merchant's token_activation
        const isValidTKA = await helpers.validateTKA(
            merchant.token_activation,
            tms,
            afiliation_number,
            tka
        );

        if (!isValidTKA) {
            return res.status(401).json({ mensaje: 'Autenticación TKA fallida' });
        }

        // Proceed with merchant validation
        validateMerchant(merchant, req, res, next);

    } catch (error) {
        console.error('Error in isMerchantValidWithTKA:', error);
        return res.status(500).json({
            mensaje: 'Error interno al validar el comercio',
            error: error.message
        });
    }
};

/**
 * Helper that returns merchant names and processors for a given affiliation number.
 * Used primarily for debugging merchant mismatch errors.
 * @param {string} afiliation_number
 * @returns {Promise<Array<{id,name,processor}>>}
 */
async function getAvailableMerchantNames(afiliation_number) {
    try {
        const merchants = await db.merchant.findAll({
            where: {
                afiliation_number,
                deleted_at: null
            },
            attributes: ['id_merchant', 'name_merchant', 'afiliation_number', 'id_processor']
        });
        return merchants.map(m => ({
            id: m.id_merchant,
            name: m.name_merchant,
            processor: m.id_processor
        }));
    } catch (error) {
        return `Error fetching merchants: ${error.message}`;
    }
}
module.exports = authCtrlTkn;
