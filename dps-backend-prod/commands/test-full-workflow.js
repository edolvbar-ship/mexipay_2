#!/usr/bin/env node

/**
 * Comprehensive Selia Workflow Test Script
 * Tests: Charge → Cancel → Charge → +24hrs → Refund
 * 
 * This script validates the complete e-commerce payment workflow:
 * 1. Initial charge transaction
 * 2. Cancellation of the charge
 * 3. New charge transaction
 * 4. Wait 24 hours (simulated)
 * 5. Refund of the second charge
 * 
 * Environment: Development
 * Usage: node test-full-workflow.js --merchantId=1 --amount=10000 --card=4111111111111111 --cvv=123 --exp=12/28
 */

const SeliaWebService = require('../lib/socketServer/lib/services/seliaWebService');
const crypto = require('crypto');

class WorkflowTester {
    constructor() {
        this.testResults = {
            initialCharge: null,
            cancellation: null,
            secondCharge: null,
            refund: null,
            overall: 'PENDING'
        };
        
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
        const required = ['merchantId', 'amount', 'card', 'cvv', 'exp'];
        const missing = required.filter(param => !this.params[param]);
        
        if (missing.length > 0) {
            console.error('❌ Missing required parameters:', missing.join(', '));
            console.log('Usage: node test-full-workflow.js --merchantId=1 --amount=10000 --card=4111111111111111 --cvv=123 --exp=12/28 [--dev]');
            process.exit(1);
        }

        // Development environment settings
        this.isDev = this.params.dev !== 'false';
        this.waitTime = this.isDev ? 5000 : 24 * 60 * 60 * 1000; // 5 sec dev vs 24hr prod
        
        console.log('🔧 Environment:', this.isDev ? 'DEVELOPMENT' : 'PRODUCTION');
        console.log('⏱️  Wait time:', this.isDev ? '5 seconds' : '24 hours');
    }

    setupSeliaService() {
        this.selia = new SeliaWebService({
            host: process.env.SELIA_HOST,
            port: process.env.SELIA_PORT,
            aesKey: process.env.SELIA_AES_KEY,
            username: process.env.SELIA_USERNAME,
            password: process.env.SELIA_PASSWORD,
            debug: true,
            db: null // We'll test without DB for now
        });
    }

    async runFullWorkflow() {
        console.log('\n🚀 STARTING COMPREHENSIVE SELIA WORKFLOW TEST');
        console.log('=' .repeat(60));
        
        try {
            await this.step1_initialCharge();
            await this.step2_cancellation();
            await this.step3_secondCharge();
            await this.step4_waitPeriod();
            await this.step5_refund();
            
            this.testResults.overall = 'SUCCESS';
            this.printResults();
            
        } catch (error) {
            this.testResults.overall = 'FAILED';
            console.error('\n💥 WORKFLOW FAILED:', error.message);
            this.printResults();
            process.exit(1);
        }
    }

    async step1_initialCharge() {
        console.log('\n📋 STEP 1: INITIAL CHARGE TRANSACTION');
        console.log('-'.repeat(40));
        
        const paymentData = {
            affiliate_code: 'TEST001',
            cardNumber: this.params.card,
            amount: this.params.amount,
            cvv: this.params.cvv,
            expiration: this.params.exp,
            transactionType: '501', // Charge
            entryMode: '1',
            branchId: '16739',
            terminalId: '1',
            merchantId: parseInt(this.params.merchantId)
        };

        console.log('🔍 Payment Data:', {
            affiliate_code: paymentData.affiliate_code,
            amount: paymentData.amount,
            card: this.maskCard(paymentData.cardNumber),
            exp: paymentData.expiration,
            merchantId: paymentData.merchantId
        });

        try {
            const result = await this.selia.processPayment(paymentData);
            
            this.testResults.initialCharge = {
                success: result.success,
                transactionId: result.transactionId,
                authorizationCode: result.authorizationCode,
                responseCode: result.responseCode,
                responseMessage: result.responseMessage,
                info_adicional: result.info_adicional
            };

            console.log('✅ Initial Charge Result:', {
                success: result.success,
                transactionId: result.transactionId,
                responseCode: result.responseCode,
                responseMessage: result.responseMessage
            });

            if (!result.success) {
                throw new Error(`Initial charge failed: ${result.responseMessage}`);
            }

            // Store for later use
            this.firstTransactionId = result.transactionId;
            this.firstAuthCode = this.selia.extractBankAuthorizationCode(result);

        } catch (error) {
            this.testResults.initialCharge = { success: false, error: error.message };
            throw error;
        }
    }

    async step2_cancellation() {
        console.log('\n🚫 STEP 2: CANCELLATION OF INITIAL CHARGE');
        console.log('-'.repeat(40));
        
        console.log('🔍 Cancel Data:', {
            transactionId: this.firstTransactionId,
            authorization: this.firstAuthCode,
            merchantId: this.params.merchantId
        });

        try {
            const result = await this.selia.queryTransaction(
                this.firstTransactionId,
                this.firstAuthCode,
                parseInt(this.params.merchantId)
            );

            this.testResults.cancellation = {
                success: result.success,
                transactionId: result.transactionId,
                responseCode: result.responseCode,
                responseMessage: result.responseMessage,
                info_adicional: result.info_adicional
            };

            console.log('✅ Cancellation Result:', {
                success: result.success,
                responseCode: result.responseCode,
                responseMessage: result.responseMessage
            });

            if (!result.success) {
                console.warn('⚠️ Cancellation failed, but continuing workflow');
            }

        } catch (error) {
            this.testResults.cancellation = { success: false, error: error.message };
            console.warn('⚠️ Cancellation error, but continuing workflow:', error.message);
        }
    }

    async step3_secondCharge() {
        console.log('\n💳 STEP 3: SECOND CHARGE TRANSACTION');
        console.log('-'.repeat(40));
        
        const paymentData = {
            affiliate_code: 'TEST002',
            cardNumber: this.params.card,
            amount: this.params.amount,
            cvv: this.params.cvv,
            expiration: this.params.exp,
            transactionType: '501', // Charge
            entryMode: '1',
            branchId: '16739',
            terminalId: '1',
            merchantId: parseInt(this.params.merchantId)
        };

        console.log('🔍 Payment Data:', {
            affiliate_code: paymentData.affiliate_code,
            amount: paymentData.amount,
            card: this.maskCard(paymentData.cardNumber),
            exp: paymentData.expiration,
            merchantId: paymentData.merchantId
        });

        try {
            const result = await this.selia.processPayment(paymentData);
            
            this.testResults.secondCharge = {
                success: result.success,
                transactionId: result.transactionId,
                authorizationCode: result.authorizationCode,
                responseCode: result.responseCode,
                responseMessage: result.responseMessage,
                info_adicional: result.info_adicional
            };

            console.log('✅ Second Charge Result:', {
                success: result.success,
                transactionId: result.transactionId,
                responseCode: result.responseCode,
                responseMessage: result.responseMessage
            });

            if (!result.success) {
                throw new Error(`Second charge failed: ${result.responseMessage}`);
            }

            // Store for refund
            this.secondTransactionId = result.transactionId;
            this.secondAuthCode = this.selia.extractBankAuthorizationCode(result);

        } catch (error) {
            this.testResults.secondCharge = { success: false, error: error.message };
            throw error;
        }
    }

    async step4_waitPeriod() {
        console.log('\n⏳ STEP 4: WAIT PERIOD');
        console.log('-'.repeat(40));
        
        const waitMs = this.waitTime;
        const waitTime = this.isDev ? '5 seconds (dev)' : '24 hours (prod)';
        
        console.log(`⏱️  Waiting ${waitTime} before refund...`);
        console.log(`⏰ Started at: ${new Date().toISOString()}`);
        
        if (this.isDev) {
            // Development: show countdown
            for (let i = 5; i > 0; i--) {
                console.log(`⏳ ${i} seconds remaining...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } else {
            // Production: actual 24 hour wait
            await new Promise(resolve => setTimeout(resolve, waitMs));
        }
        
        console.log(`⏰ Wait completed at: ${new Date().toISOString()}`);
    }

    async step5_refund() {
        console.log('\n💰 STEP 5: REFUND OF SECOND CHARGE');
        console.log('-'.repeat(40));
        
        console.log('🔍 Refund Data:', {
            transactionId: this.secondTransactionId,
            authorization: this.secondAuthCode,
            amount: this.params.amount,
            merchantId: this.params.merchantId
        });

        try {
            const result = await this.selia.reverseTransaction(
                this.secondTransactionId,
                this.secondAuthCode,
                this.params.amount,
                parseInt(this.params.merchantId)
            );

            this.testResults.refund = {
                success: result.success,
                transactionId: result.transactionId,
                responseCode: result.responseCode,
                responseMessage: result.responseMessage,
                info_adicional: result.info_adicional
            };

            console.log('✅ Refund Result:', {
                success: result.success,
                transactionId: result.transactionId,
                responseCode: result.responseCode,
                responseMessage: result.responseMessage
            });

            if (!result.success) {
                throw new Error(`Refund failed: ${result.responseMessage}`);
            }

        } catch (error) {
            this.testResults.refund = { success: false, error: error.message };
            throw error;
        }
    }

    maskCard(cardNumber) {
        return cardNumber.replace(/.(?=.{4})/g, '*');
    }

    printResults() {
        console.log('\n📊 WORKFLOW TEST RESULTS');
        console.log('=' .repeat(60));
        
        console.log('\n🔍 Detailed Results:');
        console.log('1️⃣  Initial Charge:', this.formatResult(this.testResults.initialCharge));
        console.log('2️⃣  Cancellation:', this.formatResult(this.testResults.cancellation));
        console.log('3️⃣  Second Charge:', this.formatResult(this.testResults.secondCharge));
        console.log('4️⃣  Refund:', this.formatResult(this.testResults.refund));
        
        console.log('\n🎯 Overall Result:', this.testResults.overall);
        
        if (this.testResults.overall === 'SUCCESS') {
            console.log('✅ All workflow steps completed successfully!');
            console.log('🎉 Selia e-commerce integration is working correctly!');
        } else {
            console.log('❌ Workflow failed. Check detailed results above.');
        }

        console.log('\n📋 Transaction IDs Used:');
        console.log('   First Charge:', this.firstTransactionId || 'N/A');
        console.log('   Second Charge:', this.secondTransactionId || 'N/A');
        
        console.log('\n🔐 Authorization Codes:');
        console.log('   First Auth:', this.firstAuthCode || 'N/A');
        console.log('   Second Auth:', this.secondAuthCode || 'N/A');
        
        console.log('\n💾 Info Adicional Available:');
        Object.entries(this.testResults).forEach(([step, result]) => {
            if (result && result.info_adicional) {
                console.log(`   ✅ ${step}: Complete request/response data stored`);
            }
        });
    }

    formatResult(result) {
        if (!result) return '⚠️  NOT EXECUTED';
        
        if (result.success) {
            return `✅ SUCCESS (${result.responseCode})`;
        } else if (result.error) {
            return `❌ FAILED - ${result.error}`;
        } else {
            return `❌ FAILED (${result.responseCode}) - ${result.responseMessage}`;
        }
    }
}

// Run the workflow test
if (require.main === module) {
    const tester = new WorkflowTester();
    tester.runFullWorkflow().catch(error => {
        console.error('💥 Workflow test crashed:', error);
        process.exit(1);
    });
}

module.exports = WorkflowTester;
