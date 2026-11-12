const express = require('express');
const router = express.Router();
const pool = require('../database');
const helpers = require('../lib/helpers');
const peticiones = require('./peticiones');
const { verifyToken } = require('../lib/helpers');
const tka = require('../lib/tka');
const dbTDM = require('../sequelize/init');

router.post("/register", verifyToken, async (req, res) => {
    const id_log = await helpers.insertApilog(req.uuid, req.method, req.originalUrl, req.body);
    const { iduser, app_version, type_os, os_version, uuid, afiliation_number, tkr } = req.body;
    const active = 1;

    console.log('=== STARTING SMART REGISTER ===');
    console.log('Request body:', { iduser, afiliation_number, uuid });

    const user = await dbTDM.user.findOne({ where: { iduser: iduser } })

    // Validate user exists
    if (!user) {
        console.log('❌ User not found:', iduser);
        return sendResponse(res, "M01", "User or password incorrect", {
            error_type: "authentication_error",
            device_status: "failed"
        });
    }
    console.log('✅ User found:', user.iduser);

    let merchantId, merchantName, msi, direccion, acquirerBank;

    // Try gateway API first
    const timeStamp = Date.now().toString();
    const tkaG = await tka.generateTKA(tkr, timeStamp, afiliation_number);
    const headers = {
        "content-type": "application/json",
        "X-Auth": tkaG,
        "X-Time": timeStamp,
        "commerce-id": afiliation_number,
        "X-Act": tkr
    }

    const url = "/gateway/merchant/" + afiliation_number;
    console.log('🔍 Calling gateway API:', url);
    const mensaje = await peticiones.consultMerchant(url, headers);

    if (mensaje === "No existe el comercio") {
        console.log('❌ Gateway: Merchant does not exist');
        return sendResponse(res, "M50", "No existe el comercio", {
            error_type: "merchant_not_found",
            device_status: "failed",
            gateway_response: mensaje
        });
    } else if (mensaje === "error") {
        console.log('❌ Gateway API failed (403 Forbidden), trying direct database query...');

        // Fallback: Direct database query
        console.log('🔍 Querying database for merchant:', afiliation_number);
        const directMerchant = await dbTDM.merchant.findOne({
            where: { afiliation_number: afiliation_number, active: 1 }
        });

        if (!directMerchant) {
            console.log('❌ Database: Merchant not found');
            return sendResponse(res, "M50", "No existe el comercio", {
                error_type: "merchant_not_found",
                device_status: "failed",
                data_source: "database",
                afiliation_number: afiliation_number
            });
        }

        console.log('=== DATABASE MERCHANT DEBUG ===');
        console.log('Merchant object:', directMerchant);
        console.log('Merchant dataValues:', directMerchant.dataValues);
        console.log('All merchant fields:', Object.keys(directMerchant.dataValues));

        // Try ALL possible ID field names
        merchantId = directMerchant.id_merchant ||
            directMerchant.idmerchant ||
            directMerchant.merchantId ||
            directMerchant.id ||
            directMerchant.ID;

        merchantName = directMerchant.name_merchant ||
            directMerchant.merchantName ||
            directMerchant.name ||
            'Unknown Merchant';

        msi = JSON.parse(directMerchant.MSI || directMerchant.msi || '[]');
        acquirerBank = "Unknown Bank";
        direccion = {};

        console.log('=== MERCHANT ID RESOLUTION ===');
        console.log('id_merchant:', directMerchant.id_merchant);
        console.log('idmerchant:', directMerchant.idmerchant);
        console.log('merchantId:', directMerchant.merchantId);
        console.log('id:', directMerchant.id);
        console.log('ID:', directMerchant.ID);
        console.log('Selected merchantId:', merchantId);
        console.log('Selected merchantName:', merchantName);

        console.log("✅ Used direct database fallback");
    } else {
        // Use gateway API result
        console.log('=== GATEWAY RESPONSE DEBUG ===');
        console.log('Gateway message:', mensaje);
        console.log('Gateway message type:', typeof mensaje);
        console.log('Gateway message keys:', Object.keys(mensaje));

        merchantId = mensaje.id_result ||
            mensaje.id_merchant ||
            mensaje.merchantId;

        merchantName = mensaje.name_merchant ||
            mensaje.merchantName ||
            'Unknown Merchant';

        msi = JSON.parse(mensaje.msi || '[]');
        direccion = mensaje.address || {};
        acquirerBank = mensaje.acquirer_bank || "Unknown Bank";

        console.log('Selected merchantId from gateway:', merchantId);
        console.log('Selected merchantName from gateway:', merchantName);
        console.log("✅ Used gateway API result");
    }

    console.log('=== FINAL MERCHANT VALUES ===');
    console.log('merchantId:', merchantId, 'type:', typeof merchantId);
    console.log('merchantName:', merchantName);
    console.log('msi:', msi);
    console.log('acquirerBank:', acquirerBank);
    console.log('direccion:', direccion);

    // Find or create merchant-user association
    console.log('🔍 Checking merchant-user association...');
    let merchants = await dbTDM.merchantHasUser.findOne({
        where: { user_iduser: iduser },
        include: {
            required: true,
            model: dbTDM.merchant,
            as: 'merchant',
            where: {
                afiliation_number: afiliation_number,
                name_merchant: merchantName
            }
        }
    });

    // If user doesn't have merchant associated
    if (!merchants) {
        console.log('➕ Creating new merchant-user association...');
        merchants = await dbTDM.merchantHasUser.create({
            merchant_idmerchant: merchantId,
            user_iduser: iduser
        });
        console.log('✅ Created merchant-user association');
    } else {
        console.log('✅ Existing merchant-user association found');
    }

    // Check if user has mobile device associated
    console.log('🔍 Checking user-smart device association...');
    const userhassmartDevice = await dbTDM.userHasSmartDevice.findOne({
        where: { user_iduser: iduser },
        include: {
            required: true,
            model: dbTDM.smartDevice,
            as: 'smart_device',
            where: { uuid: uuid }
        }
    });

    if (!userhassmartDevice) {
        console.log('➕ Creating new user-smart device association...');
        const transaction = await dbTDM.seq.transaction();
        try {
            var device = await dbTDM.smartDevice.findOne({ where: { uuid: uuid } });
            if (!device) {
                console.log('➕ Creating new smart device...');
                device = await dbTDM.smartDevice.create({
                    uuid: uuid,
                    app_version: app_version,
                    type_os: type_os,
                    os_version: os_version,
                    active: active
                }, { transaction });
                console.log('✅ Created smart device:', device.idsmtdevice);
            } else {
                console.log('✅ Existing smart device found:', device.idsmtdevice);
            }

            await dbTDM.userHasSmartDevice.create({
                user_iduser: iduser,
                smart_device_idsmtdevice: device.idsmtdevice
            }, { transaction: transaction });
            await transaction.commit();
            console.log('✅ Created user-smart device association');
        } catch (error) {
            await transaction.rollback();
            console.log('❌ Error creating device association:', error.message);
            return sendResponse(res, "M60", error.message, {
                error_type: "device_association_error",
                device_status: "failed",
                error_details: error.message,
                uuid: uuid
            });
        }
    } else {
        console.log('✅ Existing user-smart device association found');
    }

    // Final debug before response
    console.log('=== FINAL RESPONSE DEBUG ===');
    console.log('Sending response with merchantId:', merchantId);

    // Return success response
    return sendSuccessResponse(res, id_log, merchantId, merchantName, msi, direccion, acquirerBank);
});

async function sendResponse(res, code, mensaje, additionalData = {}) {
    console.log('📤 Sending error response:', { code, mensaje, ...additionalData });
    const resp = {
        code: code,
        mensaje: mensaje,
        timestamp: new Date().toISOString(),
        ...additionalData
    }
    res.json(resp);
}

async function sendSuccessResponse(res, id_log, idmerchant, nameMerchant, MSI, address, acquirerBank) {
    console.log('📤 Sending success response:', {
        idmerchant,
        nameMerchant,
        MSI_length: MSI.length,
        address_keys: Object.keys(address),
        acquirerBank
    });

    const resp = {
        code: "M00",
        mensaje: "Successful Registration!",
        id_merchant: idmerchant,
        name_merchant: nameMerchant,
        acquirer_bank: acquirerBank,
        MSI,
        address,
        timestamp: new Date().toISOString(),
        device_status: "registered",
        registration_type: "smart_device"
    }

    console.log('📤 Final response object:', JSON.stringify(resp, null, 2));
    res.json(resp);
}

module.exports = router;