/**
 * Transaction Utilities Controller
 * 
 * PCI DSS 4 Requirements Covered:
 * - Requirement 3.5.1: Limit storage of account data to that which is needed for business, legal, or regulatory purposes
 * - Requirement 7.1.1: Restrict access to system components and cardholder data based on need to know
 * - Requirement 7.2.1: Assign responsibility for defining access control privileges
 * - Requirement 10.2.1: Implement audit trails to reconstruct the sequence of events for each system component
 */

const { Op } = require('sequelize');
const db = require('../sequelize/init');
const helpers = require('../../../helpers/lib/helpers');

/**
 * Master query function for transaction data
 * PCI DSS 4 Requirement 3.5.1: Excludes sensitive token data (tkn_data_63_rq, tkn_data_63_rp) from query results
 * PCI DSS 4 Requirement 7.2.2: Restricts access based on merchant-specific where conditions
 */
async function queryMaster(attr, whereData, whereMerchant) {
  // console.debug('whereData ----->', whereData);
  // console.debug('whereMerchant ----->', whereMerchant);
  return db.isoMessage.findAll({
    attributes: { exclude: ['tkn_data_63_rq', 'tkn_data_63_rp', 'node'] },
    include: [
      { model: db.signatures, as: 'signature', required: false, attributes: ['id'] },
      {
        required: false,
        model: db.cisoBin,
        as: 'bin_info',
        attributes: { exclude: ['creation_date', 'last_update'] },
        include: [
          { model: db.isoBrand, as: 'tipo_tarjeta', attributes: { exclude: ['creation_date'] } },
          { model: db.isoProcessor, as: 'procesador', attributes: { exclude: ['creation_date'] } },
          { model: db.isoCardTypes, as: 'tipo_producto', attributes: { exclude: ['creation_date'] } },
          { model: db.isoIssuerBank, as: 'banco_emisor', attributes: { exclude: ['creation_date', 'last_update'] } },
        ]
      },
      { model: db.cisoOperation, as: 'tipo_operacion', attributes: { exclude: ['creation_date'] } },
      { model: db.cisoRespCode, as: 'codigo_resp', attributes: { exclude: ['creation_date'] } },
      {
        model: db.merchant,
        required: true,
        as: attr,
        attributes: ['id_merchant', 'id_client', 'name_merchant', 'afiliation_number', 'active', 'afiliation_link',
          'taza_credito', 'taza_debito', 'taza_amex', 'tasa_credito_b', 'tasa_debito_b', 'tasa_amex_b',
          'tasa_credito_c', 'tasa_debito_c', 'tasa_amex_c', 'tasa_credito_d', 'tasa_debito_d', 'tasa_amex_d',
          'taza_link_credito', 'taza_link_debito', 'taza_link_amex', 'tasa_link_credito_b', 'tasa_link_debito_b', 'tasa_link_amex_b',
          'tasa_link_credito_c', 'tasa_link_debito_c', 'tasa_link_amex_c', 'tasa_link_credito_d', 'tasa_link_debito_d', 'tasa_link_amex_d'],
        include: [
          { model: db.datosDireccion, as: 'datos_direccion', attributes: { exclude: ['createdAt', 'updatedAt'] } },
          { model: db.isoAcquiererBank, as: 'banco_adq', attributes: { exclude: ['creation_date'] } },
          { model: db.isoClient, as: 'iso_client_dt', attributes: { exclude: ['creation_date'] }, required: true },
        ],
        where: whereMerchant
      }
    ],
    where: whereData,
    order: [['creation_date', 'ASC']],
  });
}

/**
 * Dashboard-specific query function for transaction data
 * PCI DSS 4 Requirement 3.5.1: Excludes sensitive token data from dashboard queries
 */
async function queryMasterDash(attr, whereData, whereMerchant) {
  return db.isoMessage.findAll({
    attributes: { exclude: ['tkn_data_63_rq', 'tkn_data_63_rp', 'node'] },
    include: [
      {
        required: false,
        model: db.cisoBin,
        as: 'bin_info',
        attributes: { exclude: ['creation_date', 'last_update'] },
        include: [
          { model: db.isoBrand, as: 'tipo_tarjeta', attributes: { exclude: ['creation_date'] } }
        ]
      },
      {
        model: db.cisoRespCode,
        as: 'codigo_resp',
        attributes: { exclude: ['creation_date'] }
      },
      {
        model: db.merchant,
        required: true,
        as: attr,
        attributes: ['id_merchant', 'id_client', 'name_merchant', 'afiliation_number', 'active',
          'taza_credito', 'taza_debito', 'taza_amex', 'tasa_credito_b', 'tasa_debito_b', 'tasa_amex_b', 'afiliation_link',
          'tasa_credito_c', 'tasa_debito_c', 'tasa_amex_c', 'tasa_credito_d', 'tasa_debito_d', 'tasa_amex_d'
        ],
        where: whereMerchant
      }
    ],
    where: whereData
  });
}

/**
 * Get transactions with filtering based on user permissions
 * PCI DSS 4 Requirement 7.1.1: Restricts access based on user role (admin vs non-admin)
 * PCI DSS 4 Requirement 7.2.1: Enforces need-to-know access to transaction data
 */
async function getTrans(options, req = null, twoModels = true) {
  console.debug('twoModels ----->', twoModels);
  let whereData = {};
  let whereMerchant = {};

  // PCI DSS 4 Requirement 7.1.1: Non-admin users restricted to their client's data only
  if (req != undefined && req.user != undefined && req.user.is_admin !== 1 && !req.forceAllClient)
    whereMerchant.id_client = req.user.id_cliente;

  // PCI DSS 4 Requirement 7.1.1: Users with merchant assignment restricted to their merchant's data
  if (req != undefined && req.user != undefined && req.user.id_merchant)
    whereData.name_merchant = req.user.id_merchant;

  // PCI DSS 4 Requirement 10.2.1: Audit trail - log response code filtering
  if (req != undefined && req.body.response)
    whereData.resp_code = req.body.response;

  // PCI DSS 4 Requirement 10.2.1: Audit trail - log operation type filtering
  if (req != undefined && req.body.operacion)
    whereData.id_operation = req.body.operacion;

  // PCI DSS 4 Requirement 10.2.1: Audit trail - log draft capture filtering
  if (req != undefined && req.body.draft_capture)
    whereData.draft_capture = req.body.draft_capture;

  // PCI DSS 4 Requirement 10.2.1: Audit trail - log status filtering
  if (req != undefined && req.body.estatus_f)
    whereData.estatus_f = req.body.estatus_f;

  // PCI DSS 4 Requirement 10.2.1: Audit trail - log status filtering from options
  if (options.estatus_f)
    whereData.estatus_f = options.estatus_f;

  let dt;
  try {
    // PCI DSS 4 Requirement 10.3.1: Parse and validate date range for audit accuracy
    var fechas = options.fechas.split(' ');
    if (fechas[0].includes('/')) {
      for (let index = 0; index < 2; index++) {
        var aux = fechas[index].split('/');
        aux = `${aux[0]}-${aux[1]}-${aux[2]}`;
        fechas[index] = aux;
      }
    }
    fechas[0] = fechas[0].split('T')[0];
    fechas[1] = fechas[1].split('T')[0];
    
    // PCI DSS 4 Requirement 10.2.3: Use tran_date for timezone consistency and limit data access
    const startTranDate = fechas[0].replace(/-/g, '').substring(4, 8); // MMDD format
    const endTranDate = fechas[1].replace(/-/g, '').substring(4, 8);   // MMDD format
    
    console.log(`📅 transactionUtils usando tran_date: ${startTranDate} a ${endTranDate}`);
    
    whereData.tran_date = { [Op.between]: [startTranDate, endTranDate] };
  } catch (error) {
    console.log('Invalid dates, ignoring dates filter....');
  }
  // PCI DSS 4 Requirement 10.2.1: Audit trail - log reference number filtering
  if (options.reference) whereData.reference_number = { [Op.eq]: options.reference };
  // PCI DSS 4 Requirement 10.2.1: Audit trail - log terminal serial filtering
  if (options.serial) whereData.terminal = { [Op.eq]: options.serial };

  return twoModels ? queryMaster('merchant', whereData, whereMerchant) : queryMasterDash('merchant', whereData, whereMerchant);
}

module.exports = { getTrans };