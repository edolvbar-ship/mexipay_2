const pool = require('../../database');
const db = require('../../sequelize/init');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { promisify } = require('util');
const writeFile = promisify(fs.writeFile);

/**
 * Database Explorer Controller
 * 
 * Provides comprehensive database management capabilities:
 * - Dynamic table/column discovery
 * - CRUD operations on any table
 * - Relationship mapping
 * - Pagination and filtering
 * - Batch operations
 * - Database export
 */

const DatabaseExplorerController = {};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get list of all tables in the database
 */
const getAllTables = async () => {
    const query = `
        SELECT 
            table_name as tableName,
            table_comment as description
        FROM information_schema.tables 
        WHERE table_schema = DATABASE()
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
    `;
    return await pool.query(query);
};

/**
 * Get columns information for a specific table
 */
const getTableColumns = async (tableName) => {
    const query = `
        SELECT 
            column_name as columnName,
            data_type as dataType,
            is_nullable as isNullable,
            column_default as defaultValue,
            column_comment as description,
            extra,
            character_maximum_length as maxLength
        FROM information_schema.columns 
        WHERE table_schema = DATABASE()
        AND table_name = ?
        ORDER BY ordinal_position
    `;
    return await pool.query(query, [tableName]);
};

/**
 * Get primary key of a table
 */
const getPrimaryKey = async (tableName) => {
    const query = `
        SELECT column_name as primaryKey
        FROM information_schema.key_column_usage
        WHERE table_schema = DATABASE()
        AND table_name = ?
        AND constraint_name = 'PRIMARY'
    `;
    const result = await pool.query(query, [tableName]);
    return result.length > 0 ? result[0].primaryKey : null;
};

/**
 * Get foreign keys and relationships for a table
 */
const getTableRelationships = async (tableName) => {
    const query = `
        SELECT
            kcu.column_name as columnName,
            kcu.referenced_table_name as referencedTable,
            kcu.referenced_column_name as referencedColumn,
            rc.update_rule as updateRule,
            rc.delete_rule as deleteRule
        FROM information_schema.key_column_usage kcu
        JOIN information_schema.referential_constraints rc
            ON kcu.constraint_name = rc.constraint_name
            AND kcu.table_schema = rc.constraint_schema
        WHERE kcu.table_schema = DATABASE()
        AND kcu.table_name = ?
        AND kcu.referenced_table_name IS NOT NULL
    `;
    return await pool.query(query, [tableName]);
};

/**
 * Get all foreign keys pointing to a table
 */
const getReferencesToTable = async (tableName) => {
    const query = `
        SELECT
            kcu.table_name as tableName,
            kcu.column_name as columnName,
            kcu.referenced_column_name as referencedColumn
        FROM information_schema.key_column_usage kcu
        WHERE kcu.table_schema = DATABASE()
        AND kcu.referenced_table_name = ?
        AND kcu.referenced_table_name IS NOT NULL
    `;
    return await pool.query(query, [tableName]);
};

/**
 * Get indexes for a table
 */
const getTableIndexes = async (tableName) => {
    const query = `
        SELECT 
            index_name as indexName,
            column_name as columnName,
            non_unique as nonUnique
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
        AND table_name = ?
        AND index_name != 'PRIMARY'
    `;
    return await pool.query(query, [tableName]);
};

/**
 * Build WHERE clause from filter parameters
 */
const buildWhereClause = (filters, columns) => {
    if (!filters || Object.keys(filters).length === 0) {
        return { clause: '', values: [] };
    }

    const conditions = [];
    const values = [];

    for (const [key, value] of Object.entries(filters)) {
        if (value === undefined || value === null || value === '') continue;

        const column = columns.find(c => c.columnName === key);
        const dataType = column?.dataType?.toLowerCase() || '';

        // Handle different data types
        if (dataType.includes('int') || dataType.includes('decimal') || dataType.includes('float')) {
            // Numeric exact match or range
            if (typeof value === 'object' && (value.min !== undefined || value.max !== undefined)) {
                if (value.min !== undefined) {
                    conditions.push(`${key} >= ?`);
                    values.push(value.min);
                }
                if (value.max !== undefined) {
                    conditions.push(`${key} <= ?`);
                    values.push(value.max);
                }
            } else {
                conditions.push(`${key} = ?`);
                values.push(value);
            }
        } else if (dataType.includes('date') || dataType.includes('time')) {
            // Date range
            if (typeof value === 'object' && (value.from || value.to)) {
                if (value.from) {
                    conditions.push(`${key} >= ?`);
                    values.push(value.from);
                }
                if (value.to) {
                    conditions.push(`${key} <= ?`);
                    values.push(value.to);
                }
            } else {
                conditions.push(`${key} = ?`);
                values.push(value);
            }
        } else {
            // Text search with LIKE
            conditions.push(`${key} LIKE ?`);
            values.push(`%${value}%`);
        }
    }

    return {
        clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
        values: values
    };
};

/**
 * Get total count for pagination
 */
const getTotalCount = async (tableName, whereClause, whereValues) => {
    const query = `SELECT COUNT(*) as total FROM ${tableName} ${whereClause}`;
    const result = await pool.query(query, whereValues);
    return result[0].total;
};

/**
 * Sanitize table name to prevent SQL injection
 */
const sanitizeTableName = (tableName) => {
    // Only allow alphanumeric characters and underscores
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
        throw new Error('Invalid table name');
    }
    return tableName;
};

// ============================================================================
// CONTROLLER METHODS
// ============================================================================

/**
 * Get all database tables with metadata
 */
DatabaseExplorerController.getTables = async (req, res) => {
    try {
        const tables = await getAllTables();
        
        // Enhance with row counts
        const enhancedTables = await Promise.all(
            tables.map(async (table) => {
                try {
                    const [countResult] = await pool.query(
                        `SELECT COUNT(*) as count FROM \`${table.tableName}\``
                    );
                    const relationships = await getTableRelationships(table.tableName);
                    const primaryKey = await getPrimaryKey(table.tableName);
                    
                    return {
                        ...table,
                        rowCount: countResult.count,
                        primaryKey,
                        hasRelationships: relationships.length > 0,
                        relationshipCount: relationships.length
                    };
                } catch (err) {
                    return {
                        ...table,
                        rowCount: 0,
                        primaryKey: null,
                        hasRelationships: false,
                        relationshipCount: 0,
                        error: true
                    };
                }
            })
        );

        res.json({
            success: true,
            data: enhancedTables
        });
    } catch (error) {
        console.error('Error getting tables:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener tablas',
            error: error.message
        });
    }
};

/**
 * Get detailed schema for a specific table
 */
DatabaseExplorerController.getTableSchema = async (req, res) => {
    try {
        const { tableName } = req.params;
        const sanitizedTable = sanitizeTableName(tableName);

        const [columns, primaryKey, relationships, indexes, references] = await Promise.all([
            getTableColumns(sanitizedTable),
            getPrimaryKey(sanitizedTable),
            getTableRelationships(sanitizedTable),
            getTableIndexes(sanitizedTable),
            getReferencesToTable(sanitizedTable)
        ]);

        // Get row count
        const [countResult] = await pool.query(
            `SELECT COUNT(*) as count FROM \`${sanitizedTable}\``
        );

        res.json({
            success: true,
            data: {
                tableName: sanitizedTable,
                columns,
                primaryKey,
                relationships,
                indexes,
                references,
                rowCount: countResult.count
            }
        });
    } catch (error) {
        console.error('Error getting table schema:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener esquema de tabla',
            error: error.message
        });
    }
};

/**
 * Get records from a table with pagination, sorting, and filtering
 */
DatabaseExplorerController.getRecords = async (req, res) => {
    try {
        const { tableName } = req.params;
        const sanitizedTable = sanitizeTableName(tableName);
        
        const {
            page = 1,
            limit = 50,
            sortBy,
            sortOrder = 'ASC',
            filters = {},
            search,
            columns
        } = req.body;

        // Get table columns for type information
        const tableColumns = await getTableColumns(sanitizedTable);

        // Build WHERE clause
        const where = buildWhereClause(filters, tableColumns);
        let whereClause = where.clause;
        let whereValues = where.values;

        // Add global search if provided
        if (search && columns && columns.length > 0) {
            const searchConditions = columns.map(col => `${col} LIKE ?`).join(' OR ');
            const searchValues = columns.map(() => `%${search}%`);
            
            if (whereClause) {
                whereClause += ` AND (${searchConditions})`;
            } else {
                whereClause = `WHERE (${searchConditions})`;
            }
            whereValues = [...whereValues, ...searchValues];
        }

        // Get total count
        const total = await getTotalCount(sanitizedTable, whereClause, whereValues);

        // Build ORDER BY clause
        let orderClause = '';
        if (sortBy) {
            const sanitizedSortBy = tableColumns.find(c => c.columnName === sortBy)?.columnName;
            if (sanitizedSortBy) {
                const order = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
                orderClause = `ORDER BY ${sanitizedSortBy} ${order}`;
            }
        }

        // Build pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const limitClause = `LIMIT ${parseInt(limit)} OFFSET ${offset}`;

        // Execute query
        const query = `SELECT * FROM \`${sanitizedTable}\` ${whereClause} ${orderClause} ${limitClause}`;
        const records = await pool.query(query, whereValues);

        // For each record, fetch related data if requested
        const relationships = await getTableRelationships(sanitizedTable);
        
        if (req.body.includeRelations && relationships.length > 0) {
            for (const record of records) {
                for (const rel of relationships) {
                    if (record[rel.columnName]) {
                        try {
                            const [related] = await pool.query(
                                `SELECT * FROM \`${rel.referencedTable}\` WHERE \`${rel.referencedColumn}\` = ?`,
                                [record[rel.columnName]]
                            );
                            record[`_${rel.referencedTable}`] = related[0] || null;
                        } catch (e) {
                            record[`_${rel.referencedTable}`] = null;
                        }
                    }
                }
            }
        }

        res.json({
            success: true,
            data: {
                records,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / parseInt(limit))
                },
                columns: tableColumns
            }
        });
    } catch (error) {
        console.error('Error getting records:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener registros',
            error: error.message
        });
    }
};

/**
 * Get a single record by ID
 */
DatabaseExplorerController.getRecordById = async (req, res) => {
    try {
        const { tableName, id } = req.params;
        const sanitizedTable = sanitizeTableName(tableName);
        const primaryKey = await getPrimaryKey(sanitizedTable);

        if (!primaryKey) {
            return res.status(400).json({
                success: false,
                message: 'La tabla no tiene clave primaria definida'
            });
        }

        const query = `SELECT * FROM \`${sanitizedTable}\` WHERE \`${primaryKey}\` = ?`;
        const records = await pool.query(query, [id]);

        if (records.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Registro no encontrado'
            });
        }

        // Get related records
        const relationships = await getTableRelationships(sanitizedTable);
        const record = records[0];
        
        for (const rel of relationships) {
            if (record[rel.columnName]) {
                try {
                    const [related] = await pool.query(
                        `SELECT * FROM \`${rel.referencedTable}\` WHERE \`${rel.referencedColumn}\` = ?`,
                        [record[rel.columnName]]
                    );
                    record[`_${rel.referencedTable}`] = related[0] || null;
                } catch (e) {
                    record[`_${rel.referencedTable}`] = null;
                }
            }
        }

        res.json({
            success: true,
            data: record
        });
    } catch (error) {
        console.error('Error getting record:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener registro',
            error: error.message
        });
    }
};

/**
 * Create a new record
 */
DatabaseExplorerController.createRecord = async (req, res) => {
    try {
        const { tableName } = req.params;
        const sanitizedTable = sanitizeTableName(tableName);
        const data = req.body;

        // Remove empty strings and convert to null
        const cleanedData = {};
        for (const [key, value] of Object.entries(data)) {
            if (value === '' || value === undefined) {
                cleanedData[key] = null;
            } else {
                cleanedData[key] = value;
            }
        }

        const columns = Object.keys(cleanedData);
        const values = Object.values(cleanedData);
        const placeholders = columns.map(() => '?').join(', ');

        const query = `INSERT INTO \`${sanitizedTable}\` (${columns.join(', ')}) VALUES (${placeholders})`;
        
        const result = await pool.query(query, values);
        const primaryKey = await getPrimaryKey(sanitizedTable);

        // Fetch the created record
        const [created] = await pool.query(
            `SELECT * FROM \`${sanitizedTable}\` WHERE \`${primaryKey}\` = ?`,
            [result.insertId]
        );

        res.status(201).json({
            success: true,
            message: 'Registro creado exitosamente',
            data: created[0]
        });
    } catch (error) {
        console.error('Error creating record:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear registro',
            error: error.message
        });
    }
};

/**
 * Update a record
 */
DatabaseExplorerController.updateRecord = async (req, res) => {
    try {
        const { tableName, id } = req.params;
        const sanitizedTable = sanitizeTableName(tableName);
        const data = req.body;
        const primaryKey = await getPrimaryKey(sanitizedTable);

        if (!primaryKey) {
            return res.status(400).json({
                success: false,
                message: 'La tabla no tiene clave primaria definida'
            });
        }

        // Remove primary key from update data
        delete data[primaryKey];

        // Clean data
        const cleanedData = {};
        for (const [key, value] of Object.entries(data)) {
            if (key.startsWith('_')) continue; // Skip relation fields
            if (value === '' || value === undefined) {
                cleanedData[key] = null;
            } else {
                cleanedData[key] = value;
            }
        }

        const columns = Object.keys(cleanedData);
        const values = Object.values(cleanedData);

        if (columns.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No hay campos para actualizar'
            });
        }

        const setClause = columns.map(col => `\`${col}\` = ?`).join(', ');
        const query = `UPDATE \`${sanitizedTable}\` SET ${setClause} WHERE \`${primaryKey}\` = ?`;

        await pool.query(query, [...values, id]);

        // Fetch updated record
        const [updated] = await pool.query(
            `SELECT * FROM \`${sanitizedTable}\` WHERE \`${primaryKey}\` = ?`,
            [id]
        );

        res.json({
            success: true,
            message: 'Registro actualizado exitosamente',
            data: updated[0]
        });
    } catch (error) {
        console.error('Error updating record:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar registro',
            error: error.message
        });
    }
};

/**
 * Delete a record
 */
DatabaseExplorerController.deleteRecord = async (req, res) => {
    try {
        const { tableName, id } = req.params;
        const sanitizedTable = sanitizeTableName(tableName);
        const primaryKey = await getPrimaryKey(sanitizedTable);

        if (!primaryKey) {
            return res.status(400).json({
                success: false,
                message: 'La tabla no tiene clave primaria definida'
            });
        }

        // Check for related records
        const references = await getReferencesToTable(sanitizedTable);
        const blockingRecords = [];

        for (const ref of references) {
            const count = await pool.query(
                `SELECT COUNT(*) as count FROM \`${ref.tableName}\` WHERE \`${ref.columnName}\` = ?`,
                [id]
            );
            if (count[0].count > 0) {
                blockingRecords.push({
                    table: ref.tableName,
                    column: ref.columnName,
                    count: count[0].count
                });
            }
        }

        if (blockingRecords.length > 0 && req.body.force !== true) {
            return res.status(409).json({
                success: false,
                message: 'No se puede eliminar: existen registros relacionados',
                data: { relatedRecords: blockingRecords }
            });
        }

        const query = `DELETE FROM \`${sanitizedTable}\` WHERE \`${primaryKey}\` = ?`;
        await pool.query(query, [id]);

        res.json({
            success: true,
            message: 'Registro eliminado exitosamente'
        });
    } catch (error) {
        console.error('Error deleting record:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar registro',
            error: error.message
        });
    }
};

/**
 * Batch operations (create, update, delete multiple records)
 */
DatabaseExplorerController.batchOperation = async (req, res) => {
    try {
        const { tableName } = req.params;
        const { operation, records } = req.body;
        const sanitizedTable = sanitizeTableName(tableName);

        if (!Array.isArray(records) || records.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere un array de registros'
            });
        }

        const primaryKey = await getPrimaryKey(sanitizedTable);
        const results = { success: [], failed: [] };

        for (const record of records) {
            try {
                if (operation === 'create') {
                    const columns = Object.keys(record);
                    const values = Object.values(record);
                    const placeholders = columns.map(() => '?').join(', ');
                    
                    const query = `INSERT INTO \`${sanitizedTable}\` (${columns.join(', ')}) VALUES (${placeholders})`;
                    const result = await pool.query(query, values);
                    results.success.push({ id: result.insertId, data: record });

                } else if (operation === 'update' && primaryKey) {
                    const id = record[primaryKey];
                    delete record[primaryKey];
                    
                    const columns = Object.keys(record);
                    const values = Object.values(record);
                    
                    if (columns.length > 0) {
                        const setClause = columns.map(col => `\`${col}\` = ?`).join(', ');
                        const query = `UPDATE \`${sanitizedTable}\` SET ${setClause} WHERE \`${primaryKey}\` = ?`;
                        await pool.query(query, [...values, id]);
                        results.success.push({ id, data: record });
                    }

                } else if (operation === 'delete' && primaryKey) {
                    const id = record[primaryKey] || record.id;
                    const query = `DELETE FROM \`${sanitizedTable}\` WHERE \`${primaryKey}\` = ?`;
                    await pool.query(query, [id]);
                    results.success.push({ id });
                }
            } catch (err) {
                results.failed.push({
                    record,
                    error: err.message
                });
            }
        }

        res.json({
            success: results.failed.length === 0,
            message: `Operación completada: ${results.success.length} exitosos, ${results.failed.length} fallidos`,
            data: results
        });
    } catch (error) {
        console.error('Error in batch operation:', error);
        res.status(500).json({
            success: false,
            message: 'Error en operación batch',
            error: error.message
        });
    }
};

/**
 * Get related data for dropdowns
 */
DatabaseExplorerController.getRelatedData = async (req, res) => {
    try {
        const { tableName } = req.params;
        const { column, search, limit = 50 } = req.query;
        const sanitizedTable = sanitizeTableName(tableName);

        // Find the relationship
        const relationships = await getTableRelationships(sanitizedTable);
        const relationship = relationships.find(r => r.columnName === column);

        if (!relationship) {
            return res.status(400).json({
                success: false,
                message: 'No se encontró relación para esta columna'
            });
        }

        // Build search query
        let query = `SELECT * FROM \`${relationship.referencedTable}\``;
        let values = [];

        if (search) {
            // Get columns of referenced table for search
            const refColumns = await getTableColumns(relationship.referencedTable);
            const textColumns = refColumns.filter(c => 
                c.dataType.toLowerCase().includes('varchar') || 
                c.dataType.toLowerCase().includes('text') ||
                c.dataType.toLowerCase().includes('char')
            );

            if (textColumns.length > 0) {
                const conditions = textColumns.map(c => `\`${c.columnName}\` LIKE ?`).join(' OR ');
                query += ` WHERE ${conditions}`;
                values = textColumns.map(() => `%${search}%`);
            }
        }

        query += ` LIMIT ${parseInt(limit)}`;

        const records = await pool.query(query, values);

        res.json({
            success: true,
            data: {
                table: relationship.referencedTable,
                column: relationship.referencedColumn,
                records
            }
        });
    } catch (error) {
        console.error('Error getting related data:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener datos relacionados',
            error: error.message
        });
    }
};

/**
 * Execute custom SQL (read-only for safety)
 */
DatabaseExplorerController.executeQuery = async (req, res) => {
    try {
        const { query } = req.body;

        // Security: Only allow SELECT statements
        const trimmedQuery = query.trim().toLowerCase();
        if (!trimmedQuery.startsWith('select')) {
            return res.status(403).json({
                success: false,
                message: 'Solo se permiten consultas SELECT por seguridad'
            });
        }

        // Execute the query
        const records = await pool.query(query);

        res.json({
            success: true,
            data: records,
            count: records.length
        });
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({
            success: false,
            message: 'Error al ejecutar consulta',
            error: error.message
        });
    }
};

/**
 * Export database to JSON/SQL format
 */
DatabaseExplorerController.exportDatabase = async (req, res) => {
    try {
        const { format = 'json', tables } = req.body;
        const tablesToExport = tables || (await getAllTables()).map(t => t.tableName);

        const exportData = {};
        const exportDir = path.join(__dirname, '../../../../exports');

        // Create exports directory if it doesn't exist
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const exportPath = path.join(exportDir, `db-export-${timestamp}`);
        fs.mkdirSync(exportPath, { recursive: true });

        // Export each table
        for (const tableName of tablesToExport) {
            try {
                const records = await pool.query(`SELECT * FROM \`${tableName}\``);
                const columns = await getTableColumns(tableName);

                if (format === 'json') {
                    await writeFile(
                        path.join(exportPath, `${tableName}.json`),
                        JSON.stringify({ columns, records }, null, 2)
                    );
                } else if (format === 'csv') {
                    // CSV export
                    const headers = columns.map(c => c.columnName).join(',');
                    const rows = records.map(r => 
                        columns.map(c => {
                            const val = r[c.columnName];
                            if (val === null) return '';
                            if (typeof val === 'string' && val.includes(',')) {
                                return `"${val.replace(/"/g, '""')}"`;
                            }
                            return val;
                        }).join(',')
                    ).join('\n');
                    
                    await writeFile(
                        path.join(exportPath, `${tableName}.csv`),
                        `${headers}\n${rows}`
                    );
                }

                exportData[tableName] = {
                    columns: columns.length,
                    records: records.length
                };
            } catch (err) {
                exportData[tableName] = { error: err.message };
            }
        }

        // Create zip file
        const zipPath = `${exportPath}.zip`;
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        await new Promise((resolve, reject) => {
            output.on('close', resolve);
            archive.on('error', reject);
            archive.pipe(output);
            archive.directory(exportPath, false);
            archive.finalize();
        });

        // Clean up temp directory
        fs.rmSync(exportPath, { recursive: true, force: true });

        // Send file
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename=db-export-${timestamp}.zip`);
        
        const fileStream = fs.createReadStream(zipPath);
        fileStream.pipe(res);

        // Clean up zip after sending
        fileStream.on('close', () => {
            fs.unlinkSync(zipPath);
        });

    } catch (error) {
        console.error('Error exporting database:', error);
        res.status(500).json({
            success: false,
            message: 'Error al exportar base de datos',
            error: error.message
        });
    }
};

/**
 * Get database statistics
 */
DatabaseExplorerController.getDatabaseStats = async (req, res) => {
    try {
        // Total tables
        const tables = await getAllTables();
        
        // Total records across all tables
        let totalRecords = 0;
        const tableStats = [];

        for (const table of tables) {
            try {
                const [result] = await pool.query(
                    `SELECT COUNT(*) as count FROM \`${table.tableName}\``
                );
                const count = result.count;
                totalRecords += count;
                
                // Get table size
                const [sizeResult] = await pool.query(`
                    SELECT 
                        ROUND(((data_length + index_length) / 1024 / 1024), 2) AS sizeMB
                    FROM information_schema.tables
                    WHERE table_schema = DATABASE()
                    AND table_name = ?
                `, [table.tableName]);

                tableStats.push({
                    tableName: table.tableName,
                    recordCount: count,
                    sizeMB: sizeResult?.sizeMB || 0
                });
            } catch (err) {
                tableStats.push({
                    tableName: table.tableName,
                    recordCount: 0,
                    error: true
                });
            }
        }

        // Database size
        const [dbSize] = await pool.query(`
            SELECT 
                ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS totalSizeMB,
                ROUND(SUM(data_length) / 1024 / 1024, 2) AS dataSizeMB,
                ROUND(SUM(index_length) / 1024 / 1024, 2) AS indexSizeMB
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
        `);

        res.json({
            success: true,
            data: {
                totalTables: tables.length,
                totalRecords,
                totalSizeMB: dbSize?.totalSizeMB || 0,
                dataSizeMB: dbSize?.dataSizeMB || 0,
                indexSizeMB: dbSize?.indexSizeMB || 0,
                tableStats: tableStats.sort((a, b) => b.recordCount - a.recordCount)
            }
        });
    } catch (error) {
        console.error('Error getting database stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener estadísticas',
            error: error.message
        });
    }
};

/**
 * Get enum values for a column (if applicable)
 */
DatabaseExplorerController.getEnumValues = async (req, res) => {
    try {
        const { tableName, columnName } = req.params;
        const sanitizedTable = sanitizeTableName(tableName);

        // Get column type
        const [columnInfo] = await pool.query(`
            SELECT column_type
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
            AND table_name = ?
            AND column_name = ?
        `, [sanitizedTable, columnName]);

        if (!columnInfo || !columnInfo.column_type) {
            return res.json({
                success: true,
                data: { type: 'unknown', values: [] }
            });
        }

        const columnType = columnInfo.column_type.toLowerCase();

        // Parse enum values
        if (columnType.startsWith('enum(')) {
            const enumValues = columnType
                .replace('enum(', '')
                .replace(')', '')
                .split(',')
                .map(v => v.trim().replace(/'/g, ''));

            return res.json({
                success: true,
                data: {
                    type: 'enum',
                    values: enumValues
                }
            });
        }

        // Check for boolean (tinyint(1))
        if (columnType.includes('tinyint(1)')) {
            return res.json({
                success: true,
                data: {
                    type: 'boolean',
                    values: [0, 1]
                }
            });
        }

        res.json({
            success: true,
            data: {
                type: columnType,
                values: []
            }
        });
    } catch (error) {
        console.error('Error getting enum values:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener valores',
            error: error.message
        });
    }
};

module.exports = DatabaseExplorerController;
