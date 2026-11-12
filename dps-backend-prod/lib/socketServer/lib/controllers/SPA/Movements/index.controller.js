// lib/socketServer/lib/controllers/SPA/Movements/index.controller.js
const { Sequelize, Op } = require("sequelize");
const db = require("../../../sequelize/init");
const transactionCacheController = require('../../transactionCacheController');
const moment = require('moment-timezone'); // ADD MISSING IMPORT
var _ = require('lodash');

const controller = {};

// Simple direct database query for debugging
controller.getMovementsDirect = async (req, res) => {
    console.log('🔍 DEBUG - Direct database query');

    try {
        const { start_date, end_date } = req.body;

        // Simple date validation
        if (!start_date || !end_date) {
            return res.status(400).json({ error: "Start date and end date required" });
        }

        const startDate = new Date(start_date + 'T00:00:00.000Z');
        const endDate = new Date(end_date + 'T23:59:59.999Z');

        console.log('📅 Querying database with dates:', { startDate, endDate });

        // Direct query to verify data exists
        const transactions = await db.isoMessage.findAll({
            where: {
                creation_date: {
                    [Op.between]: [startDate, endDate]
                }
            },
            limit: 50,
            order: [['creation_date', 'DESC']]
        });

        console.log(`✅ Found ${transactions.length} transactions directly from database`);

        return res.json({
            success: true,
            direct_count: transactions.length,
            transactions: transactions.map(t => ({
                id_message: t.id_message,
                creation_date: t.creation_date,
                amount: t.amount,
                resp_code: t.resp_code,
                card_type: t.card_type,
                name_merchant: t.name_merchant
            }))
        });

    } catch (error) {
        console.error('💥 Direct query error:', error);
        return res.status(500).json({ error: error.message });
    }
};

controller.get = async (req, res, next) => {
    let limit = req.body.limit ? req.body.limit : 10;
    let offset = 0 + (req.body.page - 1) * limit;
    let id = req.body.id;
    let id_merchant = req.body.id_merchant;
    let start_date = req.body.start_date;
    let end_date = req.body.end_date;
    let order = req.body.order;
    const where = {};

    if (id) {
        where.reference_number = id;
        offset = 0;
    }
    if (id_merchant) {
        where.name_merchant = id_merchant;
        offset = 0;
    }
    if (start_date && end_date) {
        if (start_date > end_date) {
            return res.status(400).json({ error: "Start date can't be greater than end date" });
        }
        where.creation_date = {
            [Sequelize.Op.gte]: start_date,
            [Sequelize.Op.lte]: end_date
        };
    } else if (start_date) {
        where.creation_date = {
            [Sequelize.Op.gte]: start_date
        };
    } else if (end_date) {
        where.creation_date = {
            [Sequelize.Op.lte]: endDate
        };
    }

    if (order !== 'asc' && order !== 'desc') {
        order = 'asc';
    }

    db.isoMessage.findAndCountAll({
        attributes: [
            "id_message",
            "trace_number",
            [Sequelize.literal('name_merchant'), "id_merchant"],
            "terminal",
            "id_operation",
            "msg_type",
            "reference_number",
            "amount",
            "resp_code",
            "authorization",
            "bin",
            "last4",
            "entry_mode",
            "reverse_code",
            "tran_date",
            "tran_time",
            "capture_date",
            "reference_number_ant",
            "card_type",
            "folio",
            "creation_date",
        ],
        offset: offset,
        limit: limit,
        order: [['id_message', order]],
        where
    }).then(async result => {
        return res.json({ data: result });
    }).catch(err => {
        return res.status(500).json({ error: err });
    });
};

controller.getMovements = async (req, res, next) => {
    console.log('🔄 getMovements - Raw request body:', JSON.stringify(req.body, null, 2));

    try {
        // METHOD 1: Try simple date format first
        let startDate, endDate;

        if (req.body.start_date && req.body.end_date) {
            // Simple format: start_date and end_date as separate fields
            startDate = new Date(req.body.start_date + 'T00:00:00.000Z');
            endDate = new Date(req.body.end_date + 'T23:59:59.999Z');
            console.log('📅 Using simple date format:', { startDate, endDate });
        }
        // METHOD 2: Try fechas string
        else if (req.body.fechas && typeof req.body.fechas === 'string') {
            const dates = req.body.fechas.split(' ');

            if (dates.length === 2) {
                // Check if dates are in ISO format
                if (dates[0].includes('T') && dates[1].includes('T')) {
                    startDate = new Date(dates[0]);
                    endDate = new Date(dates[1]);
                } else {
                    // Simple date format "YYYY-MM-DD YYYY-MM-DD"
                    startDate = new Date(dates[0] + 'T00:00:00.000Z');
                    endDate = new Date(dates[1] + 'T23:59:59.999Z');
                }
                console.log('📅 Using fechas string format:', { startDate, endDate });
            }
        } else {
            return res.status(400).json({
                error: "No valid date range provided",
                received: req.body
            });
        }

        // Validate dates
        if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({
                error: "Invalid date format",
                startDate,
                endDate
            });
        }

        console.log('✅ Final date range:', {
            start: startDate.toISOString(),
            end: endDate.toISOString()
        });

        // FIRST: Try direct database query to verify data exists
        console.log('🔍 Checking database directly...');
        const directResults = await db.isoMessage.findAll({
            where: {
                creation_date: {
                    [Op.between]: [startDate, endDate]
                }
            },
            limit: 10
        });

        console.log(`📊 Direct database query found: ${directResults.length} records`);

        // SECOND: Try transaction cache
        console.log('🔄 Calling transactionCacheController...');
        let transacciones = await transactionCacheController.getTransactionsByDateRange({
            onlyResponse: true,
            fechas: `${startDate.toISOString()} ${endDate.toISOString()}`
        }, req);

        console.log(`📊 Transaction cache returned: ${transacciones ? transacciones.length : 'NO DATA'} transactions`);

        // THIRD: If cache returns nothing, use direct database results
        if (!transacciones || transacciones.length === 0) {
            console.log('⚠️ Cache returned no data, using direct database query');
            transacciones = await db.isoMessage.findAll({
                where: {
                    creation_date: {
                        [Op.between]: [startDate, endDate]
                    }
                },
                include: [
                    {
                        model: db.cisoResponseCode,
                        as: 'codigo_resp',
                        attributes: ['id_response_code', 'description']
                    }
                ]
            });
        }

        console.log(`🎯 Final transaction count: ${transacciones.length}`);

        // If still no data, return informative response
        if (!transacciones || transacciones.length === 0) {
            return res.json({
                success: true,
                message: 'No transactions found for the specified date range',
                data: [],
                total_t: 0,
                total_aprob: [],
                total_rech: [],
                total_activos: 0,
                total_inactivos: 0,
                rechazos: [],
                fechas_aprob: [],
                fechas_rech: [],
                label: [],
                tipo_prod: [],
                marca_t: [],
                tipo_prod_string: '',
                marca_t_string: '',
                debug: {
                    date_range: { start: startDate.toISOString(), end: endDate.toISOString() },
                    direct_query_count: directResults.length
                }
            });
        }

        // Process the data (your existing processing logic)
        let dataOutput = {
            data: [],
            total_t: transacciones.length,
            total_aprob: [],
            total_rech: [],
            total_activos: 0,
            total_inactivos: 0,
            rechazos: [],
            fechas_aprob: [],
            fechas_rech: [],
            label: {},
            tipo_prod: [],
            marca_t: [],
            tipo_prod_string: '',
            marca_t_string: '',
            debug: {
                date_range: { start: startDate.toISOString(), end: endDate.toISOString() },
                direct_query_count: directResults.length,
                cache_used: transacciones !== directResults
            }
        };

        let topRechazo = 5;

        for (const transaccion of transacciones) {
            const itemTransaction = {
                id_message: transaccion.id_message,
                tran_date: transaccion.tran_date,
                tran_time: transaccion.tran_time,
                capture_date: transaccion.capture_date,
                card_type: transaccion.card_type,
                folio: transaccion.folio,
                creation_date: transaccion.creation_date,
                tipo_operacion: transaccion.tipo_operacion,
                codigo_resp: transaccion.codigo_resp,
                amount: transaccion.amount,
                resp_code: transaccion.resp_code
            };

            let date = new Date(transaccion.creation_date).toLocaleDateString("en-GB");
            transaccion.date = date;
            dataOutput.label[transaccion.date] = transaccion.date;

            if (transaccion.resp_code === '00') {
                dataOutput.total_aprob.push(itemTransaction);
            } else {
                dataOutput.total_rech.push(itemTransaction);

                // Handle rejection reasons
                if (transaccion.codigo_resp) {
                    let foundRechazo = dataOutput.rechazos.find(r => r.id === transaccion.codigo_resp.id_response_code);
                    if (foundRechazo) {
                        foundRechazo.count++;
                    } else if (dataOutput.rechazos.length < topRechazo) {
                        dataOutput.rechazos.push({
                            id: transaccion.codigo_resp.id_response_code,
                            name: transaccion.codigo_resp.description,
                            count: 1
                        });
                    }
                }
            }

            // Process card types
            let tipo_prod = {};
            switch (transaccion.card_type) {
                case '00': tipo_prod = { id_card_type: 0, name: 'INTERNACIONAL' }; break;
                case 'C0': tipo_prod = { id_card_type: 1, name: 'CREDITO' }; break;
                case 'P0': tipo_prod = { id_card_type: 2, name: 'DEBITO' }; break;
                default: tipo_prod = { id_card_type: -1, name: 'DESCONOCIDO' }; break;
            }
            if (tipo_prod.name) {
                dataOutput.tipo_prod.push(tipo_prod);
            }

            // Process card brands
            if (transaccion.bin_info) {
                dataOutput.marca_t.push(transaccion.bin_info.tipo_tarjeta);
            } else {
                let metodo = {};
                if (transaccion.bin) {
                    switch (transaccion.bin.substring(0, 1)) {
                        case '3': metodo = { id_brand: 1, name: 'AMEX' }; break;
                        case '4': metodo = { id_brand: 4, name: 'VISA' }; break;
                        case '5': metodo = { id_brand: 3, name: 'MASTERCARD' }; break;
                        default: metodo = { id_brand: -1, name: 'OTRA' }; break;
                    }
                } else {
                    metodo = { id_brand: -1, name: 'NO DISPONIBLE' };
                }
                dataOutput.marca_t.push(metodo);
            }

            dataOutput.data.push(itemTransaction);
        }

        // Process statistics (your existing logic)
        let colors = ["#3498DB", "#E74C3C", "#9B59B6", "#BDC3C7", "#26B99A"];

        // Process card types
        let aux = _.groupBy(dataOutput.tipo_prod, 'id_card_type');
        let auxx = [];
        let count = 0;
        Object.keys(aux).forEach(v => {
            auxx.push({ name: aux[v][0].name, count: aux[v].length, porc: 0, color: colors[count] });
            count++;
        });
        auxx.forEach(v => { v.porc = (v.count * 100 / dataOutput.tipo_prod.length).toFixed(2); });
        if (auxx.length === 0) { auxx.push({ name: 'Sin datos', count: 0, porc: 0, color: 'gray' }); }
        dataOutput.tipo_prod = auxx;
        dataOutput.tipo_prod_string = JSON.stringify(auxx);

        // Process card brands
        aux = _.groupBy(dataOutput.marca_t, 'id_brand');
        auxx = [];
        count = 0;
        Object.keys(aux).forEach(v => {
            auxx.push({ name: aux[v][0].name, count: aux[v].length, porc: 0, color: colors[count] });
            count++;
        });
        auxx.forEach(v => { v.porc = (v.count * 100 / dataOutput.marca_t.length).toFixed(2); });
        if (auxx.length === 0) { auxx.push({ name: 'Sin datos', count: 0, porc: 0, color: 'gray' }); }
        dataOutput.marca_t = auxx;
        dataOutput.marca_t_string = JSON.stringify(auxx);

        // Process date charts
        let label_ready = [];
        const objGrafica = (data, labels) => {
            label_ready = [];
            let newAux = [];
            Object.keys(labels).forEach(label => {
                label_ready.push(label);
                let auxData = data[label] ? data[label].length : 0;
                newAux.push(auxData);
            });
            return newAux;
        };

        aux = _.groupBy(dataOutput.total_aprob, 'date');
        dataOutput.fechas_aprob = JSON.stringify(objGrafica(aux, dataOutput.label));

        aux = _.groupBy(dataOutput.total_rech, 'date');
        dataOutput.fechas_rech = JSON.stringify(objGrafica(aux, dataOutput.label));

        dataOutput.label = label_ready;

        // Process rejection percentages
        dataOutput.rechazos.forEach(element => {
            element.porc = (element.count * 100 / dataOutput.total_rech.length).toFixed(2);
        });
        dataOutput.rechazos = _.orderBy(dataOutput.rechazos, 'count', 'desc');

        // Get merchant stats
        let merchantWhere = { deleted_at: null };
        if (req.user && req.user.is_admin !== 1) {
            merchantWhere = { ...merchantWhere, id_client: req.user.id_cliente };
        }

        const merchants = await db.merchant.findAll({ where: merchantWhere });
        dataOutput.total_activos = merchants.filter(m => m.active === 1).length;
        dataOutput.total_inactivos = merchants.filter(m => m.active !== 1).length;

        console.log(`✅ Successfully processed ${dataOutput.total_t} transactions`);
        return res.json(dataOutput);

    } catch (error) {
        console.error('💥 Error in getMovements:', error);
        return res.status(500).json({
            success: false,
            message: 'Error processing movements request',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

function validateDate(date) {
    return date instanceof Date && !isNaN(date.getTime());
}

module.exports = controller;