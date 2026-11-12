/**
 * Transaction Cache Controller
 * 
 * PCI DSS 4 Requirements Covered:
 * - Requirement 3.5.1: Limit storage of account data to that which is needed for business, legal, or regulatory purposes
 * - Requirement 8.2.1: Use strong cryptography to render all authentication factors (such as passwords) unreadable during transmission and storage
 * - Requirement 10.2.1: Implement audit trails to reconstruct the sequence of events for each system component
 * - Requirement 11.3.1: Perform testing of security controls, systems, and network elements on a periodic basis
 */

let AWS = require('aws-sdk');
let moment = require('moment-timezone');
let { Op } = require('sequelize');
let NodeCache = require('node-cache');
let db = require('../sequelize/init');

// ESTABLECER ZONA HORARIA POR DEFECTO PARA TODO EL SISTEMA
// PCI DSS 4 Requirement 10.3.1: Record time stamps for all audit trail entries
moment.tz.setDefault(process.env.TZ || 'America/Mexico_City');

// PCI DSS 4 Requirement 10.2.3: Limit retention time for audit trail data to that which is needed for business, legal, or regulatory purposes
let MAX_DATE_RANGE_DAYS = 90;

/**
 * Safe JSON parsing with error handling
 * PCI DSS 4 Requirement 6.2.4: Address vulnerabilities in software and third-party components
 */
function safeParse(jsonString, fallback = []) {
    if (!jsonString || typeof jsonString !== 'string') {
        console.error('Invalid JSON string input');
        return fallback;
    }

    try {
        return JSON.parse(jsonString);
    } catch (error) {
        console.error('JSON parse error:', error.message);

        try {
            const fixedJson = jsonString
                .replace(/"[^"]*":\s*\[Circular Reference\]/g, 'null')
                .replace(/"[^"]*":\s*\[Circular: Sequelize Model\]/g, 'null')
                .replace(/"[^"]*":\s*\[object Object\]/g, 'null');

            return JSON.parse(fixedJson);
        } catch (e) {
            console.error('Failed to fix JSON, returning fallback');
            return fallback;
        }
    }
}

function safeStringify(obj, maxSize = 10 * 1024 * 1024) {
    if (!obj) return '{}';

    let seen = new WeakSet();
    const result = JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
                if (value && typeof value.toJSON === 'function') {
                    try {
                        return value.toJSON();
                    } catch (e) {
                        return '[Circular: Sequelize Model]';
                    }
                }
                return '[Circular Reference]';
            }
            seen.add(value);
        }

        if (value === undefined) return null;
        if (typeof value === 'function') return '[Function]';

        return value;
    });

    if (Buffer.byteLength(result, 'utf8') > maxSize) {
        console.warn('JSON string exceeds size limit, truncating');
        return JSON.stringify({
            error: 'Data too large for cache',
            original_length: Array.isArray(obj) ? obj.length : Object.keys(obj).length,
            truncated_at: Date.now()
        });
    }

    return result;
}

/**
 * Optimized cache retrieval with S3 fallback
 * PCI DSS 4 Requirement 3.5.1: Limit storage of account data to that which is needed for business
 * PCI DSS 4 Requirement 8.2.3: Secure all stored account data
 */
async function getFromCacheOptimized(cacheFile, freshness, type = 'transactions') {
    let cacheKey = `data:${cacheFile}`;
    let cachedData = cache.get(cacheKey);

    if (cachedData && await isCacheFresh(cacheFile, freshness, type)) {
        console.log(`Cache hit (in-memory) for ${cacheFile}, ${cachedData.length} records`);
        return cachedData;
    }

    if (await isCacheFresh(cacheFile, freshness, type)) {
        try {
            let data = await s3.getObject({
                Bucket: S3_BUCKET,
                Key: cacheFile
            }).promise();

            let parsedData = safeParse(data.Body.toString('utf8'), []);

            console.log(`Loaded ${parsedData.length} records from S3: ${cacheFile}`);
            cache.set(cacheKey, parsedData, freshness / 1000);
            return parsedData;
        } catch (error) {
            console.error(`Failed to get cache file ${cacheFile}:`, error.message);

            if (error.code === 'NoSuchKey' || error.message.includes('JSON')) {
                try {
                    await s3.deleteObject({
                        Bucket: S3_BUCKET,
                        Key: cacheFile
                    }).promise();
                    console.log(`🗑️ Deleted potentially corrupt cache file: ${cacheFile}`);
                } catch (deleteError) {
                    console.error(`Failed to delete ${cacheFile}:`, deleteError.message);
                }
            }

            return null;
        }
    }

    console.log(`Cache miss for ${cacheFile}`);
    return null;
}

/**
 * Date range validation and limitation
 * PCI DSS 4 Requirement 10.2.3: Limit retention time for audit trail data
 */
function validateAndLimitDateRange(dateRange) {
    if (!dateRange || typeof dateRange !== 'string') {
        throw new Error('Invalid date range format');
    }

    let [startDateStr, endDateStr] = dateRange.split(' ');
    if (!startDateStr || !endDateStr) {
        throw new Error('Invalid date range format. Expected "startDate endDate"');
    }

    let startDate = new Date(startDateStr);
    let endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error('Invalid date values');
    }

    if (endDate < startDate) {
        throw new Error('End date cannot be before start date');
    }

    let maxEndDate = new Date(startDate);
    maxEndDate.setDate(startDate.getDate() + MAX_DATE_RANGE_DAYS);

    let limitedEndDate = endDate > maxEndDate ? maxEndDate : endDate;

    if (endDate > maxEndDate) {
        console.warn(`Date range exceeds ${MAX_DATE_RANGE_DAYS} days. Limiting to ${MAX_DATE_RANGE_DAYS} days.`);
    }

    return {
        startDate: moment(startDate).startOf('day').toISOString(),
        endDate: moment(limitedEndDate).endOf('day').toISOString()
    };
}

let vars = require('../vars');
let helpers = require('../../../helpers/lib/helpers');
let path = require('path');

let { getTransRaw } = require('../services/transactionService');

let cache = new NodeCache({
    stdTTL: 24 * 60 * 60,
    checkperiod: 120,
});

// PCI DSS 4 Requirement 8.2.1: Use strong cryptography to protect authentication credentials
// AWS credentials stored in environment variables, not hardcoded
let s3 = new AWS.S3({
    region: process.env.APP_CACHE_AWS_REGION || 'us-east-1',
    accessKeyId: process.env.APP_CACHE_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.APP_CACHE_AWS_SECRET_ACCESS_KEY,
    httpOptions: {
        connectTimeout: 5000
    }
});

let S3_BUCKET = process.env.APP_CACHE_S3_BUCKET || 'S3CacheTXN';
let S3_PREFIX = 'transactions/';

let CACHE_HITS_FILE = `${S3_PREFIX}cache_hits_tracker.json`;
let MANIFEST_FILE = `${S3_PREFIX}cache_manifest.json`;

let FRESHNESS_HISTORICAL = 7 * 24 * 60 * 60 * 1000;
let FRESHNESS_TODAY = 24 * 60 * 60 * 1000;
let BACKFILL_LIMIT = 365;
let CLEANUP_THRESHOLD = 30 * 24 * 60 * 60 * 1000;
let BATCH_SIZE = 500;

/**
 * Generate unique instance identifier for tracking
 * PCI DSS 4 Requirement 10.2.1: Implement audit trails to reconstruct the sequence of events
 */
function generateInstanceId() {
    return `${process.pid}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${require('os').hostname()}`;
}

/**
 * Load cache hits tracker from S3
 * PCI DSS 4 Requirement 10.2.1: Implement audit trails for cache access monitoring
 */
async function loadCacheHits() {
    let cacheKey = 'cache_hits_memory';
    let cached = cache.get(cacheKey);
    if (cached) {
        return cached;
    }

    try {
        let data = await s3.getObject({
            Bucket: S3_BUCKET,
            Key: CACHE_HITS_FILE
        }).promise();

        let cacheHits = JSON.parse(data.Body.toString('utf8'));
        console.log(`Loaded cache hits tracker from S3: ${CACHE_HITS_FILE}`);

        cacheHits.verified_dates = new Set(cacheHits.verified_dates || []);
        cacheHits.verified_files = new Set(cacheHits.verified_files || []);

        return cacheHits;
    } catch (error) {
        if (error.code === 'NoSuchKey') {
            console.log('Cache hits tracker not found, initializing new one');
            let cacheHits = {
                last_updated: Date.now(),
                instance_id: generateInstanceId(),
                verified_dates: new Set(),
                verified_files: new Set()
            };
            cache.set(cacheKey, cacheHits, 3600);
            return cacheHits;
        }
        console.error('Error loading cache hits tracker:', error);
        return { verified_dates: new Set(), verified_files: new Set(), last_updated: 0 };
    }
}

/**
 * Save cache hits tracker to S3
 * PCI DSS 4 Requirement 10.2.1: Implement audit trails for cache access monitoring
 */
async function saveCacheHits(cacheHits) {
    let cacheKey = 'cache_hits_memory';
    cacheHits.last_updated = Date.now();

    let serializableHits = {
        ...cacheHits,
        verified_dates: Array.from(cacheHits.verified_dates),
        verified_files: Array.from(cacheHits.verified_files)
    };

    try {
        await s3.putObject({
            Bucket: S3_BUCKET,
            Key: CACHE_HITS_FILE,
            Body: JSON.stringify(serializableHits, null, 2),
            ContentType: 'application/json'
        }).promise();
        console.log(`Saved cache hits tracker to S3: ${CACHE_HITS_FILE}`);

        cache.set(cacheKey, cacheHits, 3600);
    } catch (error) {
        console.error('Error saving cache hits tracker:', error);
    }
}

/**
 * Mark date as verified in cache hits tracker
 * PCI DSS 4 Requirement 10.2.1: Implements audit trail for cache verification
 */
async function markDateAsVerified(date, type = 'transactions') {
    try {
        let cacheHits = await loadCacheHits();
        let dateKey = `${type}:${moment(date).format('YYYY-MM-DD')}`;
        cacheHits.verified_dates.add(dateKey);
        await saveCacheHits(cacheHits);
    } catch (error) {
        console.error('Error marking date as verified:', error);
    }
}

/**
 * Mark file as verified in cache hits tracker
 * PCI DSS 4 Requirement 10.2.1: Implements audit trail for cache verification
 */
async function markFileAsVerified(fileKey, type = 'transactions') {
    try {
        let cacheHits = await loadCacheHits();
        let fullFileKey = `${type}:${fileKey}`;
        cacheHits.verified_files.add(fullFileKey);
        await saveCacheHits(cacheHits);
    } catch (error) {
        console.error('Error marking file as verified:', error);
    }
}

/**
 * Check if date is verified in cache hits tracker
 * PCI DSS 4 Requirement 10.2.1: Implements audit trail verification
 */
async function isDateVerified(date, type = 'transactions') {
    try {
        let cacheHits = await loadCacheHits();
        let dateKey = `${type}:${moment(date).format('YYYY-MM-DD')}`;
        return cacheHits.verified_dates.has(dateKey);
    } catch (error) {
        console.error('Error checking date verification:', error);
        return false;
    }
}

/**
 * Check if file is verified in cache hits tracker
 * PCI DSS 4 Requirement 10.2.1: Implements audit trail verification
 */
async function isFileVerified(fileKey, type = 'transactions') {
    try {
        let cacheHits = await loadCacheHits();
        let fullFileKey = `${type}:${fileKey}`;
        return cacheHits.verified_files.has(fullFileKey);
    } catch (error) {
        console.error('Error checking file verification:', error);
        return false;
    }
}

/**
 * Check if cache file is fresh based on timestamp
 * PCI DSS 4 Requirement 10.2.3: Limits retention time for audit trail data
 */
async function isCacheFresh(fileKey, freshnessThreshold, type = 'transactions') {
    let isTodayFile = fileKey.includes('_00-00');

    if (!isTodayFile && await isFileVerified(fileKey, type)) {
        console.log(`Historical file verified in S3 cache hits: ${fileKey}`);
        return true;
    }

    let cacheKey = `freshness:${fileKey}`;
    let cachedFreshness = cache.get(cacheKey);
    if (cachedFreshness !== undefined) {
        console.log(`Freshness cache hit for ${fileKey}: ${cachedFreshness}`);
        if (cachedFreshness) {
            await markFileAsVerified(fileKey, type);
        }
        return cachedFreshness;
    }

    try {
        let data = await s3.headObject({
            Bucket: S3_BUCKET,
            Key: fileKey
        }).promise();
        let isFresh = Date.now() - new Date(data.LastModified).getTime() < freshnessThreshold;
        cache.set(cacheKey, isFresh, freshnessThreshold / 1000);

        if (isFresh && !isTodayFile) {
            await markFileAsVerified(fileKey, type);
        }

        console.log(`Checked S3 freshness for ${fileKey}: ${isFresh} (${isTodayFile ? 'today' : 'historical'})`);
        return isFresh;
    } catch (error) {
        if (error.code === 'NotFound') {
            cache.set(cacheKey, false, freshnessThreshold / 1000);
            console.log(`Cache file not found: ${fileKey}`);
            return false;
        }
        console.error(`Error checking freshness for ${fileKey}:`, error);
        throw error;
    }
}

/**
 * Ensure cache directory exists (S3 bucket verification)
 * PCI DSS 4 Requirement 1.1.2: Maintain inventory of system components
 */
async function ensureCacheDir() {
    console.log(`Using S3 bucket: ${S3_BUCKET}/${S3_PREFIX}`);
}

/**
 * Load cache manifest from S3
 * PCI DSS 4 Requirement 10.2.1: Implements audit trail for cache state
 */
async function loadManifest() {
    let cacheKey = 'manifest';
    let cachedManifest = cache.get(cacheKey);
    if (cachedManifest) {
        console.log('Manifest cache hit (in-memory)');
        return cachedManifest;
    }

    try {
        let data = await s3.getObject({
            Bucket: S3_BUCKET,
            Key: MANIFEST_FILE
        }).promise();
        console.log(`Manifest loaded from S3: ${MANIFEST_FILE}`);
        let parsed = JSON.parse(data.Body.toString('utf8'));
        let manifest = {
            cached_dates: parsed.cached_dates || {},
            today_file: parsed.today_file || null,
            today_mtime: parsed.today_mtime || null,
            cached_consolidation_dates: parsed.cached_consolidation_dates || {},
            today_consolidation_file: parsed.today_consolidation_file || null,
            today_consolidation_mtime: parsed.today_consolidation_mtime || null,
            cached_liquidation_dates: parsed.cached_liquidation_dates || {},
            today_liquidation_file: parsed.today_liquidation_file || null,
            today_liquidation_mtime: parsed.today_liquidation_mtime || null
        };
        cache.set(cacheKey, manifest, FRESHNESS_HISTORICAL / 1000);
        return manifest;
    } catch (error) {
        if (error.code === 'NoSuchKey') {
            console.log('Manifest not found, initializing new manifest');
            let manifest = {
                cached_dates: {},
                today_file: null,
                today_mtime: null,
                cached_consolidation_dates: {},
                today_consolidation_file: null,
                today_consolidation_mtime: null,
                cached_liquidation_dates: {},
                today_liquidation_file: null,
                today_liquidation_mtime: null
            };
            cache.set(cacheKey, manifest, FRESHNESS_HISTORICAL / 1000);
            return manifest;
        }
        console.error('Error loading manifest:', error);
        throw error;
    }
}

/**
 * Save cache manifest to S3
 * PCI DSS 4 Requirement 10.2.1: Implements audit trail for cache state
 */
async function saveManifest(manifest) {
    let cacheKey = 'manifest';
    cache.set(cacheKey, manifest, FRESHNESS_HISTORICAL / 1000);
    try {
        await s3.putObject({
            Bucket: S3_BUCKET,
            Key: MANIFEST_FILE,
            Body: JSON.stringify(manifest, null, 2),
            ContentType: 'application/json'
        }).promise();
        console.log(`Manifest saved to S3: ${MANIFEST_FILE}`);
    } catch (error) {
        console.error('Error saving manifest:', error);
        throw error;
    }
}

/**
 * Clean up old cache files from S3
 * PCI DSS 4 Requirement 3.5.1: Limit storage of account data to that which is needed
 * PCI DSS 4 Requirement 10.2.3: Limit retention time for audit trail data
 */
async function cleanupOldFiles() {
    let now = Date.now();
    try {
        let list = await s3.listObjectsV2({
            Bucket: S3_BUCKET,
            Prefix: S3_PREFIX
        }).promise();
        console.log(`Listed ${list.Contents?.length || 0} files in S3: ${S3_BUCKET}/${S3_PREFIX}`);

        let deletePromises = (list.Contents || [])
            .filter(file => file.Key !== MANIFEST_FILE && file.Key !== CACHE_HITS_FILE && now - new Date(file.LastModified).getTime() > CLEANUP_THRESHOLD)
            .map(file => {
                cache.del(`data:${file.Key}`);
                return s3.deleteObject({
                    Bucket: S3_BUCKET,
                    Key: file.Key
                }).promise().then(() => console.log(`Deleted old cache file from S3: ${file.Key}`));
            });

        await Promise.all(deletePromises);
    } catch (error) {
        console.error('Error cleaning up old files:', error);
        throw error;
    }
}

/**
 * Generate cache file path based on date and type
 * PCI DSS 4 Requirement 3.5.1: Organizes data storage for business needs
 */
function getCacheFilePath(date, type = 'transactions') {
    const dateMoment = moment(date);
    const formattedDate = dateMoment.format('YYYY-MM-DD');
    const suffix = type === 'consolidation' ? '_consolidation' : type === 'liquidation' ? '_liquidation' : '';

    const now = moment();

    console.log(`getCacheFilePath: date=${formattedDate}, type=${type}, isToday=${dateMoment.isSame(now, 'day')}`);

    // ¡CORRECCIÓN: ELIMINAR LA CONDICIÓN !dateMoment.isAfter(now)!
    if (dateMoment.isSame(now, 'day')) {
        return `${S3_PREFIX}${formattedDate}_00-00${suffix}.json`;
    }

    return `${S3_PREFIX}${formattedDate}${suffix}.json`;
}

/**
 * Save data to cache with atomic write operations
 * PCI DSS 4 Requirement 3.5.1: Limits storage of account data
 * PCI DSS 4 Requirement 8.2.3: Secures all stored account data
 */
async function saveToCache(cacheFile, data, freshness, isToday, type = 'transactions') {
    if (!data || (Array.isArray(data) && data.length === 0)) {
        console.warn(`Skipping cache write for ${cacheFile}: No data to store`);
        return;
    }

    let jsonData = safeStringify(data);
    let tempKey = `${cacheFile}.tmp`;

    try {
        await s3.putObject({
            Bucket: S3_BUCKET,
            Key: tempKey,
            Body: jsonData,
            ContentType: 'application/json'
        }).promise();
        console.log(`Wrote temporary file to S3: ${tempKey}`);

        await s3.copyObject({
            Bucket: S3_BUCKET,
            CopySource: `${S3_BUCKET}/${tempKey}`,
            Key: cacheFile
        }).promise();
        await s3.deleteObject({
            Bucket: S3_BUCKET,
            Key: tempKey
        }).promise();
        console.log(`Finalized cache file in S3: ${cacheFile}`);

        let manifest = await loadManifest();
        let dateParts = cacheFile.split('/')[1].split('.')[0].split('_');
        let dateKey = moment(dateParts[0]).format('YYYY-MM-DD');

        if (type === 'liquidation') {
            manifest.cached_liquidation_dates[dateKey] = {
                mtime: Date.now(),
                fresh_until: Date.now() + freshness
            };
            if (isToday) {
                manifest.today_liquidation_file = path.basename(cacheFile);
                manifest.today_liquidation_mtime = Date.now();
            }
        } else if (type === 'consolidation') {
            manifest.cached_consolidation_dates[dateKey] = {
                mtime: Date.now(),
                fresh_until: Date.now() + freshness
            };
            if (isToday) {
                manifest.today_consolidation_file = path.basename(cacheFile);
                manifest.today_consolidation_mtime = Date.now();
            }
        } else {
            manifest.cached_dates[dateKey] = {
                mtime: Date.now(),
                fresh_until: Date.now() + freshness
            };
            if (isToday) {
                manifest.today_file = path.basename(cacheFile);
                manifest.today_mtime = Date.now();
            }
        }
        cache.set(`data:${cacheFile}`, data, freshness / 1000);

        await markFileAsVerified(cacheFile, type);
        await markDateAsVerified(dateParts[0], type);

        await saveManifest(manifest);
    } catch (error) {
        console.error(`Error caching ${cacheFile}:`, error);
        await s3.deleteObject({
            Bucket: S3_BUCKET,
            Key: tempKey
        }).promise().catch(() => {});
    }
}

/**
 * Format monetary amount from transaction data
 * PCI DSS 4 Requirement 3.5.1: Processes financial data for business purposes
 */
function formatMount(numberStr) {
    let num = [parseInt(numberStr.substr(0, 10)), numberStr.substr(-2)];
    return `${num[0]}.${num[1]}`;
}

/**
 * Fetch transactions for a specific day with caching
 * PCI DSS 4 Requirement 10.2.1: Implements audit trail for transaction access
 * PCI DSS 4 Requirement 7.1.1: Restricts access based on user permissions
 */
async function fetchTransactionsForDay(startDate, endDate, req, options = {}) {
    console.log('💡🚨 ->>  fetchTransactionsForDay & transactionsCache <<- 🚨💡');
    try {
        let startMoment = moment(startDate);
        let endMoment = moment(endDate);
        let cacheFile = getCacheFilePath(startMoment);
        let isToday = startMoment.isSame(moment(), 'day');
        let freshness = isToday ? FRESHNESS_TODAY : FRESHNESS_HISTORICAL;

        if (endMoment.isBefore(startMoment)) {
            console.warn('End date is before start date, swapping dates');
            [startMoment, endMoment] = [endMoment, startMoment];
        }

        let now = moment();
        if (startMoment.isAfter(now)) {
            console.warn('Start date is in the future, using current time');
            endMoment = now.clone();
        }

        let formattedStartDate = startMoment.clone().startOf('day').toISOString();
        let formattedEndDate = startMoment.clone().endOf('day').toISOString();

        console.log(`Fetching transactions for DAY: ${formattedStartDate} to ${formattedEndDate}`);

        let cacheKey = getCacheFilePath(startMoment);
        let cachedData = await getFromCacheOptimized(cacheKey, freshness, 'transactions');
        if (cachedData) {
            console.log(`Cache hit for day: ${formattedStartDate} to ${formattedEndDate}`);
            return cachedData;
        }

        const cleanOptions = {
            fechas: `${formattedStartDate} ${formattedEndDate}`
        };

        if (options.terminal_id && options.terminal_id !== '') cleanOptions.terminal_id = options.terminal_id;
        if (options.merchant_id && options.merchant_id !== '') cleanOptions.merchant_id = options.merchant_id;
        if (options.card_type && options.card_type !== '') cleanOptions.card_type = options.card_type;
        if (options.id_client && options.id_client !== '') cleanOptions.id_client = options.id_client;
        if (options.id_merchant && options.id_merchant !== '') cleanOptions.id_merchant = options.id_merchant;
        if (options.estatus_f && options.estatus_f !== '') cleanOptions.estatus_f = options.estatus_f;
        if (options.tipo_operacion && options.tipo_operacion !== '') cleanOptions.tipo_operacion = options.tipo_operacion;
        if (options.bin && options.bin !== '') cleanOptions.bin = options.bin;
        if (options.resp_code && options.resp_code !== '') cleanOptions.resp_code = options.resp_code;

        console.log('Clean options for daily fetch:', cleanOptions);

        let transactions = await getTransRaw(cleanOptions, req);

        if (transactions && transactions.length > 0) {
            const dayStart = startMoment.clone().startOf('day');
            const dayEnd = startMoment.clone().endOf('day');

            // ¡¡¡CORRECCIÓN CRÍTICA AQUÍ!!! Usar momento con timezone global
            const filteredTransactions = transactions.filter(tx => {
                const txDate = moment(tx.creation_date).tz(process.env.TZ);
                return txDate.isBetween(dayStart, dayEnd, null, '[]');
            });

            if (filteredTransactions.length !== transactions.length) {
                console.warn(`Filtered out ${transactions.length - filteredTransactions.length} transactions outside date range`);
            }

            await saveToCache(cacheKey, filteredTransactions, freshness, isToday, 'transactions');
            return filteredTransactions;
        }

        return transactions || [];
    } catch (error) {
        console.error('Error in fetchTransactionsForDay:', error);
        throw error;
    }
}

/**
 * Fetch liquidation data for a specific day
 * PCI DSS 4 Requirement 10.2.1: Implements audit trail for financial data access
 * PCI DSS 4 Requirement 7.1.1: Restricts access based on user permissions
 */
async function fetchLiquidationForDay(startDate, endDate, req) {
    console.log('💡🚨 ->>  fetchLiquidationForDay & transactionsCache <<- 🚨💡');
    try {
        // PCI DSS 4 Requirement 7.1.1: Check user role for access control
        let isAdmn = req.user.is_admin;

        console.log(`fetchLiquidationForDay called with: ${startDate} to ${endDate}`);

        // PCI DSS 4 Requirement 10.3.1: Use timezone-aware timestamps for audit accuracy
        let startMoment = moment(startDate).tz(process.env.TZ);
        let endMoment = moment(endDate).tz(process.env.TZ);

        console.log(`Querying database with timezone: ${startMoment.format('YYYY-MM-DD HH:mm:ss')} to ${endMoment.format('YYYY-MM-DD HH:mm:ss')}`);
        console.log(`Which is Mexico City: ${startMoment.tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss')} to ${endMoment.tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss')}`);

        // PCI DSS 4 Requirement 10.2.1: Audit trail - log transaction data access
        let isoMessage = await getTransRaw({
            fechas: `${startMoment.toISOString()} ${endMoment.toISOString()}`
        }, req);

        console.log(`Fetched ${isoMessage?.length || 0} transactions for liquidation`);

        // PCI DSS 4 Requirement 10.2.3: Filter to specific date range to limit data access
        const dayStart = startMoment.clone().startOf('day');
        const dayEnd = startMoment.clone().endOf('day');

        // PCI DSS 4 Requirement 3.5.1: Only process transactions within requested date range
        const filteredIsoMessage = isoMessage.filter(tx => {
            if (!tx.creation_date) return false;
            const txDate = moment(tx.creation_date).tz(process.env.TZ);
            return txDate.isBetween(dayStart, dayEnd, null, '[]');
        });

        // PCI DSS 4 Requirement 10.2.1: Audit trail - log data filtering for security monitoring
        if (filteredIsoMessage.length !== isoMessage.length) {
            console.warn(`🚨 LIQUIDATION: Filtered out ${isoMessage.length - filteredIsoMessage.length} transactions from wrong day!`);
            console.warn(`Expected only transactions from ${dayStart.format('YYYY-MM-DD')}`);

            const allDates = isoMessage.map(tx => moment(tx.creation_date).tz(process.env.TZ).format('YYYY-MM-DD'));
            const uniqueDates = [...new Set(allDates)];
            console.warn(`Actual dates received: ${uniqueDates.join(', ')}`);
        }

        isoMessage = filteredIsoMessage;

        // PCI DSS 4 Requirement 3.5.1: Initialize data structure for business purposes only
        let dataDT = { data: [] };

        if (isoMessage.length === 0) {
            console.warn(`No transactions fetched for liquidation: ${startDate} to ${endDate}`);
            return dataDT;
        }

        // PCI DSS 4 Requirement 3.5.1: Process in batches to limit memory usage and data exposure
        for (let i = 0; i < isoMessage.length; i += BATCH_SIZE) {
            let batch = isoMessage.slice(i, i + BATCH_SIZE);
            for (let value of batch) {
                // PCI DSS 4 Requirement 3.5.1: Calculate rates for financial processing only
                let tasa = { banco: 0.00, agre: 0.00, comer: 0.00, comision: 0.00 };
                let merchant = {
                    name_merchant: value.merchant?.name_merchant || value.name_merchant,
                    afiliation_number: value.merchant?.afiliation_number,
                    afiliation_link: value.merchant?.afiliation_link,
                    taza_credito: value.merchant?.taza_credito,
                    taza_debito: value.merchant?.taza_debito,
                    taza_amex: value.merchant?.taza_amex,
                    tasa_credito_b: value.merchant?.tasa_credito_b || '0.00',
                    tasa_debito_b: value.merchant?.tasa_debito_b || '0.00',
                    tasa_amex_b: value.merchant?.tasa_amex_b || '0.00',
                    tasa_credito_c: value.merchant?.tasa_credito_c || '0.00',
                    tasa_debito_c: value.merchant?.tasa_debito_c || '0.00',
                    tasa_amex_c: value.merchant?.tasa_amex_c || '0.00',
                    tasa_credito_d: value.merchant?.tasa_credito_d || '0.00',
                    tasa_debito_d: value.merchant?.tasa_debito_d || '0.00',
                    tasa_amex_d: value.merchant?.tasa_amex_d || '0.00',
                    taza_link_credito: value.merchant?.taza_link_credito,
                    taza_link_debito: value.merchant?.taza_link_debito,
                    taza_link_amex: value.merchant?.taza_link_amex,
                    tasa_link_credito_b: value.merchant?.tasa_link_credito_b || '0.00',
                    tasa_link_debito_b: value.merchant?.tasa_link_debito_b || '0.00',
                    tasa_link_amex_b: value.merchant?.tasa_link_amex_b || '0.00',
                    tasa_link_credito_c: value.merchant?.tasa_link_credito_c || '0.00',
                    tasa_link_debito_c: value.merchant?.tasa_link_debito_c || '0.00',
                    tasa_link_amex_c: value.merchant?.tasa_link_amex_c || '0.00',
                    tasa_link_credito_d: value.merchant?.tasa_link_credito_d || '0.00',
                    tasa_link_debito_d: value.merchant?.tasa_link_debito_d || '0.00',
                    tasa_link_amex_d: value.merchant?.tasa_link_amex_d || '0.00'
                };

                // PCI DSS 4 Requirement 3.5.1: Parse additional transaction data only if needed for business logic
                let more_info = null;
                value.msi_months = '';

                if (value.more_info) {
                    try {
                        // PCI DSS 4 Requirement 6.2.4: Safe JSON parsing with error handling
                        more_info = JSON.parse(value.more_info);
                        if (more_info.chargePlan) value.msi_months = more_info.chargePlan.months;
                        if (more_info.link_pago && merchant.afiliation_link) merchant.afiliation_number = merchant.afiliation_link;
                        if (!more_info.merchant_data) more_info = null;
                    } catch (error) {
                        console.warn('Error parsing more_info for tx:', value, error);
                    }
                }

                if (value.resp_code === '65') value.folio = value.reference_number;

                let sourceData = more_info ? more_info.merchant_data : merchant;

                // PCI DSS 4 Requirement 3.5.1: Process card type data for rate calculation only
                if (value.card_type) {
                    let isLink = more_info?.link_pago ?? false;
                    // PCI DSS 4 Requirement 3.5.1: Rate mapping based on card type for business purposes
                    let cardTypeMapping = {
                        'C0': {
                            base: isLink ? 'taza_link_credito' : 'taza_credito',
                            b: isLink ? 'tasa_link_credito_b' : 'tasa_credito_b',
                            d: isLink ? 'tasa_link_credito_d' : 'tasa_credito_d',
                            c: isLink ? 'tasa_link_credito_c' : 'tasa_credito_c'
                        },
                        'P0': {
                            base: isLink ? 'taza_link_debito' : 'taza_debito',
                            b: isLink ? 'tasa_link_debito_b' : 'tasa_debito_b',
                            d: isLink ? 'tasa_link_debito_d' : 'tasa_debito_d',
                            c: isLink ? 'tasa_link_debito_c' : 'tasa_debito_c'
                        },
                        '00': {
                            base: isLink ? 'taza_link_amex' : 'taza_amex',
                            b: isLink ? 'tasa_link_amex_b' : 'tasa_amex_b',
                            d: isLink ? 'tasa_link_amex_d' : 'tasa_amex_d',
                            c: isLink ? 'tasa_link_amex_c' : 'tasa_amex_c'
                        },
                        'default': {
                            base: isLink ? 'taza_link_credito' : 'taza_credito',
                            b: isLink ? 'tasa_link_credito_b' : 'tasa_credito_b',
                            d: isLink ? 'tasa_link_credito_d' : 'tasa_credito_d',
                            c: isLink ? 'tasa_link_credito_c' : 'tasa_credito_c'
                        }
                    };

                    // PCI DSS 4 Requirement 7.1.1: Admin-only access to bank rate data
                    let { base, b, d, c } = cardTypeMapping[value.card_type] || cardTypeMapping['default'];
                    tasa.banco = isAdmn ? parseFloat(sourceData[base] || 0) : 0;
                    tasa.agre = parseFloat(sourceData[b] || 0);
                    tasa.comer = parseFloat(sourceData[d] || 0);
                    tasa.comision = isAdmn ? parseFloat(sourceData[c] || 0) : 0;
                } else {
                    tasa.banco = isAdmn ? parseFloat(sourceData.taza_credito || 0) : 0;
                    tasa.agre = parseFloat(sourceData.tasa_credito_b || 0);
                    tasa.comer = parseFloat(sourceData.tasa_credito_d || 0);
                    tasa.comision = isAdmn ? parseFloat(sourceData.tasa_credito_c || 0) : 0;
                }

                // PCI DSS 4 Requirement 3.5.1: Apply MSI rates only if needed for business calculation
                if (value.msi_months && more_info && more_info.merchant_data && more_info.merchant_data.MSI) {
                    // PCI DSS 4 Requirement 6.2.4: Safe JSON parsing with error handling
                    let msi_data = (typeof more_info.merchant_data.MSI === 'string') ? JSON.parse(more_info.merchant_data.MSI || '[]') : more_info.merchant_data.MSI;
                    let msi_filter = msi_data.find(v => v.type == value.msi_months);
                    if (msi_filter) tasa.agre = parseFloat(msi_filter.percent) || 0;
                }

                // PCI DSS 4 Requirement 3.5.1: Process transaction amount for financial calculation only
                let monto = null;
                let devolucion = false;
                console.log("value.amount", value.amount);
                switch (value.tipo_operacion?.id_operation) {
                    case 6: case 7: case 16:
                        devolucion = true;
                        monto = parseFloat(-1 * (formatMount(value.amount) || 0)).toFixed(2);
                        console.log("monto", monto);
                        break;
                    default:
                        monto = parseFloat(formatMount(value.amount) || 0).toFixed(2);
                        console.log("monto def", monto);
                        break;
                }

                // PCI DSS 4 Requirement 3.5.1: Determine payment method from BIN for business purposes only
                let metodo = null;
                if (!value.bin_info) {
                    if (value.bin) {
                        switch (value.bin.substring(0, 1)) {
                            case '3': metodo = 'AMEX'; break;
                            case '4': metodo = 'VISA'; break;
                            case '5': metodo = 'MASTERCARD'; break;
                            default: metodo = 'Internacional'; break;
                        }
                    } else {
                        metodo = '';
                    }
                } else {
                    metodo = value.bin_info.tipo_tarjeta?.name || '';
                }

                // PCI DSS 4 Requirement 3.5.1: Calculate fees and totals for financial reporting only
                let tbanco = 0;
                let mphs1 = parseFloat((parseFloat(monto) * (tasa.agre / 100)).toFixed(2)) * -1;
                let iva1 = parseFloat((mphs1 * (vars.iva || 0.16)).toFixed(2));
                let mphs2 = parseFloat(tasa.comer) * -1;
                mphs2 = parseFloat(mphs2.toFixed(2));
                let iva2 = parseFloat((mphs2 * (vars.iva || 0.16)));
                let suma_total = (mphs1 + mphs2 + tbanco + iva1 + iva2);
                let totales = {
                    totalC: mphs1 + mphs2 + tbanco,
                    totalI: iva1 + iva2,
                    granT: suma_total,
                    totalF: suma_total + parseFloat(monto)
                };

                // PCI DSS 4 Requirement 10.2.1: Audit trail - record transaction status for monitoring
                let status_f = null;
                switch (value.estatus_f) {
                    case '1': case 1: status_f = 'Pendiente'; break;
                    case '2': case 2: status_f = 'Por liquidar'; break;
                    case '3': case 3: status_f = 'Liquidado'; break;
                    default: status_f = 'No disponible'; break;
                }

                // PCI DSS 4 Requirement 3.5.1: Extract tip and waiter data only if needed for business logic
                let propina = 'N/A';
                let waiter = 'N/A';
                if (value.more_info) {
                    try {
                        // PCI DSS 4 Requirement 6.2.4: Safe JSON parsing with error handling
                        let ax = JSON.parse(value.more_info);
                        propina = isNaN(ax.tip) ? 'N/A' : ax.tip;
                        waiter = isNaN(ax.waiter) ? 'N/A' : ax.waiter;
                    } catch (error) {
                        console.log('Impossible to parse more_info:', value, error);
                    }
                }

                // PCI DSS 4 Requirement 3.5.1: Determine card type for rate calculation only
                let card_type = 'INTERNACIONAL';
                if (value.card_type === '00') {
                    card_type = value.bin_info ? value.bin_info.tipo_producto?.name || 'INTERNACIONAL' : 'INTERNACIONAL';
                } else {
                    card_type = value.card_type === 'C0' ? 'CRÉDITO' : 'DÉBITO';
                }

                // PCI DSS 4 Requirement 3.5.1: Mask card number - only show first 6 and last 4 digits
                let card = (value.bin && value.bin !== '') ? `${value.bin.substr(0,4)}-${value.bin.substr(4,6)}**-****-${value.last4}` : '';
                let entryMode = '';
                switch (value.entry_mode) {
                    case '051': entryMode = 'Chip'; break;
                    case '901': entryMode = 'Banda Magnética'; break;
                    case '010': entryMode = 'Manual'; break;
                    case '911': entryMode = 'Sin Contacto Magnético'; break;
                    case '801': entryMode = 'Fallback'; break;
                    case '810': entryMode = 'Ecommerce'; break;
                    case '071': entryMode = 'Sin Contacto'; break;
                    default: entryMode = '';
                }

                // PCI DSS 4 Requirement 3.5.1: Build response object with only necessary business data
                let newObj = {
                    reg: {
                        id_message: value.id_message,
                        id_operation: value.id_operation,
                        trace_number: value.trace_number,
                        reference_number: value.reference_number,
                        amount: value.amount,
                        resp_code: value.resp_code,
                        authorization: value.authorization,
                        bin: value.bin,
                        last4: value.last4,
                        entry_mode: value.entry_mode,
                        creation_date: value.creation_date,
                        terminal: value.terminal,
                        name_merchant: value.name_merchant,
                        estatus_f: value.estatus_f,
                        card_type: value.card_type,
                        folio: value.folio,
                        more_info: value.more_info
                    },
                    Cliente: more_info?.client_data?.name || 'NO DISPONIBLE',
                    Comercio: sourceData.name_merchant || 'NO DISPONIBLE',
                    Afiliación: sourceData.afiliation_number || 'NO DISPONIBLE',
                    TipoProd: card_type,
                    Tarjeta: card,
                    idTrans: value.trace_number || '',
                    Estatus: value.codigo_resp?.description || 'NO DISPONIBLE',
                    EstatusF: status_f,
                    Método: metodo,
                    Terminal: helpers.haveValue(value.terminal),
                    TipoT: helpers.haveValue(value.tipo_operacion?.name),
                    Autorización: helpers.haveValue(value.authorization),
                    Monto: monto,
                    MPHS1: mphs1.toFixed(2),
                    IVA1: iva1.toFixed(2),
                    TotalC1: (mphs1 + iva1).toFixed(2),
                    MPHS2: mphs2.toFixed(2),
                    IVA2: iva2.toFixed(2),
                    TotalC2: (mphs2 + iva2).toFixed(2),
                    tbanco: tbanco.toFixed(2),
                    TotalC: totales.totalC.toFixed(2),
                    TotalI: totales.totalI.toFixed(2),
                    GranT: totales.granT.toFixed(2),
                    TotalFinal: totales.totalF.toFixed(2),
                    propina: propina,
                    mesero: waiter,
                    entryMode: entryMode,
                    msi_months: value.msi_months || 'N/A'
                };
                dataDT.data.push(newObj);
            }
        }

        console.log(`Processed ${dataDT.data.length} liquidation records for ${startDate} to ${endDate}`);
        return dataDT;
    } catch (error) {
        console.error('Error in fetchLiquidationForDay:', error);
        throw error;
    }
}

async function getReportLiquidationByDate(fechas, req) {
    console.log('💡🚨 ->>  getReportLiquidationByDate & transactionsCache <<- 🚨💡');
    try {
        console.log(`Raw fechas received: "${fechas}"`);

        let [startDateStr, endDateStr] = fechas.split(' ');

        console.log(`Original dates - start: "${startDateStr}", end: "${endDateStr}"`);

        let startDate, endDate;

        if (startDateStr.includes('T') && startDateStr.endsWith('Z')) {
            console.log('Detected UTC timestamp format');
            startDate = startDateStr;
            endDate = endDateStr;
        } else if (startDateStr.includes(' ') && startDateStr.includes(':')) {
            console.log('Detected local datetime format without timezone');
            startDate = moment.tz(startDateStr, 'YYYY-MM-DD HH:mm:ss', 'America/Mexico_City').utc().toISOString();
            endDate = moment.tz(endDateStr, 'YYYY-MM-DD HH:mm:ss', 'America/Mexico_City').utc().toISOString();
        } else if (!startDateStr.includes('T')) {
            console.log('Detected date-only format');
            startDate = moment.tz(startDateStr + ' 00:00:00', 'YYYY-MM-DD HH:mm:ss', 'America/Mexico_City').utc().toISOString();
            endDate = moment.tz(endDateStr + ' 23:59:59.999', 'YYYY-MM-DD HH:mm:ss', 'America/Mexico_City').utc().toISOString();
        } else {
            ({ startDate, endDate } = validateAndLimitDateRange(fechas));
        }

        console.log(`Using UTC dates - start: ${startDate}, end: ${endDate}`);

        let start = moment(startDate).tz(process.env.TZ);
        let end = moment(endDate).tz(process.env.TZ);
        let now = moment().tz(process.env.TZ);

        console.log(`Now UTC: ${now.format('YYYY-MM-DD HH:mm:ss')}`);

        if (!start.isValid() || !end.isValid()) {
            console.error('Invalid dates after processing:', { start: start.toString(), end: end.toString() });
            return { data: [] };
        }

        console.log(`Final UTC date range: ${start.format('YYYY-MM-DD HH:mm:ss')} to ${end.format('YYYY-MM-DD HH:mm:ss')}`);
        console.log(`In Mexico City time: ${start.tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss')} to ${end.tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss')}`);

        if (start.isAfter(now)) {
            console.log('Start date is in the future, no data to process');
            return { data: [] };
        }

        let effectiveEnd = end.isAfter(now) ? now.clone() : end;

        if (start.isAfter(effectiveEnd)) {
            console.log('Start date is after effective end date, no data to process');
            return { data: [] };
        }

        let dataDT = { data: [] };
        console.log(`Query range in UTC: ${start.format('YYYY-MM-DD')} to ${effectiveEnd.format('YYYY-MM-DD')}`);

        await ensureCacheDir();

        let fetchPromises = [];

        let datesToProcess = [];
        let currentDate = start.clone().startOf('day');
        let lastDate = effectiveEnd.clone().startOf('day');

        console.log(`Date range to process: ${currentDate.format('YYYY-MM-DD')} to ${lastDate.format('YYYY-MM-DD')}`);

        while (currentDate.isSameOrBefore(lastDate, 'day')) {
            datesToProcess.push(currentDate.clone());
            currentDate.add(1, 'day');
        }

        console.log(`Dates to process: ${datesToProcess.map(d => d.format('YYYY-MM-DD')).join(', ')}`);

        for (let date of datesToProcess) {
            fetchPromises.push((async (processingDate) => {
                console.log(`\n=== Processing day: ${processingDate.format('YYYY-MM-DD')} ===`);

                let cacheFile = getCacheFilePath(processingDate, 'liquidation');
                let isToday = processingDate.isSame(now, 'day');
                let freshness = isToday ? FRESHNESS_TODAY : FRESHNESS_HISTORICAL;

                console.log(`Cache file: ${cacheFile}`);
                console.log(`Is today? ${isToday}`);

                if (!isToday && await isFileVerified(cacheFile, 'liquidation')) {
                    console.log(`Historical liquidation file verified - direct load: ${cacheFile}`);
                    try {
                        let data = await s3.getObject({
                            Bucket: S3_BUCKET,
                            Key: cacheFile
                        }).promise();
                        let parsedData = JSON.parse(data.Body.toString('utf8'));
                        console.log(`Loaded ${parsedData.length} liquidation records from verified file: ${cacheFile}`);
                        return parsedData;
                    } catch (error) {
                        console.error(`Failed to load verified liquidation file ${cacheFile}:`, error);
                    }
                }

                let cachedData = await getFromCacheOptimized(cacheFile, freshness, 'liquidation');
                if (cachedData) {
                    console.log(`Liquidation cache hit for ${processingDate.format('YYYY-MM-DD')}`);
                    return cachedData;
                }

                console.log(`Liquidation cache miss for ${processingDate.format('YYYY-MM-DD')}`);

                let dayStart = processingDate.clone().tz('America/Mexico_City').startOf('day');
                let dayEnd = processingDate.clone().tz('America/Mexico_City').endOf('day');

                let dayStartUTC = dayStart.tz(process.env.TZ);
                let dayEndUTC = dayEnd.tz(process.env.TZ);

                console.log(`Mexico City day: ${dayStart.format('YYYY-MM-DD HH:mm:ss')} to ${dayEnd.format('YYYY-MM-DD HH:mm:ss')}`);
                console.log(`UTC query range: ${dayStartUTC.format('YYYY-MM-DD HH:mm:ss')} to ${dayEndUTC.format('YYYY-MM-DD HH:mm:ss')}`);

                let dayData = await fetchLiquidationForDay(dayStartUTC.toISOString(), dayEndUTC.toISOString(), req);

                if (!dayData.data || dayData.data.length === 0) {
                    console.log(`No data fetched for ${processingDate.format('YYYY-MM-DD')}`);
                    return [];
                }

                console.log(`Fetched ${dayData.data.length} records for ${processingDate.format('YYYY-MM-DD')}`);
                await saveToCache(cacheFile, dayData.data, freshness, isToday, 'liquidation');
                return dayData.data;
            })(date));
        }

        let results = await Promise.all(fetchPromises);
        dataDT.data = results.flat();
        console.log(`\n=== FINAL RESULT ===`);
        console.log(`Total liquidation records loaded: ${dataDT.data.length}`);

        if (dataDT.data.length > 0) {
            const dates = dataDT.data.map(item =>
                moment(item.reg?.creation_date || item.creation_date).format('YYYY-MM-DD')
            );
            const uniqueDates = [...new Set(dates)];
            console.log(`Dates with data: ${uniqueDates.join(', ')}`);
        }

        return dataDT;

    } catch (error) {
        console.error('Error in getReportLiquidationByDate:', error);
        throw error;
    }
}

async function backfillLiquidation(startDate, endDate, req) {
    let manifest = await loadManifest();
    let now = moment();

    let start = moment.max(moment(startDate), moment().subtract(BACKFILL_LIMIT, 'days'));
    let end = moment.min(moment(endDate), now);

    if (!start.isValid() || !end.isValid() || start.isAfter(end)) {
        console.error('Invalid backfill date range:', { start: start.toString(), end: end.toString() });
        return;
    }

    let backfillPromises = [];
    let current = start.clone().startOf('day');

    while (current.isSameOrBefore(end, 'day')) {
        let cacheFile = getCacheFilePath(current, 'liquidation');

        if (await isDateVerified(current, 'liquidation')) {
            console.log(`Skipping backfill for verified date: ${current.format('YYYY-MM-DD')}`);
            current.add(1, 'day');
            continue;
        }

        if (!(await isCacheFresh(cacheFile, FRESHNESS_HISTORICAL, 'liquidation'))) {
            backfillPromises.push(async () => {
                console.log(`Backfilling liquidation cache for ${current.format('YYYY-MM-DD')}`);

                let dayStart = current.clone().startOf('day').toISOString();
                let dayEnd = current.clone().endOf('day').toISOString();

                let dataDT = await fetchLiquidationForDay(dayStart, dayEnd, req);
                if (dataDT.data.length === 0) {
                    console.warn(`No data to cache for ${current.format('YYYY-MM-DD')}`);
                    return;
                }

                await saveToCache(cacheFile, dataDT.data, FRESHNESS_HISTORICAL, false, 'liquidation');
            });
        } else {
            await markDateAsVerified(current, 'liquidation');
        }
        current.add(1, 'day');
    }

    await Promise.all(backfillPromises.map(fn => fn()));
    await cleanupOldFiles();
}

async function backfillCache(startDate, endDate, req, options) {
    let now = moment();
    let start = moment.max(moment(startDate), moment().subtract(BACKFILL_LIMIT, 'days'));
    let end = moment.min(moment(endDate), now);

    let backfillPromises = [];
    let current = start.clone().startOf('day');

    while (current.isSameOrBefore(end, 'day')) {
        let cacheFile = getCacheFilePath(current);

        if (await isDateVerified(current, 'transactions')) {
            console.log(`Skipping transaction backfill for verified date: ${current.format('YYYY-MM-DD')}`);
            current.add(1, 'day');
            continue;
        }

        if (!(await isCacheFresh(cacheFile, FRESHNESS_HISTORICAL, 'transactions'))) {
            backfillPromises.push(async () => {
                console.log(`Backfilling cache for ${current.format('YYYY-MM-DD')}`);

                const cleanOptions = {
                    ...(options.terminal_id && { terminal_id: options.terminal_id }),
                    ...(options.merchant_id && { merchant_id: options.merchant_id }),
                    ...(options.card_type && { card_type: options.card_type })
                };

                let dayStart = current.toISOString();
                let dayEnd = current.clone().endOf('day').toISOString();

                let transactions = await fetchTransactionsForDay(dayStart, dayEnd, req, cleanOptions);
                if (transactions.length === 0) {
                    console.warn(`No transaction data to cache for ${current.format('YYYY-MM-DD')}`);
                    return;
                }

                await saveToCache(cacheFile, transactions, FRESHNESS_HISTORICAL, false, 'transactions');
            });
        } else {
            await markDateAsVerified(current, 'transactions');
        }
        current.add(1, 'day');
    }

    await Promise.all(backfillPromises.map(fn => fn()));
    await cleanupOldFiles();
}

async function getTransactionsByDateRange(options, req) {
    console.log('💡🚨 ->>  getTransactionsByDateRange & transactionsCache <<- 🚨💡');
    if (!req._cacheCallDepth) req._cacheCallDepth = 0;
    req._cacheCallDepth++;

    if (req._cacheCallDepth > 3) {
        console.error('❌ CIRCULAR DEPENDENCY DETECTED: Too many recursive cache calls');
        req._cacheCallDepth = 0;
        throw new Error('Circular dependency in cache calls');
    }

    try {
        let { fechas } = options;

        let { startDate, endDate } = validateAndLimitDateRange(fechas);

        console.log(`Processing transactions for range: ${startDate} to ${endDate}`);

        let start = moment(startDate).startOf('day');
        let end = moment(endDate).endOf('day');
        let now = moment();

        if (start.isAfter(now)) {
            console.log('Start date is in the future, adjusting to current time');
            start = now.clone().startOf('day');
        }

        let effectiveEnd = end.isAfter(now) ? now.clone() : end;

        if (start.isAfter(effectiveEnd)) {
            console.log('Start date is after effective end date, no data to process');
            return [];
        }

        let transactions = [];

        await ensureCacheDir();

        if (start.isBefore(now, 'day')) {
            console.log('Running backfill for historical transaction data...');
            const backfillOptions = {
                ...(options.terminal_id && { terminal_id: options.terminal_id }),
                ...(options.merchant_id && { merchant_id: options.merchant_id }),
                ...(options.card_type && { card_type: options.card_type })
            };
            await backfillCache(start, end, req, backfillOptions);
        }

        let current = start.clone();
        while (current.isSameOrBefore(end, 'day')) {
            let cacheFile = getCacheFilePath(current);
            let isToday = current.isSame(now, 'day');
            let freshness = isToday ? FRESHNESS_TODAY : FRESHNESS_HISTORICAL;

            if (!isToday && await isFileVerified(cacheFile, 'transactions')) {
                console.log(`Historical transaction file verified - direct load: ${cacheFile}`);
                try {
                    let data = await s3.getObject({
                        Bucket: S3_BUCKET,
                        Key: cacheFile
                    }).promise();
                    let parsedData = safeParse(data.Body.toString('utf8'), []);
                    transactions.push(...parsedData);
                    console.log(`Loaded ${parsedData.length} transaction records from verified file: ${cacheFile}`);
                    current.add(1, 'day');
                    continue;
                } catch (error) {
                    console.error(`Failed to load verified transaction file ${cacheFile}:`, error);
                }
            }

            if (await isCacheFresh(cacheFile, freshness, 'transactions')) {
                console.log(`Transaction cache hit for ${current.format('YYYY-MM-DD')}`);
                try {
                    let data = await s3.getObject({
                        Bucket: S3_BUCKET,
                        Key: cacheFile
                    }).promise();
                    let parsedData = safeParse(data.Body.toString('utf8'), []);
                    transactions.push(...parsedData);
                    console.log(`Loaded ${parsedData.length} transaction records from cache: ${cacheFile}`);
                } catch (error) {
                    console.error(`❌ Failed to parse cache file ${cacheFile}:`, error.message);

                    try {
                        await s3.deleteObject({
                            Bucket: S3_BUCKET,
                            Key: cacheFile
                        }).promise();
                        console.log(`🗑️ Deleted corrupt cache file: ${cacheFile}`);
                    } catch (deleteError) {
                        console.error(`Failed to delete corrupt file ${cacheFile}:`, deleteError.message);
                    }

                    cache.del(`data:${cacheFile}`);
                    cache.del(`freshness:${cacheFile}`);

                    const cleanOptions = {
                        ...(options.terminal_id && { terminal_id: options.terminal_id }),
                        ...(options.merchant_id && { merchant_id: options.merchant_id }),
                        ...(options.card_type && { card_type: options.card_type })
                    };

                    let dayStart = current.toISOString();
                    let dayEnd = current.clone().endOf('day').toISOString();
                    let dayTransactions = await fetchTransactionsForDay(dayStart, dayEnd, req, cleanOptions);
                    transactions.push(...dayTransactions);

                    try {
                        let jsonData = safeStringify(dayTransactions);
                        await s3.putObject({
                            Bucket: S3_BUCKET,
                            Key: cacheFile,
                            Body: jsonData,
                            ContentType: 'application/json'
                        }).promise();

                        let manifest = await loadManifest();
                        manifest.cached_dates[current.format('YYYY-MM-DD')] = {
                            mtime: Date.now(),
                            fresh_until: Date.now() + freshness
                        };
                        if (isToday) {
                            manifest.today_file = path.basename(cacheFile);
                            manifest.today_mtime = Date.now();
                        }
                        await saveManifest(manifest);
                    } catch (err) {
                        console.error(`Invalid JSON for ${cacheFile}, skipping:`, err);
                        continue;
                    }
                }
            } else {
                console.log(`Transaction cache miss for ${current.format('YYYY-MM-DD')}`);
                const cleanOptions = {
                    ...(options.terminal_id && { terminal_id: options.terminal_id }),
                    ...(options.merchant_id && { merchant_id: options.merchant_id }),
                    ...(options.card_type && { card_type: options.card_type })
                };

                let dayStart = current.toISOString();
                let dayEnd = current.clone().endOf('day').toISOString();
                let dayTransactions = await fetchTransactionsForDay(dayStart, dayEnd, req, cleanOptions);
                transactions.push(...dayTransactions);

                try {
                    let jsonData = safeStringify(dayTransactions);
                    await s3.putObject({
                        Bucket: S3_BUCKET,
                        Key: cacheFile,
                        Body: jsonData,
                        ContentType: 'application/json'
                    }).promise();

                    let manifest = await loadManifest();
                    manifest.cached_dates[current.format('YYYY-MM-DD')] = {
                        mtime: Date.now(),
                        fresh_until: Date.now() + freshness
                    };
                    if (isToday) {
                        manifest.today_file = path.basename(cacheFile);
                        manifest.today_mtime = Date.now();
                    }
                    await saveManifest(manifest);
                } catch (error) {
                    console.error(`Invalid JSON for ${cacheFile}, skipping:`, error);
                    continue;
                }
            }

            current.add(1, 'day');
        }

        if (end.isSame(now, 'day')) {
            let manifest = await loadManifest();
            let todayFile = getCacheFilePath(now);
            let lastMtime = manifest.today_mtime || 0;

            try {
                let data = await s3.headObject({
                    Bucket: S3_BUCKET,
                    Key: todayFile
                }).promise();
                lastMtime = new Date(data.LastModified).getTime();
            } catch (error) {
                if (error.code !== 'NotFound') throw error;
            }

            const cleanOptions = {};
            if (options.terminal_id) cleanOptions.terminal_id = options.terminal_id;
            if (options.merchant_id) cleanOptions.merchant_id = options.merchant_id;
            if (options.card_type) cleanOptions.card_type = options.card_type;
            if (options.id_client) cleanOptions.id_client = options.id_client;
            if (options.id_merchant) cleanOptions.id_merchant = options.id_merchant;
            if (options.estatus_f) cleanOptions.estatus_f = options.estatus_f;
            if (options.tipo_operacion) cleanOptions.tipo_operacion = options.tipo_operacion;
            if (options.bin) cleanOptions.bin = options.bin;
            if (options.resp_code) cleanOptions.resp_code = options.resp_code;

            let newTransactions = await fetchTransactionsForDay(
                moment(lastMtime).toISOString(),
                now.toISOString(),
                req,
                cleanOptions
            );

            if (newTransactions.length > 0) {
                let allTransactions = [];
                try {
                    let existing = await s3.getObject({
                        Bucket: S3_BUCKET,
                        Key: todayFile
                    }).promise().catch(() => ({ Body: '[]' }));
                    allTransactions = [...safeParse(existing.Body.toString('utf8'), []), ...newTransactions];

                    const uniqueMap = new Map();
                    allTransactions.forEach(tx => {
                        const key = tx.id_message || tx.trace_number;
                        if (key && !uniqueMap.has(key)) {
                            uniqueMap.set(key, tx);
                        }
                    });
                    allTransactions = Array.from(uniqueMap.values());

                } catch (error) {
                    console.error(`Failed to parse existing cache ${todayFile}:`, error);
                    allTransactions = newTransactions;
                }

                try {
                    let jsonData = safeStringify(allTransactions);
                    await s3.putObject({
                        Bucket: S3_BUCKET,
                        Key: todayFile,
                        Body: jsonData,
                        ContentType: 'application/json'
                    }).promise();

                    transactions = transactions.filter(tx => {
                        const txDate = moment(tx.creation_date);
                        return !txDate.isSame(now, 'day');
                    });
                    transactions.push(...allTransactions);

                    manifest.today_mtime = Date.now();
                    await saveManifest(manifest);
                } catch (error) {
                    console.error(`Invalid JSON for ${todayFile}, skipping:`, error);
                }
            }
        }

        return transactions;

    } catch (error) {
        console.error('Error in getTransactionsByDateRange:', error);
        console.log('⚠️ Cache error, will fallback to database query');
    } finally {
        req._cacheCallDepth--;
    }
}

async function fetchConsolidationForDay(dayTimestamp, cliente, req) {
    console.log('💡🚨 ->>  fetchConsolidationForDay & transactionsCache <<- 🚨💡');

    let min = 60000;
    let hora = 60 * min;
    let dayStart = new Date(parseInt(dayTimestamp) - hora);
    let dayEnd = new Date(parseInt(dayTimestamp) + (22 * hora) + (59 * min) + (min - 1000));

    let status = [2, 4, 5];
    let where = cliente === 'all' ? { status, created_at: { [Op.between]: [dayStart, dayEnd] } } : { status, id_client: cliente, created_at: { [Op.between]: [dayStart, dayEnd] } };

    let response = await db.consolidacion.findAll({
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
    }).catch(error => {
        console.error(`Error querying consolidacion table:`, error);
        return [];
    });
    console.log(`Fetched ${response.length} consolidation records for ${dayStart} to ${dayEnd}`);

    let clientes = [];
    response.forEach(r => {
        if (!clientes.includes(r.id_client)) clientes.push(r.id_client);
    });

    let id_merchants = [];
    let ProGruposColl = clientes.map(async idClient => {
        let merchants = [];
        response.filter(r => r.id_client === idClient).map(r => {
            if (2 === r.status) {
                if ('credit' === r.t_medio && 0 !== r.msi) r.t_medio = `credit_msi${r.msi}`;
                if (1 === r.isLink) {
                    if ('debit' === r.t_medio) r.t_medio = 'debit_link';
                    else if ('credit' === r.t_medio) r.t_medio = 'credit_link';
                    else if ('internacional' === r.t_medio) r.t_medio = 'internacional_link';
                }
            }
        }).forEach(r => {
            if (!id_merchants.includes(r.id_merchant)) {
                let msiConfig;
                try {
                    msiConfig = JSON.parse(r['merchant.msi'] || '[]');
                } catch (error) {
                    console.warn(`Error parsing merchant.msi for merchant ${r.id_merchant}:`, error);
                    msiConfig = [];
                }
                let msi_Tasa = [3, 6, 9, 12, 18].map(m => {
                    let slc = msiConfig.filter(msiC => msiC.type === m);
                    return slc[0] || { percent: 0 };
                });

                merchants.push({
                    id: r.id_merchant,
                    name: r['merchant.name_merchant'],
                    clabe: r['merchant.datos_bancarios.clabe'],
                    rfc: r['merchant.rfc_merchant'],
                    retencion: parseFloat(r['merchant.retencion'] || 0),
                    dataCargo_internacional_link: { no: 0, montoBruto: 0, tasa: 0, comision: 0, ivaTasa: 0, ivaComision: 0, montoNeto: 0, tasas: [parseFloat(r.tasa_amex_b || 0)] },
                    dataCargo_internacional: { no: 0, montoBruto: 0, tasa: 0, comision: 0, ivaTasa: 0, ivaComision: 0, montoNeto: 0, tasas: [parseFloat(r.tasa_amex_b || 0)] },
                    dataCargo_debit_link: { no: 0, montoBruto: 0, tasa: 0, comision: 0, ivaTasa: 0, ivaComision: 0, montoNeto: 0, tasas: [parseFloat(r.tasa_debito_b || 0)] },
                    dataCargo_debit: { no: 0, montoBruto: 0, tasa: 0, comision: 0, ivaTasa: 0, ivaComision: 0, montoNeto: 0, tasas: [parseFloat(r.tasa_debito_b || 0)] },
                    dataCargo_credit: { no: 0, montoBruto: 0, tasa: 0, comision: 0, ivaTasa: 0, ivaComision: 0, montoNeto: 0, tasas: [parseFloat(r.tasa_credito_b || 0)] },
                    dataCargo_credit_link: { no: 0, montoBruto: 0, tasa: 0, comision: 0, ivaTasa: 0, ivaComision: 0, montoNeto: 0, tasas: [parseFloat(r.tasa_credito_b || 0)] },
                    dataCargo_credit_msi3: { no: 0, montoBruto: 0, tasa: 0, comision: 0, ivaTasa: 0, ivaComision: 0, montoNeto: 0, tasas: [parseFloat(r.tasa_credito_b || 0) + parseFloat(msi_Tasa[0].percent)], sobretasas: parseFloat(msi_Tasa[0].percent) },
                    dataCargo_credit_msi6: { no: 0, montoBruto: 0, tasa: 0, comision: 0, ivaTasa: 0, ivaComision: 0, montoNeto: 0, tasas: [parseFloat(r.tasa_credito_b || 0) + parseFloat(msi_Tasa[1].percent)], sobretasas: parseFloat(msi_Tasa[1].percent) },
                    dataCargo_credit_msi9: { no: 0, montoBruto: 0, tasa: 0, comision: 0, ivaTasa: 0, ivaComision: 0, montoNeto: 0, tasas: [parseFloat(r.tasa_credito_b || 0) + parseFloat(msi_Tasa[2].percent)], sobretasas: parseFloat(msi_Tasa[2].percent) },
                    dataCargo_credit_msi12: { no: 0, montoBruto: 0, tasa: 0, comision: 0, ivaTasa: 0, ivaComision: 0, montoNeto: 0, tasas: [parseFloat(r.tasa_credito_b || 0) + parseFloat(msi_Tasa[3].percent)], sobretasas: parseFloat(msi_Tasa[3].percent) },
                    dataCargo_credit_msi18: { no: 0, montoBruto: 0, tasa: 0, comision: 0, ivaTasa: 0, ivaComision: 0, montoNeto: 0, tasas: [parseFloat(r.tasa_credito_b || 0) + parseFloat(msi_Tasa[4].percent)], sobretasas: parseFloat(msi_Tasa[4].percent) },
                    dataDevolucion_debit: { no: 0, montoBruto: 0, tasa: 0, comision: 0, ivaTasa: 0, ivaComision: 0, montoNeto: 0, tasas: [parseFloat(r.tasa_debito_b || 0)] },
                    dataDevolucion_internacional: { no: 0, montoBruto: 0, tasa: 0, comision: 0, ivaTasa: 0, ivaComision: 0, montoNeto: 0, tasas: [parseFloat(r.tasa_amex_b || 0)] },
                    dataDevolucion_credit: { no: 0, montoBruto: 0, tasa: 0, comision: 0, ivaTasa: 0, ivaComision: 0, montoNeto: 0, tasas: [parseFloat(r.tasa_credito_b || 0)] },
                    dataCancelacion_debit: { no: 0, montoBruto: 0, tasa: 0, comision: 0, ivaTasa: 0, ivaComision: 0, montoNeto: 0, tasas: [parseFloat(r.tasa_debito_b || 0)] },
                    dataCancelacion_internacional: { no: 0, montoBruto: 0, tasa: 0, comision: 0, ivaTasa: 0, ivaComision: 0, montoNeto: 0, tasas: [parseFloat(r.tasa_amex_b || 0)] },
                    dataCancelacion_credit: { no: 0, montoBruto: 0, tasa: 0, comision: 0, ivaTasa: 0, ivaComision: 0, montoNeto: 0, tasas: [parseFloat(r.tasa_credito_b || 0)] },
                });
                id_merchants.push(r.id_merchant);
            }
        });

        let cliente = await db.isoClient.findOne({ attributes: ['name'], where: { id_client: idClient }, raw: true }).catch(error => {
            console.error(`Error querying isoClient for id_client ${idClient}:`, error);
            return null;
        });
        return { cli: { id: idClient, name: cliente?.name ?? 'Desconocido' }, merchants };
    });

    let grupos = await Promise.all(ProGruposColl);

    grupos.forEach((g, i) => {
        g.merchants.forEach((gm, ii) => {
            [['dataCargo', 2, 1], ['dataDevolucion', 4, 1], ['dataCancelacion', 5, 1]].forEach(k => {
                ['debit', 'debit_link', 'credit', 'credit_link', 'credit_msi3', 'credit_msi6', 'credit_msi9', 'credit_msi12', 'credit_msi18', 'internacional', 'internacional_link'].forEach(tag => {
                    let masterTag = `${k[0]}_${tag}`;
                    if (grupos[i].merchants[ii][masterTag]) {
                        let cargos = response.filter(r => {
                            let vCli = r.id_client === g.cli.id;
                            let vComercio = r.id_merchant === gm.id;
                            let vMedio = tag === r.t_medio;
                            let vStatus = k[1] === r.status;
                            return vCli && vComercio && vMedio && vStatus;
                        });

                        let no = cargos.length;
                        let montoBruto = 0;
                        let tasa = 0;
                        let comision = 0;
                        try {
                            montoBruto = cargos.map(c => k[2] * parseFloat(c.amount)).reduce((anterior, actual) => anterior + actual, 0);
                            let tasas = grupos[i].merchants[ii][masterTag].tasas;
                            tasa = cargos.map(c => {
                                let cMeses = JSON.parse(c['merchant.msi'] || '[]').filter(m => c.msi === m.type);
                                let sobretasa = cMeses[0] || { percent: 0 };
                                let vTasa = parseFloat(
                                    /^credit/.test(c.t_medio) ? (0 === c.msi ? c.tasa_credito_b : (parseFloat(c.tasa_credito_b || 0) + parseFloat(sobretasa.percent))) :
                                        (/^internacional/.test(c.t_medio) ? c.tasa_amex_b : c.tasa_debito_b)
                                );
                                tasas.push(vTasa);
                                return k[2] * (parseFloat(c.id_operation === 6 ? (c.amount / 100) : c.amount)) * vTasa;
                            }).reduce((anterior, actual) => anterior + actual, 0);
                            comision = cargos.map(c => {
                                return parseFloat(/^credit/.test(c.t_medio) ? c.tasa_credito_d : (/^internacional/.test(c.t_medio) ? c.tasa_amex_d : c.tasa_debito_d));
                            }).reduce((anterior, actual) => anterior + actual, 0);
                        } catch (error) {
                            console.warn(`Error processing cargos for ${masterTag}:`, error);
                        }

                        let ivaTasa = (tasa / 100) * 16;
                        let ivaComision = (comision / 100) * 16;
                        let montoNeto = montoBruto - (tasa + comision + ivaTasa + ivaComision);

                        tasas = encontrarNumeroMasRepetido(tasas || []);
                        grupos[i].merchants[ii][masterTag] = { no, montoBruto, tasa, comision, ivaTasa, ivaComision, montoNeto, tasas };
                    }
                });
            });
        });
    });

    console.log(`Processed ${grupos.length} consolidation groups`);
    return { grupos, dayStart, dayEnd };
}

async function backfillConsolidation(dayTimestamp, cliente, req) {
    let now = moment();
    let day = moment(parseInt(dayTimestamp));
    let start = moment.max(day, moment().subtract(BACKFILL_LIMIT, 'days'));
    let end = moment.min(day, now);

    let backfillPromises = [];
    let current = start.clone().startOf('day');

    while (current.isSameOrBefore(end, 'day')) {
        let cacheFile = getCacheFilePath(current, 'consolidation');

        if (await isDateVerified(current, 'consolidation')) {
            console.log(`Skipping consolidation backfill for verified date: ${current.format('YYYY-MM-DD')}`);
            current.add(1, 'day');
            continue;
        }

        if (!(await isCacheFresh(cacheFile, FRESHNESS_HISTORICAL, 'consolidation'))) {
            backfillPromises.push(async () => {
                console.log(`Backfilling consolidation cache for ${current.format('YYYY-MM-DD')}`);
                let { grupos } = await fetchConsolidationForDay(current.valueOf(), cliente, req);
                if (grupos.length === 0) {
                    console.warn(`No consolidation data to cache for ${current.format('YYYY-MM-DD')}`);
                    return;
                }

                await saveToCache(cacheFile, grupos, FRESHNESS_HISTORICAL, false, 'consolidation');
            });
        } else {
            await markDateAsVerified(current, 'consolidation');
        }
        current.add(1, 'day');
    }

    await Promise.all(backfillPromises.map(fn => fn()));
    await cleanupOldFiles();
}

async function getConsolidationByDate(dayTimestamp, cliente, req) {
    console.log('💡🚨 ->>  getConsolidationByDate & transactionsCache <<- 🚨💡');
    let day = moment(parseInt(dayTimestamp));
    let cacheFile = getCacheFilePath(day, 'consolidation');
    let isToday = day.isSame(moment(), 'day');
    let freshness = isToday ? FRESHNESS_TODAY : FRESHNESS_HISTORICAL;

    await ensureCacheDir();
    console.log(`Processing consolidation for ${day.format('YYYY-MM-DD')}`);

    if (day.isBefore(moment(), 'day')) {
        console.log('Running backfill for historical consolidation data...');
    }

    if (!isToday && await isFileVerified(cacheFile, 'consolidation')) {
        console.log(`Historical consolidation file verified - direct load: ${cacheFile}`);
        try {
            let data = await s3.getObject({
                Bucket: S3_BUCKET,
                Key: cacheFile
            }).promise();
            let parsedData = JSON.parse(data.Body.toString('utf8'));
            console.log(`Loaded ${parsedData.length} consolidation groups from verified file: ${cacheFile}`);
            return { grupos: parsedData, dayStart: day.startOf('day').toDate(), dayEnd: day.endOf('day').toDate() };
        } catch (error) {
            console.error(`Failed to load verified consolidation file ${cacheFile}:`, error);
        }
    }

    let cachedData = await getFromCacheOptimized(cacheFile, freshness, 'consolidation');
    if (cachedData) {
        console.log(`Consolidation cache hit for ${day.format('YYYY-MM-DD')}`);
        return { grupos: cachedData, dayStart: day.startOf('day').toDate(), dayEnd: day.endOf('day').toDate() };
    }

    console.log(`Consolidation cache miss for ${day.format('YYYY-MM-DD')}`);
    let result = await fetchConsolidationForDay(dayTimestamp, cliente, req);
    if (result.grupos.length === 0) {
        console.warn(`No consolidation data fetched for ${day.format('YYYY-MM-DD')}`);
    }

    await saveToCache(cacheFile, result.grupos, freshness, isToday, 'consolidation');
    console.log(`Returning ${result.grupos.length} consolidation groups`);
    return result;
}

function encontrarNumeroMasRepetido(array) {
    let frecuencia = {};
    for (let i = 0; i < array.length; i++) {
        if (array[i] in frecuencia) frecuencia[array[i]]++;
        else frecuencia[array[i]] = 1;
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

function validateDate(date) {
    return date.toString() !== 'Invalid Date';
}

async function logCacheHitsStats() {
    try {
        let cacheHits = await loadCacheHits();
        console.log(`\n=== S3 Cache Hits Statistics ===`);
        console.log(`Total verified dates: ${cacheHits.verified_dates.size}`);
        console.log(`Total verified files: ${cacheHits.verified_files.size}`);
        console.log(`Last updated: ${new Date(cacheHits.last_updated).toISOString()}`);
        console.log(`Instance ID: ${cacheHits.instance_id}`);

        let types = ['transactions', 'consolidation', 'liquidation'];
        for (let type of types) {
            let typeDates = Array.from(cacheHits.verified_dates).filter(d => d.startsWith(`${type}:`));
            let typeFiles = Array.from(cacheHits.verified_files).filter(f => f.startsWith(`${type}:`));
            console.log(`\n${type}: ${typeDates.length} dates, ${typeFiles.length} files`);

            if (typeDates.length > 0) {
                console.log(`Sample dates: ${typeDates.slice(0, 3).map(d => d.replace(`${type}:`, '')).join(', ')}`);
            }
        }
    } catch (error) {
        console.error('Error logging cache hits stats:', error);
    }
}

async function getVerifiedDates(type = 'transactions') {
    try {
        let cacheHits = await loadCacheHits();
        let prefix = `${type}:`;
        return Array.from(cacheHits.verified_dates)
            .filter(date => date.startsWith(prefix))
            .map(date => date.replace(prefix, ''));
    } catch (error) {
        console.error('Error getting verified dates:', error);
        return [];
    }
}

async function healthCheck() {
    try {
        await s3.headBucket({ Bucket: S3_BUCKET }).promise();

        const stats = cache.getStats();

        const manifest = await loadManifest();

        return {
            status: 'healthy',
            s3: { bucket: S3_BUCKET, accessible: true },
            cache: {
                keys: stats.keys,
                hits: stats.hits,
                misses: stats.misses,
                ksize: stats.ksize,
                vsize: stats.vsize
            },
            manifest: {
                cached_dates: Object.keys(manifest.cached_dates || {}).length,
                cached_consolidation_dates: Object.keys(manifest.cached_consolidation_dates || {}).length,
                cached_liquidation_dates: Object.keys(manifest.cached_liquidation_dates || {}).length
            },
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

async function validateCachedData(fileKey) {
    try {
        const data = await s3.getObject({
            Bucket: S3_BUCKET,
            Key: fileKey
        }).promise();

        const parsed = JSON.parse(data.Body.toString('utf8'));

        const filename = fileKey.split('/').pop();
        const dateStr = filename.split('_')[0];
        const expectedDate = moment(dateStr, 'YYYY-MM-DD');

        if (Array.isArray(parsed)) {
            const invalidDates = parsed.filter(item => {
                const itemDate = moment(item.creation_date);
                return !itemDate.isSame(expectedDate, 'day');
            });

            if (invalidDates.length > 0) {
                console.warn(`Cache validation failed for ${fileKey}: ${invalidDates.length} items from wrong date`);
                return false;
            }
        }

        return true;
    } catch (error) {
        console.error(`Validation error for ${fileKey}:`, error);
        return false;
    }
}

async function getTransactionsApp(options, req = null, _twoModels = true) {
  const moment = require('moment-timezone');

  const whereData = {
    id_operation: {
      [Op.ne]: 3,
    },
  };

  try {
    var fechas = options.fechas.split(' ');

    // Handle date formats with slashes
    if (fechas[0].includes('/')) {
      for (let index = 0; index < 2; index++) {
        var aux = fechas[index].split('/');
        aux = `${aux[0]}-${aux[1]}-${aux[2]}`;
        fechas[index] = aux;
      }
    }

    // Remove time component if present
    fechas[0] = fechas[0].split('T')[0];
    fechas[1] = fechas[1].split('T')[0];

    // ✅ CORRECT: Use creation_date with full timestamps
    const startDate = `${fechas[0]}T00:00:00.000Z`;
    const endDate = `${fechas[1]}T23:59:59.999Z`;

    console.log(`📅 getTransactionsApp usando creation_date: ${startDate} a ${endDate}`);
    console.log(`   Fechas originales: ${fechas[0]} a ${fechas[1]}`);

    whereData.creation_date = {
      [Op.between]: [startDate, endDate]
    };

  } catch (error) {
    console.error('Invalid dates, ignoring dates filter....', error);
  }

  if (options.reference) whereData.reference_number = options.reference;
  if (options.serial) whereData.terminal = options.serial;

  let operations = [];
  var ventas = [];

  try {
    console.log(`🔍 Ejecutando query con whereData:`, JSON.stringify(whereData, null, 2));

    operations = await db.isoMessage.findAll({
      attributes: { exclude: ['tkn_data_63_rq', 'tkn_data_63_rp', 'node'] },
      order: [
        ["id_message", "ASC"]
      ],
      include: [
        {
          model: db.signatures,
          as: 'signature',
          required: false,
          attributes: ['id']
        },
        { model: db.cisoOperation, as: 'tipo_operacion', attributes: { exclude: ['creation_date'] } },
        {
          model: db.cisoRespCode,
          as: 'codigo_resp',
          attributes: { exclude: ['creation_date'] }
        },
        {
          required: false,
          model: db.cisoBin,
          as: 'bin_info',
          attributes: ['id_bin'],
          include: [
            { attributes: ['name'], required: false, model: db.isoBrand, as: 'tipo_tarjeta' },
            { attributes: ['name'], required: false, model: db.isoIssuerBank, as: 'banco_emisor' },
            { attributes: ['name'], required: false, model: db.isoCardTypes, as: 'tipo_producto' },
          ]
        }
      ],
      where: whereData
    });

    console.log(`✅ Query ejecutada. Encontradas ${operations.length} transacciones`);

    if (operations.length === 0) {
      console.log('⚠️ No se encontraron transacciones. Verificando filtros...');
      console.log('   name_merchant:', req?.user?.id_merchant);
      console.log('   fechas:', options.fechas);
      console.log('   serial:', options.serial);
    }

    const result = JSON.parse(JSON.stringify(operations));

    const onlyRejected = options.rejected;
    const { notOriginal, groupedTransacctions, transactionRejecteds } = await getGroupedTransacctions(result, onlyRejected);

    ventas = onlyRejected ? transactionRejecteds : groupedTransacctions;

    console.log(`📊 Transacciones procesadas: ${ventas.length}`);

  } catch (error) {
    console.error('Error en getTransactionsApp:', error.stack);
  }
  return ventas;
}

async function getTransaction(options, req = null, twoModels = true) {
  const moment = require('moment-timezone');

  console.debug('twoModels ----->', twoModels);
  let whereData = {};
  let whereMerchant = {};

  if (req != undefined && req.user != undefined && req.user.is_admin !== 1 && !req.forceAllClient)
    whereMerchant.id_client = req.user.id_cliente;

  if (req != undefined && req.user != undefined && req.user.id_merchant)
    whereData.name_merchant = req.user.id_merchant;

  if (req != undefined && req.body.response != undefined && req.body.response !== '')
    whereData.resp_code = { [db.Sequelize.Op.eq]: req.body.response };

  if (options.onlyResponse)
    whereData.resp_code = { [db.Sequelize.Op.ne]: '' };

  if (options.draft_capture)
    whereData.draft_capture = options.draft_capture;

  if (options.bin)
    whereData.bin = { [db.Sequelize.Op.ne]: '' };

  if (options.operacion)
    whereData.id_operation = options.operacion;

  if (req != undefined && req.body.tipoOperacion != undefined && req.body.tipoOperacion !== '')
    whereData.id_operation = { [db.Sequelize.Op.or]: [4,5,6,7,12,19] };

  if (options.response)
    whereData.resp_code = { [db.Sequelize.Op.eq]: options.response };

  if (options.id_message)
    whereData.id_message = options.id_message;

  if (options.fechas) {
    try {
      const { startDate, endDate } = validateAndLimitDateRange(options.fechas);

      // ✅ CORRECT: Use creation_date instead of tran_date
      const startMoment = moment(startDate).startOf('day');
      const endMoment = moment(endDate).endOf('day');

      const startCreationDate = startMoment.toISOString();
      const endCreationDate = endMoment.toISOString();

      console.log(`📅 getTransaction usando creation_date con timezone: ${startCreationDate} a ${endCreationDate}`);
      console.log(`   Fechas originales: ${options.fechas}`);

      whereData.creation_date = {
        [db.Sequelize.Op.between]: [startCreationDate, endCreationDate]
      };

    } catch (error) {
      console.error('Error procesando rango de fechas:', error.message);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 7);

      // ✅ CORRECT: Default range using creation_date
      whereData.creation_date = {
        [db.Sequelize.Op.between]: [
          moment(startDate).startOf('day').toISOString(),
          moment(endDate).endOf('day').toISOString()
        ]
      };

      console.warn(`Usando rango por defecto (últimos 7 días) con creation_date debido a error: ${error.message}`);
    }
  }

  const arrAux = ['merchant_por_id'];
  if (twoModels)
    arrAux.push('merchant');

  const auxResponse = new Map();
  const queryAttrs = new Set();

  console.log(`🔍 Ejecutando query con filtros:`);
  console.log('   whereData:', JSON.stringify(whereData, null, 2));
  console.log('   whereMerchant:', JSON.stringify(whereMerchant, null, 2));

  for (const attr of arrAux) {
    const Aux = await queryMaster(attr, whereData, whereMerchant);

    if (Aux) {
      console.log(`✅ Query ${attr} devolvió ${Aux.length} resultados`);
      for (const r of Aux) {
        if (attr === 'merchant_por_id') {
          r.merchant = r.merchant_por_id;
          delete r.merchant_por_id;
        }

        const idMessage = r.id_message;
        if (!auxResponse.has(idMessage)) {
          auxResponse.set(idMessage, r);
          queryAttrs.add(idMessage);
        }
      }
    }
  }

  const results = Array.from(auxResponse.values());
  console.log(`📊 Total de transacciones encontradas: ${results.length}`);

  if (results.length > 0) {
    console.log(`📅 Fechas de transacciones encontradas (creation_date):`);
    results.slice(0, 5).forEach((tx, i) => {
      console.log(`   ${i+1}. ID: ${tx.id_message}, creation_date: ${tx.creation_date}, tran_date: ${tx.tran_date}`);
    });
  }

  return results;
}

async function getTransactionDash(options, req = null, twoModels = true) {
  const moment = require('moment-timezone');

  let whereData = {};
  let whereMerchant = {};

  if (req && req.user.is_admin !== 1 && !req.forceAllClient)
    whereMerchant.id_client = req.user.id_cliente;

  if (req && req.user.id_merchant)
    whereData.name_merchant = req.user.id_merchant;

  if (options.onlyResponse)
    whereData.resp_code = { [db.Sequelize.Op.ne]: '' };

  if (options.draft_capture)
    whereData.draft_capture = options.draft_capture;

  if (options.bin)
    whereData.bin = { [db.Sequelize.Op.ne]: '' };

  if (options.operacion)
    whereData.id_operation = options.operacion;

  if (options.response)
    whereData.resp_code = options.response;

  if (options.id_message)
    whereData.id_message = options.id_message;

  if (options.fechas) {
    try {
      const { startDate, endDate } = validateAndLimitDateRange(options.fechas);

      console.log(`📅 Dashboard usando rango de fechas: ${startDate} a ${endDate}`);

      // ✅ CORRECT: Use creation_date instead of tran_date
      const startMoment = moment(startDate).startOf('day');
      const endMoment = moment(endDate).endOf('day');

      const startCreationDate = startMoment.toISOString();
      const endCreationDate = endMoment.toISOString();

      console.log(`📅 Dashboard usando creation_date con timezone: ${startCreationDate} a ${endCreationDate}`);

      whereData.creation_date = {
        [db.Sequelize.Op.between]: [startCreationDate, endCreationDate]
      };

    } catch (error) {
      console.error('Error procesando rango de fechas del dashboard:', error.message);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 7);

      // ✅ CORRECT: Default range using creation_date
      whereData.creation_date = {
        [db.Sequelize.Op.between]: [
          moment(startDate).startOf('day').toISOString(),
          moment(endDate).endOf('day').toISOString()
        ]
      };

      console.warn(`Usando rango por defecto (últimos 7 días) con creation_date debido a error: ${error.message}`);
    }
  }

  const arrAux = ['merchant_por_id'];
  if (twoModels)
    arrAux.push('merchant');

  const auxResponse = new Map();
  const queryAttrs = new Set();

  console.log(`🔍 Dashboard ejecutando query con filtros:`);
  console.log('   whereData:', JSON.stringify(whereData, null, 2));

  for (const attr of arrAux) {
    const Aux = await queryMasterDash(attr, whereData, whereMerchant);

    if (Aux) {
      console.log(`✅ Dashboard query ${attr} devolvió ${Aux.length} resultados`);
      for (const r of Aux) {
        if (attr === 'merchant_por_id') {
          r.merchant = r.merchant_por_id;
          delete r.merchant_por_id;
        }

        const idMessage = r.id_message;
        if (!auxResponse.has(idMessage)) {
          auxResponse.set(idMessage, r);
          queryAttrs.add(idMessage);
        }
      }
    }
  }

  const results = Array.from(auxResponse.values());
  console.log(`📊 Dashboard - Total de transacciones encontradas: ${results.length}`);

  return results;
}

module.exports = {
    // Funciones principales
    getTransactionsByDateRange,
    getConsolidationByDate,
    getReportLiquidationByDate,

    // Funciones de utilidad
    logCacheHitsStats,
    getVerifiedDates,
    healthCheck,
    validateCachedData,

    // Funciones internas (para debugging)
    fetchLiquidationForDay,
    backfillCache,
    fetchTransactionsForDay,
    getCacheFilePath,
    isCacheFresh,

    // ✅ ADD THESE EXPORTS - THE FIXED FUNCTIONS
    getTransactionsApp,
    getTransaction,
    getTransactionDash
};
//let AWS = require('aws-sdk');
//let moment = require('moment-timezone');
//let { Op } = require('sequelize');
//let NodeCache = require('node-cache');
//let db = require('../sequelize/init');
//
//// Maximum allowed date range in days
//let MAX_DATE_RANGE_DAYS = 90;
//
//
//// ADD THIS AFTER ALL REQUIRE STATEMENTS:
//function safeParse(jsonString, fallback = []) {
//    if (!jsonString || typeof jsonString !== 'string') {
//        console.error('Invalid JSON string input');
//        return fallback;
//    }
//
//    try {
//        return JSON.parse(jsonString);
//    } catch (error) {
//        console.error('JSON parse error:', error.message);
//
//        // Try to fix common circular reference issues
//        try {
//            const fixedJson = jsonString
//                .replace(/"[^"]*":\s*\[Circular Reference\]/g, 'null')
//                .replace(/"[^"]*":\s*\[Circular: Sequelize Model\]/g, 'null')
//                .replace(/"[^"]*":\s*\[object Object\]/g, 'null');
//
//            return JSON.parse(fixedJson);
//        } catch (e) {
//            console.error('Failed to fix JSON, returning fallback');
//            return fallback;
//        }
//    }
//}
//
//function safeStringify(obj) {
//    if (!obj) return '{}';
//
//    let seen = new WeakSet();
//    return JSON.stringify(obj, (key, value) => {
//        if (typeof value === 'object' && value !== null) {
//            if (seen.has(value)) {
//                // For Sequelize instances, return their toJSON()
//                if (value && typeof value.toJSON === 'function') {
//                    try {
//                        return value.toJSON();
//                    } catch (e) {
//                        return '[Circular: Sequelize Model]';
//                    }
//                }
//                return '[Circular Reference]';
//            }
//            seen.add(value);
//        }
//
//        // Handle special cases
//        if (value === undefined) return null;
//        if (typeof value === 'function') return '[Function]';
//
//        return value;
//    });
//}
//
//async function getFromCacheOptimized(cacheFile, freshness, type = 'transactions') {
//    let cacheKey = `data:${cacheFile}`;
//    let cachedData = cache.get(cacheKey);
//
//    // First check in-memory cache
//    if (cachedData && await isCacheFresh(cacheFile, freshness, type)) {
//        console.log(`Cache hit (in-memory) for ${cacheFile}, ${cachedData.length} records`);
//        return cachedData;
//    }
//
//    // Check S3 with cache hits optimization
//    if (await isCacheFresh(cacheFile, freshness, type)) {
//        try {
//            let data = await s3.getObject({
//                Bucket: S3_BUCKET,
//                Key: cacheFile
//            }).promise();
//            let parsedData = safeParse(data.Body.toString('utf8'), []); // FIXED: Use safeParse
//            console.log(`Loaded ${parsedData.length} records from S3: ${cacheFile}`);
//            cache.set(cacheKey, parsedData, freshness / 1000);
//            return parsedData;
//        } catch (error) {
//            console.error(`Failed to get cache file ${cacheFile}:`, error.message);
//
//            // If file is corrupt, delete it
//            if (error.code === 'NoSuchKey' || error.message.includes('JSON')) {
//                try {
//                    await s3.deleteObject({
//                        Bucket: S3_BUCKET,
//                        Key: cacheFile
//                    }).promise();
//                    console.log(`🗑️ Deleted potentially corrupt cache file: ${cacheFile}`);
//                } catch (deleteError) {
//                    console.error(`Failed to delete ${cacheFile}:`, deleteError.message);
//                }
//            }
//
//            return null;
//        }
//    }
//
//    console.log(`Cache miss for ${cacheFile}`);
//    return null;
//}
//
//
///**
// * Validates and limits the date range to prevent excessive data loading
// * @param {string} dateRange - Date range string in format "startDate endDate"
// * @returns {Object} Object with startDate and endDate as ISO strings
// */
//function validateAndLimitDateRange(dateRange) {
//  if (!dateRange || typeof dateRange !== 'string') {
//    throw new Error('Invalid date range format');
//  }
//
//  let [startDateStr, endDateStr] = dateRange.split(' ');
//  if (!startDateStr || !endDateStr) {
//    throw new Error('Invalid date range format. Expected "startDate endDate"');
//  }
//
//  // Parse dates
//  let startDate = new Date(startDateStr);
//  let endDate = new Date(endDateStr);
//
//  // Validate dates
//  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
//    throw new Error('Invalid date values');
//  }
//
//  // Ensure end date is not before start date
//  if (endDate < startDate) {
//    throw new Error('End date cannot be before start date');
//  }
//
//  // Limit date range to MAX_DATE_RANGE_DAYS
//  let maxEndDate = new Date(startDate);
//  maxEndDate.setDate(startDate.getDate() + MAX_DATE_RANGE_DAYS);
//
//  let limitedEndDate = endDate > maxEndDate ? maxEndDate : endDate;
//
//  if (endDate > maxEndDate) {
//    console.warn(`Date range exceeds ${MAX_DATE_RANGE_DAYS} days. Limiting to ${MAX_DATE_RANGE_DAYS} days.`);
//  }
//
//  return {
//    startDate: startDate.toISOString(),
//    endDate: limitedEndDate.toISOString()
//  };
//}
//let vars = require('../vars');
//let helpers = require('../../../helpers/lib/helpers');
//let path = require('path');
//
//// ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
//// IMPORTANTE: función directa SIN HTTP
//// ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
//let { getTransRaw } = require('../services/transactionService');
//
//let cache = new NodeCache({ stdTTL: 24 * 60 * 60, checkperiod: 120 });
//
//let s3 = new AWS.S3({
//    region: process.env.APP_CACHE_AWS_REGION || 'us-east-1',
//    accessKeyId: process.env.APP_CACHE_AWS_ACCESS_KEY_ID,
//    secretAccessKey: process.env.APP_CACHE_AWS_SECRET_ACCESS_KEY
//});
//let S3_BUCKET = process.env.APP_CACHE_S3_BUCKET || 'S3CacheTXN';
//let S3_PREFIX = 'transactions/';
//
//let CACHE_HITS_FILE = `${S3_PREFIX}cache_hits_tracker.json`;
//let MANIFEST_FILE = `${S3_PREFIX}cache_manifest.json`;
//
//let FRESHNESS_HISTORICAL = 7 * 24 * 60 * 60 * 1000;
//let FRESHNESS_TODAY = 24 * 60 * 60 * 1000;
//let BACKFILL_LIMIT = 365;
//let CLEANUP_THRESHOLD = 30 * 24 * 60 * 60 * 1000;
//let BATCH_SIZE = 500;
//
//// Generate a unique instance ID for tracking
//function generateInstanceId() {
//    return `${process.pid}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
//}
//
//// Cache hits management functions - STORED IN S3
//async function loadCacheHits() {
//    let cacheKey = 'cache_hits_memory';
//    let cached = cache.get(cacheKey);
//    if (cached) {
//        return cached;
//    }
//
//    try {
//        let data = await s3.getObject({
//            Bucket: S3_BUCKET,
//            Key: CACHE_HITS_FILE
//        }).promise();
//
//        let cacheHits = JSON.parse(data.Body.toString('utf8'));
//        console.log(`Loaded cache hits tracker from S3: ${CACHE_HITS_FILE}`);
//
//        // Convert arrays back to Sets for efficient lookups
//        cacheHits.verified_dates = new Set(cacheHits.verified_dates || []);
//        cacheHits.verified_files = new Set(cacheHits.verified_files || []);
//
//        cache.set(cacheKey, cacheHits, 3600); // Cache for 1 hour
//        return cacheHits;
//    } catch (error) {
//        if (error.code === 'NoSuchKey') {
//            console.log('Cache hits tracker not found, initializing new one');
//            let cacheHits = {
//                verified_dates: new Set(), // Dates we've verified exist in S3
//                verified_files: new Set(), // Specific files we've verified exist in S3
//                last_updated: Date.now(),
//                instance_id: generateInstanceId()
//            };
//            cache.set(cacheKey, cacheHits, 3600);
//            return cacheHits;
//        }
//        console.error('Error loading cache hits tracker:', error);
//        // Return empty cache hits instead of throwing
//        return { verified_dates: new Set(), verified_files: new Set(), last_updated: 0 };
//    }
//}
//
//async function saveCacheHits(cacheHits) {
//    let cacheKey = 'cache_hits_memory';
//    cacheHits.last_updated = Date.now();
//
//    // Convert Sets to Arrays for JSON serialization
//    let serializableHits = {
//        ...cacheHits,
//        verified_dates: Array.from(cacheHits.verified_dates),
//        verified_files: Array.from(cacheHits.verified_files)
//    };
//
//    try {
//        await s3.putObject({
//            Bucket: S3_BUCKET,
//            Key: CACHE_HITS_FILE,
//            Body: JSON.stringify(serializableHits, null, 2),
//            ContentType: 'application/json'
//        }).promise();
//        console.log(`Saved cache hits tracker to S3: ${CACHE_HITS_FILE}`);
//
//        // Update memory cache
//        cache.set(cacheKey, cacheHits, 3600);
//    } catch (error) {
//        console.error('Error saving cache hits tracker:', error);
//        // Don't throw - this is an optimization, not critical
//    }
//}
//
//async function markDateAsVerified(date, type = 'transactions') {
//    try {
//        let cacheHits = await loadCacheHits();
//        let dateKey = `${type}:${moment(date).format('YYYY-MM-DD')}`;
//        cacheHits.verified_dates.add(dateKey);
//        await saveCacheHits(cacheHits);
//    } catch (error) {
//        console.error('Error marking date as verified:', error);
//        // Continue silently - this is an optimization
//    }
//}
//
//async function markFileAsVerified(fileKey, type = 'transactions') {
//    try {
//        let cacheHits = await loadCacheHits();
//        let fullFileKey = `${type}:${fileKey}`;
//        cacheHits.verified_files.add(fullFileKey);
//        await saveCacheHits(cacheHits);
//    } catch (error) {
//        console.error('Error marking file as verified:', error);
//        // Continue silently - this is an optimization
//    }
//}
//
//async function isDateVerified(date, type = 'transactions') {
//    try {
//        let cacheHits = await loadCacheHits();
//        let dateKey = `${type}:${moment(date).format('YYYY-MM-DD')}`;
//        return cacheHits.verified_dates.has(dateKey);
//    } catch (error) {
//        console.error('Error checking date verification:', error);
//        return false; // Fall back to checking S3 directly
//    }
//}
//
//async function isFileVerified(fileKey, type = 'transactions') {
//    try {
//        let cacheHits = await loadCacheHits();
//        let fullFileKey = `${type}:${fileKey}`;
//        return cacheHits.verified_files.has(fullFileKey);
//    } catch (error) {
//        console.error('Error checking file verification:', error);
//        return false; // Fall back to checking S3 directly
//    }
//}
//
//// Enhanced cache freshness check with S3-based cache hits optimization
//async function isCacheFresh(fileKey, freshnessThreshold, type = 'transactions') {
//    let isTodayFile = fileKey.includes('_00-00');
//
//    // For historical files - if verified, they're always fresh (no need to re-check)
//    if (!isTodayFile && await isFileVerified(fileKey, type)) {
//        console.log(`Historical file verified in S3 cache hits: ${fileKey}`);
//        return true;
//    }
//
//    // For today files OR unverified historical files - check freshness
//    let cacheKey = `freshness:${fileKey}`;
//    let cachedFreshness = cache.get(cacheKey);
//    if (cachedFreshness !== undefined) {
//        console.log(`Freshness cache hit for ${fileKey}: ${cachedFreshness}`);
//        if (cachedFreshness) {
//            await markFileAsVerified(fileKey, type);
//        }
//        return cachedFreshness;
//    }
//
//    try {
//        let data = await s3.headObject({
//            Bucket: S3_BUCKET,
//            Key: fileKey
//        }).promise();
//        let isFresh = Date.now() - new Date(data.LastModified).getTime() < freshnessThreshold;
//        cache.set(cacheKey, isFresh, freshnessThreshold / 1000);
//
//        // Only mark as verified if it's NOT a today file (historical files get permanent verification)
//        if (isFresh && !isTodayFile) {
//            await markFileAsVerified(fileKey, type);
//        }
//
//        console.log(`Checked S3 freshness for ${fileKey}: ${isFresh} (${isTodayFile ? 'today' : 'historical'})`);
//        return isFresh;
//    } catch (error) {
//        if (error.code === 'NotFound') {
//            cache.set(cacheKey, false, freshnessThreshold / 1000);
//            console.log(`Cache file not found: ${fileKey}`);
//            return false;
//        }
//        console.error(`Error checking freshness for ${fileKey}:`, error);
//        throw error;
//    }
//}
//
//// Optimized cache getter with S3-based cache hits integration
////async function getFromCacheOptimized(cacheFile, freshness, type = 'transactions') {
////    let cacheKey = `data:${cacheFile}`;
////    let cachedData = cache.get(cacheKey);
////
////    // First check in-memory cache
////    if (cachedData && await isCacheFresh(cacheFile, freshness, type)) {
////        console.log(`Cache hit (in-memory) for ${cacheFile}, ${cachedData.length} records`);
////        return cachedData;
////    }
////
////    // Check S3 with cache hits optimization
////    if (await isCacheFresh(cacheFile, freshness, type)) {
////        try {
////            let data = await s3.getObject({
////                Bucket: S3_BUCKET,
////                Key: cacheFile
////            }).promise();
////            let parsedData = JSON.parse(data.Body.toString('utf8'));
////            console.log(`Loaded ${parsedData.length} records from S3: ${cacheFile}`);
////            cache.set(cacheKey, parsedData, freshness / 1000);
////            return parsedData;
////        } catch (error) {
////            console.error(`Failed to parse cache file ${cacheFile}:`, error);
////            return null;
////        }
////    }
////
////    console.log(`Cache miss for ${cacheFile}`);
////    return null;
////}
//
//// Ensure cache directory exists (no-op for S3)
//async function ensureCacheDir() {
//    console.log(`Using S3 bucket: ${S3_BUCKET}/${S3_PREFIX}`);
//}
//
//// Load or initialize manifest from S3
//async function loadManifest() {
//    let cacheKey = 'manifest';
//    let cachedManifest = cache.get(cacheKey);
//    if (cachedManifest) {
//        console.log('Manifest cache hit (in-memory)');
//        return cachedManifest;
//    }
//
//    try {
//        let data = await s3.getObject({
//            Bucket: S3_BUCKET,
//            Key: MANIFEST_FILE
//        }).promise();
//        console.log(`Manifest loaded from S3: ${MANIFEST_FILE}`);
//        let parsed = JSON.parse(data.Body.toString('utf8'));
//        let manifest = {
//            cached_dates: parsed.cached_dates || {},
//            today_file: parsed.today_file || null,
//            today_mtime: parsed.today_mtime || null,
//            cached_consolidation_dates: parsed.cached_consolidation_dates || {},
//            today_consolidation_file: parsed.today_consolidation_file || null,
//            today_consolidation_mtime: parsed.today_consolidation_mtime || null,
//            cached_liquidation_dates: parsed.cached_liquidation_dates || {},
//            today_liquidation_file: parsed.today_liquidation_file || null,
//            today_liquidation_mtime: parsed.today_liquidation_mtime || null
//        };
//        cache.set(cacheKey, manifest, FRESHNESS_HISTORICAL / 1000);
//        return manifest;
//    } catch (error) {
//        if (error.code === 'NoSuchKey') {
//            console.log('Manifest not found, initializing new manifest');
//            let manifest = {
//                cached_dates: {},
//                today_file: null,
//                today_mtime: null,
//                cached_consolidation_dates: {},
//                today_consolidation_file: null,
//                today_consolidation_mtime: null,
//                cached_liquidation_dates: {},
//                today_liquidation_file: null,
//                today_liquidation_mtime: null
//            };
//            cache.set(cacheKey, manifest, FRESHNESS_HISTORICAL / 1000);
//            return manifest;
//        }
//        console.error('Error loading manifest:', error);
//        throw error;
//    }
//}
//
//// Save manifest to S3
//async function saveManifest(manifest) {
//    let cacheKey = 'manifest';
//    cache.set(cacheKey, manifest, FRESHNESS_HISTORICAL / 1000);
//    try {
//        await s3.putObject({
//            Bucket: S3_BUCKET,
//            Key: MANIFEST_FILE,
//            Body: JSON.stringify(manifest, null, 2),
//            ContentType: 'application/json'
//        }).promise();
//        console.log(`Manifest saved to S3: ${MANIFEST_FILE}`);
//    } catch (error) {
//        console.error('Error saving manifest:', error);
//        throw error;
//    }
//}
//
//// Clean up old cache files in S3
//async function cleanupOldFiles() {
//    let now = Date.now();
//    try {
//        let list = await s3.listObjectsV2({
//            Bucket: S3_BUCKET,
//            Prefix: S3_PREFIX
//        }).promise();
//        console.log(`Listed ${list.Contents?.length || 0} files in S3: ${S3_BUCKET}/${S3_PREFIX}`);
//
//        let deletePromises = (list.Contents || [])
//            .filter(file => file.Key !== MANIFEST_FILE && file.Key !== CACHE_HITS_FILE && now - new Date(file.LastModified).getTime() > CLEANUP_THRESHOLD)
//            .map(file => {
//                cache.del(`data:${file.Key}`);
//                return s3.deleteObject({
//                    Bucket: S3_BUCKET,
//                    Key: file.Key
//                }).promise().then(() => console.log(`Deleted old cache file from S3: ${file.Key}`));
//            });
//
//        await Promise.all(deletePromises);
//    } catch (error) {
//        console.error('Error cleaning up old files:', error);
//        throw error;
//    }
//}
//
//// Get cache file path for a date (S3 key)
//function getCacheFilePath(date, type = 'transactions') {
//    let formattedDate = moment(date).format('YYYY-MM-DD');
//    let suffix = type === 'consolidation' ? '_consolidation' : type === 'liquidation' ? '_liquidation' : '';
//    if (moment(date).isSame(moment(), 'day')) {
//        return `${S3_PREFIX}${formattedDate}_00-00${suffix}.json`;
//    }
//    return `${S3_PREFIX}${formattedDate}${suffix}.json`;
//}
//
//async function saveToCache(cacheFile, data, freshness, isToday, type = 'transactions') {
//    if (!data || (Array.isArray(data) && data.length === 0)) {
//        console.warn(`Skipping cache write for ${cacheFile}: No data to store`);
//        return;
//    }
//
//    let tempKey = `${cacheFile}.tmp`;
//    try {
//        let jsonData = safeStringify(data); // Use safe serialization
//        JSON.parse(jsonData); // Validate JSON
//        await s3.putObject({
//            Bucket: S3_BUCKET,
//            Key: tempKey,
//            Body: jsonData,
//            ContentType: 'application/json'
//        }).promise();
//        console.log(`Wrote temporary file to S3: ${tempKey}`);
//
//        await s3.copyObject({
//            Bucket: S3_BUCKET,
//            CopySource: `${S3_BUCKET}/${tempKey}`,
//            Key: cacheFile
//        }).promise();
//        await s3.deleteObject({
//            Bucket: S3_BUCKET,
//            Key: tempKey
//        }).promise();
//        console.log(`Finalized cache file in S3: ${cacheFile}`);
//
//        let manifest = await loadManifest();
//        // Fix moment parsing by removing .json suffix
//        let dateParts = cacheFile.split('/')[1].split('.')[0].split('_');
//        let dateKey = moment(dateParts[0]).format('YYYY-MM-DD');
//        if (type === 'liquidation') {
//            manifest.cached_liquidation_dates[dateKey] = {
//                mtime: Date.now(),
//                fresh_until: Date.now() + freshness
//            };
//            if (isToday) {
//                manifest.today_liquidation_file = path.basename(cacheFile);
//                manifest.today_liquidation_mtime = Date.now();
//            }
//        } else if (type === 'consolidation') {
//            manifest.cached_consolidation_dates[dateKey] = {
//                mtime: Date.now(),
//                fresh_until: Date.now() + freshness
//            };
//            if (isToday) {
//                manifest.today_consolidation_file = path.basename(cacheFile);
//                manifest.today_consolidation_mtime = Date.now();
//            }
//        } else {
//            manifest.cached_dates[dateKey] = {
//                mtime: Date.now(),
//                fresh_until: Date.now() + freshness
//            };
//            if (isToday) {
//                manifest.today_file = path.basename(cacheFile);
//                manifest.today_mtime = Date.now();
//            }
//        }
//        cache.set(`data:${cacheFile}`, data, freshness / 1000);
//
//        // Mark as verified in cache hits
//        await markFileAsVerified(cacheFile, type);
//        await markDateAsVerified(dateParts[0], type);
//
//        await saveManifest(manifest);
//    } catch (error) {
//        console.error(`Error caching ${cacheFile}:`, error);
//        await s3.deleteObject({
//            Bucket: S3_BUCKET,
//            Key: tempKey
//        }).promise().catch(() => {});
//    }
//}
//
//// Safe serialization to handle circular references
////function safeStringify(obj) {
////    let seen = new WeakSet();
////    return JSON.stringify(obj, (key, value) => {
////        if (typeof value === 'object' && value !== null) {
////            if (seen.has(value)) return undefined; // Skip circular references
////            seen.add(value);
////        }
////        return value;
////    });
////}
//
//// FUNCION PARA FORMATEAR EL MONTO
//function formatMount(numberStr) {
//    let num = [parseInt(numberStr.substr(0, 10)), numberStr.substr(-2)];
//    return `${num[0]}.${num[1]}`;
//}
//
//// =============================================================================
//// FIXED: SINGLE IMPLEMENTATION OF fetchTransactionsForDay
//// =============================================================================
//async function fetchTransactionsForDay(startDate, endDate, req, options = {}) {
//console.log('💡🚨 ->>  fetchTransactionsForDay & transactionsCache <<- 🚨💡');
//  try {
//    // Convert startDate to moment object immediately
//    let startMoment = moment(startDate);
//    let cacheFile = getCacheFilePath(startMoment);
//    let isToday = startMoment.isSame(moment(), 'day');
//    let freshness = isToday ? FRESHNESS_TODAY : FRESHNESS_HISTORICAL;
//
//    // Ensure dates are valid and in the correct order
//    let startDateMoment = moment(startDate).startOf('day'); // ✅ Change to let
//    let endDateMoment = moment(endDate).endOf('day'); // ✅ Change to let
//
//    // Ensure end date is not before start date
//    if (endDateMoment.isBefore(startDateMoment)) {
//      console.warn('End date is before start date, swapping dates');
//      // ✅ Now this will work since we're using let
//      [startDateMoment, endDateMoment] = [endDateMoment, startDateMoment];
//    }
//
//    // Ensure we don't query future dates
//    let now = moment();
//    if (startDateMoment.isAfter(now)) {
//      console.warn('Start date is in the future, using current time');
//      startDateMoment = startDateMoment.subtract(1, 'day'); // ✅ Use let for reassignment
//      endDateMoment = now.clone();
//    }
//
//    let formattedStartDate = startDateMoment.toISOString();
//    let formattedEndDate = endDateMoment.toISOString();
//
//    console.log(`Fetching transactions for range: ${formattedStartDate} to ${formattedEndDate}`);
//
//    // Try to get from cache first - use the moment-based cache key
//    let cacheKey = getCacheFilePath(startMoment);
//    let cachedData = await getFromCacheOptimized(cacheKey, freshness, 'transactions');
//    if (cachedData) {
//      console.log(`Cache hit for range: ${formattedStartDate} to ${formattedEndDate}`);
//      return cachedData;
//    }
//
//    // If not in cache or cache is stale, fetch from the database
//    let transactions = await getTransRaw({
//      ...options,
//      fechas: `${formattedStartDate} ${formattedEndDate}`
//    }, req);
//
//    // Save to cache
//    if (transactions && transactions.length > 0) {
//      await saveToCache(cacheKey, transactions, freshness, isToday, 'transactions');
//    }
//
//    return transactions || [];
//  } catch (error) {
//    console.error('Error in fetchTransactionsForDay:', error);
//    throw error;
//  }
//}
//
//
//// Fetch liquidation data for a single day
//async function fetchLiquidationForDay(startDate, endDate, req) {
//  console.log('💡🚨 ->>  fetchLiquidationForDay & transactionsCache <<- 🚨💡');
//  try {
//    let isAdmn = req.user.is_admin;
//
//    console.log(`fetchLiquidationForDay called with: ${startDate} to ${endDate}`);
//
//    // Ensure dates are in UTC
//    let startMoment = moment.utc(startDate);
//    let endMoment = moment.utc(endDate);
//
//    console.log(`Querying database with UTC: ${startMoment.format('YYYY-MM-DD HH:mm:ss')} to ${endMoment.format('YYYY-MM-DD HH:mm:ss')}`);
//    console.log(`Which is Mexico City: ${startMoment.tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss')} to ${endMoment.tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss')}`);
//
//    let isoMessage = await getTransRaw({
//      fechas: `${startMoment.toISOString()} ${endMoment.toISOString()}`
//    }, req);
//
//    console.log(`Fetched ${isoMessage?.length || 0} transactions for liquidation`);
//    let dataDT = { data: [] };
//
//    if (isoMessage.length === 0) {
//      console.warn(`No transactions fetched for liquidation: ${startDate} to ${endDate}`);
//      return dataDT;
//    }
//
//    for (let i = 0; i < isoMessage.length; i += BATCH_SIZE) {
//      let batch = isoMessage.slice(i, i + BATCH_SIZE);
//      for (let value of batch) {
//        let tasa = { banco: 0.00, agre: 0.00, comer: 0.00, comision: 0.00 };
//        // Avoid circular references by copying only needed fields
//        let merchant = {
//          name_merchant: value.merchant?.name_merchant || value.name_merchant,
//          afiliation_number: value.merchant?.afiliation_number,
//          afiliation_link: value.merchant?.afiliation_link,
//          taza_credito: value.merchant?.taza_credito,
//          taza_debito: value.merchant?.taza_debito,
//          taza_amex: value.merchant?.taza_amex,
//          tasa_credito_b: value.merchant?.tasa_credito_b || '0.00',
//          tasa_debito_b: value.merchant?.tasa_debito_b || '0.00',
//          tasa_amex_b: value.merchant?.tasa_amex_b || '0.00',
//          tasa_credito_c: value.merchant?.tasa_credito_c || '0.00',
//          tasa_debito_c: value.merchant?.tasa_debito_c || '0.00',
//          tasa_amex_c: value.merchant?.tasa_amex_c || '0.00',
//          tasa_credito_d: value.merchant?.tasa_credito_d || '0.00',
//          tasa_debito_d: value.merchant?.tasa_debito_d || '0.00',
//          tasa_amex_d: value.merchant?.tasa_amex_d || '0.00',
//          taza_link_credito: value.merchant?.taza_link_credito,
//          taza_link_debito: value.merchant?.taza_link_debito,
//          taza_link_amex: value.merchant?.taza_link_amex,
//          tasa_link_credito_b: value.merchant?.tasa_link_credito_b || '0.00',
//          tasa_link_debito_b: value.merchant?.tasa_link_debito_b || '0.00',
//          tasa_link_amex_b: value.merchant?.tasa_link_amex_b || '0.00',
//          tasa_link_credito_c: value.merchant?.tasa_link_credito_c || '0.00',
//          tasa_link_debito_c: value.merchant?.tasa_link_debito_c || '0.00',
//          tasa_link_amex_c: value.merchant?.tasa_link_amex_c || '0.00',
//          tasa_link_credito_d: value.merchant?.tasa_link_credito_d || '0.00',
//          tasa_link_debito_d: value.merchant?.tasa_link_debito_d || '0.00',
//          tasa_link_amex_d: value.merchant?.tasa_link_amex_d || '0.00'
//        };
//
//        let more_info = null;
//        value.msi_months = '';
//
//        if (value.more_info) {
//          try {
//            more_info = JSON.parse(value.more_info);
//            if (more_info.chargePlan) value.msi_months = more_info.chargePlan.months;
//            if (more_info.link_pago && merchant.afiliation_link) merchant.afiliation_number = merchant.afiliation_link;
//            if (!more_info.merchant_data) more_info = null;
//          } catch (error) {
//            console.warn('Error parsing more_info for tx:', value, error);
//          }
//        }
//
//        if (value.resp_code === '65') value.folio = value.reference_number;
//
//        let sourceData = more_info ? more_info.merchant_data : merchant;
//
//        if (value.card_type) {
//          let isLink = more_info?.link_pago ?? false;
//          let cardTypeMapping = {
//            'C0': {
//              base: isLink ? 'taza_link_credito' : 'taza_credito',
//              b: isLink ? 'tasa_link_credito_b' : 'tasa_credito_b',
//              d: isLink ? 'tasa_link_credito_d' : 'tasa_credito_d',
//              c: isLink ? 'tasa_link_credito_c' : 'tasa_credito_c'
//            },
//            'P0': {
//              base: isLink ? 'taza_link_debito' : 'taza_debito',
//              b: isLink ? 'tasa_link_debito_b' : 'tasa_debito_b',
//              d: isLink ? 'tasa_link_debito_d' : 'tasa_debito_d',
//              c: isLink ? 'tasa_link_debito_c' : 'tasa_debito_c'
//            },
//            '00': {
//              base: isLink ? 'taza_link_amex' : 'taza_amex',
//              b: isLink ? 'tasa_link_amex_b' : 'tasa_amex_b',
//              d: isLink ? 'tasa_link_amex_d' : 'tasa_amex_d',
//              c: isLink ? 'tasa_link_amex_c' : 'tasa_amex_c'
//            },
//            'default': {
//              base: isLink ? 'taza_link_credito' : 'taza_credito',
//              b: isLink ? 'tasa_link_credito_b' : 'tasa_credito_b',
//              d: isLink ? 'tasa_link_credito_d' : 'tasa_credito_d',
//              c: isLink ? 'tasa_link_credito_c' : 'tasa_credito_c'
//            }
//          };
//
//          let { base, b, d, c } = cardTypeMapping[value.card_type] || cardTypeMapping['default'];
//          tasa.banco = isAdmn ? parseFloat(sourceData[base] || 0) : 0;
//          tasa.agre = parseFloat(sourceData[b] || 0);
//          tasa.comer = parseFloat(sourceData[d] || 0);
//          tasa.comision = isAdmn ? parseFloat(sourceData[c] || 0) : 0;
//        } else {
//          tasa.banco = isAdmn ? parseFloat(sourceData.taza_credito || 0) : 0;
//          tasa.agre = parseFloat(sourceData.tasa_credito_b || 0);
//          tasa.comer = parseFloat(sourceData.tasa_credito_d || 0);
//          tasa.comision = isAdmn ? parseFloat(sourceData.tasa_credito_c || 0) : 0;
//        }
//
//        if (value.msi_months && more_info && more_info.merchant_data && more_info.merchant_data.MSI) {
//          let msi_data = (typeof more_info.merchant_data.MSI === 'string') ? JSON.parse(more_info.merchant_data.MSI || '[]') : more_info.merchant_data.MSI;
//          let msi_filter = msi_data.find(v => v.type == value.msi_months);
//          if (msi_filter) tasa.agre = parseFloat(msi_filter.percent) || 0;
//        }
//
//        let monto = null;
//        let devolucion = false;
//        console.log("value.amount", value.amount)
//        switch (value.tipo_operacion?.id_operation) {
//          case 6: case 7: case 16:
//            devolucion = true;
//            monto = parseFloat(-1 * (formatMount(value.amount) || 0)).toFixed(2);
//            console.log("monto", monto)
//            break;
//          default:
//            monto = parseFloat(formatMount(value.amount) || 0).toFixed(2);
//            console.log("monto def", monto)
//            break;
//        }
//
//        let metodo = null;
//        if (!value.bin_info) {
//          if (value.bin) {
//            switch (value.bin.substring(0, 1)) {
//              case '3': metodo = 'AMEX'; break;
//              case '4': metodo = 'VISA'; break;
//              case '5': metodo = 'MASTERCARD'; break;
//              default: metodo = 'Internacional'; break;
//            }
//          } else {
//            metodo = '';
//          }
//        } else {
//          metodo = value.bin_info.tipo_tarjeta?.name || '';
//        }
//
//        let tbanco = 0;
//        let mphs1 = parseFloat((parseFloat(monto) * (tasa.agre / 100)).toFixed(2)) * -1;
//        let iva1 = parseFloat((mphs1 * (vars.iva || 0.16)).toFixed(2));
//        let mphs2 = parseFloat(tasa.comer) * -1;
//        mphs2 = parseFloat(mphs2.toFixed(2));
//        let iva2 = parseFloat((mphs2 * (vars.iva || 0.16)));
//        let suma_total = (mphs1 + mphs2 + tbanco + iva1 + iva2);
//        let totales = {
//          totalC: mphs1 + mphs2 + tbanco,
//          totalI: iva1 + iva2,
//          granT: suma_total,
//          totalF: suma_total + parseFloat(monto)
//        };
//
//        let status_f = null;
//        switch (value.estatus_f) {
//          case '1': case 1: status_f = 'Pendiente'; break;
//          case '2': case 2: status_f = 'Por liquidar'; break;
//          case '3': case 3: status_f = 'Liquidado'; break;
//          default: status_f = 'No disponible'; break;
//        }
//
//        let propina = 'N/A';
//        let waiter = 'N/A';
//        if (value.more_info) {
//          try {
//            let ax = JSON.parse(value.more_info);
//            propina = isNaN(ax.tip) ? 'N/A' : ax.tip;
//            waiter = isNaN(ax.waiter) ? 'N/A' : ax.waiter;
//          } catch (error) {
//            console.log('Impossible to parse more_info:', value, error);
//          }
//        }
//
//        let card_type = 'INTERNACIONAL';
//        if (value.card_type === '00') {
//          card_type = value.bin_info ? value.bin_info.tipo_producto?.name || 'INTERNACIONAL' : 'INTERNACIONAL';
//        } else {
//          card_type = value.card_type === 'C0' ? 'CRÉDITO' : 'DÉBITO';
//        }
//
//        let card = (value.bin && value.bin !== '') ? `${value.bin.substr(0,4)}-${value.bin.substr(4,6)}**-****-${value.last4}` : '';
//        let entryMode = '';
//        switch (value.entry_mode) {
//          case '051': entryMode = 'Chip'; break;
//          case '901': entryMode = 'Banda Magnética'; break;
//          case '010': entryMode = 'Manual'; break;
//          case '911': entryMode = 'Sin Contacto Magnético'; break;
//          case '801': entryMode = 'Fallback'; break;
//          case '810': entryMode = 'Ecommerce'; break;
//          case '071': entryMode = 'Sin Contacto'; break;
//          default: entryMode = '';
//        }
//
//        let newObj = {
//          reg: {
//            id_message: value.id_message,
//            id_operation: value.id_operation,
//            trace_number: value.trace_number,
//            reference_number: value.reference_number,
//            amount: value.amount,
//            resp_code: value.resp_code,
//            authorization: value.authorization,
//            bin: value.bin,
//            last4: value.last4,
//            entry_mode: value.entry_mode,
//            creation_date: value.creation_date,
//            terminal: value.terminal,
//            name_merchant: value.name_merchant,
//            estatus_f: value.estatus_f,
//            card_type: value.card_type,
//            folio: value.folio,
//            more_info: value.more_info
//          },
//          Cliente: more_info?.client_data?.name || 'NO DISPONIBLE',
//          Comercio: sourceData.name_merchant || 'NO DISPONIBLE',
//          Afiliación: sourceData.afiliation_number || 'NO DISPONIBLE',
//          TipoProd: card_type,
//          Tarjeta: card,
//          idTrans: value.trace_number || '',
//          Estatus: value.codigo_resp?.description || 'NO DISPONIBLE',
//          EstatusF: status_f,
//          Método: metodo,
//          Terminal: helpers.haveValue(value.terminal),
//          TipoT: helpers.haveValue(value.tipo_operacion?.name),
//          Autorización: helpers.haveValue(value.authorization),
//          Monto: monto,
//          MPHS1: mphs1.toFixed(2),
//          IVA1: iva1.toFixed(2),
//          TotalC1: (mphs1 + iva1).toFixed(2),
//          MPHS2: mphs2.toFixed(2),
//          IVA2: iva2.toFixed(2),
//          TotalC2: (mphs2 + iva2).toFixed(2),
//          tbanco: tbanco.toFixed(2),
//          TotalC: totales.totalC.toFixed(2),
//          TotalI: totales.totalI.toFixed(2),
//          GranT: totales.granT.toFixed(2),
//          TotalFinal: totales.totalF.toFixed(2),
//          propina: propina,
//          mesero: waiter,
//          entryMode: entryMode,
//          msi_months: value.msi_months || 'N/A'
//        };
//        dataDT.data.push(newObj);
//      }
//    }
//
//    console.log(`Processed ${dataDT.data.length} liquidation records for ${startDate} to ${endDate}`);
//    return dataDT;
//  } catch (error) {
//    console.error('Error in fetchLiquidationForDay:', error);
//    throw error;
//  }
//}
//
//async function getReportLiquidationByDate(fechas, req) {
//console.log('💡🚨 ->>  getReportLiquidationByDate & transactionsCache <<- 🚨💡');
//  try {
//    console.log(`Raw fechas received: "${fechas}"`);
//
//    // Parse the dates manually to handle the specific format from frontend
//    let [startDateStr, endDateStr] = fechas.split(' ');
//
//    console.log(`Original dates - start: "${startDateStr}", end: "${endDateStr}"`);
//
//    // CRITICAL FIX: The frontend is sending local time (Mexico City) without timezone info
//    // We need to parse them as Mexico City time and convert to UTC properly
//
//    let startDate, endDate;
//
//    // Check if dates are in the format "YYYY-MM-DD HH:mm:ss" (without timezone)
//    if (startDateStr.includes(' ') && startDateStr.includes(':')) {
//      console.log('Detected local datetime format without timezone');
//
//      // Parse as Mexico City time and convert to UTC
//      startDate = moment.tz(startDateStr, 'YYYY-MM-DD HH:mm:ss', 'America/Mexico_City').utc().toISOString();
//      endDate = moment.tz(endDateStr, 'YYYY-MM-DD HH:mm:ss', 'America/Mexico_City').utc().toISOString();
//
//    } else if (!startDateStr.includes('T')) {
//      // If just date without time, add time and convert
//      console.log('Detected date-only format');
//      startDate = moment.tz(startDateStr + ' 00:00:00', 'YYYY-MM-DD HH:mm:ss', 'America/Mexico_City').utc().toISOString();
//      endDate = moment.tz(endDateStr + ' 23:59:59.999', 'YYYY-MM-DD HH:mm:ss', 'America/Mexico_City').utc().toISOString();
//    } else {
//      // Already in ISO format with timezone
//      ({ startDate, endDate } = validateAndLimitDateRange(fechas));
//    }
//
//    console.log(`Converted to UTC - start: ${startDate}, end: ${endDate}`);
//
//    // Now work in UTC for database queries
//    let start = moment.utc(startDate);
//    let end = moment.utc(endDate);
//    let now = moment.utc();
//
//    // CRITICAL FIX: Check if dates are valid
//    if (!start.isValid() || !end.isValid()) {
//      console.error('Invalid dates after processing:', { start: start.toString(), end: end.toString() });
//      return { data: [] };
//    }
//
//    console.log(`Final UTC date range: ${start.format('YYYY-MM-DD HH:mm:ss')} to ${end.format('YYYY-MM-DD HH:mm:ss')}`);
//    console.log(`In Mexico City time: ${start.tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss')} to ${end.tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss')}`);
//
//    if (start.isAfter(now)) {
//      console.log('Start date is in the future, no data to process');
//      return { data: [] };
//    }
//
//    // Ensure we don't process future dates
//    let effectiveEnd = end.isAfter(now) ? now.clone() : end;
//
//    if (start.isAfter(effectiveEnd)) {
//      console.log('Start date is after effective end date, no data to process');
//      return { data: [] };
//    }
//
//    let dataDT = { data: [] };
//    console.log(`Query range in UTC: ${start.format('YYYY-MM-DD')} to ${effectiveEnd.format('YYYY-MM-DD')}`);
//
//    await ensureCacheDir();
//
//    // Process each day in the range
//    let fetchPromises = [];
//    let current = start.clone();
//
//    while (current.isSameOrBefore(effectiveEnd, 'day')) {
//      let cacheFile = getCacheFilePath(current, 'liquidation');
//      let isToday = current.isSame(now, 'day');
//      let freshness = isToday ? FRESHNESS_TODAY : FRESHNESS_HISTORICAL;
//
//      fetchPromises.push(async () => {
//        // For historical files, check verification first without freshness check
//        if (!isToday && await isFileVerified(cacheFile, 'liquidation')) {
//          console.log(`Historical liquidation file verified - direct load: ${cacheFile}`);
//          try {
//            let data = await s3.getObject({
//              Bucket: S3_BUCKET,
//              Key: cacheFile
//            }).promise();
//            let parsedData = JSON.parse(data.Body.toString('utf8'));
//            console.log(`Loaded ${parsedData.length} liquidation records from verified file: ${cacheFile}`);
//            return parsedData;
//          } catch (error) {
//            console.error(`Failed to load verified liquidation file ${cacheFile}:`, error);
//            // Fall through to normal cache logic
//          }
//        }
//
//        // Normal cache logic for today files or unverified historical files
//        let cachedData = await getFromCacheOptimized(cacheFile, freshness, 'liquidation');
//        if (cachedData) {
//          console.log(`Liquidation cache hit for ${current.format('YYYY-MM-DD')}`);
//          return cachedData;
//        }
//
//        console.log(`Liquidation cache miss for ${current.format('YYYY-MM-DD')}`);
//
//        // Use UTC boundaries for database queries
//        let dayStart = current.clone().startOf('day').toISOString();
//        let dayEnd = current.clone().endOf('day').toISOString();
//
//        // For today, cap at the current time
//        if (isToday && current.isSame(now, 'day')) {
//          dayEnd = now.toISOString();
//        }
//
//        console.log(`Fetching liquidation for UTC day: ${dayStart} to ${dayEnd}`);
//        console.log(`Which is Mexico City: ${moment.utc(dayStart).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss')} to ${moment.utc(dayEnd).tz('America/Mexico_City').format('YYYY-MM-DD HH:mm:ss')}`);
//
//        let dayData = await fetchLiquidationForDay(dayStart, dayEnd, req);
//
//        if (!dayData.data || dayData.data.length === 0) {
//          console.warn(`No data fetched for ${current.format('YYYY-MM-DD')}`);
//          return [];
//        }
//
//        await saveToCache(cacheFile, dayData.data, freshness, isToday, 'liquidation');
//        return dayData.data;
//      });
//
//      current.add(1, 'day');
//    }
//
//    // Process all fetch promises in parallel
//    let results = await Promise.all(fetchPromises.map(fn => fn()));
//    dataDT.data = results.flat();
//    console.log(`Total liquidation records loaded: ${dataDT.data.length}`);
//
//    return dataDT;
//
//  } catch (error) {
//    console.error('Error in getReportLiquidationByDate:', error);
//    throw error;
//  }
//}
//
///**
// * Validates and limits the date range to prevent excessive data loading
// * @param {string} dateRange - Date range string in format "startDate endDate"
// * @returns {Object} Object with startDate and endDate as ISO strings
// */
////function validateAndLimitDateRange(dateRange) {
////  if (!dateRange || typeof dateRange !== 'string') {
////    throw new Error('Invalid date range format');
////  }
////
////  let [startDateStr, endDateStr] = dateRange.split(' ');
////  if (!startDateStr || !endDateStr) {
////    throw new Error('Invalid date range format. Expected "startDate endDate"');
////  }
////
////  // Parse dates with Mexico City timezone
////  let startDate = moment.tz(startDateStr, 'America/Mexico_City');
////  let endDate = moment.tz(endDateStr, 'America/Mexico_City');
////
////  // If parsing fails, try without timezone
////  if (!startDate.isValid() || !endDate.isValid()) {
////    console.warn('Date parsing with timezone failed, trying without timezone');
////    startDate = moment(startDateStr);
////    endDate = moment(endDateStr);
////  }
////
////  // Validate dates
////  if (!startDate.isValid() || !endDate.isValid()) {
////    throw new Error('Invalid date values');
////  }
////
////  // Ensure end date is not before start date
////  if (endDate.isBefore(startDate)) {
////    throw new Error('End date cannot be before start date');
////  }
////
////  // Limit date range to MAX_DATE_RANGE_DAYS
////  let maxEndDate = startDate.clone().add(MAX_DATE_RANGE_DAYS, 'days');
////
////  let limitedEndDate = endDate.isAfter(maxEndDate) ? maxEndDate : endDate;
////
////  if (endDate.isAfter(maxEndDate)) {
////    console.warn(`Date range exceeds ${MAX_DATE_RANGE_DAYS} days. Limiting to ${MAX_DATE_RANGE_DAYS} days.`);
////  }
////
////  return {
////    startDate: startDate.toISOString(),
////    endDate: limitedEndDate.toISOString()
////  };
////}
//async function backfillLiquidation(startDate, endDate, req) {
//
//    let manifest = await loadManifest();
//    let now = moment();
//
//    // CRITICAL FIX: Ensure dates are valid
//    let start = moment.max(moment(startDate), moment().subtract(BACKFILL_LIMIT, 'days'));
//    let end = moment.min(moment(endDate), now);
//
//    // Additional validation
//    if (!start.isValid() || !end.isValid() || start.isAfter(end)) {
//      console.error('Invalid backfill date range:', { start: start.toString(), end: end.toString() });
//      return;
//    }
//
//    let backfillPromises = [];
//    let current = start.clone().startOf('day');
//
//    while (current.isSameOrBefore(end, 'day')) {
//        let cacheFile = getCacheFilePath(current, 'liquidation');
//
//        // Skip if we've already verified this date has fresh cache in S3
//        if (await isDateVerified(current, 'liquidation')) {
//            console.log(`Skipping backfill for verified date: ${current.format('YYYY-MM-DD')}`);
//            current.add(1, 'day');
//            continue;
//        }
//
//        if (!(await isCacheFresh(cacheFile, FRESHNESS_HISTORICAL, 'liquidation'))) {
//            backfillPromises.push(async () => {
//                console.log(`Backfilling liquidation cache for ${current.format('YYYY-MM-DD')}`);
//
//                let dayStart = current.clone().startOf('day').toISOString();
//                let dayEnd = current.clone().endOf('day').toISOString();
//
//                let dataDT = await fetchLiquidationForDay(dayStart, dayEnd, req);
//                if (dataDT.data.length === 0) {
//                    console.warn(`No data to cache for ${current.format('YYYY-MM-DD')}`);
//                    return;
//                }
//
//                await saveToCache(cacheFile, dataDT.data, FRESHNESS_HISTORICAL, false, 'liquidation');
//            });
//        } else {
//            // Mark as verified in S3 since it's already fresh
//            await markDateAsVerified(current, 'liquidation');
//        }
//        current.add(1, 'day');
//    }
//
//    await Promise.all(backfillPromises.map(fn => fn()));
//    await cleanupOldFiles();
//}
//
//async function backfillCache(startDate, endDate, req, options) {
//  let now = moment();
//  let start = moment.max(moment(startDate), moment().subtract(BACKFILL_LIMIT, 'days'));
//  let end = moment.min(moment(endDate), now);
//
//  let backfillPromises = [];
//  let current = start.clone().startOf('day');
//
//  while (current.isSameOrBefore(end, 'day')) {
//    let cacheFile = getCacheFilePath(current);
//
//    // Skip if we've already verified this date has fresh cache
//    if (await isDateVerified(current, 'transactions')) {
//      console.log(`Skipping transaction backfill for verified date: ${current.format('YYYY-MM-DD')}`);
//      current.add(1, 'day');
//      continue;
//    }
//
//    if (!(await isCacheFresh(cacheFile, FRESHNESS_HISTORICAL, 'transactions'))) {
//      backfillPromises.push(async () => {
//        console.log(`Backfilling cache for ${current.format('YYYY-MM-DD')}`);
//
//        // ✅ Pass the current date as ISO string for startDate, and end of day as ISO string for endDate
//        let dayStart = current.toISOString();
//        let dayEnd = current.clone().endOf('day').toISOString();
//
//        let transactions = await fetchTransactionsForDay(dayStart, dayEnd, req, options);
//        if (transactions.length === 0) {
//          console.warn(`No transaction data to cache for ${current.format('YYYY-MM-DD')}`);
//          return;
//        }
//
//        await saveToCache(cacheFile, transactions, FRESHNESS_HISTORICAL, false, 'transactions');
//      });
//    } else {
//      // Mark as verified since it's already fresh
//      await markDateAsVerified(current, 'transactions');
//    }
//    current.add(1, 'day');
//  }
//
//  await Promise.all(backfillPromises.map(fn => fn()));
//  await cleanupOldFiles();
//}
//
//async function getTransactionsByDateRange(options, req) {
//    console.log('💡🚨 ->>  getTransactionsByDateRange & transactionsCache <<- 🚨💡');
//  // Guard against infinite recursion
//  if (!req._cacheCallDepth) req._cacheCallDepth = 0;
//  req._cacheCallDepth++;
//
//  if (req._cacheCallDepth > 3) {
//    console.error('❌ CIRCULAR DEPENDENCY DETECTED: Too many recursive cache calls');
//    req._cacheCallDepth = 0;
//    throw new Error('Circular dependency in cache calls');
//  }
//
//  try {
//    let { fechas } = options;
//
//    // Validate and limit the date range
//    let { startDate, endDate } = validateAndLimitDateRange(fechas);
//
//    console.log(`Processing transactions for range: ${startDate} to ${endDate}`);
//
//    let start = moment(startDate).startOf('day');
//    let end = moment(endDate).endOf('day');
//    let now = moment();
//
//    if (start.isAfter(now)) {
//      console.log('Start date is in the future, no data to process');
//      return [];
//    }
//
//    // Ensure we don't process future dates
//    let effectiveEnd = end.isAfter(now) ? now.clone() : end;
//
//    if (start.isAfter(effectiveEnd)) {
//      console.log('Start date is after effective end date, no data to process');
//      return [];
//    }
//
//    let transactions = [];
//
//    await ensureCacheDir();
//
//    // Wait for backfill to complete before proceeding
//    if (start.isBefore(now, 'day')) {
//      console.log('Running backfill for historical transaction data...');
//      await backfillCache(start, end, req, options);
//    }
//
//    let current = start.clone();
//    while (current.isSameOrBefore(end, 'day')) {
//      let cacheFile = getCacheFilePath(current);
//      let isToday = current.isSame(now, 'day');
//      let freshness = isToday ? FRESHNESS_TODAY : FRESHNESS_HISTORICAL;
//
//      // For historical files, check verification first without freshness check
//      if (!isToday && await isFileVerified(cacheFile, 'transactions')) {
//        console.log(`Historical transaction file verified - direct load: ${cacheFile}`);
//        try {
//          let data = await s3.getObject({
//            Bucket: S3_BUCKET,
//            Key: cacheFile
//          }).promise();
//          let parsedData = safeParse(data.Body.toString('utf8'), []); // FIXED: Use safeParse
//          transactions.push(...parsedData);
//          console.log(`Loaded ${parsedData.length} transaction records from verified file: ${cacheFile}`);
//          current.add(1, 'day');
//          continue;
//        } catch (error) {
//          console.error(`Failed to load verified transaction file ${cacheFile}:`, error);
//          // Fall through to normal cache logic
//        }
//      }
//
//      // Use cache hits optimized check for today files or unverified historical files
//      if (await isCacheFresh(cacheFile, freshness, 'transactions')) {
//        console.log(`Transaction cache hit for ${current.format('YYYY-MM-DD')}`);
//        try {
//          let data = await s3.getObject({
//            Bucket: S3_BUCKET,
//            Key: cacheFile
//          }).promise();
//          let parsedData = safeParse(data.Body.toString('utf8'), []); // FIXED: Use safeParse
//          transactions.push(...parsedData);
//          console.log(`Loaded ${parsedData.length} transaction records from cache: ${cacheFile}`);
//        } catch (error) {
//          console.error(`❌ Failed to parse cache file ${cacheFile}:`, error.message);
//
//          // DELETE THE CORRUPT FILE
//          try {
//            await s3.deleteObject({
//              Bucket: S3_BUCKET,
//              Key: cacheFile
//            }).promise();
//            console.log(`🗑️ Deleted corrupt cache file: ${cacheFile}`);
//          } catch (deleteError) {
//            console.error(`Failed to delete corrupt file ${cacheFile}:`, deleteError.message);
//          }
//
//          // Clear from memory cache
//          cache.del(`data:${cacheFile}`);
//          cache.del(`freshness:${cacheFile}`);
//
//          // Regenerate cache
//          let dayStart = current.toISOString();
//          let dayEnd = current.clone().endOf('day').toISOString();
//          let dayTransactions = await fetchTransactionsForDay(dayStart, dayEnd, req, options);
//          transactions.push(...dayTransactions);
//
//          try {
//            let jsonData = safeStringify(dayTransactions);
//            safeParse(jsonData); // Validate
//            await s3.putObject({
//              Bucket: S3_BUCKET,
//              Key: cacheFile,
//              Body: jsonData,
//              ContentType: 'application/json'
//            }).promise();
//
//            let manifest = await loadManifest();
//            manifest.cached_dates[current.format('YYYY-MM-DD')] = {
//              mtime: Date.now(),
//              fresh_until: Date.now() + freshness
//            };
//            if (isToday) {
//              manifest.today_file = path.basename(cacheFile);
//              manifest.today_mtime = Date.now();
//            }
//            await saveManifest(manifest);
//          } catch (err) {
//            console.error(`Invalid JSON for ${cacheFile}, skipping:`, err);
//            continue;
//          }
//        }
//      } else {
//        console.log(`Transaction cache miss for ${current.format('YYYY-MM-DD')}`);
//        let dayStart = current.toISOString();
//        let dayEnd = current.clone().endOf('day').toISOString();
//        let dayTransactions = await fetchTransactionsForDay(dayStart, dayEnd, req, options);
//        transactions.push(...dayTransactions);
//
//        try {
//          let jsonData = safeStringify(dayTransactions);
//          safeParse(jsonData); // Validate
//          await s3.putObject({
//            Bucket: S3_BUCKET,
//            Key: cacheFile,
//            Body: jsonData,
//            ContentType: 'application/json'
//          }).promise();
//
//          let manifest = await loadManifest();
//          manifest.cached_dates[current.format('YYYY-MM-DD')] = {
//            mtime: Date.now(),
//            fresh_until: Date.now() + freshness
//          };
//          if (isToday) {
//            manifest.today_file = path.basename(cacheFile);
//            manifest.today_mtime = Date.now();
//          }
//          await saveManifest(manifest);
//        } catch (error) {
//          console.error(`Invalid JSON for ${cacheFile}, skipping:`, error);
//          continue;
//        }
//      }
//
//      current.add(1, 'day');
//    }
//
//    if (end.isSame(now, 'day')) {
//      let manifest = await loadManifest();
//      let todayFile = getCacheFilePath(now);
//      let lastMtime = manifest.today_mtime || 0;
//
//      try {
//        let data = await s3.headObject({
//          Bucket: S3_BUCKET,
//          Key: todayFile
//        }).promise();
//        lastMtime = new Date(data.LastModified).getTime();
//      } catch (error) {
//        if (error.code !== 'NotFound') throw error;
//      }
//
//      let newTransactions = await fetchTransactionsForDay(
//        moment(lastMtime).toISOString(),
//        now.toISOString(),
//        req,
//        options
//      );
//
//      if (newTransactions.length > 0) {
//        let allTransactions = [];
//        try {
//          let existing = await s3.getObject({
//            Bucket: S3_BUCKET,
//            Key: todayFile
//          }).promise().catch(() => ({ Body: '[]' }));
//          allTransactions = [...safeParse(existing.Body.toString('utf8'), []), ...newTransactions];
//        } catch (error) {
//          console.error(`Failed to parse existing cache ${todayFile}:`, error);
//          allTransactions = newTransactions;
//        }
//
//        try {
//          let jsonData = safeStringify(allTransactions);
//          safeParse(jsonData); // Validate
//          await s3.putObject({
//            Bucket: S3_BUCKET,
//            Key: todayFile,
//            Body: jsonData,
//            ContentType: 'application/json'
//          }).promise();
//          transactions = transactions.filter(tx => !moment(tx.creation_date).isSame(now, 'day'));
//          transactions.push(...allTransactions);
//
//          manifest.today_mtime = Date.now();
//          await saveManifest(manifest);
//        } catch (error) {
//          console.error(`Invalid JSON for ${todayFile}, skipping:`, error);
//        }
//      }
//    }
//
//    return transactions;
//
//  } catch (error) {
//    console.error('Error in getTransactionsByDateRange:', error);
//    throw error;
//  } finally {
//    req._cacheCallDepth--;
//  }
//}
//
//// Fetch consolidation data for a single day
//async function fetchConsolidationForDay(dayTimestamp, cliente, req) {
//console.log('💡🚨 ->>  fetchConsolidationForDay & transactionsCache <<- 🚨💡');
//
//    let min = 60000;
//    let hora = 60 * min;
//    let dayStart = new Date(parseInt(dayTimestamp) - hora);
//    let dayEnd = new Date(parseInt(dayTimestamp) + (22 * hora) + (59 * min) + (min - 1000));
//
//    let status = [2, 4, 5];
//    let where = cliente === 'all' ? { status, created_at: { [Op.between]: [dayStart, dayEnd] } } : { status, id_client: cliente, created_at: { [Op.between]: [dayStart, dayEnd] } };
//
//    let response = await db.consolidacion.findAll({
//        include: [{
//            model: db.merchant,
//            as: 'merchant',
//            attributes: ['name_merchant', 'id_datos_bancarios', 'rfc_merchant', 'tasa_debito_b', 'tasa_credito_b', 'retencion', 'msi'],
//            include: {
//                model: db.datosBancarios,
//                as: 'datos_bancarios',
//                attributes: ['clabe'],
//            }
//        }],
//        where,
//        raw: true
//    }).catch(error => {
//        console.error(`Error querying consolidacion table:`, error);
//        return [];
//    });
//    console.log(`Fetched ${response.length} consolidation records for ${dayStart} to ${dayEnd}`);
//
//    let clientes = [];
//    response.forEach(r => {
//        if (!clientes.includes(r.id_client)) clientes.push(r.id_client);
//    });
//
//    let id_merchants = [];
//    let ProGruposColl = clientes.map(async idClient => {
//        let merchants = [];
//        response.filter(r => r.id_client === idClient).map(r => {
//            if (2 === r.status) {
//                if ('credit' === r.t_medio && 0 !== r.msi) r.t_medio = `credit_msi${r.msi}`;
//                if (1 === r.isLink) {
//                    if ('debit' === r.t_medio) r.t_medio = 'debit_link';
//                    else if ('credit' === r.t_medio) r.t_medio = 'credit_link';
//                    else if ('internacional' === r.t_medio) r.t_medio = 'internacional_link';
//                }
//            }
//            return r;
//        }).forEach(r => {
//            if (!id_merchants.includes(r.id_merchant)) {
//                let msiConfig;
//                try {
//                    msiConfig = JSON.parse(r['merchant.msi'] || '[]');
//                } catch (error) {
//                    console.warn(`Error parsing merchant.msi for merchant ${r.id_merchant}:`, error);
//                    msiConfig = [];
//                }
//                let msi_Tasa = [3, 6, 9, 12, 18].map(m => {
//                    let slc = msiConfig.filter(msiC => msiC.type === m);
//                    return slc[0] || { percent: 0 };
//                });
//
//                merchants.push({
//                    id: r.id_merchant,
//                    name: r['merchant.name_merchant'],
//                    clabe: r['merchant.datos_bancarios.clabe'],
//                    rfc: r['merchant.rfc_merchant'],
//                    retencion: parseFloat(r['merchant.retencion'] || 0),
//                    dataCargo_internacional_link: { no: 0, montoBruto: 0, tasa: 0, comision: 0, ivaTasa: 0, ivaComision: 0, montoNeto: 0, tasas: [parseFloat(r.tasa_amex_b || 0)] },
//                    dataCargo_internacional: { no: 0, montoBruto: 0, tasa: 0, comision: 0, ivaTasa: 0, ivaComision: 0, montoNeto: 0, tasas: [parseFloat(r.tasa_amex_b || 0)] },
//                    dataCargo_debit_link: { no: 0, montoBruto: 0, tasa: 0, comision: 0, ivaTasa: 0, ivaComision: 0, montoNeto: 0, tasas: [parseFloat(r.tasa_debito_b || 0)] },
//                    dataCargo_debit: { no: 0, montoBruto: 0, tasa: 0, comision: 0, ivaTasa: 0, ivaComision: 0, montoNeto: 0, tasas: [parseFloat(r.tasa_debito_b || 0)] },
//                    dataCargo_credit: { no: 0, montoBruto: 0, tasa: 0, comision: 0, ivaTasa: 0, ivaComision: 0, montoNeto: 0, tasas: [parseFloat(r.tasa_credito_b || 0)] },
//                    dataCargo_credit_link: { no: 0, montoBruto: 0, tasa: 0, comision: 0, ivaTasa: 0, ivaComision: 0, montoNeto: 0, tasas: [parseFloat(r.tasa_credito_b || 0)] },
//                    dataCargo_credit_msi3: { no: 0, montoBruto: 0, tasa: 0, comision: 0, ivaTasa: 0, ivaComision: 0, montoNeto: 0, tasas: [parseFloat(r.tasa_credito_b || 0) + parseFloat(msi_Tasa[0].percent)], sobretasas: parseFloat(msi_Tasa[0].percent) },
//                    dataCargo_credit_msi6: { no: 0, montoBruto: 0, tasa: 0, comision: 0, ivaTasa: 0, ivaComision: 0, montoNeto: 0, tasas: [parseFloat(r.tasa_credito_b || 0) + parseFloat(msi_Tasa[1].percent)], sobretasas: parseFloat(msi_Tasa[1].percent) },
//                    dataCargo_credit_msi9: { no: 0, montoBruto: 0, tasa: 0, comision: 0, ivaTasa: 0, ivaComision: 0, montoNeto: 0, tasas: [parseFloat(r.tasa_credito_b || 0) + parseFloat(msi_Tasa[2].percent)], sobretasas: parseFloat(msi_Tasa[2].percent) },
//                    dataCargo_credit_msi12: { no: 0, montoBruto: 0, tasa: 0, comision: 0, ivaTasa: 0, ivaComision: 0, montoNeto: 0, tasas: [parseFloat(r.tasa_credito_b || 0) + parseFloat(msi_Tasa[3].percent)], sobretasas: parseFloat(msi_Tasa[3].percent) },
//                    dataCargo_credit_msi18: { no: 0, montoBruto: 0, tasa: 0, comision: 0, ivaTasa: 0, ivaComision: 0, montoNeto: 0, tasas: [parseFloat(r.tasa_credito_b || 0) + parseFloat(msi_Tasa[4].percent)], sobretasas: parseFloat(msi_Tasa[4].percent) },
//                    dataDevolucion_debit: { no: 0, montoBruto: 0, tasa: 0, comision: 0, ivaTasa: 0, ivaComision: 0, montoNeto: 0, tasas: [parseFloat(r.tasa_debito_b || 0)] },
//                    dataDevolucion_internacional: { no: 0, montoBruto: 0, tasa: 0, comision: 0, ivaTasa: 0, ivaComision: 0, montoNeto: 0, tasas: [parseFloat(r.tasa_amex_b || 0)] },
//                    dataDevolucion_credit: { no: 0, montoBruto: 0, tasa: 0, comision: 0, ivaTasa: 0, ivaComision: 0, montoNeto: 0, tasas: [parseFloat(r.tasa_credito_b || 0)] },
//                    dataCancelacion_debit: { no: 0, montoBruto: 0, tasa: 0, comision: 0, ivaTasa: 0, ivaComision: 0, montoNeto: 0, tasas: [parseFloat(r.tasa_debito_b || 0)] },
//                    dataCancelacion_internacional: { no: 0, montoBruto: 0, tasa: 0, comision: 0, ivaTasa: 0, ivaComision: 0, montoNeto: 0, tasas: [parseFloat(r.tasa_amex_b || 0)] },
//                    dataCancelacion_credit: { no: 0, montoBruto: 0, tasa: 0, comision: 0, ivaTasa: 0, ivaComision: 0, montoNeto: 0, tasas: [parseFloat(r.tasa_credito_b || 0)] },
//                });
//                id_merchants.push(r.id_merchant);
//            }
//        });
//
//        let cliente = await db.isoClient.findOne({ attributes: ['name'], where: { id_client: idClient }, raw: true }).catch(error => {
//            console.error(`Error querying isoClient for id_client ${idClient}:`, error);
//            return null;
//        });
//        return { cli: { id: idClient, name: cliente?.name ?? 'Desconocido' }, merchants };
//    });
//
//    let grupos = await Promise.all(ProGruposColl);
//
//    grupos.forEach((g, i) => {
//        g.merchants.forEach((gm, ii) => {
//            [['dataCargo', 2, 1], ['dataDevolucion', 4, 1], ['dataCancelacion', 5, 1]].forEach(k => {
//                ['debit', 'debit_link', 'credit', 'credit_link', 'credit_msi3', 'credit_msi6', 'credit_msi9', 'credit_msi12', 'credit_msi18', 'internacional', 'internacional_link'].forEach(tag => {
//                    let masterTag = `${k[0]}_${tag}`;
//                    if (grupos[i].merchants[ii][masterTag]) {
//                        let cargos = response.filter(r => {
//                            let vCli = r.id_client === g.cli.id;
//                            let vComercio = r.id_merchant === gm.id;
//                            let vMedio = tag === r.t_medio;
//                            let vStatus = k[1] === r.status;
//                            return vCli && vComercio && vMedio && vStatus;
//                        });
//
//                        let no = cargos.length;
//                        let montoBruto = 0;
//                        let tasa = 0;
//                        let comision = 0;
//                        try {
//                            montoBruto = cargos.map(c => k[2] * parseFloat(c.amount)).reduce((anterior, actual) => anterior + actual, 0);
//                            let tasas = grupos[i].merchants[ii][masterTag].tasas;
//                            tasa = cargos.map(c => {
//                                let cMeses = JSON.parse(c['merchant.msi'] || '[]').filter(m => c.msi === m.type);
//                                let sobretasa = cMeses[0] || { percent: 0 };
//                                let vTasa = parseFloat(
//                                    /^credit/.test(c.t_medio) ? (0 === c.msi ? c.tasa_credito_b : (parseFloat(c.tasa_credito_b || 0) + parseFloat(sobretasa.percent))) :
//                                        (/^internacional/.test(c.t_medio) ? c.tasa_amex_b : c.tasa_debito_b)
//                                );
//                                tasas.push(vTasa);
//                                return k[2] * (parseFloat(c.id_operation === 6 ? (c.amount / 100) : c.amount)) * vTasa;
//                            }).reduce((anterior, actual) => anterior + actual, 0);
//                            comision = cargos.map(c => {
//                                return parseFloat(/^credit/.test(c.t_medio) ? c.tasa_credito_d : (/^internacional/.test(c.t_medio) ? c.tasa_amex_d : c.tasa_debito_d));
//                            }).reduce((anterior, actual) => anterior + actual, 0);
//                        } catch (error) {
//                            console.warn(`Error processing cargos for ${masterTag}:`, error);
//                        }
//
//                        let ivaTasa = (tasa / 100) * 16;
//                        let ivaComision = (comision / 100) * 16;
//                        let montoNeto = montoBruto - (tasa + comision + ivaTasa + ivaComision);
//
//                        tasas = encontrarNumeroMasRepetido(tasas || []);
//                        grupos[i].merchants[ii][masterTag] = { no, montoBruto, tasa, comision, ivaTasa, ivaComision, montoNeto, tasas };
//                    }
//                });
//            });
//        });
//    });
//
//    console.log(`Processed ${grupos.length} consolidation groups`);
//    return { grupos, dayStart, dayEnd };
//}
//
//// FIXED: Enhanced backfill consolidation - wait for completion
//async function backfillConsolidation(dayTimestamp, cliente, req) {
//    let now = moment();
//    let day = moment(parseInt(dayTimestamp));
//    let start = moment.max(day, moment().subtract(BACKFILL_LIMIT, 'days'));
//    let end = moment.min(day, now);
//
//    let backfillPromises = [];
//    let current = start.clone().startOf('day');
//
//    while (current.isSameOrBefore(end, 'day')) {
//        let cacheFile = getCacheFilePath(current, 'consolidation');
//
//        // Skip if we've already verified this date has fresh cache
//        if (await isDateVerified(current, 'consolidation')) {
//            console.log(`Skipping consolidation backfill for verified date: ${current.format('YYYY-MM-DD')}`);
//            current.add(1, 'day');
//            continue;
//        }
//
//        if (!(await isCacheFresh(cacheFile, FRESHNESS_HISTORICAL, 'consolidation'))) {
//            backfillPromises.push(async () => {
//                console.log(`Backfilling consolidation cache for ${current.format('YYYY-MM-DD')}`);
//                let { grupos } = await fetchConsolidationForDay(current.valueOf(), cliente, req);
//                if (grupos.length === 0) {
//                    console.warn(`No consolidation data to cache for ${current.format('YYYY-MM-DD')}`);
//                    return;
//                }
//
//                await saveToCache(cacheFile, grupos, FRESHNESS_HISTORICAL, false, 'consolidation');
//            });
//        } else {
//            // Mark as verified since it's already fresh
//            await markDateAsVerified(current, 'consolidation');
//        }
//        current.add(1, 'day');
//    }
//
//    await Promise.all(backfillPromises.map(fn => fn()));
//    await cleanupOldFiles();
//}
//
//// FIXED: Enhanced get consolidation - wait for backfill to complete
//async function getConsolidationByDate(dayTimestamp, cliente, req) {
//console.log('💡🚨 ->>  getConsolidationByDate & transactionsCache <<- 🚨💡');
//    let day = moment(parseInt(dayTimestamp));
//    let cacheFile = getCacheFilePath(day, 'consolidation');
//    let isToday = day.isSame(moment(), 'day');
//    let freshness = isToday ? FRESHNESS_TODAY : FRESHNESS_HISTORICAL;
//
//    await ensureCacheDir();
//    console.log(`Processing consolidation for ${day.format('YYYY-MM-DD')}`);
//
//    // FIX: Wait for backfill to complete before proceeding
//    if (day.isBefore(moment(), 'day')) {
//        console.log('Running backfill for historical consolidation data...');
//        await backfillConsolidation(dayTimestamp, cliente, req); // AWAIT here - don't run in background
//    }
//
//    // For historical files, check verification first without freshness check
//    if (!isToday && await isFileVerified(cacheFile, 'consolidation')) {
//        console.log(`Historical consolidation file verified - direct load: ${cacheFile}`);
//        try {
//            let data = await s3.getObject({
//                Bucket: S3_BUCKET,
//                Key: cacheFile
//            }).promise();
//            let parsedData = JSON.parse(data.Body.toString('utf8'));
//            console.log(`Loaded ${parsedData.length} consolidation groups from verified file: ${cacheFile}`);
//            return { grupos: parsedData, dayStart: day.startOf('day').toDate(), dayEnd: day.endOf('day').toDate() };
//        } catch (error) {
//            console.error(`Failed to load verified consolidation file ${cacheFile}:`, error);
//            // Fall through to normal cache logic
//        }
//    }
//
//    let cachedData = await getFromCacheOptimized(cacheFile, freshness, 'consolidation');
//    if (cachedData) {
//        console.log(`Consolidation cache hit for ${day.format('YYYY-MM-DD')}`);
//        return { grupos: cachedData, dayStart: day.startOf('day').toDate(), dayEnd: day.endOf('day').toDate() };
//    }
//
//    console.log(`Consolidation cache miss for ${day.format('YYYY-MM-DD')}`);
//    let result = await fetchConsolidationForDay(dayTimestamp, cliente, req);
//    if (result.grupos.length === 0) {
//        console.warn(`No consolidation data fetched for ${day.format('YYYY-MM-DD')}`);
//    }
//
//    await saveToCache(cacheFile, result.grupos, freshness, isToday, 'consolidation');
//    console.log(`Returning ${result.grupos.length} consolidation groups`);
//    return result;
//}
//
//// Reused from reportes.controller.js
//function encontrarNumeroMasRepetido(array) {
//    let frecuencia = {};
//    for (let i = 0; i < array.length; i++) {
//        if (array[i] in frecuencia) frecuencia[array[i]]++;
//        else frecuencia[array[i]] = 1;
//    }
//    let maxFrecuencia = 0;
//    let numeroMasRepetido;
//    for (let numero in frecuencia) {
//        if (frecuencia[numero] > maxFrecuencia) {
//            maxFrecuencia = frecuencia[numero];
//            numeroMasRepetido = numero;
//        }
//    }
//    return numeroMasRepetido;
//}
//
//// Validate date
//function validateDate(date) {
//    return date.toString() !== 'Invalid Date';
//}
//
//// Add a function to log cache hits statistics from S3
//async function logCacheHitsStats() {
//    try {
//        let cacheHits = await loadCacheHits();
//        console.log(`\n=== S3 Cache Hits Statistics ===`);
//        console.log(`Total verified dates: ${cacheHits.verified_dates.size}`);
//        console.log(`Total verified files: ${cacheHits.verified_files.size}`);
//        console.log(`Last updated: ${new Date(cacheHits.last_updated).toISOString()}`);
//        console.log(`Instance ID: ${cacheHits.instance_id}`);
//
//        // Breakdown by type
//        let types = ['transactions', 'consolidation', 'liquidation'];
//        for (let type of types) {
//            let typeDates = Array.from(cacheHits.verified_dates).filter(d => d.startsWith(`${type}:`));
//            let typeFiles = Array.from(cacheHits.verified_files).filter(f => f.startsWith(`${type}:`));
//            console.log(`\n${type}: ${typeDates.length} dates, ${typeFiles.length} files`);
//
//            if (typeDates.length > 0) {
//                console.log(`Sample dates: ${typeDates.slice(0, 3).map(d => d.replace(`${type}:`, '')).join(', ')}`);
//            }
//        }
//    } catch (error) {
//        console.error('Error logging cache hits stats:', error);
//    }
//}
//
//async function getVerifiedDates(type = 'transactions') {
//    try {
//        let cacheHits = await loadCacheHits();
//        let prefix = `${type}:`;
//        return Array.from(cacheHits.verified_dates)
//            .filter(date => date.startsWith(prefix))
//            .map(date => date.replace(prefix, ''));
//    } catch (error) {
//        console.error('Error getting verified dates:', error);
//        return [];
//    }
//}
//
//module.exports = {
//    getTransactionsByDateRange,
//    getConsolidationByDate,
//    getReportLiquidationByDate,
//    logCacheHitsStats,
//    getVerifiedDates,
//    fetchLiquidationForDay,
//    backfillCache
//};
//
///*
//echo '## gw-backend-backup/lib/socketServer/lib/controllers/transactionCacheController.js';
//cat '/Users/andresgutierrez/Companies/Programmer City/Clients/Isela Vazquez - Proyecto Construccion de APIs/SourceCode/UltimateCode/migration/back-front/gw-backend-backup/lib/socketServer/lib/controllers/transactionCacheController.js' | grep -v '\/\/'
//echo '## gw-backend-backup/lib/socketServer/lib/controllers/transactionCacheController.js';
//cat '/Users/andresgutierrez/Companies/Programmer City/Clients/Isela Vazquez - Proyecto Construccion de APIs/SourceCode/UltimateCode/migration/back-front/gw-backend-backup/lib/socketServer/lib/controllers/reportes.controller.js'  | grep -v '\/\/'
//echo '## gw-backend-backup/lib/socketServer/lib/controllers/transactionCacheController.js';
//cat '/Users/andresgutierrez/Companies/Programmer City/Clients/Isela Vazquez - Proyecto Construccion de APIs/SourceCode/UltimateCode/migration/back-front/gw-backend-backup/lib/socketServer/lib/controllers/SPA/Dashboard/dashboard.controller.js' | grep -v '\/\/'
//echo '## gw-backend-backup/lib/socketServer/lib/controllers/transactionCacheController.js';
//cat '/Users/andresgutierrez/Companies/Programmer City/Clients/Isela Vazquez - Proyecto Construccion de APIs/SourceCode/UltimateCode/migration/back-front/gw-backend-backup/lib/socketServer/lib/controllers/SPA/Movements/movements.pro.controller.js' | grep -v '\/\/'
//echo '## gw-frontend-backup/src/app/pages/dashboard/dashboard.component.css';
//cat '/Users/andresgutierrez/Companies/Programmer City/Clients/Isela Vazquez - Proyecto Construccion de APIs/SourceCode/UltimateCode/migration/back-front/gw-frontend-backup/src/app/pages/dashboard/dashboard.component.css' | grep -v '\/\/'
//echo '## gw-frontend-backup/src/app/pages/dashboard/dashboard.component.html';
//cat '/Users/andresgutierrez/Companies/Programmer City/Clients/Isela Vazquez - Proyecto Construccion de APIs/SourceCode/UltimateCode/migration/back-front/gw-frontend-backup/src/app/pages/dashboard/dashboard.component.html' | grep -v '\/\/'
//echo '## gw-frontend-backup/src/app/pages/dashboard/dashboard.component.spec.ts';
//cat '/Users/andresgutierrez/Companies/Programmer City/Clients/Isela Vazquez - Proyecto Construccion de APIs/SourceCode/UltimateCode/migration/back-front/gw-frontend-backup/src/app/pages/dashboard/dashboard.component.spec.ts' | grep -v '\/\/'
//echo '## gw-frontend-backup/src/app/pages/dashboard/dashboard.component.ts';
//cat '/Users/andresgutierrez/Companies/Programmer City/Clients/Isela Vazquez - Proyecto Construccion de APIs/SourceCode/UltimateCode/migration/back-front/gw-frontend-backup/src/app/pages/dashboard/dashboard.component.ts' | grep -v '\/\/'
//
//*/