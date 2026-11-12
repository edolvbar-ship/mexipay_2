'use strict';

require('dotenv').config();

const { Sequelize } = require('sequelize');

const PROD = process.env.SSL !== 'false';

const op = {
    host: process.env.DB_HOST_TDM,
    port: process.env.DB_PORT_TDM,
    dialect: 'mysql',
    logging: false,
    dialectOptions: {}
};

if (PROD) {
    op.dialectOptions.ssl = { rejectUnauthorized: false };
}

const sequelize = new Sequelize(
    process.env.DB_NAME_TDM,
    process.env.DB_USER_TDM,
    process.env.DB_PASSWORD_TDM,
    op
);

async function fixTerminalModels() {
    console.log('=== Fix Terminal Models ===\n');

    try {
        // 1. Delete duplicate NEW9800 (idmodel 6)
        console.log('Deleting duplicate NEW9800 (idmodel 6)...');
        const deleted = await sequelize.query(
            'DELETE FROM model WHERE idmodel = ?',
            { replacements: [6] }
        );
        console.log(`Deleted ${deleted[0].affectedRows} row(s)\n`);

        // 2. Populate idmodel 7 (NEW9800) with NEWPOS info
        console.log('Populating idmodel 7 (NEW9800) with NEWPOS manufacturer info...');
        await sequelize.query(
            `UPDATE model
             SET manufacter = ?, manufacter_short = ?, type = ?, active = ?
             WHERE idmodel = ?`,
            { replacements: ['NEWPOS', 'NEWPOS', 'mPOS', 1, 7] }
        );
        console.log('Done\n');

        // 3. Populate idmodel 8 (NEW9830) with NEWPOS info
        console.log('Populating idmodel 8 (NEW9830) with NEWPOS manufacturer info...');
        await sequelize.query(
            `UPDATE model
             SET manufacter = ?, manufacter_short = ?, type = ?, active = ?
             WHERE idmodel = ?`,
            { replacements: ['NEWPOS', 'NEWPOS', 'mPOS', 1, 8] }
        );
        console.log('Done\n');

        // 4. Deactivate Telpo (idmodel 1) and DSPread (idmodel 2, 3)
        console.log('Deactivating Telpo (idmodel 1) and DSPread (idmodel 2, 3)...');
        await sequelize.query(
            'UPDATE model SET active = 0 WHERE idmodel IN (1, 2, 3)'
        );
        console.log('Done\n');

        // 5. Activate Nexgo N3 (idmodel 4)
        console.log('Activating Nexgo N3 (idmodel 4)...');
        await sequelize.query(
            'UPDATE model SET active = 1 WHERE idmodel = 4'
        );
        console.log('Done\n');

        // 6. Insert missing Nexgo model variations (N86, N9)
        const nexgoModels = [
            { model: 'N86', manufacter: 'Nexgo', manufacter_short: 'Nexgo', type: 'mPOS' },
            { model: 'N9',  manufacter: 'Nexgo', manufacter_short: 'Nexgo', type: 'mPOS' }
        ];

        for (const m of nexgoModels) {
            const existing = await sequelize.query(
                'SELECT idmodel FROM model WHERE model = ?',
                { replacements: [m.model], type: Sequelize.QueryTypes.SELECT }
            );
            if (existing && existing.length > 0) {
                console.log(`Model "${m.model}" already exists (idmodel: ${existing[0].idmodel}), skipping insert`);
                continue;
            }
            console.log(`Inserting model "${m.model}" (Nexgo)...`);
            const result = await sequelize.query(
                `INSERT INTO model (manufacter, manufacter_short, model, type, active)
                 VALUES (?, ?, ?, ?, 1)`,
                { replacements: [m.manufacter, m.manufacter_short, m.model, m.type] }
            );
            console.log(`Inserted "${m.model}" with idmodel: ${result[0].insertId}`);
        }
        console.log('');

        // 7. Show final state
        console.log('Final state of model table:');
        const rows = await sequelize.query(
            'SELECT * FROM model ORDER BY idmodel',
            { type: Sequelize.QueryTypes.SELECT }
        );
        console.table(rows);

    } catch (error) {
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        process.exit(0);
    }
}

fixTerminalModels();
