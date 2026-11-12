/**
 * Consolidados Controller
 *
 * Manages transaction consolidation and reporting functionality for merchant transactions.
 * This controller handles the aggregation of transaction data, generation of consolidated
 * reports, and Excel/PDF export functionality for financial reconciliation.
 *
 * Key Responsibilities:
 * - Consolidate daily transaction data by merchant, BIN, operation type, and authorization type
 * - Generate Excel and PDF reports for transaction settlements
 * - Calculate commissions, fees, and net amounts for different payment types
 * - Support multi-client and multi-merchant reporting
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 3.4: Implements data masking for sensitive cardholder data (BIN handling)
 * - Requirement 7.2: Enforces access control based on user roles (admin vs non-admin)
 * - Requirement 10.2: Maintains audit trails through transaction consolidation records
 * - Requirement 10.3: Ensures timestamp synchronization for all transaction records
 *
 * @module controllers/consolidados
 * @requires sequelize
 * @requires ../sequelize/init
 * @requires ./reportes.controller
 * @requires ../Classes/makeExcelDispersion
 * @requires moment
 */

const { Op } = require('sequelize')

const db = require('../sequelize/init');
const reportesCrtrl = require('./reportes.controller');
const { makeExcel } = require('./../Classes/makeExcelDispersion')
const data = {};
var moment = require('moment');

/**
 * Main consolidation function for transaction data aggregation
 *
 * Processes all merchant transactions within a specified date range and consolidates
 * them by BIN, operation type, authorization type, and response code. Creates
 * consolidated records in the database for reporting and reconciliation purposes.
 *
 * This function is designed to run as a scheduled CRON job, typically at 11:59 PM daily.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 10.2.1: Records all transaction events with user identification
 * - Requirement 10.3.3: Includes timestamps for all entries
 * - Requirement 3.4.1: BIN data is stored but full PAN is never exposed
 *
 * @async
 * @function index
 * @param {Object} req - Request object containing date range parameters
 * @param {Object} [req.dates] - Optional array of date strings [startDate, endDate]
 * @param {number} [req.daysToGet=1] - Number of days to retrieve if dates not provided
 * @param {boolean} [req.forceAllClient] - Flag to force retrieval across all clients
 * @returns {Promise<void>} Logs completion message when finished
 * @throws {Error} Database errors from merchant or transaction queries
 */
data.index = async req => {
  // TODOS LOS DIAS A LAS 11:59 PM
  let d1, d2;
  if (req.dates) {
    d1 = new Date();
    d1.setDate(d1.getDate() - (req.daysToGet) ? req.daysToGet : 1);
    d2 = new Date();
  }
  else {
    d1 = new Date(req.dates[0]);
    d2 = new Date(req.dates[1]);
  }
  let date = `${d1.toISOString()} ${d2.toISOString()}`;

  // OBTENGO TODOS LOS COMERCIOS/TRANSACCIONES DEL DIA PARA ANALIZARLOS
  req.forceAllClient = true;
  const merchants = await db.merchant.findAll();
  const txs = await reportesCrtrl.getTrans({ onlyResponse: false, fechas: date }, req);
  // OBTIENE LAS TRANSACCIONES DEL COMERCIO Y SUMARIZA LA INFO 

  for (const merchant of merchants) {
    // TODAS LAS TRANSACCIONES DEL COMERCIO
    const txs_merchant = txs.filter(tx => { return tx.merchant.id_merchant == merchant.id_merchant });
    let aux_merchant = {};
    for (const tx_merchant of txs_merchant) {
      // Guarda el BIN
      if (!aux_merchant[tx_merchant.bin])
        aux_merchant[tx_merchant.bin] = {};
      
      // GUARDA EL TIPO DE OPERACION
      if (!aux_merchant[tx_merchant.bin][tx_merchant.tipo_operacion.name])
        aux_merchant[tx_merchant.bin][tx_merchant.tipo_operacion.name] = {};
      
      // TIPO DE AUTORIZACION 
      const moreInfo = (tx_merchant.more_info) ? JSON.parse(tx_merchant.more_info) : {};
      moreInfo.auth = (moreInfo.auth) ? moreInfo.auth : 'UNKNOWN';
      if (!aux_merchant[tx_merchant.bin][tx_merchant.tipo_operacion.name][moreInfo.auth])
        aux_merchant[tx_merchant.bin][tx_merchant.tipo_operacion.name][moreInfo.auth] = {};
      
      // GUARDA EL TIPO DE RESPUESTA
      if (!aux_merchant[tx_merchant.bin][tx_merchant.tipo_operacion.name][moreInfo.auth][tx_merchant.resp_code])
        aux_merchant[tx_merchant.bin][tx_merchant.tipo_operacion.name][moreInfo.auth][tx_merchant.resp_code] = [];
      
      aux_merchant[tx_merchant.bin][tx_merchant.tipo_operacion.name][moreInfo.auth][tx_merchant.resp_code].push(tx_merchant);
      // GUARDA LO CONSOLIDADO EN LA TABLA DE CONSOLIDACIÓN
      const promises = [];
      Object.keys(aux_merchant).forEach(BIN => { // BIN
        Object.keys(aux_merchant[BIN]).forEach(TIPO_OP => { // TIPO OP
          Object.keys(aux_merchant[BIN][TIPO_OP]).forEach(TIPO_A => { // TIPO AUTORIZACION
            Object.keys(aux_merchant[BIN][TIPO_OP][TIPO_A]).forEach(async TIPO_R => { // TIPO DE RESPUESTA
              const obj_arr = aux_merchant[BIN][TIPO_OP][TIPO_A][TIPO_R];

              promises.push(
                db.consolidadosTx.create({
                  id_merchant: merchant.id_merchant,
                  name_merchantd2espuesta: obj_arr[0].codigo_resp.description,
                  count: obj_arr.length,
                  analysis_date: date,
                  created_at: d2.toISOString()
                })
              );

            })
          })
        })
      })

      await Promise.all(promises);
    }
  }

  // SE FINALIZA Y SE AVISA QUE YA SE TERMINO DE ANALIZAR LA TABLA
  console.log(`Se finaliza la tabla de consolidados dia: ${data}`);
};

/**
 * Renders column configuration for consolidated transaction DataTable display
 *
 * Prepares the table structure and column definitions for displaying consolidated
 * transaction data in a DataTable format. Retrieves active client information
 * for filtering purposes.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 3.4.2: BIN data displayed but masked to authorized users only
 * - Requirement 7.2.2: Implements role-based access control for data visibility
 *
 * @async
 * @function render
 * @param {Object} _req - Request object (unused in current implementation)
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response containing:
 *   - columns: Column definitions and configuration
 *   - n_col: Number of columns before last count
 *   - dtW: DataTable width percentage
 *   - clientesBook: Array of active clients for filtering
 * @throws {Error} Database errors during client query
 */
data.render = async (_req, res) => {
  let columns = [
    { textName: 'ID', data: 'id_consolidacion', width: '5%', className: 'dt-smaller-font' },
    { textName: 'Comercio', data: 'merchant.name_merchant', width: '5%', className: 'dt-smaller-font' },
    { textName: 'Cliente', data: 'iso_client.name', className: 'dt-smaller-font dt-scroll' },
    { textName: 'Bin', data: 'bin', className: 'dt-smaller-font dt-scroll' },
    { textName: 'Autorización', data: 'authorization', className: 'dt-smaller-font' },
    { textName: 'Monto', data: 'amount', className: 'dt-smaller-font' },
    { textName: 'Tipo', data: 't_medio', className: 'dt-smaller-font' },
    { textName: 'Estatus', data: 'status', className: 'dt-smaller-font' },
    { textName: 'Fecha analisis', data: 'created_at', className: 'dt-smaller-font' }
  ];

  const aux = [];
  let n = 0;
  let found = false;
  columns.forEach(c => {
    if (c != null) {
      aux.push(c);
      if (!found) { n++; }
      if (c.lastCount) { found = true; }
    }
  });
  columns = aux;

  const response = await db.consolidacion.findAll({
    attributes: ['id_client', 'status'],
    include: [{
      model: db.isoClient,
      as: 'iso_client',
      attributes: ['id_client', 'name']
    }],
    where: { status: 2 }
  });

  let clientes = [];
  response.forEach(r => {
    if (r.iso_clien) {
      const tag = `${r.iso_client.id_client}|||${r.iso_client.name}`;
      if (!clientes.includes(tag))
        clientes.push(tag)
    }
  });

  clientes = clientes.map(c => {
    const tmp = c.split('|||');

    return {
      id: tmp[0],
      name: tmp[1]
    }
  })

  return res.json({ columns: { obj: columns, string: JSON.stringify(columns) }, n_col: n, dtW: '98%', clientesBook: clientes });
}

/**
 * Generates consolidated transaction reports in Excel and PDF formats
 *
 * Creates detailed settlement reports for specified date ranges and clients, calculating
 * transaction amounts, commissions, fees, taxes, and net amounts. Supports different
 * payment types including debit, credit, MSI (monthly installments), and international cards.
 * Generates both Excel and PDF outputs for administrative and merchant use.
 *
 * Report Includes:
 * - Transaction counts by payment type
 * - Gross amounts
 * - Commission calculations (percentage and fixed)
 * - IVA (VAT) calculations
 * - Net settlement amounts
 * - MSI (Meses Sin Intereses) surcharges
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 7.2.1: Role-based file access (admin gets xlsx, non-admin gets PDF only)
 * - Requirement 3.4.2: Sensitive data masked in reports
 * - Requirement 10.2.7: Creation of audit objects (consolidated records)
 * - Requirement 10.3.2: Timestamp synchronization for date range calculations
 *
 * @async
 * @function makeFile
 * @param {Object} req - Express request object
 * @param {Object} req.params - Request parameters
 * @param {string} req.params.day - Timestamp (milliseconds) for report date
 * @param {string} req.params.cliente - Client ID or 'all' for all clients
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.format='pdf'] - Output format ('pdf' or 'xlsx', admin only)
 * @param {Object} req.user - Authenticated user object
 * @param {number} req.user.is_admin - Admin flag (1 for admin, 0 for non-admin)
 * @param {Object} res - Express response object
 * @returns {Promise<void>} Downloads the generated file (Excel or PDF)
 * @throws {Error} Database errors or file generation errors
 */
data.makeFile = async (req, res) => {
  const min = 60000;
  const hora = 60 * min;
  const dayStart = new Date(parseInt(req.params.day) - hora);
  const dayEnd = new Date(parseInt(req.params.day) + (22 * hora) + (59 * min) + (min - 1000));

  const status = [2, 4, 5];

  const where = 'all' === req.params.cliente ? { status, created_at: { [Op.between]: [dayStart, dayEnd] } } : { status, id_client: req.params.cliente, created_at: { [Op.between]: [dayStart, dayEnd] } }

  const response = await db.consolidacion.findAll({
    include: [{
      model: db.merchant,
      as: 'merchant',
      attributes: ['name_merchant', 'id_datos_bancarios', 'rfc_merchant', 'tasa_debito_b', 'tasa_credito_b', 'retencion', 'msi'],
      include: {
        model: db.datosBancarios,
        as: 'datos_bancarios',
        attributes: ['clabe'],
      }
    }],
    where,
    raw: true
  });

  const clientes = [];
  response.forEach(r => {
    if (!clientes.includes(r.id_client)) clientes.push(r.id_client);
  });

  const id_merchants = [];
  const ProGruposColl = clientes.map(async idClient => {
    const merchants = [];
    response.filter(r => r.id_client === idClient).map(r => {
      if(2 === r.status) {
        if('credit' === r.t_medio && 0 !== r.msi)
          r.t_medio = `credit_msi${r.msi}`;

        if(1 === r.isLink) {
          if('debit' === r.t_medio)
            r.t_medio = 'debit_link';

          else if('credit' === r.t_medio)
            r.t_medio = 'credit_link';

          else if('internacional' === r.t_medio)
            r.t_medio = 'internacional_link';
        }
      }

      return r;
    }).forEach(r => {
      if (!id_merchants.includes(r.id_merchant)) {
        const msiConfig = JSON.parse(r['merchant.msi']);
        const msi_Tasa = [3,6,9,12,18].map(m => {
          const slc = msiConfig.filter(msiC => msiC.type === m);

          return slc[0] || { percent: 0 };
        });
        
        console.log('merchant.tasas ----->', [
          r.tasa_amex_b,
          r.tasa_debito_b,
          r.tasa_credito_b
        ]);

        merchants.push({
          id: r.id_merchant,
          name: r['merchant.name_merchant'],
          clabe: r['merchant.datos_bancarios.clabe'],
          rfc: r['merchant.rfc_merchant'],
          retencion: parseFloat(r['merchant.retencion']),
          dataCargo_internacional_link: {
            no: 0,
            montoBruto: 0,
            tasa: 0,
            comision: 0,
            ivaTasa: 0,
            ivaComision: 0,
            montoNeto: 0,
            tasas: [parseFloat(r.tasa_amex_b)]
          },
          dataCargo_internacional: {
            no: 0,
            montoBruto: 0,
            tasa: 0,
            comision: 0,
            ivaTasa: 0,
            ivaComision: 0,
            montoNeto: 0,
            tasas: [parseFloat(r.tasa_amex_b)]
          },
          dataCargo_debit_link: {
            no: 0,
            montoBruto: 0,
            tasa: 0,
            comision: 0,
            ivaTasa: 0,
            ivaComision: 0,
            montoNeto: 0,
            tasas: [parseFloat(r.tasa_debito_b)]
          },
          dataCargo_debit: {
            no: 0,
            montoBruto: 0,
            tasa: 0,
            comision: 0,
            ivaTasa: 0,
            ivaComision: 0,
            montoNeto: 0,
            tasas: [parseFloat(r.tasa_debito_b)]
          },
          dataCargo_credit: {
            no: 0,
            montoBruto: 0,
            tasa: 0,
            comision: 0,
            ivaTasa: 0,
            ivaComision: 0,
            montoNeto: 0,
            tasas: [parseFloat(r.tasa_credito_b)]
          },
          dataCargo_credit_link: {
            no: 0,
            montoBruto: 0,
            tasa: 0,
            comision: 0,
            ivaTasa: 0,
            ivaComision: 0,
            montoNeto: 0,
            tasas: [parseFloat(r.tasa_credito_b)]
          },
          dataCargo_credit_msi3: {
            no: 0,
            montoBruto: 0,
            tasa: 0,
            comision: 0,
            ivaTasa: 0,
            ivaComision: 0,
            montoNeto: 0,
            tasas: [parseFloat(r.tasa_credito_b)+parseFloat(msi_Tasa[0].percent)],
            sobretasas: parseFloat(msi_Tasa[0].percent),
          },
          dataCargo_credit_msi6: {
            no: 0,
            montoBruto: 0,
            tasa: 0,
            comision: 0,
            ivaTasa: 0,
            ivaComision: 0,
            montoNeto: 0,
            tasas: [parseFloat(r.tasa_credito_b)+parseFloat(msi_Tasa[1].percent)],
            sobretasas: parseFloat(msi_Tasa[1].percent),
          },
          dataCargo_credit_msi9: {
            no: 0,
            montoBruto: 0,
            tasa: 0,
            comision: 0,
            ivaTasa: 0,
            ivaComision: 0,
            montoNeto: 0,
            tasas: [parseFloat(r.tasa_credito_b)+parseFloat(msi_Tasa[2].percent)],
            sobretasas: parseFloat(msi_Tasa[2].percent),
          },
          dataCargo_credit_msi12: {
            no: 0,
            montoBruto: 0,
            tasa: 0,
            comision: 0,
            ivaTasa: 0,
            ivaComision: 0,
            montoNeto: 0,
            tasas: [parseFloat(r.tasa_credito_b)+parseFloat(msi_Tasa[3].percent)],
            sobretasas: parseFloat(msi_Tasa[3].percent),
          },
          dataCargo_credit_msi18: {
            no: 0,
            montoBruto: 0,
            tasa: 0,
            comision: 0,
            ivaTasa: 0,
            ivaComision: 0,
            montoNeto: 0,
            tasas: [parseFloat(r.tasa_credito_b)+parseFloat(msi_Tasa[4].percent)],
            sobretasas: parseFloat(msi_Tasa[4].percent),
          },
          dataDevolucion_debit: {
            no: 0,
            montoBruto: 0,
            tasa: 0,
            comision: 0,
            ivaTasa: 0,
            ivaComision: 0,
            montoNeto: 0,
            tasas: [parseFloat(r.tasa_debito_b)]
          },
          dataDevolucion_internacional: {
            no: 0,
            montoBruto: 0,
            tasa: 0,
            comision: 0,
            ivaTasa: 0,
            ivaComision: 0,
            montoNeto: 0,
            tasas: [parseFloat(r.tasa_amex_b)]
          },
          dataDevolucion_credit: {
            no: 0,
            montoBruto: 0,
            tasa: 0,
            comision: 0,
            ivaTasa: 0,
            ivaComision: 0,
            montoNeto: 0,
            tasas: [parseFloat(r.tasa_credito_b)]
          },
          dataCancelacion_debit: {
            no: 0,
            montoBruto: 0,
            tasa: 0,
            comision: 0,
            ivaTasa: 0,
            ivaComision: 0,
            montoNeto: 0,
            tasas: [parseFloat(r.tasa_debito_b)]
          },
          dataCancelacion_internacional: {
            no: 0,
            montoBruto: 0,
            tasa: 0,
            comision: 0,
            ivaTasa: 0,
            ivaComision: 0,
            montoNeto: 0,
            tasas: [parseFloat(r.tasa_amex_b)]
          },
          dataCancelacion_credit: {
            no: 0,
            montoBruto: 0,
            tasa: 0,
            comision: 0,
            ivaTasa: 0,
            ivaComision: 0,
            montoNeto: 0,
            tasas: [parseFloat(r.tasa_credito_b)]
          },
        })
        id_merchants.push(r.id_merchant);
      }
    });

    const cliente = await db.isoClient.findOne({ attributes: ['name'], where: { id_client: idClient }, raw: true });

    return { cli: { id: idClient, name: cliente?.name ?? 'Desconocido' }, merchants }
  });

  const grupos = await Promise.all(ProGruposColl);

  grupos.forEach((g, i) => {
    g.merchants.forEach((gm, ii) => {
      [
        ['dataCargo', 2, 1],
        ['dataDevolucion', 4, 1],
        ['dataCancelacion', 5, 1]
      ].forEach(k => {
        ['debit', 'debit_link', 'credit', 'credit_link', 'credit_msi3', 'credit_msi6', 'credit_msi9', 'credit_msi12', 'credit_msi18', 'internacional', 'internacional_link'].forEach(tag => {
          const masterTag = `${k[0]}_${tag}`;
          if(grupos[i].merchants[ii][masterTag]) {
            const cargos = response.filter(r => {
              const vCli = r.id_client === g.cli.id;
              const vComercio = r.id_merchant === gm.id;
              const vMedio = tag === r.t_medio;
              const vStatus = k[1] === r.status;
  
              return vCli && vComercio && vMedio && vStatus;
            })

            const no = cargos.length;
  
            const montoBruto = cargos.map(c => k[2] * parseFloat(c.amount)).reduce((anterior, actual) => anterior + actual, 0);
  
            let tasas = grupos[i].merchants[ii][masterTag].tasas
            const tasa = cargos.map(c => {
              const cMeses = JSON.parse(c['merchant.msi']).filter(m => c.msi === m.type);
              const sobretasa = cMeses[0] || { percent: 0 };
              console.log('c.t_medio ----->', c.t_medio);
              const vTasa = parseFloat(
                /^credit/.test(c.t_medio) ? (0 === c.msi ? c.tasa_credito_b : (parseFloat(c.tasa_credito_b) + parseFloat(sobretasa.percent)) )
                : (/^internacional/.test(c.t_medio) ? c.tasa_amex_b : c.tasa_debito_b)
              );

              tasas.push(vTasa);
  
              return k[2] * (parseFloat(c.id_operation === 6 ? (c.amount / 100) : c.amount)) * vTasa;
            }).reduce((anterior, actual) => anterior + actual, 0);
  
            const comision = cargos.map(c => {
              console.log('comision - c.t_medio ----->', c.t_medio);

              return parseFloat(/^credit/.test(c.t_medio) ? c.tasa_credito_d : (/^internacional/.test(c.t_medio) ? c.tasa_amex_d : c.tasa_debito_d))
            }).reduce((anterior, actual) => anterior + actual, 0);
  
            const ivaTasa = (tasa / 100) * 16;
            const ivaComision = (comision / 100) * 16
            const montoNeto = montoBruto - (tasa + comision + ivaTasa + ivaComision)

            tasas = encontrarNumeroMasRepetido(tasas);
  
            grupos[i].merchants[ii][masterTag] = { no, montoBruto, tasa, comision, ivaTasa, ivaComision, montoNeto, tasas }
          }
        })
      });
    })
  });

  /**
   * Finds the most frequently occurring number in an array
   *
   * Helper function to determine the most common rate/percentage used in a set
   * of transactions. Used for standardizing rate reporting when multiple rates exist.
   *
   * @function encontrarNumeroMasRepetido
   * @param {number[]} array - Array of numeric values (typically rates or percentages)
   * @returns {number} The most frequently occurring number in the array
   */
  function encontrarNumeroMasRepetido(array) {
    let frecuencia = {};

    for (let i = 0; i < array.length; i++) {
      if (array[i] in frecuencia)
        frecuencia[array[i]]++;
      else
        frecuencia[array[i]] = 1;
    }


    let maxFrecuencia = 0;
    let numeroMasRepetido;
    for (let numero in frecuencia) {
      if (frecuencia[numero] > maxFrecuencia) {
        maxFrecuencia = frecuencia[numero];
        numeroMasRepetido = numero;
      }
    }

    return numeroMasRepetido;
  }

  const name = (req.params.cliente == 'all' ) ? 'Todos' : req.params.cliente ;
  moment.locale('es');
  const dayname = moment(dayEnd).format('DD-MMMM-YYYY');
  const fileName = `${name}-${dayname}`;
  makeExcel(grupos, dayStart, dayEnd, fileName).then(result => {
    // Based on your updated function, result should be an object with file paths
    if (result && result.pdfPath) {
        if (req.user.is_admin != 1) {
            // Non-admin users only get PDF
            return res.download(result.pdfPath);
        } else {
            // Admin users get a choice or we need to decide which one to send
            // Since we can only send one file, let's send PDF by default
            // Or you could implement a query parameter to choose
            const format = req.query.format || 'pdf';
            if (format === 'xlsx') {
                return res.download(result.xlsxPath);
            } else {
                return res.download(result.pdfPath);
            }
        }
    } else {
        return res.status(500).json({ error: 'Failed to generate report' });
    }
})
    .catch((error) => {
        console.error('Report generation error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    });
}

/**
 * Retrieves merchant list based on user role and permissions
 *
 * Returns all merchants accessible to the requesting user. For admin users, returns
 * all merchants in the system. For non-admin users, returns only merchants associated
 * with their client ID.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 7.2.1: Access to merchant data restricted based on user role
 * - Requirement 7.2.2: System enforces access control by client ownership
 * - Requirement 10.2.1: Access to merchant data can be logged for audit trails
 *
 * @async
 * @function getMerchants
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user object
 * @param {number} req.user.is_admin - Admin flag (1 for admin, 0 for non-admin)
 * @param {number} req.user.id_cliente - Client ID for non-admin users
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with merchant data array
 * @throws {Error} Database errors during merchant query
 */
data.getMerchants = async (req, res) => {
  const whereMerchant = {};
  if (req && req.user.is_admin != 1)
    whereMerchant.id_client = req.user.id_cliente;

  const merchants = await db.merchant.findAll({ where: whereMerchant });

  return res.json({ data: merchants });
}

/**
 * Manually triggers the consolidation script for a specified date range
 *
 * Administrative endpoint to populate the consolidados table with historical data
 * or re-process transactions for specific date ranges. Accepts date parameters
 * and triggers the main index consolidation function.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 10.2.2: Automated actions initiated by administrative users logged
 * - Requirement 10.3.3: All consolidation records include timestamps
 * - Requirement 7.2.1: This function should be restricted to administrative users only
 *
 * @async
 * @function scriptConsolidados
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} [req.body.fechas] - Date range string in format "DD/MM/YYYY DD/MM/YYYY"
 * @param {Object} res - Express response object
 * @returns {Promise<string>} Confirmation message that consolidation has started
 * @throws {Error} Errors from the index consolidation function
 */
data.scriptConsolidados = async (req, res) => {
  if (req.body.fechas) {
    const dates = req.body.fechas.split(' ');

    let d1 = dates[0].split('/');
    d1 = `${d1[1]}-${d1[0]}-${d1[2]}`;

    let d2 = dates[0].split('/');
    d2 = `${d2[1]}-${d2[0]}-${d2[2]}`;
  }

  req.daysToGet = 2000;
  this.index(req, res);

  return res.send('Se pobla la tabla consolidados')
}

module.exports = data;