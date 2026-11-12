#!/usr/bin/env node

/**
 * commands/test-initKeys.js
 *
 * Standalone end-to-end key initialization test script.
 *
 * Usage:
 *   node commands/test-initKeys.js
 *   node commands/test-initKeys.js --send
 *   node commands/test-initKeys.js --device VF9... --rsa <512-hex> --check 123456 --merchant 123 --send
 *
 * By default the script only builds and prints the Selia tx 506 key-init message.
 * Pass --send to actually send it through the configured Selia gateway.
 */

require('dotenv').config();

const IsoSeliaService = require('../lib/socketServer/lib/services/isoSeliaService');
const helpers = require('../lib/helpers/lib/helpers');
const { seq: sequelize, ...db } = require('../lib/socketServer/lib/sequelize/init');

function showUsage() {
    console.log(`
Usage: node commands/test-initKeys.js [options]

Options:
  --send                         Actually send the key-init message to Selia
  --device <serial>              Terminal device serial (default: TEST000000000001)
  --rsa <512-hex-chars>          RSA-encrypted transport key (default: 512 '0' chars)
  --check <6-char-kcv>           Transport key KCV (default: 000000)
  --version <10-char-name>       RSA public key version (default: public_prod)
  --padding <01|02>              Padding: 01=PKCS1.5, 02=OAEP (default: 02)
  --pos-version <string>         POS software version for Token ES (default: SEV820v02_25)
  --merchant <id>                Internal merchant ID (default: env TEST_KEY_INIT_MERCHANT_ID or 1)
  --afiliation <number>          PROSA affiliation number (default: env TEST_KEY_INIT_AFFILIATION or 0000000000)
  --selia-id <id>                Selia company ID (default: env SELIA_COMPANY_TPV_ID or 1)
  --help                         Show this help
`);
}

function parseArgs(argv) {
    const out = {
        send: false,
        device: process.env.TEST_KEY_INIT_DEVICE || 'TEST0000000000000000000000000001',
        rsa: process.env.TEST_KEY_INIT_RSA || '0'.repeat(512),
        check: process.env.TEST_KEY_INIT_CHECK || '000000',
        version: process.env.TEST_KEY_INIT_RSA_VERSION || 'public_prod',
        padding: process.env.TEST_KEY_INIT_PADDING || '02',
        posVersion: process.env.TEST_KEY_INIT_POS_VERSION || 'SEV820v02_25',
        merchant: process.env.TEST_KEY_INIT_MERCHANT_ID || '1',
        afiliation: process.env.TEST_KEY_INIT_AFFILIATION || '0000000000',
        seliaId: process.env.SELIA_COMPANY_TPV_ID || '1'
    };

    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--send') out.send = true;
        else if (a === '--help') { showUsage(); process.exit(0); }
        else if (a === '--device') out.device = argv[++i] || out.device;
        else if (a === '--rsa') out.rsa = argv[++i] || out.rsa;
        else if (a === '--check') out.check = argv[++i] || out.check;
        else if (a === '--version') out.version = argv[++i] || out.version;
        else if (a === '--padding') out.padding = argv[++i] || out.padding;
        else if (a === '--pos-version') out.posVersion = argv[++i] || out.posVersion;
        else if (a === '--merchant') out.merchant = argv[++i] || out.merchant;
        else if (a === '--afiliation') out.afiliation = argv[++i] || out.afiliation;
        else if (a === '--selia-id') out.seliaId = argv[++i] || out.seliaId;
    }

    return out;
}

(async () => {
    const args = parseArgs(process.argv.slice(2));

    if (args.rsa.length !== 512) {
        console.error(`[test-initKeys] RSA key must be exactly 512 hex chars, got ${args.rsa.length}`);
        process.exit(1);
    }

    const seliaService = new IsoSeliaService({
        db: { ...db, sequelize },
        helpers,
        debug: true
    });

    const keyInitData = {
        deviceSerial: args.device,
        rsaEncryptedKey: args.rsa,
        checkValue: args.check,
        rsaKeyVersion: args.version,
        paddingAlgorithm: args.padding,
        posSoftwareVersion: args.posVersion,
        merchantId: parseInt(args.merchant, 10),
        afiliationNumber: args.afiliation,
        originador: 'MEXIPAY01'
    };

    console.log('\n=== test-initKeys ===');
    console.log('Mode:', args.send ? 'SEND' : 'BUILD-ONLY');
    console.log('SELIA_ISO_MODE:', process.env.SELIA_ISO_MODE || 'not set');
    console.log('Device:', keyInitData.deviceSerial);
    console.log('Merchant:', keyInitData.merchantId);
    console.log('RSA key length:', keyInitData.rsaEncryptedKey.length);

    // Build the new tx 506 Selia message for verification
    try {
        const message = await seliaService.buildKeyInitMessage({
            deviceSerial: keyInitData.deviceSerial,
            rsaEncryptedKey: keyInitData.rsaEncryptedKey,
            checkValue: keyInitData.checkValue,
            rsaKeyVersion: keyInitData.rsaKeyVersion,
            paddingAlgorithm: keyInitData.paddingAlgorithm,
            posSoftwareVersion: keyInitData.posSoftwareVersion,
            seliaId: args.seliaId,
            afiliationNumber: keyInitData.afiliationNumber,
            originador: keyInitData.originador
        });

        console.log('\n=== Built Selia tx 506 Key-Init Message ===');
        console.log(message);
        console.log(`=== Message length: ${message.length} chars ===\n`);
    } catch (err) {
        console.error('[test-initKeys] buildKeyInitMessage failed:', err.message);
        console.error(err.stack);
    }

    if (args.send) {
        console.log('\n=== Sending key-init to Selia ===');
        try {
            const result = await seliaService.sendKeyInitialization(keyInitData);

            console.log('\n=== Key Init Result ===');
            console.log(JSON.stringify(result, null, 2));

            if (result.success && result.tokenEXParsed) {
                console.log('\n=== DUKPT Keys ===');
                console.log('initial key:', result.tokenEXParsed.encryptedNewKey);
                console.log('ksn:', result.tokenEXParsed.ksn);
                console.log('kcv:', result.tokenEXParsed.checkValue);
                console.log('status:', result.tokenEXParsed.status);
                console.log('crc32:', result.tokenEXParsed.crc32);
            }
        } catch (err) {
            console.error('[test-initKeys] sendKeyInitialization failed:', err.message);
            console.error(err.stack);
            process.exit(1);
        }
    } else {
        console.log('\n[test-initKeys] Build-only complete. Use --send to transmit to Selia.');
    }
})();
