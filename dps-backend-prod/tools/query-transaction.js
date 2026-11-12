#!/usr/bin/env node

/**
 * Transaction Object Query Utility
 * Demonstrates the power of single-file transaction storage
 */

const TransactionObjectService = require('../lib/socketServer/lib/services/transactionObjectService');
require('dotenv').config();

// MX Timezone utility
function formatMXTime(utcTimestamp) {
    if (!utcTimestamp) return 'N/A';
    
    try {
        const date = new Date(utcTimestamp);
        // Convert to Mexico City timezone (CDT/CST)
        const mxTime = new Intl.DateTimeFormat('es-MX', {
            timeZone: 'America/Mexico_City',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).format(date);
        
        return mxTime;
    } catch (error) {
        return utcTimestamp; // fallback to original
    }
}

class TransactionQueryTool {
    constructor() {
        this.txnService = new TransactionObjectService();
    }

    async getTransaction(transactionId, merchantId) {
        try {
            console.log(`🔍 Fetching transaction ${transactionId} for merchant ${merchantId}...`);
            const txn = await this.txnService.getTransactionById(transactionId, merchantId);
            
            console.log('\n📋 COMPLETE TRANSACTION LIFECYCLE:');
            console.log('='.repeat(50));
            
            // Basic info
            console.log(`\n📝 Transaction Info:`);
            console.log(`   ID: ${txn.log.transactionId}`);
            console.log(`   Order: ${txn.log.orderId}`);
            console.log(`   Source: ${txn.log.source}`);
            console.log(`   Created: ${txn.log.createdAt} (UTC) | ${formatMXTime(txn.log.createdAt)} (MX)`);
            
            // Charge details
            if (txn.lifecycle.charge) {
                console.log(`\n💳 Charge Process:`);
                console.log(`   Timestamp: ${txn.lifecycle.charge.timestamp} (UTC) | ${formatMXTime(txn.lifecycle.charge.timestamp)} (MX)`);
                console.log(`   Amount: ${txn.lifecycle.charge.request.paymentData.amount}`);
                console.log(`   Card: ${txn.lifecycle.charge.request.paymentData.cardNumber?.replace(/\d(?=\d{4})/g, '*')}`);
                console.log(`   Success: ${txn.lifecycle.charge.response.seliaResult.success}`);
                console.log(`   Auth Code: ${txn.lifecycle.charge.response.seliaResult.authorizationCode}`);
                
                if (txn.lifecycle.charge.response.parsedFields) {
                    console.log(`   Field 8 (Selia ID): ${txn.lifecycle.charge.response.parsedFields['8']}`);
                    console.log(`   Field 50 (Bank Auth): ${txn.lifecycle.charge.response.parsedFields['50']}`);
                }
            }
            
            // Cancel details
            if (txn.lifecycle.cancel) {
                console.log(`\n🚫 Cancel Process:`);
                console.log(`   Timestamp: ${txn.lifecycle.cancel.timestamp} (UTC) | ${formatMXTime(txn.lifecycle.cancel.timestamp)} (MX)`);
                console.log(`   Success: ${txn.lifecycle.cancel.response.cancelResult.success}`);
                console.log(`   Response: ${txn.lifecycle.cancel.response.cancelResult.responseMessage}`);
                
                if (txn.lifecycle.cancel.response.parsedFields) {
                    console.log(`   Response Code: ${txn.lifecycle.cancel.response.parsedFields['14']}`);
                }
            }
            
            // Refund details
            if (txn.lifecycle.refund) {
                console.log(`\n💰 Refund Process:`);
                console.log(`   Timestamp: ${txn.lifecycle.refund.timestamp} (UTC) | ${formatMXTime(txn.lifecycle.refund.timestamp)} (MX)`);
                console.log(`   Success: ${txn.lifecycle.refund.response.refundResult.success}`);
                console.log(`   Response: ${txn.lifecycle.refund.response.refundResult.responseMessage}`);
            }
            
            console.log('\n' + '='.repeat(50));
            console.log('✅ Complete transaction retrieved from single file!');
            
            return txn;
        } catch (error) {
            console.error('❌ Error:', error.message);
            throw error;
        }
    }

    async searchMerchantTransactions(merchantId, filters = {}) {
        try {
            console.log(`🔍 Searching transactions for merchant ${merchantId}...`);
            
            if (filters.processType) {
                console.log(`   Filter: Only transactions with ${filters.processType} process`);
            }
            
            const transactions = await this.txnService.searchTransactions(merchantId, filters);
            
            console.log(`\n📊 Found ${transactions.length} transactions:`);
            console.log('='.repeat(80));
            
            transactions.forEach((txn, index) => {
                console.log(`\n${index + 1}. Transaction ${txn.log.transactionId}:`);
                console.log(`   Order: ${txn.log.orderId}`);
                console.log(`   Created: ${txn.log.createdAt}`);
                console.log(`   Processes: ${Object.keys(txn.lifecycle).join(', ')}`);
                
                // Show key metrics
                if (txn.lifecycle.charge) {
                    const charge = txn.lifecycle.charge;
                    console.log(`   Amount: $${parseInt(charge.request.paymentData.amount) / 100}`);
                    console.log(`   Status: ${charge.response.seliaResult.success ? '✅ Approved' : '❌ Failed'}`);
                }
                
                if (txn.lifecycle.cancel) {
                    console.log(`   Cancelled: ✅ Yes`);
                }
                
                if (txn.lifecycle.refund) {
                    console.log(`   Refunded: ✅ Yes`);
                }
            });
            
            console.log('\n' + '='.repeat(80));
            console.log(`✅ Retrieved ${transactions.length} complete transactions from single files!`);
            
            return transactions;
        } catch (error) {
            console.error('❌ Error:', error.message);
            throw error;
        }
    }

    async getProcessData(transactionId, merchantId, processType) {
        try {
            console.log(`🔍 Fetching ${processType} data for transaction ${transactionId}...`);
            
            const processData = await this.txnService.getProcessData(transactionId, merchantId, processType);
            
            if (!processData) {
                console.log(`❌ No ${processType} data found`);
                return null;
            }
            
            console.log(`\n📋 ${processType.toUpperCase()} PROCESS DATA:`);
            console.log('='.repeat(50));
            console.log(`   Timestamp: ${processData.timestamp} (UTC) | ${formatMXTime(processData.timestamp)} (MX)`);
            console.log(`   Request: ${JSON.stringify(processData.request, null, 6)}`);
            console.log(`   Response: ${JSON.stringify(processData.response, null, 6)}`);
            
            if (processData.parsedFields) {
                console.log(`   Parsed Fields: ${JSON.stringify(processData.parsedFields, null, 4)}`);
            }
            
            console.log('\n' + '='.repeat(50));
            console.log(`✅ ${processType} data retrieved from single transaction file!`);
            
            return processData;
        } catch (error) {
            console.error('❌ Error:', error.message);
            throw error;
        }
    }
}

// CLI Interface
async function main() {
    const tool = new TransactionQueryTool();
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log(`
🔍 Transaction Query Tool - Single File Demo

Usage:
  node query-transaction.js get <transactionId> <merchantId>
  node query-transaction.js search <merchantId> [--process=charge|cancel|refund]
  node query-transaction.js process <transactionId> <merchantId> <processType>

Examples:
  node query-transaction.js get 123456 60
  node query-transaction.js search 60 --process=cancel
  node query-transaction.js process 123456 60 charge
        `);
        return;
    }
    
    const command = args[0];
    
    try {
        switch (command) {
            case 'get':
                if (args.length < 3) {
                    console.log('❌ Usage: node query-transaction.js get <transactionId> <merchantId>');
                    return;
                }
                await tool.getTransaction(args[1], args[2]);
                break;
                
            case 'search':
                if (args.length < 2) {
                    console.log('❌ Usage: node query-transaction.js search <merchantId> [--process=type]');
                    return;
                }
                const merchantId = args[1];
                const filters = {};
                
                // Parse optional filters
                for (let i = 2; i < args.length; i++) {
                    if (args[i].startsWith('--process=')) {
                        filters.processType = args[i].split('=')[1];
                    }
                }
                
                await tool.searchMerchantTransactions(merchantId, filters);
                break;
                
            case 'process':
                if (args.length < 4) {
                    console.log('❌ Usage: node query-transaction.js process <transactionId> <merchantId> <processType>');
                    return;
                }
                await tool.getProcessData(args[1], args[2], args[3]);
                break;
                
            default:
                console.log(`❌ Unknown command: ${command}`);
                break;
        }
    } catch (error) {
        console.error('💥 Command failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = TransactionQueryTool;
