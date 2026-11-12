const express = require('express');
const router = express.Router();
const pool = require('../database');
const helpers = require('../lib/helpers');
const { verifyToken } = require('../lib/helpers');
const fs = require('fs');
const peticiones = require('./peticiones');
const db = require('../../../socketServer/lib/sequelize/init');
const { v4: uuidv4 } = require('uuid');

router.post("/register", verifyToken, async (req, res) => {
    let id_log;
    console.log()
    console.log("ENTERING /register  ");
    console.log("ENTERING /register  ");
    console.log("ENTERING /register  ");
    try {
        const { uuid, model, serial, firmware, afiliation_number, name_merchant } = req.body;
        const active = 1;

        const sessionUUID = req.user?.session?.uuid || req.user?.uuid;
        if (!sessionUUID) {
            console.error('No session UUID found in req.user:', Object.keys(req.user || {}));
            return res.status(401).json({ code: "M22", mensaje: "Invalid session data - no UUID found" });
        }

        id_log = await helpers.insertApilog(sessionUUID, req.method, req.originalUrl, req.body);

        let smart_device_idsmtdevice;
        let merchant;
        let model_idmodel;
        let terminal_device_idterm_device;

        const rowsSmart = await pool.query('SELECT * FROM smart_device WHERE uuid = ?', [uuid]);
        if (rowsSmart.length === 0) {
            await helpers.updateApilog(id_log, JSON.stringify({ code: "M05", mensaje: "Smart device not found" }));
            return res.status(404).json({ code: "M05", mensaje: "Smart device not found" });
        }
        smart_device_idsmtdevice = rowsSmart[0].idsmtdevice;

        const rows = await pool.query('SELECT * FROM merchant WHERE afiliation_number = ? AND name_merchant = ?', [afiliation_number, name_merchant]);
        if (rows.length === 0) {
            await helpers.updateApilog(id_log, JSON.stringify({ code: "M05", mensaje: "Merchant not found" }));
            return res.json({ code: "M05", mensaje: "Merchant not found" });
        }
        merchant = rows[0];
        console.log(merchant)
        console.log("----")
        console.log(afiliation_number)
        console.log("----")
        console.log(name_merchant)
        console.log("----")

        const rowsModel = await pool.query('SELECT * FROM model WHERE model = ?', [model]);
        if (rowsModel.length === 0) {
            await helpers.updateApilog(id_log, JSON.stringify({ code: "M05", mensaje: "Model not found" }));
            return res.status(404).json({ code: "M05", mensaje: "Model not found" });
        }
        model_idmodel = rowsModel[0].idmodel;

        if (merchant.use_moreterminals === 0) {
            const rowsSmartTerm = await pool.query(
                'SELECT * FROM smart_device_has_terminal_device ' +
                'INNER JOIN smart_device ON smart_device_idsmtdevice=idsmtdevice ' +
                'INNER JOIN terminal_device ON terminal_device_idterm_device=idterm_device ' +
                'WHERE uuid = ? AND serial = ?',
                [uuid, serial]
            );
            if (rowsSmartTerm.length > 0) {
                await helpers.updateApilog(id_log, JSON.stringify({ code: "M05", mensaje: "Terminal Already Exists!" }));
                return res.json({ code: "M05", mensaje: "Terminal Already Exists!" });
            }

            const rowsTerm = await pool.query('SELECT * FROM terminal_device WHERE serial = ?', [serial]);
            if (rowsTerm.length === 0) {
                const result = await pool.query(
                    'INSERT INTO terminal_device (model_idmodel, serial, firmware, active) VALUES (?, ?, ?, ?)',
                    [model_idmodel, serial, firmware, active]
                );
                terminal_device_idterm_device = result.insertId;
            } else {
                terminal_device_idterm_device = rowsTerm[0].idterm_device;
            }

            await pool.query(
                'INSERT INTO smart_device_has_terminal_device (smart_device_idsmtdevice, terminal_device_idterm_device, id_merchant) VALUES (?, ?, ?)',
                [smart_device_idsmtdevice, terminal_device_idterm_device, merchant.id_merchant]
            );

            await helpers.updateApilog(id_log, JSON.stringify({ code: "M00", mensaje: "Successful Registration!" }));
            return res.json({ code: "M00", mensaje: "Successful Registration!" });
        } else {
            const rowsTerm = await pool.query('SELECT * FROM terminal_device WHERE serial = ?', [serial]);
            if (rowsTerm.length === 0) {
                const result = await pool.query(
                    'INSERT INTO terminal_device (model_idmodel, serial, firmware, active) VALUES (?, ?, ?, ?)',
                    [model_idmodel, serial, firmware, active]
                );
                terminal_device_idterm_device = result.insertId;
            } else {
                terminal_device_idterm_device = rowsTerm[0].idterm_device;
            }

            const rowsSmart_Term = await pool.query(
                'SELECT * FROM smart_device_has_terminal_device ' +
                'WHERE smart_device_idsmtdevice = ? AND terminal_device_idterm_device = ?',
                [smart_device_idsmtdevice, terminal_device_idterm_device]
            );
            if (rowsSmart_Term.length > 0) {
                await helpers.updateApilog(id_log, JSON.stringify({ code: "M00", mensaje: "Successful Registration!" }));
                return res.json({ code: "M00", mensaje: "Successful Registration!" });
            }

            await pool.query(
                'INSERT INTO smart_device_has_terminal_device (smart_device_idsmtdevice, terminal_device_idterm_device, id_merchant) VALUES (?, ?, ?)',
                [smart_device_idsmtdevice, terminal_device_idterm_device, merchant.id_merchant]
            );

            await helpers.updateApilog(id_log, JSON.stringify({ code: "M00", mensaje: "Successful Registration!" }));
            return res.json({ code: "M00", mensaje: "Successful Registration!" });
        }
    } catch (error) {
        console.error('Error in /register:', error);
        const errorResp = { code: "M18", mensaje: `Internal server error: ${error.message}` };
        if (id_log) await helpers.updateApilog(id_log, JSON.stringify(errorResp));
        return res.status(500).json(errorResp);
    }
});

router.post("/dissociate", verifyToken, async (req, res) => {
    let id_log;
    try {
        const { afiliation_number, uuid } = req.body;
        if (!uuid) {
            return res.status(400).json({ code: "M14", mensaje: "Missing uuid" });
        }

        id_log = await helpers.insertApilog(uuid, req.method, req.originalUrl, req.body);

        const rows = await pool.query('SELECT * FROM merchant WHERE afiliation_number = ?', [afiliation_number]);
        if (rows.length === 0) {
            await helpers.updateApilog(id_log, JSON.stringify({ code: "M05", mensaje: "Merchant not found" }));
            return res.json({ code: "M05", mensaje: "Merchant not found" });
        }
        const merchant = rows[0];

        if (merchant.active !== 1) {
            const rowsMerchSmart = await pool.query(
                'SELECT * FROM merchant_has_smart_device ' +
                'INNER JOIN smart_device ON smart_device_idsmtdevice=idsmtdevice ' +
                'INNER JOIN merchant ON merchant_idmerchant=idmerchant ' +
                'WHERE uuid = ? AND afiliation_number = ?',
                [uuid, afiliation_number]
            );
            if (rowsMerchSmart.length === 0) {
                await helpers.updateApilog(id_log, JSON.stringify({ code: "M05", mensaje: "Failed Update - No association found" }));
                return res.json({ code: "M05", mensaje: "Failed Update - No association found" });
            }

            const smart_device_idsmtdevice = rowsMerchSmart[0].idsmtdevice;
            const rowsSmart = await pool.query('SELECT * FROM smart_device_has_terminal_device WHERE smart_device_idsmtdevice = ?', [smart_device_idsmtdevice]);
            if (rowsSmart.length === 0) {
                await helpers.updateApilog(id_log, JSON.stringify({ code: "M05", mensaje: "Failed Update - No terminal association" }));
                return res.json({ code: "M05", mensaje: "Failed Update - No terminal association" });
            }

            const { smart_device_idsmtdevice: sdid, terminal_device_idterm_device: tdid } = rowsSmart[0];
            await pool.query(
                'DELETE FROM smart_device_has_terminal_device WHERE smart_device_idsmtdevice = ? AND terminal_device_idterm_device = ?',
                [sdid, tdid]
            );

            await helpers.updateApilog(id_log, JSON.stringify({ code: "M00", mensaje: "Successful Update!" }));
            return res.json({ code: "M00", mensaje: "Successful Update!" });
        } else {
            await helpers.updateApilog(id_log, JSON.stringify({ code: "M05", mensaje: "Failed Update - Merchant inactive" }));
            return res.json({ code: "M05", mensaje: "Failed Update - Merchant inactive" });
        }
    } catch (error) {
        console.error('Error in /dissociate:', error);
        const errorResp = { code: "M18", mensaje: `Internal server error: ${error.message}` };
        if (id_log) await helpers.updateApilog(id_log, JSON.stringify(errorResp));
        return res.status(500).json(errorResp);
    }
});
router.post('/get_operations', verifyToken, async (req, res) => {
    let id_log;
    try {
        console.log('Started /get_operations');
        const sessionUUID = req.user?.session?.uuid || req.user?.uuid;
        if (!sessionUUID) {
            console.error('No session UUID found in req.user:', Object.keys(req.user || {}));
            return res.status(401).json({ code: "M22", mensaje: "Invalid session data - no UUID found" });
        }

        id_log = await helpers.insertApilog(sessionUUID, req.method, req.originalUrl, req.body);
        console.log(`Inserted log with id_log: ${id_log}`);

        const { id_merchant } = req.body;
        console.log(`Received body: ${JSON.stringify(req.body)}`);
        if (!id_merchant || isNaN(id_merchant)) {
            const errorResp = { code: "M14", mensaje: "Invalid or missing id_merchant" };
            await helpers.updateApilog(id_log, JSON.stringify(errorResp));
            console.log(`Updated log with error response: ${JSON.stringify(errorResp)}`);
            return res.status(400).json(errorResp);
        }

        const rows = await pool.query(
            'SELECT merchant_type, operation, url FROM merchant_has_operations ' +
            'INNER JOIN operations ON idoperations = operations_idoperations ' +
            'WHERE merchant_idmerchant = ?',
            [id_merchant]
        );
        console.log(`Fetched rows: ${JSON.stringify(rows)}`);

        if (rows.length > 0) {
            const perfil_trans = await peticiones.consultaPerfilTrans(id_merchant);
            console.log(`Fetched Perfil_trans: ${JSON.stringify(perfil_trans)}`);
            if (!perfil_trans || !perfil_trans.hex_value) {
                const errorResp = { code: "M15", mensaje: "Failed to fetch transaction profile" };
                await helpers.updateApilog(id_log, JSON.stringify(errorResp));
                console.log(`Updated log with error response: ${JSON.stringify(errorResp)}`);
                return res.status(500).json(errorResp);
            }

            const indicadores = await helpers.getIndicadores(perfil_trans.hex_value);
            console.log(`Fetched indicadores: ${JSON.stringify(indicadores)}`);
            if (!indicadores) {
                const errorResp = { code: "M16", mensaje: "Failed to fetch indicadores" };
                await helpers.updateApilog(id_log, JSON.stringify(errorResp));
                console.log(`Updated log with error response: ${JSON.stringify(errorResp)}`);
                return res.status(500).json(errorResp);
            }

            const rowsWithIndicadores = rows.map(row => ({ ...row, indicadores }));
            console.log(`Fetched rows with indicadores: ${JSON.stringify(rowsWithIndicadores)}`);


            const merchant = await db.merchant.findOne({
                where: { id_merchant: id_merchant },
                include: [{ model: db.isoProcessor, as: 'procesador' }]
            });
            console.log(`Fetched merchant: ${JSON.stringify(merchant)}`);
            if (!merchant) {
                const errorResp = { code: "M17", mensaje: "Merchant not found" };
                await helpers.updateApilog(id_log, JSON.stringify(errorResp));
                console.log(`Updated log with error response: ${JSON.stringify(errorResp)}`);
                return res.status(404).json(errorResp);
            }

            const response = {
                code: "M00",
                mensaje: "Success",
                rows: rowsWithIndicadores,
                procesador: merchant.procesador
            };
            console.log(`Prepared response: ${JSON.stringify(response)}`);
            await helpers.updateApilog(id_log, JSON.stringify(response));
            console.log(`Updated log with response: ${JSON.stringify(response)}`);
            return res.json(response);
        } else {
            const errorResp = { code: "M13", mensaje: "No operations exist" };
            await helpers.updateApilog(id_log, JSON.stringify(errorResp));
            console.log(`Updated log with error response: ${JSON.stringify(errorResp)}`);
            return res.status(404).json(errorResp);
        }
    } catch (error) {
        console.error(`Error in /get_operations: ${error.message}`);
        const errorResp = { code: "M18", mensaje: `Internal server error: ${error.message}` };
        if (id_log) await helpers.updateApilog(id_log, JSON.stringify(errorResp));
        console.log(`Updated log with error response: ${JSON.stringify(errorResp)}`);
        return res.status(500).json(errorResp);
    }
});

module.exports = router;