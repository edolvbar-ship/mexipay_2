// Test script for SeliaWebService cancel/refund functionality
// Usage: node cancel-refund-test.js --transactionId=12345 --amount=10000 --merchantId=1 --type=cancel|refund

const SeliaWebService = require('../lib/socketServer/lib/services/seliaWebService');

async function testCancelRefund() {
    const args = process.argv.slice(2);
    const params = {};

    // Parse command line arguments
    args.forEach(arg => {
        const [key, value] = arg.replace('--', '').split('=');
        params[key] = value;
    });

    if (!params.transactionId || !params.auth || !params.amount || !params.merchantId) {
        console.log('❌ Missing required parameters');
        console.log('Usage: node cancel-refund-test.js --transactionId=12345 --auth=ABC123 --amount=10000 --merchantId=1 [--type=cancel|refund]');
        process.exit(1);
    }

    const selia = new SeliaWebService({
        debug: true // Enable logging
    });

    try {
        const transactionId = params.transactionId;
        const amount = params.amount;
        const merchantId = params.merchantId;
        const type = params.type || 'refund'; // Default to refund

        console.log(`🔄 Testing ${type} for transaction: ${transactionId}`);
        console.log(`   Amount: ${amount}`);
        console.log(`   Merchant ID: ${merchantId}`);
        console.log(`   Authorization: ${params.auth}`);

        let result;

        if (type === 'refund') {
            // Use reverseTransaction for refunds (502)
            result = await selia.reverseTransaction(transactionId, amount, merchantId, params.auth);
            console.log('💰 Refund Result:', {
                success: result.success,
                responseCode: result.responseCode,
                responseMessage: result.responseMessage,
                transactionId: result.transactionId
            });
        } else if (type === 'cancel') {
            // Use queryTransaction for cancel (503)
            result = await selia.queryTransaction(transactionId, merchantId, params.auth);
            console.log('🚫 Cancel Result:', {
                success: result.success,
                responseCode: result.responseCode,
                responseMessage: result.responseMessage,
                transactionId: result.transactionId
            });
        } else {
            throw new Error('Invalid type. Use "cancel" or "refund"');
        }

        if (result.success) {
            console.log('✅ Operation completed successfully');
        } else {
            console.log('❌ Operation failed');
        }

    } catch (error) {
        console.error('💥 Test failed:', error.message);
        process.exit(1);
    }
}

testCancelRefund();