/**
 * LDI Credentials Seeder with KMS Encryption
 * 
 * PCI DSS 4 Requirements Covered:
 * - Requirement 3.5.2: Render cardholder data unreadable using encryption (AWS KMS)
 * - Requirement 8.2.1: Use strong cryptography to protect authentication credentials
 * - Requirement 8.2.3: Secure all stored account data
 * - Requirement 10.2.1: Implement audit trails for credential operations
 */

'use strict';

const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');

// PCI DSS 4 Requirement 8.2.1: Initialize KMS with strong cryptography for credential protection
const kms = new AWS.KMS({ 
    region: process.env.AWS_REGION, 
    accessKeyId: process.env.AWS_KMS_ACCESSKEY_ID, 
    secretAccessKey: process.env.AWS_KMS_SECRET_ACCESS_KEY 
});

/**
 * Encrypt credential using AWS KMS
 * PCI DSS 4 Requirement 3.5.2: Encrypt sensitive data before storage
 */
async function encryptWithKms(plaintext) {
    try {
        const params = { 
            KeyId: process.env.AWS_KMS_KEY_ID, 
            Plaintext: Buffer.from(plaintext, 'utf8') 
        };
        const result = await kms.encrypt(params).promise();
        return result.CiphertextBlob.toString('base64');
    } catch (error) {
        console.error('KMS encryption error:', error);
        throw new Error(`Failed to encrypt credential: ${error.message}`);
    }
}

function validateRecord(record) {
    const errors = [];
    
    if (!record.selia_id || isNaN(record.selia_id)) {
        errors.push('selia_id must be a valid number');
    }
    if (!record.username || record.username.trim().length === 0) {
        errors.push('username is required');
    }
    if (!record.password || record.password.trim().length === 0) {
        errors.push('password is required');
    }
    if (!record.secret || record.secret.trim().length === 0) {
        errors.push('secret is required');
    }
    if (record.username && record.username.length > 100) {
        errors.push('username exceeds 100 characters');
    }
    if (record.password && record.password.length > 255) {
        errors.push('password exceeds 255 characters');
    }
    if (record.secret && record.secret.length > 255) {
        errors.push('secret exceeds 255 characters');
    }
    
    return errors;
}

module.exports = {
    async up(queryInterface, Sequelize) {
        // Use encrypted credentials file if available, otherwise fall back to original
        const encryptedPath = path.join(__dirname, '../../../../../migrations/ldi-credentials-encrypted.json');
        const originalPath = path.join(__dirname, '../../../../../migrations/ldi-credentials.json');
        
        const jsonPath = fs.existsSync(encryptedPath) ? encryptedPath : originalPath;
        console.log('JSON file path:', jsonPath);
        console.log('Using encrypted credentials:', fs.existsSync(encryptedPath));
        
        if (!fs.existsSync(jsonPath)) {
            throw new Error(`JSON file not found at: ${jsonPath}`);
        }

        // Read and parse JSON file
        const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        console.log(`Found ${jsonData.length} LDI credential records in JSON file`);

        // Validate and prepare records with KMS encryption
        const validRecords = [];
        let invalidCount = 0;

        for (let i = 0; i < jsonData.length; i++) {
            const record = jsonData[i];
            const validationErrors = validateRecord(record);
            
            if (validationErrors.length > 0) {
                console.warn(`Validation errors in record ${i + 1}:`, validationErrors);
                console.warn('Problematic record data:', record);
                invalidCount++;
            } else {
                // PCI DSS 4 Requirement 3.5.2: Encrypt password and secret with KMS before storage
                const encryptedPassword = await encryptWithKms(record.password.trim());
                const encryptedSecret = await encryptWithKms(record.secret.trim());
                
                validRecords.push({
                    selia_id: record.selia_id,
                    username: record.username.trim(),
                    password: encryptedPassword,
                    secret: encryptedSecret,
                    active: record.active !== false, // default to true
                    created_at: new Date(),
                    updated_at: new Date()
                });
                
                // PCI DSS 4 Requirement 10.2.1: Audit trail - log credential encryption
                console.log(`✅ Encrypted credentials for selia_id ${record.selia_id}`);
            }
        }

        console.log(`Valid records: ${validRecords.length}, Invalid records: ${invalidCount}`);

        if (validRecords.length === 0) {
            throw new Error('No valid data found in JSON file');
        }

        // Check for duplicate selia_id values
        const seliaIds = validRecords.map(r => r.selia_id);
        const duplicateIds = seliaIds.filter((id, index) => seliaIds.indexOf(id) !== index);
        
        if (duplicateIds.length > 0) {
            console.warn('Duplicate selia_id values found:', duplicateIds);
            throw new Error(`Duplicate selia_id values: ${duplicateIds.join(', ')}`);
        }

        // Insert records in batches
        const batchSize = 50;
        for (let i = 0; i < validRecords.length; i += batchSize) {
            const batch = validRecords.slice(i, i + batchSize);
            
            try {
                await queryInterface.bulkInsert('ldi_credentials', batch);
                console.log(`✅ Inserted batch ${Math.floor(i/batchSize) + 1} with ${batch.length} records`);
            } catch (error) {
                console.error(`❌ Error inserting batch ${Math.floor(i/batchSize) + 1}:`, error.message);
                throw error;
            }
        }

        console.log(`✅ Successfully seeded ${validRecords.length} LDI credentials records with KMS encryption`);
    },

    async down(queryInterface, Sequelize) {
        // Remove all LDI credentials if rolling back
        await queryInterface.bulkDelete('ldi_credentials', {}, {});
        console.log('✅ LDI credentials table cleared');
    }
};