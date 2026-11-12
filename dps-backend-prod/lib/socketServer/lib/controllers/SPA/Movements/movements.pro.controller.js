// lib/socketServer/lib/controllers/SPA/Movements/index.controller.js
require('dotenv').config();
const { Sequelize, Op } = require("sequelize");
const db = require("../../../sequelize/init");
const transactionCacheController = require('../../transactionCacheController');
const moment = require('moment-timezone');
const AWS = require('aws-sdk');
var _ = require('lodash');

const controller = {};

// Initialize S3 for cache operations
const s3 = new AWS.S3({
    region: process.env.APP_CACHE_AWS_REGION || 'us-east-1',
    accessKeyId: process.env.APP_CACHE_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.APP_CACHE_AWS_SECRET_ACCESS_KEY
});
const S3_BUCKET = process.env.APP_CACHE_S3_BUCKET || 'S3CacheTXN';

// Cache helper functions
function getCacheFilePath(date, type = 'transactions') {
    let formattedDate = moment(date).format('YYYY-MM-DD');
    let suffix = type === 'consolidation' ? '_consolidation' : type === 'liquidation' ? '_liquidation' : '';
    if (moment(date).isSame(moment(), 'day')) {
        return `transactions/${formattedDate}_00-00${suffix}.json`;
    }
    return `transactions/${formattedDate}${suffix}.json`;
}

async function saveToCache(cacheFile, data, freshness, isToday, type = 'transactions') {
    try {
        await s3.putObject({
            Bucket: S3_BUCKET,
            Key: cacheFile,
            Body: JSON.stringify(data, null, 2),
            ContentType: 'application/json'
        }).promise();
        console.log(`✅ Cache file saved: ${cacheFile} (${data.length} records)`);
        return true;
    } catch (error) {
        console.error(`❌ Error saving cache file ${cacheFile}:`, error);
        return false;
    }
}

async function checkCacheFileExists(cacheFile) {
    try {
        await s3.headObject({
            Bucket: S3_BUCKET,
            Key: cacheFile
        }).promise();
        return true;
    } catch (error) {
        if (error.code === 'NotFound') {
            return false;
        }
        throw error;
    }
}

async function populateCacheForDateRange(startDate, endDate, transactions, req) {
    try {
        console.log('💾 Starting manual cache population...');

        let current = moment(startDate).startOf('day');
        const end = moment(endDate).endOf('day');

        // Group transactions by day
        const transactionsByDay = {};
        transactions.forEach(tx => {
            const day = moment(tx.creation_date).format('YYYY-MM-DD');
            if (!transactionsByDay[day]) {
                transactionsByDay[day] = [];
            }
            transactionsByDay[day].push(tx);
        });

        // Save each day to cache - ONLY SAVE UNIQUE TRANSACTIONS
        for (const [day, dayTransactions] of Object.entries(transactionsByDay)) {
            const dayMoment = moment(day);
            const cacheFile = getCacheFilePath(dayMoment);

            // ⚠️ CRITICAL FIX: Check if cache file already exists
            const cacheExists = await checkCacheFileExists(cacheFile);

            if (cacheExists) {
                // ⚠️ LOAD EXISTING DATA FIRST to avoid duplication
                try {
                    console.log(`⚠️ Cache file ${cacheFile} already exists, loading existing data...`);

                    const existingData = await s3.getObject({
                        Bucket: S3_BUCKET,
                        Key: cacheFile
                    }).promise();

                    const existingTransactions = JSON.parse(existingData.Body.toString());
                    console.log(`📊 Existing cache has ${existingTransactions.length} transactions`);

                    console.log('🔍 Database amount check:', {
                      id_message: tx.id_message,
                      rawAmountFromDB: tx.amount,
                      typeof: typeof tx.amount,
                      isString: typeof tx.amount === 'string',
                      containsDot: tx.amount && tx.amount.includes('.'),
                      length: tx.amount && tx.amount.length
                    });
                    // Create a Set of unique transaction IDs to avoid duplicates
                    const existingIds = new Set(existingTransactions.map(tx =>
                        tx.id_message || tx.reference_number || JSON.stringify(tx)
                    ));

                    // Filter out transactions that already exist
                    const newTransactions = dayTransactions.filter(tx => {
                        const txId = tx.id_message || tx.reference_number || JSON.stringify(tx);
                        return !existingIds.has(txId);
                    });

                    if (newTransactions.length > 0) {
                        console.log(`🆕 Adding ${newTransactions.length} new transactions to existing cache`);
                        // Merge and save
                        const combinedTransactions = [...existingTransactions, ...newTransactions];
                        await saveToCache(cacheFile, combinedTransactions, 0, false, 'transactions');
                    } else {
                        console.log(`✅ No new transactions to add for ${day}`);
                    }

                } catch (error) {
                    console.error(`❌ Error loading existing cache for ${day}:`, error);
                    // Save fresh data if we can't load existing
                    await saveToCache(cacheFile, dayTransactions, 0, false, 'transactions');
                }
            } else {
                // Cache doesn't exist, save fresh data
                console.log(`💾 Creating new cache file for ${day} with ${dayTransactions.length} transactions`);
                await saveToCache(cacheFile, dayTransactions, 0, false, 'transactions');
            }
        }

        console.log('✅ Manual cache population completed');
    } catch (error) {
        console.error('❌ Error populating cache:', error);
    }
}
// ==================== CACHE MANAGEMENT ENDPOINTS ====================

controller.cacheStatus = async (req, res) => {
    try {
        const { start_date, end_date } = req.body;

        if (!start_date || !end_date) {
            return res.status(400).json({
                success: false,
                error: "start_date and end_date are required"
            });
        }

        const startDate = new Date(start_date + 'T00:00:00.000Z');
        const endDate = new Date(end_date + 'T23:59:59.999Z');

        // Check cache files existence
        let current = moment(startDate);
        const end = moment(endDate);

        const cacheStatus = [];

        while (current.isSameOrBefore(end, 'day')) {
            const cacheFile = getCacheFilePath(current);
            const cacheExists = await checkCacheFileExists(cacheFile);

            cacheStatus.push({
                date: current.format('YYYY-MM-DD'),
                cacheFile: cacheFile,
                exists: cacheExists,
                url: `https://${S3_BUCKET}.s3.amazonaws.com/${cacheFile}`
            });

            current.add(1, 'day');
        }

        // Check direct database
        const directCount = await db.isoMessage.count({
            where: {
                creation_date: {
                    [Op.between]: [startDate, endDate]
                }
            }
        });

        return res.json({
            success: true,
            date_range: {
                start: startDate.toISOString(),
                end: endDate.toISOString(),
                human_readable: `${start_date} to ${end_date}`
            },
            direct_database_count: directCount,
            cache_status: cacheStatus,
            issues: cacheStatus.filter(s => !s.exists).map(s => `Missing cache for ${s.date}`),
            summary: {
                total_days: cacheStatus.length,
                cached_days: cacheStatus.filter(s => s.exists).length,
                missing_days: cacheStatus.filter(s => !s.exists).length,
                coverage: `${((cacheStatus.filter(s => s.exists).length / cacheStatus.length) * 100).toFixed(1)}%`
            }
        });

    } catch (error) {
        console.error('Cache status error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
controller.warmCache = async (req, res) => {
    try {
        let start_date, end_date;
        if (req.body.fechas) {
            const dates = req.body.fechas.split(' ');
            start_date = new Date(dates[0]);
            end_date = new Date(dates[1]);
        } else if (req.body.start_date && req.body.end_date) {
            start_date = new Date(req.body.start_date + 'T00:00:00.000Z');
            end_date = new Date(req.body.end_date + 'T23:59:59.999Z');
        } else {
            return res.status(400).json({
                success: false,
                error: "Either 'fechas' or both 'start_date' and 'end_date' are required"
            });
        }


        console.log('🔥 Manual cache warm-up started...', { start_date, end_date });

        let results = {
            success: true,
            message: `Cache warm-up completed for ${start_date} to ${end_date}`,
            warmed_range: {
                start: start_date,
                end: end_date
            },
            details: []
        };

        // ⚡ FIX: Use the dates from req.body directly
        const startDate = new Date(start_date);
        const endDate = new Date(end_date);

        // Force backfill using the cache controller
        if (transactionCacheController.backfillCache) {
            await transactionCacheController.backfillCache(
                startDate.toISOString(),
                endDate.toISOString(),
                req,
                { onlyResponse: true }
            );
            results.details.push('Used transactionCacheController.backfillCache');
        } else {
            console.log('⚠️ backfillCache not available in transactionCacheController');
            // Fallback: manually populate cache
            const transactions = await db.isoMessage.findAll({
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
                    },
                    {
                        model: db.cisoOperation,
                        as: 'tipo_operacion',
                        attributes: ['id_operation', 'name']
                    }
                ],
                order: [['creation_date', 'DESC']]
            });

            await populateCacheForDateRange(startDate, endDate, transactions, req);
            results.details.push('Used manual cache population');
            results.transactions_processed = transactions.length;
        }

        // Verify cache was created
        let current = moment(startDate);
        const end = moment(endDate);
        const verifiedFiles = [];

        while (current.isSameOrBefore(end, 'day')) {
            const cacheFile = getCacheFilePath(current);
            const exists = await checkCacheFileExists(cacheFile);
            verifiedFiles.push({
                date: current.format('YYYY-MM-DD'),
                cacheFile: cacheFile,
                exists: exists
            });
            current.add(1, 'day');
        }

        results.cache_verification = verifiedFiles;
        results.successful_files = verifiedFiles.filter(f => f.exists).length;
        results.total_files = verifiedFiles.length;

        return res.json(results);

    } catch (error) {
        console.error('Cache warm-up error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
controller.clearCache = async (req, res) => {
    try {
        const { start_date, end_date } = req.body;

        let filesToDelete = [];

        if (start_date && end_date) {
            // Clear specific date range
            const startDate = new Date(start_date + 'T00:00:00.000Z');
            const endDate = new Date(end_date + 'T23:59:59.999Z');

            let current = moment(startDate);
            const end = moment(endDate);

            while (current.isSameOrBefore(end, 'day')) {
                const cacheFile = getCacheFilePath(current);
                filesToDelete.push(cacheFile);
                current.add(1, 'day');
            }
        } else {
            // Clear all cache files (be careful!)
            try {
                const list = await s3.listObjectsV2({
                    Bucket: S3_BUCKET,
                    Prefix: 'transactions/'
                }).promise();

                filesToDelete = (list.Contents || [])
                    .filter(file => file.Key.startsWith('transactions/') && file.Key.endsWith('.json'))
                    .map(file => file.Key);
            } catch (error) {
                console.error('Error listing cache files:', error);
            }
        }

        // Delete files
        const deleteResults = [];
        for (const fileKey of filesToDelete) {
            try {
                await s3.deleteObject({
                    Bucket: S3_BUCKET,
                    Key: fileKey
                }).promise();
                deleteResults.push({ file: fileKey, status: 'deleted' });
                console.log(`🗑️ Deleted cache file: ${fileKey}`);
            } catch (error) {
                deleteResults.push({ file: fileKey, status: 'error', error: error.message });
            }
        }

        return res.json({
            success: true,
            message: `Cleared ${deleteResults.filter(r => r.status === 'deleted').length} cache files`,
            details: deleteResults
        });

    } catch (error) {
        console.error('Cache clear error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ==================== ORIGINAL ENDPOINTS (ENHANCED) ====================

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
    console.log('💡🚨 ->>  getMovements <<- 🚨💡');
    console.log('🔄 getMovements - Raw request body:', JSON.stringify(req.body, null, 2));

    try {
        let startDate, endDate;

        // ⚡ ENHANCED: Handle BOTH formats - fechas AND start_date/end_date
        if (req.body.start_date && req.body.end_date) {
            // New format: separate start_date and end_date
            startDate = new Date(req.body.start_date + 'T00:00:00.000Z');
            endDate = new Date(req.body.end_date + 'T23:59:59.999Z');
            console.log('📅 Using start_date/end_date format:', {
                start_date: req.body.start_date,
                end_date: req.body.end_date
            });
        }
        else if (req.body.fechas && typeof req.body.fechas === 'string') {
            // Existing fechas format handling
            const dates = req.body.fechas.split(' ');

            if (dates.length === 2) {
                // Check if dates are already in ISO format (contain 'T' and end with 'Z')
                if (dates[0].includes('T') && dates[0].endsWith('Z') && dates[1].includes('T') && dates[1].endsWith('Z')) {
                    // Format: "2025-11-28T00:00:00.000Z 2025-11-29T23:59:59.999Z" - use directly
                    startDate = new Date(dates[0]);
                    endDate = new Date(dates[1]);
                    console.log('Using existing ISO format dates');
                } else {
                    // Format: "YYYY-MM-DD YYYY-MM-DD" - convert to ISO
                    startDate = new Date(dates[0] + 'T00:00:00.000Z');
                    endDate = new Date(dates[1] + 'T23:59:59.999Z');
                    console.log('Converting date-only format to ISO');
                }
            } else if (dates.length === 4) {
                // Format: "YYYY-MM-DD HH:mm:ss YYYY-MM-DD HH:mm:ss"
                startDate = moment.tz(`${dates[0]}T${dates[1]}`, 'America/Mexico_City').utc().toDate();
                endDate = moment.tz(`${dates[2]}T${dates[3]}`, 'America/Mexico_City').utc().toDate();
                console.log('Converting datetime format to ISO');
            } else {
                return res.status(400).json({ error: "Invalid date format. Expected 2 or 4 date components." });
            }
        } else {
            return res.status(400).json({
                error: "No valid date range provided. Use either 'fechas' or 'start_date' and 'end_date'",
                received_body: req.body
            });
        }

        console.log('✅ Final date range:', {
            start: startDate.toISOString(),
            end: endDate.toISOString()
        });

        // Validate dates
        if (!validateDate(startDate) || !validateDate(endDate)) {
            return res.status(400).send({ message: 'Invalid date range' });
        }

        // ⚡ CACHE DISABLED - Using direct database query only
        // Cache corruption issue requires separate investigation
        // TODO: Investigate and fix S3 cache duplication before re-enabling
        console.log('🚫 Cache disabled - using direct database query for data integrity');

        let transacciones;
        let source = 'direct_database';

        // Direct database query for the FULL range
        // ⚠️ FIX: Use the correct model name - from your original working code
        transacciones = await db.isoMessage.findAll({
            where: {
                creation_date: {
                    [Op.between]: [startDate, endDate]
                }
            },
            include: [
                {
                    model: db.cisoRespCode, // ⚠️ FIXED: Use cisoRespCode NOT cisoResponseCode
                    as: 'codigo_resp',
                    attributes: ['id_response_code', 'description']
                },
                {
                    model: db.cisoOperation,
                    as: 'tipo_operacion',
                    attributes: ['id_operation', 'name']
                }
            ],
            attributes: ['msg_type', 'resp_code', 'card_type', 'bin', 'amount', 'creation_date', 'tran_date', 'tran_time', 'capture_date', 'folio', 'id_message'], // Include all necessary fields
            order: [['creation_date', 'DESC']],
        });

        console.log(`📊 Direct query found: ${transacciones.length} transactions`);

        // Log actual counts by date for debugging
        const dateCounts = {};
        transacciones.forEach(tx => {
            if (tx.creation_date) {
                const dateStr = new Date(tx.creation_date).toISOString().split('T')[0];
                dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
            }
        });
        console.log(`📅 Actual database counts by date:`, dateCounts);

        // ⚠️ CRITICAL: DO NOT populate cache here!
        // This is what caused the duplication loop
        console.log('🚫 Cache population disabled to prevent duplication');

        // If no data, return informative response
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
                netAmount: 0,
                originalTransactions: 0,
                reversalTransactions: 0,
                debug: {
                    date_range: { start: startDate.toISOString(), end: endDate.toISOString() },
                    cache_used: false,
                    source: source,
                    warning: 'Cache disabled due to corruption'
                }
            });
        }

        // Process the data with proper msg_type filtering
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
            // New fields for proper msg_type handling
            netAmount: 0,
            originalTransactions: 0,
            reversalTransactions: 0,
            debug: {
                date_range: { start: startDate.toISOString(), end: endDate.toISOString() },
                cache_used: false,
                source: source,
                warning: 'Cache disabled - direct database query only'
            }
        };

        let topRechazo = 5;

        // Track amounts for net calculation
        let totalApprovedAmount0200 = 0;
        let totalReversalAmount = 0;
        let originalTxCount = 0;
        let reversalTxCount = 0;

        for (const transaccion of transacciones) {
            // ✅ CONVERT AMOUNT FROM CENTS TO DOLLARS FOR DISPLAY
            // TransactionContext ensures amounts are stored in cents
            let amountCents = Number(transaccion.amount) || 0;
            let amountDollars = (amountCents / 100).toFixed(2);

            // Calculate date before creating itemTransaction
            let date;
            if (transaccion.creation_date) {
                try {
                    date = new Date(transaccion.creation_date).toLocaleDateString("en-GB");
                } catch (e) {
                    date = new Date().toLocaleDateString("en-GB");
                }
            } else {
                date = new Date().toLocaleDateString("en-GB");
            }
            transaccion.date = date;
            dataOutput.label[transaccion.date] = transaccion.date;

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
                amount: amountDollars, // Convert to dollars
                amount_cents: amountCents, // Keep raw cents for calculations
                amount_formatted: `$${amountDollars}`,
                resp_code: transaccion.resp_code,
                msg_type: transaccion.msg_type, // Include msg_type
                bin: transaccion.bin,
                date: date // Include date for chart grouping
            };

            // ✅ CRITICAL FIX: Only count 0200 transactions for approval/rejection stats
            // 0200 = Original purchase/authorization transactions
            // 0220/0420 = Reversal transactions (not counted in approval rate)
            // 200/210 = Sale transactions (when tipo_operacion is VENTA)
            // 0210 = Reversal transactions (when tipo_operacion is REVERSO)
            const isOriginalTransaction = transaccion.msg_type === '0200' || 
                transaccion.msg_type === '200' ||
                transaccion.msg_type === '210' ||
                (!transaccion.msg_type && transaccion.tipo_operacion?.name === 'VENTA');
            const isReversal = transaccion.msg_type === '0220' || 
                transaccion.msg_type === '0420' ||
                (transaccion.msg_type === '0210' && transaccion.tipo_operacion?.name === 'REVERSO');

            // Log first few transactions for debugging
            if (originalTxCount < 5) {
                console.log(`🔍 Transaction ${originalTxCount + 1}:`, {
                    msg_type: transaccion.msg_type,
                    tipo_operacion: transaccion.tipo_operacion?.name,
                    resp_code: transaccion.resp_code,
                    isOriginal: isOriginalTransaction,
                    isReversal: isReversal
                });
            }

            if (isOriginalTransaction) {
                originalTxCount++;
                
                // ✅ FIX: Process card types and brands for ALL 0200 transactions (for charts)
                // This should happen regardless of resp_code status
                let tipo_prod = {};
                // Log first few card_type values for debugging
                if (originalTxCount <= 5) {
                    console.log(`🔍 Card type for transaction ${originalTxCount}:`, {
                        card_type: transaccion.card_type,
                        bin: transaccion.bin
                    });
                }
                // Handle both old format (00, C0, P0) and new format (MC, VI, etc.)
                switch (transaccion.card_type) {
                    case '00': tipo_prod = { id_card_type: 0, name: 'INTERNACIONAL' }; break;
                    case 'C0': tipo_prod = { id_card_type: 1, name: 'CREDITO' }; break;
                    case 'P0': tipo_prod = { id_card_type: 2, name: 'DEBITO' }; break;
                    case 'MC': tipo_prod = { id_card_type: 1, name: 'CREDITO' }; break;  // MasterCard = Credit
                    case 'VI': tipo_prod = { id_card_type: 1, name: 'CREDITO' }; break;  // Visa = Credit
                    case 'AX': tipo_prod = { id_card_type: 1, name: 'CREDITO' }; break;  // Amex = Credit
                    case 'DC': tipo_prod = { id_card_type: 2, name: 'DEBITO' }; break;   // Discover = Debit
                    default: tipo_prod = { id_card_type: -1, name: 'DESCONOCIDO' }; break;
                }
                if (tipo_prod.name) {
                    dataOutput.tipo_prod.push(tipo_prod);
                }

                // Process card brands
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
                
                // ✅ FIX: Handle missing resp_code - if undefined/null, don't count in approval stats
                const hasRespCode = transaccion.resp_code !== undefined && transaccion.resp_code !== null;
                const isApproved = hasRespCode && (transaccion.resp_code === '00' || transaccion.resp_code === '0');
                
                if (isApproved) {
                    dataOutput.total_aprob.push(itemTransaction);
                    totalApprovedAmount0200 += amountCents;
                } else if (hasRespCode) {
                    // Only count as rejected if resp_code exists and is not '00'/'0'
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
                } else {
                    // resp_code missing - skip for approval rate calculation
                    console.log(`⚠️ Transaction with missing resp_code - not counted in approval rate:`, {
                        msg_type: transaccion.msg_type,
                        id_message: transaccion.id_message
                    });
                }
            } else if (isReversal) {
                // Count reversals separately for net calculation
                reversalTxCount++;
                if ((transaccion.resp_code === '00' || transaccion.resp_code === '0')) {
                    totalReversalAmount += amountCents;
                }
                // Reversals are still included in data array but not in approval/rejection stats
            } else {
                // Transaction not counted (neither 0200 nor reversal)
                console.log(`⚠️ Transaction skipped - not 0200/0220/0420 and no VENTA fallback:`, {
                    msg_type: transaccion.msg_type,
                    tipo_operacion: transaccion.tipo_operacion?.name
                });
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
        if (dataOutput.total_rech.length > 0) {
            dataOutput.rechazos.forEach(element => {
                element.porc = (element.count * 100 / dataOutput.total_rech.length).toFixed(2);
            });
        }
        dataOutput.rechazos = _.orderBy(dataOutput.rechazos, 'count', 'desc');

        // ✅ Calculate net amount and set new fields
        // Net Amount = Sum(approved 0200) - Sum(approved reversals)
        const netAmountCents = totalApprovedAmount0200 - totalReversalAmount;
        dataOutput.netAmount = (netAmountCents / 100).toFixed(2);
        dataOutput.originalTransactions = originalTxCount;
        dataOutput.reversalTransactions = reversalTxCount;

        console.log(`📊 Dashboard metrics with msg_type filtering:`, {
            originalTransactions: originalTxCount,
            reversalTransactions: reversalTxCount,
            totalApprovedAmount0200: (totalApprovedAmount0200 / 100).toFixed(2),
            totalReversalAmount: (totalReversalAmount / 100).toFixed(2),
            netAmount: dataOutput.netAmount,
            approved0200: dataOutput.total_aprob.length,
            rejected0200: dataOutput.total_rech.length
        });

        // Get merchant stats (with error handling for missing columns)
        try {
            let merchantWhere = { deleted_at: null };
            if (req.user && req.user.is_admin !== 1) {
                merchantWhere = { ...merchantWhere, id_client: req.user.id_cliente };
            }

            const merchants = await db.merchant.findAll({ 
                where: merchantWhere,
                attributes: ['id_merchant', 'active'] // Only select needed fields
            });
            dataOutput.total_activos = merchants.filter(m => m.active === 1).length;
            dataOutput.total_inactivos = merchants.filter(m => m.active !== 1).length;
        } catch (merchantError) {
            console.warn('⚠️ Could not fetch merchant stats:', merchantError.message);
            dataOutput.total_activos = 0;
            dataOutput.total_inactivos = 0;
        }

        console.log(`✅ Successfully processed ${dataOutput.total_t} transactions (source: ${source})`);
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
// ==================== DEBUGGING ENDPOINTS ====================

controller.getMovementsDirect = async (req, res) => {
    console.log('💡🚨 ->>  getMovementsDirect <<- 🚨💡');
    console.log('🔍 DEBUG - Direct database query only');

    try {
        const { start_date, end_date, fechas } = req.body;

        let startDate, endDate;

        // Handle both formats
        if (start_date && end_date) {
            startDate = new Date(start_date + 'T00:00:00.000Z');
            endDate = new Date(end_date + 'T23:59:59.999Z');
        } else if (fechas) {
            const dates = fechas.split(' ');
            startDate = new Date(dates[0]);
            endDate = new Date(dates[1]);
        } else {
            return res.status(400).json({
                success: false,
                error: "Either start_date/end_date or fechas required"
            });
        }

        console.log('📅 Direct query with dates:', { startDate, endDate });

        // Direct query to verify data exists
        const transactions = await db.isoMessage.findAll({
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
            ],
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
                name_merchant: t.name_merchant,
                response_description: t.codigo_resp?.description
            })),
            date_range: {
                start: startDate.toISOString(),
                end: endDate.toISOString()
            }
        });

    } catch (error) {
        console.error('💥 Direct query error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

controller.healthCheck = async (req, res) => {
    try {
        // Check database connection
        const dbCheck = await db.sequelize.authenticate();

        // Check S3 connection
        const s3Check = await s3.headBucket({ Bucket: S3_BUCKET }).promise();

        // Check cache controller
        const cacheControllerAvailable = !!transactionCacheController.getTransactionsByDateRange;

        return res.json({
            success: true,
            timestamp: new Date().toISOString(),
            services: {
                database: 'connected',
                s3: 'connected',
                cache_controller: cacheControllerAvailable ? 'available' : 'unavailable'
            },
            environment: {
                node_env: process.env.NODE_ENV,
                s3_bucket: S3_BUCKET,
                aws_region: process.env.APP_CACHE_AWS_REGION || 'us-east-1'
            }
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message,
            services: {
                database: error.message.includes('database') ? 'error' : 'unknown',
                s3: error.message.includes('S3') ? 'error' : 'unknown'
            }
        });
    }
};

// ==================== HELPER FUNCTIONS ====================

function validateDate(date) {
    return date instanceof Date && !isNaN(date.getTime());
}

module.exports = controller;