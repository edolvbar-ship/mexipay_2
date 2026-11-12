'use strict';

require('dotenv').config();

const mysql = require('mysql2');
const { promisify } = require('util');

const PROD = process.env.SSL ? process.env.SSL === 'true' : true;

const database = {
    connectionLimit: 10,
    user: process.env.DB_USER_TDM,
    password: process.env.DB_PASSWORD_TDM,
    host: process.env.DB_HOST_TDM,
    database: process.env.DB_NAME_TDM,
    port: process.env.DB_PORT_TDM,
    timezone: 'local'
};

if (PROD) {
    database.ssl = { rejectUnauthorized: false };
}

const pool = mysql.createPool(database);
pool.query = promisify(pool.query);

async function registerTerminalModel() {
    const modelName = process.argv[2] || 'NEW9800';

    console.log('=== Register Terminal Model ===\n');
    console.log(`Model to register: ${modelName}`);
    console.log(`TDM Database: ${process.env.DB_NAME_TDM}@${process.env.DB_HOST_TDM}:${process.env.DB_PORT_TDM}\n`);

    try {
        const existing = await pool.query('SELECT * FROM model WHERE model = ?', [modelName]);

        if (existing.length > 0) {
            console.log(`✅ Model "${modelName}" already exists (idmodel: ${existing[0].idmodel})`);
            console.log('Full record:', existing[0]);
            return;
        }

        console.log(`Model "${modelName}" not found. Inserting...`);

        const result = await pool.query(
            'INSERT INTO model (model) VALUES (?)',
            [modelName]
        );

        console.log(`✅ Successfully inserted model "${modelName}" with idmodel: ${result.insertId}`);

        const verify = await pool.query('SELECT * FROM model WHERE idmodel = ?', [result.insertId]);
        console.log('Verified record:', verify[0]);

        console.log('\nAll models in database:');
        const allModels = await pool.query('SELECT * FROM model ORDER BY idmodel');
        allModels.forEach(row => {
            console.log(`  idmodel: ${row.idmodel} | model: ${row.model}`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        process.exit(0);
    }
}

registerTerminalModel();
