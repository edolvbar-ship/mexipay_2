#!/usr/bin/env node

/**
 * Selia Charge Command
 * Processes a charge transaction using Selia API and stores it in iso_message database
 * 
 * Usage: node charge-transaction.js --amount=1000 --cardNumber=4111111111111111 --expiration=1228 --merchantId=98
 */

const mysql = require('mysql2/promise');
const SeliaWebService = require('../lib/socketServer/lib/services/seliaWebService');
require('dotenv').config();

class ChargeCommand {
    constructor() {
        this.parseArgs();
        this.setupSeliaService();
    }

    // Helper functions for date/time formatting (same as ecommerce routes)
    horaLocalBnrg() {
        const d = new Date();
        return (`0${d.getHours()}`).substr(-2)
            + (`0${d.getMinutes()}`).substr(-2)
            + (`0${d.getSeconds()}`).substr(-2);
    }

    fechaLocalBnrg() {
        const d = new Date();
        return (`0${d.getDate()}`).substr(-2) + (`0${d.getMonth() + 1}`).substr(-2); // DDMM format
    }

    parseArgs() {
        const args = process.argv.slice(2);
        this.params = {};
        
        args.forEach(arg => {
            const [key, value] = arg.replace('--', '').split('=');
            this.params[key] = value;
        });

        // Validate required parameters
        const required = ['amount', 'cardNumber', 'expiration'];
        const missing = required.filter(param => !this.params[param]);
        
        if (missing.length > 0) {
            console.error('❌ Missing required parameters:', missing.join(', '));
            console.log('Usage: node charge-transaction.js --amount=1000 --cardNumber=4111111111111111 --expiration=1228 [--merchantId=98]');
            process.exit(1);
        }

        console.log('🔍 Charge Parameters:');
        console.log('   Amount (cents):', this.params.amount);
        console.log('   Card Number:', this.maskCard(this.params.cardNumber));
        console.log('   Expiration (MMYY):', this.params.expiration);
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

    async executeCharge() {
        console.log('\n💳 EXECUTING TRANSACTION CHARGE');
        console.log('=' .repeat(50));
        
        try {
            // Process charge with Selia
            const expiration = this.params.expiration;
            const fixedExpiration = expiration.substring(2) + expiration.substring(0, 2); // YYMM format
            
            const result = await this.selia.processPayment({
                amount: this.params.amount,
                cardNumber: this.params.cardNumber,
                expiration: fixedExpiration,
                merchantId: this.params.merchantId ? parseInt(this.params.merchantId) : null
            });

            console.log('\n✅ Charge Result:');
            console.log('   Success:', result.success);
            console.log('   Response Code:', result.responseCode);
            console.log('   Response Message:', result.responseMessage);
            console.log('   Transaction ID:', result.transactionId || result.parsedFields?.['8']);
            console.log('   Authorization Code:', result.authorizationCode);
            
            if (result.parsedFields) {
                console.log('\n📋 Parsed Response Fields:');
                Object.entries(result.parsedFields).forEach(([key, value]) => {
                    console.log(`   ${key}: ${value}`);
                });
            }

            if (result.success) {
                console.log('\n🎉 Charge completed successfully!');
                
                // Store transaction in database
                await this.storeTransaction(result);
                
                const txnId = result.transactionId || result.parsedFields?.['8'];
                console.log('\n💾 Transaction stored in iso_message database');
                console.log(`📝 Use --txn=${txnId} for cancellation`);
                console.log(`📝 Use --txn=${txnId} for refund`);
                
            } else {
                console.log('\n⚠️ Charge failed or was declined');
            }

        } catch (error) {
            console.error('\n💥 Charge Error:', error.message);
            process.exit(1);
        }
    }

    async storeTransaction(chargeResult) {
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
            console.log('\n💾 Storing transaction in database...');

            // Extract BIN and last4 from card number
            const cardNumber = this.params.cardNumber;
            const bin = cardNumber.substring(0, 6);
            const last4 = cardNumber.substring(cardNumber.length - 4);
            
            // Build proper track2 data for cancellations/refunds
            const expirationYY = this.params.expiration.substring(2);
            const expirationMM = this.params.expiration.substring(0, 2);
            const track2 = `;B${cardNumber}^${expirationYY}${expirationMM}0000000000000000000000000000000?`;

            // Prepare transaction data
            const transactionData = {
                name_merchant: this.params.merchantId || '98',
                terminal: 'WEB',
                msg_type: '0200',
                reference_number: chargeResult.transactionId || `WEB${Date.now().toString().slice(-6)}`,
                amount: this.params.amount,
                resp_code: chargeResult.responseCode || '00',
                authorization: chargeResult.authorizationCode,
                bin: bin,
                last4: last4,
                creation_date: new Date(),
                id_operation: chargeResult.transactionId,
                estatus_f: chargeResult.success ? 2 : 1,
                card_type: this.getCardType(bin),
                node: 'WEB',
                tran_date: this.fechaLocalBnrg(),
                tran_time: this.horaLocalBnrg(),
                capture_date: chargeResult.success ? this.fechaLocalBnrg() : null,
                tkn_data_63_rq: JSON.stringify({
                    amount: this.params.amount,
                    cardNumber: this.maskCard(cardNumber),
                    expiration: this.params.expiration
                }),
                tkn_data_63_rp: JSON.stringify(chargeResult.parsedFields || {}),
                track2: track2,
                card_acceptor: 'WEB',
                folio: chargeResult.transactionId,
                trace_number: chargeResult.traceNumber || Date.now().toString().slice(-6),
                entry_mode: '1',
                reverse_code: null,
                draft_capture: null,
                reference_number_ant: null,
                more_info: JSON.stringify({
                    selia_response: chargeResult.parsedFields || {},
                    charge_amount: this.params.amount,
                    masked_card: this.maskCard(cardNumber),
                    full_card: cardNumber, // Store full card number for cancel/refund
                    expiration: this.params.expiration
                })
            };

            const [insertResult] = await connection.query(`
                INSERT INTO iso_message (
                    name_merchant, terminal, msg_type, reference_number, amount, resp_code,
                    authorization, bin, last4, creation_date, id_operation, estatus_f,
                    card_type, node, tran_date, tran_time, capture_date, tkn_data_63_rq,
                    tkn_data_63_rp, track2, card_acceptor, folio, trace_number, entry_mode,
                    reverse_code, draft_capture, reference_number_ant, more_info
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                transactionData.name_merchant,
                transactionData.terminal,
                transactionData.msg_type,
                transactionData.reference_number,
                transactionData.amount,
                transactionData.resp_code,
                transactionData.authorization,
                transactionData.bin,
                transactionData.last4,
                transactionData.creation_date,
                transactionData.id_operation,
                transactionData.estatus_f,
                transactionData.card_type,
                transactionData.node,
                transactionData.tran_date,
                transactionData.tran_time,
                transactionData.capture_date,
                transactionData.tkn_data_63_rq,
                transactionData.tkn_data_63_rp,
                transactionData.track2,
                transactionData.card_acceptor,
                transactionData.folio,
                transactionData.trace_number,
                transactionData.entry_mode,
                transactionData.reverse_code,
                transactionData.draft_capture,
                transactionData.reference_number_ant,
                transactionData.more_info
            ]);

            if (insertResult.affectedRows > 0) {
                console.log(`✅ Transaction stored with ID: ${insertResult.insertId}`);
                console.log(`📋 Reference: ${transactionData.reference_number}`);
                console.log(`💳 Card: ${this.maskCard(cardNumber)} (${bin}****${last4})`);
                console.log(`💰 Amount: $${parseInt(this.params.amount) / 100}`);
                console.log(`🎯 Transaction Type: 501 (Charge)`);
                console.log(`💾 Track2: ${track2.substring(0, 20)}... (ready for cancel/refund)`);
            } else {
                console.error('❌ Failed to store transaction in database');
            }

        } catch (error) {
            console.error('❌ Database storage error:', error.message);
            throw error;
        } finally {
            await connection.end();
        }
    }

    getCardType(bin) {
        // Simple card type detection based on BIN - return 2-char codes
        if (bin.startsWith('4')) return 'VI';  // VISA
        if (bin.startsWith('5')) return 'MC';  // MASTERCARD
        if (bin.startsWith('3')) return 'AX';  // AMEX
        if (bin.startsWith('6')) return 'DS';  // DISCOVER
        return 'UN';  // UNKNOWN
    }

    maskCard(cardNumber) {
        return cardNumber.replace(/.(?=.{4})/g, '*');
    }
}

// Run the charge command
if (require.main === module) {
    const command = new ChargeCommand();
    command.executeCharge().catch(error => {
        console.error('💥 Charge command crashed:', error);
        process.exit(1);
    });
}

module.exports = ChargeCommand;
