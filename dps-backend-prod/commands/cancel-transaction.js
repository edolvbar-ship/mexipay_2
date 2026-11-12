#!/usr/bin/env node

/**
 * Selia Cancellation Command
 * Cancels a previously authorized transaction using the Selia API
 * Extracts required data from the iso_message database
 * 
 * Usage: node cancel-transaction.js --txn=226622 [--merchantId=98]
 */

const mysql = require('mysql2/promise');
const SeliaWebService = require('../lib/socketServer/lib/services/seliaWebService');
const TransactionObjectService = require('../lib/socketServer/lib/services/transactionObjectService');
require('dotenv').config();

class CancellationCommand {
    constructor() {
        this.parseArgs();
        this.setupSeliaService();
    }

    parseArgs() {
        const args = process.argv.slice(2);
        this.params = {};
        
        args.forEach(arg => {
            const [key, value] = arg.replace('--', '').split('=');
            this.params[key] = value;
        });

        // Validate required parameters
        const required = ['txn'];
        const missing = required.filter(param => !this.params[param]);
        
        if (missing.length > 0) {
            console.error('❌ Missing required parameters:', missing.join(', '));
            console.log('Usage: node cancel-transaction.js --txn=226622 [--merchantId=98]');
            process.exit(1);
        }

        console.log('🔍 Cancellation Parameters:');
        console.log('   Transaction ID (iso_message.id_message):', this.params.txn);
        console.log('   Merchant ID:', this.params.merchantId || 'default (98)');
    }

    setupSeliaService() {
        this.selia = new SeliaWebService({
            host: process.env.SELIA_HOST,
            port: process.env.SELIA_PORT,
            aesKey: process.env.SELIA_AES_KEY,
            username: process.env.SELIA_USERNAME,
            password: process.env.SELIA_PASSWORD,
            debug: true,
            db: null
        });
        
        // Initialize S3 Transaction Object Service
        this.txnObjectService = new TransactionObjectService();
    }

    async fetchTransactionData(transactionId) {
        const databaseName = process.env.DB_NAME;
        if (!databaseName) {
            throw new Error('DB_NAME environment variable is not set');
        }

        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: databaseName,
            port: process.env.DB_PORT || 3306,
            charset: 'utf8mb4',
            connectTimeout: 5000
        });

        try {
            console.log(`📥 Fetching transaction data for ID: ${transactionId}`);

            const [rows] = await connection.query(`
                SELECT
                    id_message,
                    authorization,
                    amount,
                    bin,
                    last4,
                    track2,
                    more_info,
                    tkn_data_63_rp,
                    resp_code,
                    estatus_f,
                    reference_number,
                    name_merchant
                FROM iso_message
                WHERE id_message = ?
            `, [transactionId]);

            if (rows.length === 0) {
                throw new Error(`Transaction ID ${transactionId} not found in database`);
            }

            const transaction = rows[0];
            console.log(`✅ Found transaction: ${transaction.reference_number || 'N/A'}`);

            // Fetch selia_id from merchant table
            let merchantSeliaId = null;
            if (transaction.name_merchant) {
                try {
                    const [merchantRows] = await connection.query(`
                        SELECT selia_id FROM merchant WHERE id_merchant = ?
                    `, [transaction.name_merchant]);
                    
                    if (merchantRows.length > 0 && merchantRows[0].selia_id) {
                        merchantSeliaId = merchantRows[0].selia_id;
                        console.log(`✅ Found merchant selia_id: ${merchantSeliaId}`);
                    } else {
                        console.log(`⚠️ No selia_id found for merchant ${transaction.name_merchant}`);
                    }
                } catch (merchantError) {
                    console.log(`⚠️ Could not lookup merchant selia_id: ${merchantError.message}`);
                }
            }

            // Extract field 8 transaction ID, field 50 auth code, full card number, and expiration from stored data
            let field8TransactionId = null;
            let field50AuthCode = null;
            let fullCardNumber = null;
            let expiration = null;
            
            if (transaction.tkn_data_63_rp) {
                try {
                    const responseData = JSON.parse(transaction.tkn_data_63_rp);
                    field8TransactionId = responseData['8']; // Field 8 = transaction ID
                    field50AuthCode = responseData['50']; // Field 50 = authorization code
                    expiration = responseData.expiration; // Expiration stored in tkn_data_63_rp
                } catch (e) {
                    console.log('⚠️ Could not parse tkn_data_63_rp');
                }
            }
            
            // Get full card number and expiration from more_info
            if (transaction.more_info) {
                try {
                    const moreInfo = JSON.parse(transaction.more_info);
                    if (!field8TransactionId) field8TransactionId = moreInfo.selia_response?.['8'];
                    if (!field50AuthCode) field50AuthCode = moreInfo.selia_response?.['50'];
                    fullCardNumber = moreInfo.full_card; // Full card number for field 35
                    if (!expiration) expiration = moreInfo.expiration_selia_format; // Fallback: expiration from more_info
                    
                    // Try to fetch complete transaction object from S3 if s3_key is available
                    if (moreInfo.s3_key && (!field8TransactionId || !field50AuthCode)) {
                        try {
                            console.log('📦 Fetching complete transaction object from S3...');
                            const txnObject = await this.txnObjectService.getTransactionObject(moreInfo.s3_key);
                            
                            // Extract data from S3 transaction object
                            if (txnObject.lifecycle?.charge?.response?.parsedFields) {
                                const parsedFields = txnObject.lifecycle.charge.response.parsedFields;
                                if (!field8TransactionId) field8TransactionId = parsedFields['8'];
                                if (!field50AuthCode) field50AuthCode = parsedFields['50'];
                                console.log('✅ Extracted from S3 transaction object:');
                                console.log(`   Field 8: ${field8TransactionId}`);
                                console.log(`   Field 50: ${field50AuthCode}`);
                            }
                        } catch (s3Error) {
                            console.log(`⚠️ Could not fetch from S3: ${s3Error.message}`);
                        }
                    }
                } catch (e) {
                    console.log('⚠️ Could not parse more_info');
                }
            }

            // Extract required fields
            const data = {
                transactionId: field8TransactionId || transaction.id_message, // Use field 8 if available
                authorizationCode: field50AuthCode || transaction.authorization, // Use field 50 if available
                amount: transaction.amount ? transaction.amount.toString() : null,
                maskedCardNumber: fullCardNumber || this.buildMaskedCardNumber(transaction.bin, transaction.last4), // Use full card if available
                expiration: expiration || this.extractExpirationFromTrack2(transaction.track2), // Use stored expiration first, then track2 fallback
                merchantId: transaction.name_merchant, // Use merchant ID from transaction
                seliaId: merchantSeliaId // Use selia_id from merchant table
            };

            console.log('🔍 Extracted Data:');
            console.log(`   Transaction ID (field 8): ${data.transactionId}`);
            console.log(`   Authorization Code (field 50): ${data.authorizationCode}`);
            console.log(`   Amount: ${data.amount}`);
            console.log(`   Card Number (field 35): ${this.maskCard(data.maskedCardNumber)}`);
            console.log(`   Expiration: ${data.expiration}`);
            console.log(`   Merchant ID: ${data.merchantId}`);
            console.log(`   Selia ID: ${data.seliaId || 'NOT FOUND'}`);

            return data;

        } finally {
            await connection.end();
        }
    }

    async updateOriginalTransaction(transactionId, cancelResult, transactionData) {
        const databaseName = process.env.DB_NAME;
        if (!databaseName) {
            throw new Error('DB_NAME environment variable is not set');
        }

        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: databaseName,
            port: process.env.DB_PORT || 3306,
            charset: 'utf8mb4',
            connectTimeout: 5000
        });

        try {
            console.log(`\n🔄 Updating original transaction ${transactionId} to msg_type = '0220'`);

            // Get current transaction data
            const [rows] = await connection.query(`
                SELECT more_info FROM iso_message WHERE id_message = ?
            `, [transactionId]);

            if (rows.length === 0) {
                throw new Error(`Transaction ID ${transactionId} not found for update`);
            }

            const currentData = rows[0];
            
            // Look up merchant selia_id from merchant table
            let merchantSeliaId = null;
            if (transactionData && transactionData.merchantId) {
                try {
                    const [merchantRows] = await connection.query(`
                        SELECT selia_id FROM merchant WHERE id_merchant = ?
                    `, [transactionData.merchantId]);
                    
                    if (merchantRows.length > 0 && merchantRows[0].selia_id) {
                        merchantSeliaId = merchantRows[0].selia_id.toString();
                        console.log(`✅ Found merchant selia_id: ${merchantSeliaId}`);
                    }
                } catch (merchantError) {
                    console.log(`⚠️ Could not lookup merchant selia_id: ${merchantError.message}`);
                }
            }
            
            // Parse existing more_info and append cancel response
            let moreInfo = {};
            
            try {
                moreInfo = JSON.parse(currentData.more_info || '{}');
            } catch (e) {
                console.log('⚠️ Could not parse existing more_info, starting fresh');
            }

            // Append cancel response to more_info
            moreInfo.cancel_result = {
                success: cancelResult.success,
                responseCode: cancelResult.responseCode,
                responseMessage: cancelResult.responseMessage,
                transactionId: cancelResult.transactionId,
                parsedFields: cancelResult.parsedFields || {},
                timestamp: new Date().toISOString()
            };

            // Store cancellation data in S3 if s3_key exists
            if (moreInfo.s3_key) {
                try {
                    console.log('📦 Storing cancellation data in S3...');

                    const cancelProcessData = {
                        timestamp: new Date().toISOString(),
                        request: {
                            data: transactionData
                        },
                        response: {
                            cancelResult: cancelResult
                        },
                        rawRequest: cancelResult.rawRequest,
                        rawResponse: cancelResult.rawResponse,
                        parsedFields: cancelResult.parsedFields
                    };

                    // Update the complete transaction object in S3
                    const merchantIdForS3 = cancelResult.usedSeliaId || currentData.id_merchant?.toString() || 'unknown';
                    console.log(`📦 Using merchant ID for S3: ${merchantIdForS3} (usedSeliaId: ${cancelResult.usedSeliaId}, db_merchant: ${currentData.id_merchant})`);
                    
                    await this.txnObjectService.updateTransactionObject(
                        transactionId.toString(),
                        merchantIdForS3,
                        'cancel',
                        cancelProcessData
                    );
                    
                    console.log('✅ Cancellation data stored in S3');
                } catch (s3Error) {
                    console.log(`⚠️ Failed to store cancellation data in S3: ${s3Error.message}`);
                }
            }

            // Update the original record
            await connection.query(`
                UPDATE iso_message SET 
                    msg_type = '0220',
                    more_info = ?,
                    estatus_f = ?  -- Cancelled status (2 = Cancelled)
                WHERE id_message = ?
            `, [
                JSON.stringify(moreInfo),
                cancelResult.success ? 2 : 1,
                transactionId
            ]);

            console.log(`✅ Transaction ${transactionId} updated to msg_type = '0220'`);

        } finally {
            await connection.end();
        }
    }

    buildMaskedCardNumber(bin, last4) {
        if (!bin || !last4) {
            return null;
        }
        // Build full card number from BIN (6 digits) + masked middle + last4 (4 digits)
        const middleStars = '*'.repeat(Math.max(16 - 6 - 4, 0));
        return bin + middleStars + last4;
    }

    extractExpirationFromTrack2(track2) {
        if (!track2) {
            return null;
        }

        // Track 2 format: ;B4111111111111111^2612101000000000000000000000000000?
        // Look for expiration in YYMM format after the card number
        const match = track2.match(/\^(\d{4})/);
        if (match) {
            const yymm = match[1];
            // Convert YYMM to MMYY for Selia
            const yy = yymm.substring(0, 2);
            const mm = yymm.substring(2, 4);
            return mm + yy; // MMYY format
        }

        // Alternative format: look for 4 digits after card number
        const altMatch = track2.match(/(\d{16})(\d{4})/);
        if (altMatch) {
            const yymm = altMatch[2];
            const yy = yymm.substring(0, 2);
            const mm = yymm.substring(2, 4);
            return mm + yy; // MMYY format
        }

        return null;
    }

    async executeCancellation() {
        console.log('\n🚫 EXECUTING TRANSACTION CANCELLATION');
        console.log('=' .repeat(50));
        
        try {
            // Fetch transaction data from database
            const transactionData = await this.fetchTransactionData(this.params.txn);

            const result = await this.selia.reverseTransaction(
                transactionData.transactionId,
                transactionData.authorizationCode,
                transactionData.amount,
                transactionData.maskedCardNumber,
                transactionData.expiration,
                null, // merchantId - not needed since we pass seliaId directly
                '502', // Selia transaction type (502 = Cancel)
                transactionData.seliaId // Pass selia_id directly
            );

            console.log('\n✅ Cancellation Result:');
            console.log('   Success:', result.success);
            console.log('   Response Code:', result.responseCode);
            console.log('   Response Message:', result.responseMessage);
            console.log('   Transaction ID:', result.transactionId);
            
            if (result.parsedFields) {
                console.log('\n📋 Parsed Response Fields:');
                Object.entries(result.parsedFields).forEach(([key, value]) => {
                    console.log(`   ${key}: ${value}`);
                });
            }

            if (result.success) {
                console.log('\n🎉 Cancellation completed successfully!');
                
                // UPDATE the original iso_message record to msg_type = '0220'
                await this.updateOriginalTransaction(this.params.txn, result, transactionData);
            } else {
                console.log('\n⚠️ Cancellation failed or was declined');
            }

        } catch (error) {
            console.error('\n💥 Cancellation Error:', error.message);
            process.exit(1);
        }
    }

    maskCard(cardNumber) {
        return cardNumber.replace(/.(?=.{4})/g, '*');
    }
}

// Run the cancellation command
if (require.main === module) {
    const command = new CancellationCommand();
    command.executeCancellation().catch(error => {
        console.error('💥 Cancellation command crashed:', error);
        process.exit(1);
    });
}

module.exports = CancellationCommand;
