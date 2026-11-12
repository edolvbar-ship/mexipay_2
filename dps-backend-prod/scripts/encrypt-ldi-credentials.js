/**
 * KMS Encryption Utility for LDI Credentials
 * 
 * PCI DSS 4 Requirements Covered:
 * - Requirement 3.5.2: Render cardholder data unreadable using encryption (AWS KMS)
 * - Requirement 8.2.1: Use strong cryptography to protect authentication credentials
 * - Requirement 8.2.3: Secure all stored account data
 * 
 * Usage:
 *   node scripts/encrypt-ldi-credentials.js <plaintext>
 * 
 * Environment Variables Required:
 *   - AWS_REGION: AWS region
 *   - AWS_KMS_ACCESSKEY_ID: AWS KMS access key ID
 *   - AWS_KMS_SECRET_ACCESS_KEY: AWS KMS secret access key
 *   - AWS_KMS_KEY_ID: AWS KMS key ID for encryption
 */

const path = require('path');
const fs = require('fs');

// Load environment variables from specified file or default .env
const envFile = process.env.ENV_FILE || '.env';
const envPath = path.resolve(process.cwd(), envFile);

if (fs.existsSync(envPath)) {
    console.log(`Loading environment from: ${envPath}`);
    require('dotenv').config({ path: envPath });
} else {
    console.log(`Environment file not found: ${envPath}, using default .env`);
    require('dotenv').config();
}

const AWS = require('aws-sdk');

// PCI DSS 4 Requirement 8.2.1: Initialize KMS with strong cryptography
const kms = new AWS.KMS({ 
    region: process.env.AWS_REGION, 
    accessKeyId: process.env.AWS_KMS_ACCESSKEY_ID, 
    secretAccessKey: process.env.AWS_KMS_SECRET_ACCESS_KEY 
});

/**
 * Encrypt plaintext using AWS KMS
 * PCI DSS 4 Requirement 3.5.2: Encrypt sensitive data before storage
 */
async function encryptWithKms(plaintext) {
    try {
        if (!process.env.AWS_KMS_KEY_ID) {
            throw new Error('AWS_KMS_KEY_ID environment variable is required');
        }

        const params = { 
            KeyId: process.env.AWS_KMS_KEY_ID, 
            Plaintext: Buffer.from(plaintext, 'utf8') 
        };
        const result = await kms.encrypt(params).promise();
        const encrypted = result.CiphertextBlob.toString('base64');
        
        console.log('✅ Encryption successful');
        console.log('Encrypted value:', encrypted);
        return encrypted;
    } catch (error) {
        console.error('❌ KMS encryption error:', error.message);
        process.exit(1);
    }
}

/**
 * Main function - encrypt command line argument or all credentials from file
 */
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('Usage: node scripts/encrypt-ldi-credentials.js <plaintext>');
        console.log('Example: node scripts/encrypt-ldi-credentials.js "MyPassword123"');
        console.log('\nOr use with JSON file:');
        console.log('node scripts/encrypt-ldi-credentials.js --json migrations/ldi-credentials.json');
        process.exit(1);
    }

    // Encrypt single plaintext value
    if (args[0] !== '--json') {
        const plaintext = args[0];
        console.log(`Encrypting: ${plaintext}`);
        await encryptWithKms(plaintext);
        return;
    }

    // Encrypt credentials from JSON file
    if (args[0] === '--json' && args[1]) {
        const fs = require('fs');
        const path = require('path');
        const jsonPath = path.resolve(args[1]);
        
        if (!fs.existsSync(jsonPath)) {
            console.error(`❌ JSON file not found: ${jsonPath}`);
            process.exit(1);
        }

        console.log(`Reading credentials from: ${jsonPath}`);
        const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        
        console.log(`Found ${jsonData.length} credential records`);
        console.log('Encrypting passwords and secrets...\n');

        const encryptedData = [];
        
        for (let i = 0; i < jsonData.length; i++) {
            const record = jsonData[i];
            console.log(`[${i + 1}/${jsonData.length}] Processing selia_id ${record.selia_id}...`);
            
            const encryptedPassword = await encryptWithKms(record.password);
            const encryptedSecret = await encryptWithKms(record.secret);
            
            encryptedData.push({
                selia_id: record.selia_id,
                username: record.username,
                password: encryptedPassword,
                secret: encryptedSecret,
                active: record.active !== false
            });
            
            console.log(`✅ Encrypted credentials for selia_id ${record.selia_id}\n`);
        }

        // Write encrypted credentials to new file
        const outputPath = jsonPath.replace('.json', '-encrypted.json');
        fs.writeFileSync(outputPath, JSON.stringify(encryptedData, null, 2));
        console.log(`\n✅ Encrypted credentials written to: ${outputPath}`);
        console.log('You can now use this file with the seeder.');
    }
}

// Run main function
main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
