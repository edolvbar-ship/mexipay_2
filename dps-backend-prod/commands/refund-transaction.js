#!/usr/bin/env node

/**
 * Selia Refund Command
 * Refunds a previously authorized transaction using the Selia API
 * Extracts required data from the iso_message database
 * 
 * Usage: node refund-transaction.js --txn=226622 [--merchantId=98]
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const SeliaWebService = require('../lib/socketServer/lib/services/seliaWebService');
const TransactionObjectService = require('../lib/socketServer/lib/services/transactionObjectService');


class RefundCommand {
    constructor() {
        this.parseArgs();
        this.setupSeliaService();
        this.setupTransactionService();
    }

    parseArgs() {
        const args = process.argv.slice(2);
        this.params = {};
        
        args.forEach(arg => {
            const [key, value] = arg.replace('--', '').split('=');
            this.params[key] = value;
        });

        // Validate that either txn or auth is provided
        if (!this.params.txn && !this.params.auth) {
            console.error('❌ Missing required parameter: either --txn or --auth must be provided');
            console.log('Usage: node refund-transaction.js --txn=226622 [--merchantId=98]');
            console.log('Usage: node refund-transaction.js --auth=XXXXX [--merchantId=98]');
            console.log('Usage: node refund-transaction.js --auth=12345,67890,ABCDE [--merchantId=98]');
            process.exit(1);
        }

        // Validate that both aren't provided at the same time
        if (this.params.txn && this.params.auth) {
            console.error('❌ Cannot use both --txn and --auth parameters simultaneously');
            console.log('Usage: node refund-transaction.js --txn=226622 [--merchantId=98]');
            console.log('Usage: node refund-transaction.js --auth=XXXXX [--merchantId=98]');
            console.log('Usage: node refund-transaction.js --auth=12345,67890,ABCDE [--merchantId=98]');
            process.exit(1);
        }

        // Parse authorization codes if provided
        if (this.params.auth) {
            // Handle comma-separated authorization codes
            this.params.authCodes = this.params.auth.split(',').map(code => code.trim()).filter(code => code.length > 0);
        }

        console.log('🔍 Refund Parameters:');
        if (this.params.txn) {
            console.log('   Transaction ID (iso_message.id_message):', this.params.txn);
        }
        if (this.params.authCodes) {
            console.log('   Authorization Codes:', this.params.authCodes.length > 1 ? 
                `\n     ${this.params.authCodes.join('\n     ')}` : this.params.authCodes[0]);
        }
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
    }

    setupTransactionService() {
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
            console.log(`\n📥 Fetching transaction data for ID: ${transactionId}`);

            const [rows] = await connection.query(`
                SELECT 
                    id_message,
                    reference_number,
                    amount,
                    authorization,
                    bin,
                    last4,
                    tkn_data_63_rq,
                    tkn_data_63_rp,
                    track2,
                    more_info,
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
                } catch (e) {
                    console.log('⚠️ Could not parse more_info');
                }
            }

            // Extract required fields - convert amount from cents to original currency format
            const data = {
                transactionId: field8TransactionId || transaction.id_message, // Use field 8 if available
                authorizationCode: field50AuthCode || transaction.authorization, // Use field 50 if available
                amount: transaction.amount ? (transaction.amount / 100).toFixed(2).toString() : null, // Convert from cents to currency format, then to string
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

    async fetchTransactionsByAuthCode(authorizationCode) {
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
            console.log(`\n🔍 Searching for transactions with authorization code: ${authorizationCode}`);

            const [rows] = await connection.query(`
                SELECT 
                    id_message,
                    reference_number,
                    amount,
                    authorization,
                    bin,
                    last4,
                    tkn_data_63_rq,
                    tkn_data_63_rp,
                    track2,
                    more_info,
                    name_merchant,
                    creation_date,
                    resp_code,
                    estatus_f
                FROM iso_message 
                WHERE authorization = ?
                ORDER BY creation_date DESC
            `, [authorizationCode]);

            console.log(`✅ Found ${rows.length} transaction(s) with authorization code: ${authorizationCode}`);
            return rows;

        } catch (error) {
            console.error(`❌ Database error: ${error.message}`);
            return [];
        } finally {
            await connection.end();
        }
    }

    async displayTransactionMatches(matches) {
        if (matches.length === 0) {
            console.log('📭 No matching transactions found');
            return;
        }

        console.log('\n' + '═'.repeat(120));
        console.log(`📋 MATCHING TRANSACTIONS FOUND (${matches.length})`);
        console.log('═'.repeat(120));

        // Display table header
        console.log('│ # │ ID      │ Merchant           │ Ref #         │ Amount    │ Resp │ Status │ Date/Time          │');
        console.log('├───┼─────────┼────────────────────┼───────────────┼───────────┼──────┼────────┼────────────────────┤');

        // Display each row
        matches.forEach((row, index) => {
            const num = String(index + 1).padEnd(1);
            const id = String(row.id_message || '').padEnd(7);
            const merchant = (row.name_merchant || 'N/A').substring(0, 18).padEnd(18);
            const ref = (row.reference_number || 'N/A').padEnd(13);
            const amount = row.amount ? `$${parseInt(row.amount)}`.padEnd(9) : '$0.00'.padEnd(9);
            const resp = (row.resp_code || 'N/A').padEnd(4);
            const status = row.estatus_f === 2 ? 'APPROVED'.padEnd(6) : (row.estatus_f === 3 ? 'DECLINED'.padEnd(6) : 'OTHER'.padEnd(6));

            const date = new Date(row.creation_date);
            const datetime = date.toLocaleString('es-MX', {
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            }).padEnd(18);

            console.log(`│ ${num} │ ${id} │ ${merchant} │ ${ref} │ ${amount} │ ${resp} │ ${status} │ ${datetime} │`);

            // Add separator every 10 rows
            if (index < matches.length - 1 && (index + 1) % 10 === 0) {
                console.log('├───┼─────────┼────────────────────┼───────────────┼───────────┼──────┼────────┼────────────────────┤');
            }
        });

        console.log('═'.repeat(120));

        // Summary
        const totalAmount = matches.reduce((sum, row) => sum + (parseInt(row.amount) || 0), 0);
        console.log(`📊 Total: ${matches.length} transactions | Total Amount: $${totalAmount / 100}`);
    }

    isInteractiveMode() {
        // Check if we're running in an interactive terminal
        return process.stdin.isTTY && process.stdout.isTTY;
    }

    async promptForTransactionSelection(matches) {
        // If not in interactive mode, we can't prompt for selection
        if (!this.isInteractiveMode()) {
            console.error('❌ Multiple transactions found but running in non-interactive mode.');
            console.error('   Found', matches.length, 'matching transactions:');
            matches.forEach((match, index) => {
                console.error(`   ${index + 1}. ID: ${match.id_message}, Ref: ${match.reference_number}, Amount: $${match.amount / 100}`);
            });
            console.error('   Please run with --txn=<transaction_id> to specify which transaction to refund.');
            return null;
        }

        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        try {
            const selection = await new Promise((resolve) => {
                rl.question('\n🎯 Enter the number of the transaction to refund (1-' + matches.length + '): ', (answer) => {
                    resolve(answer.trim());
                });
            });

            const selectedIndex = parseInt(selection) - 1;
            
            if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= matches.length) {
                console.error('❌ Invalid selection. Please enter a number between 1 and ' + matches.length);
                return null;
            }

            const selectedTransaction = matches[selectedIndex];
            console.log(`✅ Selected transaction #${selection}: ID ${selectedTransaction.id_message} - Ref: ${selectedTransaction.reference_number}`);
            
            return selectedTransaction;

        } finally {
            rl.close();
        }
    }

    async storeRefundDataInS3(originalTransactionId, refundResult, transactionData) {
        try {
            console.log('📦 Storing refund data in S3...');

            const refundProcessData = {
                timestamp: new Date().toISOString(),
                request: {
                    data: transactionData
                },
                response: {
                    refundResult: refundResult
                },
                rawRequest: refundResult.rawRequest,
                rawResponse: refundResult.rawResponse,
                parsedFields: refundResult.parsedFields
            };

            // Look up merchant selia_id from merchant table
            let merchantSeliaId = null;
            const databaseName = process.env.DB_NAME;
            if (databaseName) {
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
                    if (transactionData && transactionData.merchantId) {
                        const [merchantRows] = await connection.query(`
                            SELECT selia_id FROM merchant WHERE id_merchant = ?
                        `, [transactionData.merchantId]);
                        
                        if (merchantRows.length > 0 && merchantRows[0].selia_id) {
                            merchantSeliaId = merchantRows[0].selia_id.toString();
                            console.log(`✅ Found merchant selia_id: ${merchantSeliaId}`);
                        }
                    }
                } catch (merchantError) {
                    console.log(`⚠️ Could not lookup merchant selia_id: ${merchantError.message}`);
                } finally {
                    await connection.end();
                }
            }

            // Update the complete transaction object in S3
            const merchantIdForS3 = refundResult.usedSeliaId || merchantSeliaId || 'unknown';
            console.log(`📦 Using merchant ID for S3: ${merchantIdForS3} (usedSeliaId: ${refundResult.usedSeliaId}, db_merchant: ${merchantSeliaId})`);
            
            await this.txnObjectService.updateTransactionObject(
                originalTransactionId.toString(),
                merchantIdForS3,
                'refund',
                refundProcessData
            );
            
            console.log('✅ Refund data stored in S3');
        } catch (s3Error) {
            console.log(`⚠️ Failed to store refund data in S3: ${s3Error.message}`);
        }
    }

    async processRefundTransaction(originalTransactionId, refundResult, transactionData) {
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
            console.log(`\n🔄 Processing refund for transaction ${originalTransactionId}`);

            // 1) Get original transaction data
            const [rows] = await connection.query(`
                SELECT * FROM iso_message WHERE id_message = ?
            `, [originalTransactionId]);

            if (rows.length === 0) {
                throw new Error(`Original transaction ID ${originalTransactionId} not found`);
            }

            const originalTx = rows[0];
            
            // 2) UPDATE original transaction to voided
            let currentMoreInfo = {};
            try {
                currentMoreInfo = JSON.parse(originalTx.more_info || '{}');
            } catch (e) {
                console.log('⚠️ Could not parse existing more_info');
            }
            
            currentMoreInfo.voided_timestamp = new Date().toISOString();
            currentMoreInfo.voided_by_refund = true;

            await connection.query(`
                UPDATE iso_message SET 
                    estatus_f = ?,  -- Voided status (3 = Voided)
                    more_info = ?
                WHERE id_message = ?
            `, [
                3, // Voided status
                JSON.stringify(currentMoreInfo),
                originalTransactionId
            ]);

            console.log(`✅ Original transaction ${originalTransactionId} marked as voided`);

            // 3) CREATE new transaction with msg_type = '0420' and negative amount
            const refundAmount = -Math.abs(parseInt(originalTx.amount)); // Negative amount
            const refundTransactionData = {
                name_merchant: originalTx.name_merchant,
                terminal: originalTx.terminal,
                msg_type: '0420', // Refund transaction type
                reference_number: `REF${Date.now().toString().slice(-6)}`,
                amount: refundAmount, // Negative amount for refund
                resp_code: refundResult.responseCode || '0',
                authorization: refundResult.parsedFields?.['50'] || originalTx.authorization,
                bin: originalTx.bin,
                last4: originalTx.last4,
                creation_date: new Date(),
                id_operation: 16, // REVERSO operation for refunds
                estatus_f: refundResult.success ? 2 : 1,
                card_type: originalTx.card_type,
                node: originalTx.node,
                tran_date: this.fechaLocalBnrg(),
                tran_time: this.horaLocalBnrg(),
                capture_date: refundResult.success ? this.fechaLocalBnrg() : null,
                tkn_data_63_rq: JSON.stringify({
                    original_transaction_id: originalTransactionId,
                    refund_amount: refundAmount,
                    original_amount: originalTx.amount
                }),
                tkn_data_63_rp: JSON.stringify(refundResult.parsedFields || {}),
                track2: originalTx.track2,
                card_acceptor: originalTx.card_acceptor,
                folio: refundResult.transactionId,
                trace_number: Date.now().toString().slice(-6),
                entry_mode: originalTx.entry_mode,
                reverse_code: null,
                draft_capture: null,
                reference_number_ant: originalTx.reference_number,
                more_info: JSON.stringify({
                    original_transaction: originalTransactionId,
                    refund_result: {
                        success: refundResult.success,
                        responseCode: refundResult.responseCode,
                        responseMessage: refundResult.responseMessage,
                        transactionId: refundResult.transactionId,
                        timestamp: new Date().toISOString()
                    }
                })
            };

            // Insert the refund transaction
            const [insertResult] = await connection.query(`
                INSERT INTO iso_message (
                    name_merchant, terminal, msg_type, reference_number, amount, resp_code,
                    authorization, bin, last4, creation_date, id_operation, estatus_f,
                    card_type, node, tran_date, tran_time, capture_date, tkn_data_63_rq,
                    tkn_data_63_rp, track2, card_acceptor, folio, trace_number, entry_mode,
                    reverse_code, draft_capture, reference_number_ant, more_info
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                refundTransactionData.name_merchant,
                refundTransactionData.terminal,
                refundTransactionData.msg_type,
                refundTransactionData.reference_number,
                refundTransactionData.amount,
                refundTransactionData.resp_code,
                refundTransactionData.authorization,
                refundTransactionData.bin,
                refundTransactionData.last4,
                refundTransactionData.creation_date,
                refundTransactionData.id_operation,
                refundTransactionData.estatus_f,
                refundTransactionData.card_type,
                refundTransactionData.node,
                refundTransactionData.tran_date,
                refundTransactionData.tran_time,
                refundTransactionData.capture_date,
                refundTransactionData.tkn_data_63_rq,
                refundTransactionData.tkn_data_63_rp,
                refundTransactionData.track2,
                refundTransactionData.card_acceptor,
                refundTransactionData.folio,
                refundTransactionData.trace_number,
                refundTransactionData.entry_mode,
                refundTransactionData.reverse_code,
                refundTransactionData.draft_capture,
                refundTransactionData.reference_number_ant,
                refundTransactionData.more_info
            ]);

            console.log(`✅ New refund transaction created with ID: ${insertResult.insertId}`);
            console.log(`   Message Type: 0420`);
            console.log(`   Amount: ${refundAmount} (negative)`);

            // 4) Store refund data in S3
            await this.storeRefundDataInS3(originalTransactionId, refundResult, transactionData);

        } finally {
            await connection.end();
        }
    }

    fechaLocalBnrg() {
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${month}${day}`;
    }

    horaLocalBnrg() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        return `${hours}${minutes}${seconds}`;
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

    async executeRefund() {
        console.log('\n💰 EXECUTING TRANSACTION REFUND');
        console.log('=' .repeat(50));
        
        try {
            if (this.params.authCodes) {
                // Process multiple authorization codes
                await this.processMultipleAuthCodes();
            } else {
                // Process single transaction by ID
                await this.processSingleTransaction(this.params.txn);
            }

        } catch (error) {
            console.error('\n💥 Refund Error:', error.message);
            process.exit(1);
        }
    }

    async processMultipleAuthCodes() {
        console.log(`\n🔄 Processing ${this.params.authCodes.length} authorization codes...`);
        
        const results = [];
        
        for (let i = 0; i < this.params.authCodes.length; i++) {
            const authCode = this.params.authCodes[i];
            console.log(`\n${'─'.repeat(60)}`);
            console.log(`📍 Processing authorization code ${i + 1}/${this.params.authCodes.length}: ${authCode}`);
            console.log(`${'─'.repeat(60)}`);
            
            try {
                const result = await this.processAuthCode(authCode);
                results.push({ authCode, success: true, result });
                
                if (result.success) {
                    console.log(`✅ Authorization code ${authCode}: Refund completed successfully`);
                } else {
                    console.log(`⚠️ Authorization code ${authCode}: Refund failed or was declined`);
                }
            } catch (error) {
                console.error(`❌ Authorization code ${authCode}: ${error.message}`);
                results.push({ authCode, success: false, error: error.message });
            }
        }
        
        // Summary
        console.log(`\n${'═'.repeat(60)}`);
        console.log('📊 BATCH PROCESSING SUMMARY');
        console.log(`${'═'.repeat(60)}`);
        
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        console.log(`✅ Successful refunds: ${successful}/${this.params.authCodes.length}`);
        console.log(`❌ Failed refunds: ${failed}/${this.params.authCodes.length}`);
        
        if (failed > 0) {
            console.log('\n❌ Failed authorization codes:');
            results.filter(r => !r.success).forEach(r => {
                console.log(`   ${r.authCode}: ${r.error || 'Refund failed'}`);
            });
        }
        
        console.log(`${'═'.repeat(60)}`);
    }

    async processAuthCode(authCode) {
        // Search by authorization code
        const matches = await this.fetchTransactionsByAuthCode(authCode);

        if (matches.length === 0) {
            throw new Error(`No transactions found with authorization code: ${authCode}`);
        }

        let transactionId;
        
        if (matches.length === 1) {
            // Only one match, use it directly
            console.log('✅ Found exactly one matching transaction');
            transactionId = matches[0].id_message;
            console.log(`   Using transaction ID: ${transactionId}`);
        } else {
            // Multiple matches - show selection prompt
            console.log(`\n⚠️ Found ${matches.length} matching transactions for authorization code ${authCode}. Please select one to refund:`);
            await this.displayTransactionMatches(matches);
            
            const selectedTransaction = await this.promptForTransactionSelection(matches);
            if (!selectedTransaction) {
                console.log('❌ No valid selection made. Skipping this authorization code.');
                throw new Error(`No transaction selected for authorization code: ${authCode}`);
            }
            
            transactionId = selectedTransaction.id_message;
            console.log(`   Selected transaction ID: ${transactionId}`);
        }

        // Process the refund
        return await this.processSingleTransaction(transactionId, authCode);
    }

    async processSingleTransaction(transactionId, authCode = null) {
        // Fetch transaction data from database
        const transactionData = await this.fetchTransactionData(transactionId);

        // Convert decimal amount to cents for Selia API
        const amountInCents = Math.round(parseFloat(transactionData.amount) * 100);
        
        const result = await this.selia.reverseTransaction(
            transactionData.transactionId,
            transactionData.authorizationCode,
            amountInCents.toString(), // Pass amount in cents as string
            transactionData.maskedCardNumber,
            transactionData.expiration,
            null, // merchantId - not needed since we pass seliaId directly
            '502', // Selia transaction type (502 = Refund)
            transactionData.seliaId // Pass selia_id directly
        );

        console.log('\n✅ Refund Result:');
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
            console.log('\n🎉 Refund completed successfully!');
            
            // 1) UPDATE original transaction to voided
            // 2) CREATE new transaction with msg_type = '0420' and negative amount
            // 3) Store refund data in S3
            await this.processRefundTransaction(transactionId, result, transactionData);
        } else {
            console.log('\n⚠️ Refund failed or was declined');
        }

        return result;
    }

    maskCard(cardNumber) {
        return cardNumber.replace(/.(?=.{4})/g, '*');
    }
}

// Run the refund command
if (require.main === module) {
    const command = new RefundCommand();
    command.executeRefund().catch(error => {
        console.error('💥 Refund command crashed:', error);
        process.exit(1);
    });
}

module.exports = RefundCommand;
