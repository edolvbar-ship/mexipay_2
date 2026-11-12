// seeders/XXXXXX-selia-error-codes-seeder.js
'use strict';

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

function validateRecord(record) {
    const errors = [];
    
    if (!record.descripcion) {
        errors.push('descripcion is required');
    }
    if (isNaN(record.campo_origen)) {
        errors.push('campo_origen must be a number');
    }
    if (isNaN(record.codigo)) {
        errors.push('codigo must be a number');
    }
    if (record.descripcion && record.descripcion.length > 255) {
        errors.push('descripcion exceeds 255 characters');
    }
    if (record.mensaje_terminal && record.mensaje_terminal.length > 500) {
        errors.push('mensaje_terminal exceeds 500 characters');
    }
    if (record.type && record.type.length > 50) {
        errors.push('type exceeds 50 characters');
    }
    
    return errors;
}

async function identifyProblematicRecord(queryInterface, records) {
    console.log('Testing records individually to find the problematic one...');
    
    for (let i = 0; i < records.length; i++) {
        try {
            console.log(`Testing record ${i + 1}:`, records[i]);
            await queryInterface.bulkInsert('selia_error_codes', [records[i]]);
            console.log(`✓ Record ${i + 1} inserted successfully`);
        } catch (error) {
            console.error(`✗ Record ${i + 1} failed:`, error.message);
            console.error('Problematic record:', records[i]);
            break;
        }
    }
}

async function checkDatabaseState(queryInterface) {
    try {
        const tableExists = await queryInterface.showAllTables();
        console.log('Table exists:', tableExists.includes('selia_error_codes'));
        
        const existingRecords = await queryInterface.sequelize.query(
            'SELECT codigo FROM selia_error_codes LIMIT 5',
            { type: queryInterface.sequelize.QueryTypes.SELECT }
        );
        console.log('Existing codigo values:', existingRecords);
    } catch (error) {
        console.log('Table check result:', error.message);
    }
}

async function testWithSampleData(queryInterface) {
    const sampleData = [
        {
            campo_origen: 1,
            codigo: 1001,
            descripcion: 'Test description 1',
            mensaje_terminal: 'Test terminal message 1',
            type: 'TEST',
            created_at: new Date(),
            updated_at: new Date()
        },
        {
            campo_origen: 2,
            codigo: 1002,
            descripcion: 'Test description 2',
            mensaje_terminal: 'Test terminal message 2',
            type: 'TEST',
            created_at: new Date(),
            updated_at: new Date()
        }
    ];
    
    try {
        console.log('Testing with sample data...');
        await queryInterface.bulkInsert('selia_error_codes', sampleData);
        console.log('Sample data inserted successfully');
        return true;
    } catch (error) {
        console.error('Sample data test failed:', error);
        return false;
    }
}

module.exports = {
    async up(queryInterface, type) {
        const csvData = [];

        return new Promise((resolve, reject) => {
            const csvPath = path.join(__dirname, '../../../../../MENSAJES_ERROR_13_1.csv');
            console.log('CSV file path:', csvPath);
            
            if (!fs.existsSync(csvPath)) {
                return reject(new Error(`CSV file not found at: ${csvPath}`));
            }

            // First check database state
            checkDatabaseState(queryInterface);

            let rowCount = 0;
            fs.createReadStream(csvPath)
                .pipe(csv())
                .on('data', (row) => {
                    rowCount++;
                    
                    try {
                        const parsedRow = {
                            campo_origen: parseInt(row['CAMPO13/Origen']) || 0,
                            codigo: parseInt(row['CODIGO/CAMPO14']) || 0,
                            descripcion: row['DESCRIPCION'] ? row['DESCRIPCION'].trim() : '',
                            mensaje_terminal: (row['Mensaje Terminal'] || '').trim(),
                            type: (row['Type'] || '').trim(),
                            created_at: new Date(),
                            updated_at: new Date()
                        };
                        
                        const validationErrors = validateRecord(parsedRow);
                        if (validationErrors.length > 0) {
                            console.warn(`Validation errors in row ${rowCount}:`, validationErrors);
                            console.warn('Problematic row data:', row);
                            return;
                        }
                        
                        csvData.push(parsedRow);
                        
                    } catch (parseError) {
                        console.error(`Error parsing row ${rowCount}:`, row, parseError);
                    }
                })
                .on('end', async () => {
                    console.log(`Finished reading CSV. Total rows: ${rowCount}`);
                    console.log(`Prepared ${csvData.length} records for insertion`);
                    
                    if (csvData.length === 0) {
                        return reject(new Error('No valid data found in CSV file'));
                    }

                    try {
                        // Test with sample data first
                        const sampleTestPassed = await testWithSampleData(queryInterface);
                        if (!sampleTestPassed) {
                            return reject(new Error('Sample data test failed - database issues'));
                        }

                        console.log('Attempting bulk insert...');
                        
                        // Check for duplicate codigo values in our data
                        const codigoMap = new Map();
                        const duplicates = [];
                        csvData.forEach((record, index) => {
                            if (codigoMap.has(record.codigo)) {
                                duplicates.push({ index, codigo: record.codigo });
                            } else {
                                codigoMap.set(record.codigo, index);
                            }
                        });
                        
                        if (duplicates.length > 0) {
                            console.error('Duplicate codigo values found:', duplicates);
                            return reject(new Error(`Duplicate codigo values: ${duplicates.map(d => d.codigo).join(', ')}`));
                        }

                        const result = await queryInterface.bulkInsert('selia_error_codes', csvData);
                        console.log('Bulk insert successful. Result:', result);
                        resolve();
                    } catch (error) {
                        console.error('Bulk insert error:', error);
                        console.error('Error details:', {
                            name: error.name,
                            message: error.message,
                            parent: error.parent,
                            original: error.original,
                            sql: error.sql
                        });
                        
                        await identifyProblematicRecord(queryInterface, csvData);
                        reject(error);
                    }
                })
                .on('error', (error) => {
                    console.error('CSV read error:', error);
                    reject(error);
                });
        });
    },

    async down(queryInterface, type) {
        await queryInterface.bulkDelete('selia_error_codes', null, {});
    }
};