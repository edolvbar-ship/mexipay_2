#!/usr/bin/env node

/**
 * Sandbox Test Script - Tests the /payments/affiliate/payment endpoint
 * against the local server using curl, following the Integration Guide.
 *
 * Usage:
 *   node commands/sandbox-check.js                    # Run all test scenarios
 *   node commands/sandbox-check.js --scenario=approved  # Run specific scenario
 *   node commands/sandbox-check.js --base-url=http://localhost:3002  # Custom URL
 *
 * Requirements:
 *   - Server must be running (npm start / node app.js)
 *   - SELIA_ISO_MODE must be set to DEV in .env
 *   - A valid affiliate_code must exist in the database
 */

require('dotenv').config();

const { execSync } = require('child_process');
const paymentValidator = require('../lib/socketServer/lib/services/paymentValidator');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3002';
const AFFILIATE_CODE = process.env.SANDBOX_AFFILIATE_CODE || '1';

const TEST_SCENARIOS = [
    {
        name: 'VISA Approved',
        card: '4111111111111111',
        expectedStatus: 'approved',
        expectedSuccess: true,
        description: 'Transacción exitosa con VISA'
    },
    {
        name: 'VISA Insufficient Funds',
        card: '4111111111111112',
        expectedStatus: 'declined',
        expectedSuccess: false,
        expectedError: 'insufficient_funds',
        description: 'Fondos insuficientes'
    },
    {
        name: 'VISA Card Declined',
        card: '4111111111111113',
        expectedStatus: 'declined',
        expectedSuccess: false,
        expectedError: 'card_declined',
        description: 'Tarjeta declinada'
    },
    {
        name: 'Mastercard Approved',
        card: '5555555555554444',
        expectedStatus: 'approved',
        expectedSuccess: true,
        description: 'Transacción exitosa con Mastercard'
    },
    {
        name: 'Mastercard Processor Error',
        card: '5555555555554445',
        expectedStatus: 'declined',
        expectedSuccess: false,
        expectedError: 'processor_error',
        description: 'Error del procesador'
    },
    {
        name: 'VISA 4242 Approved',
        card: '4242424242424242',
        expectedStatus: 'approved',
        expectedSuccess: true,
        description: 'Transacción exitosa con VISA 4242'
    },
    {
        name: 'Non-Test Card in Dev (should be rejected)',
        card: '4000000000000002',
        expectedStatus: 'rejected',
        expectedSuccess: false,
        expectedErrorCode: 'non_test_card_in_dev',
        description: 'Tarjeta no de prueba en ambiente dev - debe ser rechazada'
    }
];

function buildRequestBody(scenario) {
    const orderId = `T${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`.substring(0, 15);
    return {
        affiliate_code: AFFILIATE_CODE,
        order_id: orderId,
        amount: 150.50,
        currency: 'MXN',
        description: `Pago de prueba - ${scenario.name}`,
        card: {
            number: scenario.card,
            exp_month: '12',
            exp_year: '2028',
            cvv: '123',
            holder_name: 'JUAN PEREZ'
        },
        customer: {
            name: 'Juan Perez',
            email: 'juan@email.com',
            phone: '+525512345678'
        },
        billing_address: {
            street: 'Av. Principal 123',
            city: 'Ciudad de Mexico',
            state: 'CDMX',
            country: 'MX',
            postal_code: '12345'
        }
    };
}

function runCurlRequest(scenario) {
    const body = buildRequestBody(scenario);
    const jsonBody = JSON.stringify(body);

    const curlCommand = [
        'curl',
        '-s',
        '-w', '"\\n__HTTP_STATUS__:%{http_code}"',
        '-X', 'POST',
        `${BASE_URL}/payments/affiliate/payment`,
        '-H', '"Content-Type: application/json"',
        '-H', '"User-Agent: SandboxTest/1.0"',
        '-H', '"Accept: application/json"',
        '-d', `'${jsonBody.replace(/'/g, "'\\''")}'`,
        '--max-time', '30'
    ].join(' ');

    try {
        const output = execSync(curlCommand, { encoding: 'utf8', timeout: 35000 });
        const lines = output.split('\n');
        const httpStatusMatch = lines[lines.length - 1].match(/__HTTP_STATUS__:(\d+)/);
        const httpStatus = httpStatusMatch ? httpStatusMatch[1] : 'unknown';
        const responseBody = lines.slice(0, -1).join('\n');

        return {
            httpStatus,
            body: responseBody,
            parsed: JSON.parse(responseBody)
        };
    } catch (error) {
        return {
            httpStatus: 'error',
            body: error.message,
            parsed: null
        };
    }
}

function validateResponse(scenario, result) {
    const checks = [];
    const p = result.parsed;

    if (!p) {
        checks.push({ check: 'Response is valid JSON', passed: false, detail: 'No JSON response' });
        return checks;
    }


    if (scenario.expectedSuccess !== undefined) {
        const passed = p.success === scenario.expectedSuccess;
        checks.push({
            check: `success === ${scenario.expectedSuccess}`,
            passed,
            detail: `Got: ${p.success}`
        });
    }

    if (scenario.expectedStatus && p.status) {
        const passed = p.status === scenario.expectedStatus;
        checks.push({
            check: `status === "${scenario.expectedStatus}"`,
            passed,
            detail: `Got: "${p.status}"`
        });
    }

    if (scenario.expectedError && p.error) {
        const passed = p.error.code === scenario.expectedError || (p.responseMessage || '').includes(scenario.expectedError);
        checks.push({
            check: `error contains "${scenario.expectedError}"`,
            passed,
            detail: `Got: ${p.error?.code || p.responseMessage || 'N/A'}`
        });
    }

    if (scenario.expectedErrorCode && p.error) {
        const passed = p.error.code === scenario.expectedErrorCode;
        checks.push({
            check: `error.code === "${scenario.expectedErrorCode}"`,
            passed,
            detail: `Got: "${p.error.code}"`
        });
    }

    if (scenario.expectedSuccess && p.success) {
        const hasTxnId = !!p.transaction_id || !!p.transactionId;
        checks.push({
            check: 'transaction_id present',
            passed: hasTxnId,
            detail: `Got: ${p.transaction_id || p.transactionId || 'N/A'}`
        });

        const hasAuthCode = !!p.authorization_code || !!p.authorizationCode;
        checks.push({
            check: 'authorization_code present',
            passed: hasAuthCode,
            detail: `Got: ${p.authorization_code || p.authorizationCode || 'N/A'}`
        });
    }

    return checks;
}

function printResult(scenario, result, checks) {
    const allPassed = checks.length > 0 && checks.every(c => c.passed);
    const icon = allPassed ? '✅' : '❌';
    const httpIcon = result.httpStatus === '200' || result.httpStatus === '403' ? '✅' : '⚠️';

    console.log(`\n${'─'.repeat(70)}`);
    console.log(`${icon} ${scenario.name}`);
    console.log(`   ${scenario.description}`);
    console.log(`   Card: ${scenario.card}`);
    console.log(`   HTTP Status: ${httpIcon} ${result.httpStatus}`);

    if (result.parsed) {
        console.log(`   success: ${result.parsed.success}`);
        if (result.parsed.status) console.log(`   status: ${result.parsed.status}`);
        if (result.parsed.transaction_id) console.log(`   transaction_id: ${result.parsed.transaction_id}`);
        if (result.parsed.transactionId) console.log(`   transactionId: ${result.parsed.transactionId}`);
        if (result.parsed.authorization_code) console.log(`   authorization_code: ${result.parsed.authorization_code}`);
        if (result.parsed.authorizationCode) console.log(`   authorizationCode: ${result.parsed.authorizationCode}`);
        if (result.parsed.error) console.log(`   error: ${JSON.stringify(result.parsed.error)}`);
        if (result.parsed.responseMessage) console.log(`   responseMessage: ${result.parsed.responseMessage}`);
        if (result.parsed.responseCode) console.log(`   responseCode: ${result.parsed.responseCode}`);
        if (result.parsed._sandbox) console.log(`   _sandbox: ${result.parsed._sandbox}`);
        if (result.parsed._scenario) console.log(`   _scenario: ${result.parsed._scenario}`);

        // For approved scenarios in DEV mode, the transaction travels to real Selia.
        // Show the full raw response so the integrator can see Selia's actual reply.
        const isDev = (process.env.SELIA_ISO_MODE || '').toUpperCase() === 'DEV';
        const isApprovedScenario = scenario.expectedSuccess === true;
        if (isDev && isApprovedScenario) {
            console.log(`\n   📨 Full Selia Gateway Response:`);
            console.log(`   ${'─'.repeat(66)}`);
            console.log(`   ${JSON.stringify(result.parsed, null, 2).split('\n').join('\n   ')}`);
            console.log(`   ${'─'.repeat(66)}`);
        }
    } else {
        console.log(`   Raw: ${result.body}`);
    }

    console.log(`\n   Validations:`);
    checks.forEach(c => {
        console.log(`   ${c.passed ? '✅' : '❌'} ${c.check} ${c.passed ? '' : `→ ${c.detail}`}`);
    });
}

// ==================== PAYLOAD VALIDATION TEST CASES ====================
const VALIDATION_SCENARIOS = [
    {
        name: 'Valid Full Payload',
        payload: {
            affiliate_code: '1',
            order_id: 'ORD-123',
            amount: 150.50,
            currency: 'MXN',
            card: { number: '4111111111111111', exp_month: '12', exp_year: '2028', cvv: '123', holder_name: 'JUAN PEREZ' },
            customer: { name: 'Juan Perez', email: 'juan@email.com' },
            billing_address: { street: 'Av. Principal 123', city: 'CDMX', state: 'CDMX', country: 'MX', postal_code: '12345' }
        },
        expectValid: true,
        description: 'Payload completo y válido'
    },
    {
        name: 'Missing affiliate_code',
        payload: {
            order_id: 'ORD-123', amount: 150.50,
            card: { number: '4111111111111111', exp_month: '12', exp_year: '2028', cvv: '123' }
        },
        expectValid: false,
        expectedCode: 'missing_fields',
        description: 'Falta affiliate_code'
    },
    {
        name: 'Missing order_id',
        payload: {
            affiliate_code: '1', amount: 150.50,
            card: { number: '4111111111111111', exp_month: '12', exp_year: '2028', cvv: '123' }
        },
        expectValid: false,
        expectedCode: 'missing_fields',
        description: 'Falta order_id'
    },
    {
        name: 'Missing amount',
        payload: {
            affiliate_code: '1', order_id: 'ORD-123',
            card: { number: '4111111111111111', exp_month: '12', exp_year: '2028', cvv: '123' }
        },
        expectValid: false,
        expectedCode: 'missing_fields',
        description: 'Falta amount'
    },
    {
        name: 'Missing card object',
        payload: {
            affiliate_code: '1', order_id: 'ORD-123', amount: 150.50
        },
        expectValid: false,
        expectedCode: 'missing_fields',
        description: 'Falta el objeto card'
    },
    {
        name: 'Missing card.number',
        payload: {
            affiliate_code: '1', order_id: 'ORD-123', amount: 150.50,
            card: { exp_month: '12', exp_year: '2028', cvv: '123' }
        },
        expectValid: false,
        expectedCode: 'missing_fields',
        description: 'Falta card.number'
    },
    {
        name: 'Missing card.cvv',
        payload: {
            affiliate_code: '1', order_id: 'ORD-123', amount: 150.50,
            card: { number: '4111111111111111', exp_month: '12', exp_year: '2028' }
        },
        expectValid: false,
        expectedCode: 'missing_fields',
        description: 'Falta card.cvv'
    },
    {
        name: 'Negative amount',
        payload: {
            affiliate_code: '1', order_id: 'ORD-123', amount: -50.00,
            card: { number: '4111111111111111', exp_month: '12', exp_year: '2028', cvv: '123' }
        },
        expectValid: false,
        expectedCode: 'invalid_amount',
        description: 'Monto negativo'
    },
    {
        name: 'Zero amount',
        payload: {
            affiliate_code: '1', order_id: 'ORD-123', amount: 0,
            card: { number: '4111111111111111', exp_month: '12', exp_year: '2028', cvv: '123' }
        },
        expectValid: false,
        expectedCode: 'invalid_amount',
        description: 'Monto en cero'
    },
    {
        name: 'Non-numeric amount',
        payload: {
            affiliate_code: '1', order_id: 'ORD-123', amount: 'abc',
            card: { number: '4111111111111111', exp_month: '12', exp_year: '2028', cvv: '123' }
        },
        expectValid: false,
        expectedCode: 'invalid_amount',
        description: 'Monto no numérico'
    },
    {
        name: 'Card number too short',
        payload: {
            affiliate_code: '1', order_id: 'ORD-123', amount: 150.50,
            card: { number: '4111111111111', exp_month: '12', exp_year: '2028', cvv: '123' }
        },
        expectValid: false,
        expectedCode: 'invalid_card',
        description: 'Tarjeta con menos de 16 dígitos'
    },
    {
        name: 'Card number with letters',
        payload: {
            affiliate_code: '1', order_id: 'ORD-123', amount: 150.50,
            card: { number: '41111111111111AB', exp_month: '12', exp_year: '2028', cvv: '123' }
        },
        expectValid: false,
        expectedCode: 'invalid_card',
        description: 'Tarjeta con caracteres no numéricos'
    },
    {
        name: 'Unsupported card brand (Amex)',
        payload: {
            affiliate_code: '1', order_id: 'ORD-123', amount: 150.50,
            card: { number: '378282246310005', exp_month: '12', exp_year: '2028', cvv: '1234' }
        },
        expectValid: false,
        expectedCode: 'invalid_card',
        description: 'Tarjeta American Express no soportada'
    },
    {
        name: 'Invalid exp_month (13)',
        payload: {
            affiliate_code: '1', order_id: 'ORD-123', amount: 150.50,
            card: { number: '4111111111111111', exp_month: '13', exp_year: '2028', cvv: '123' }
        },
        expectValid: false,
        expectedCode: 'invalid_expiry',
        description: 'Mes de expiración 13 (inválido)'
    },
    {
        name: 'Invalid exp_month (0)',
        payload: {
            affiliate_code: '1', order_id: 'ORD-123', amount: 150.50,
            card: { number: '4111111111111111', exp_month: '0', exp_year: '2028', cvv: '123' }
        },
        expectValid: false,
        expectedCode: 'invalid_expiry',
        description: 'Mes de expiración 0 (inválido)'
    },
    {
        name: 'Expired card (past year)',
        payload: {
            affiliate_code: '1', order_id: 'ORD-123', amount: 150.50,
            card: { number: '4111111111111111', exp_month: '12', exp_year: '2020', cvv: '123' }
        },
        expectValid: false,
        expectedCode: 'expired_card',
        description: 'Tarjeta expirada (año 2020)'
    },
    {
        name: 'Expired card (past month this year)',
        payload: {
            affiliate_code: '1', order_id: 'ORD-123', amount: 150.50,
            card: { number: '4111111111111111', exp_month: '01', exp_year: String(new Date().getFullYear() - 1), cvv: '123' }
        },
        expectValid: false,
        expectedCode: 'expired_card',
        description: 'Tarjeta expirada (mes enero del año pasado)'
    },
    {
        name: 'CVV with 2 digits',
        payload: {
            affiliate_code: '1', order_id: 'ORD-123', amount: 150.50,
            card: { number: '4111111111111111', exp_month: '12', exp_year: '2028', cvv: '12' }
        },
        expectValid: false,
        expectedCode: 'invalid_cvv',
        description: 'CVV con solo 2 dígitos'
    },
    {
        name: 'CVV with letters',
        payload: {
            affiliate_code: '1', order_id: 'ORD-123', amount: 150.50,
            card: { number: '4111111111111111', exp_month: '12', exp_year: '2028', cvv: 'abc' }
        },
        expectValid: false,
        expectedCode: 'invalid_cvv',
        description: 'CVV con letras'
    },
    {
        name: 'Invalid currency (USD)',
        payload: {
            affiliate_code: '1', order_id: 'ORD-123', amount: 150.50, currency: 'USD',
            card: { number: '4111111111111111', exp_month: '12', exp_year: '2028', cvv: '123' }
        },
        expectValid: false,
        expectedCode: 'invalid_currency',
        description: 'Moneda USD no soportada'
    },
    {
        name: 'order_id too long (>50 chars)',
        payload: {
            affiliate_code: '1', order_id: 'A'.repeat(51), amount: 150.50,
            card: { number: '4111111111111111', exp_month: '12', exp_year: '2028', cvv: '123' }
        },
        expectValid: false,
        expectedCode: 'invalid_order_id',
        description: 'order_id excede 50 caracteres'
    },
    {
        name: 'Valid VISA with dashes in card',
        payload: {
            affiliate_code: '1', order_id: 'ORD-123', amount: 150.50,
            card: { number: '4111-1111-1111-1111', exp_month: '12', exp_year: '2028', cvv: '123' }
        },
        expectValid: true,
        description: 'Tarjeta VISA con guiones (debe ser aceptada)'
    },
    {
        name: 'Valid Mastercard',
        payload: {
            affiliate_code: '1', order_id: 'ORD-123', amount: 150.50,
            card: { number: '5555555555554444', exp_month: '06', exp_year: '2029', cvv: '456' }
        },
        expectValid: true,
        description: 'Mastercard válida'
    },
    {
        name: 'Valid 4-digit CVV (Amex-style)',
        payload: {
            affiliate_code: '1', order_id: 'ORD-123', amount: 150.50,
            card: { number: '4111111111111111', exp_month: '12', exp_year: '2028', cvv: '1234' }
        },
        expectValid: true,
        description: 'CVV de 4 dígitos (válido)'
    }
];

// ==================== E2E BAD PAYLOAD TEST CASES ====================
const E2E_BAD_PAYLOAD_SCENARIOS = [
    {
        name: 'E2E: Missing affiliate_code',
        payload: {
            order_id: 'ORD-123', amount: 150.50, currency: 'MXN',
            card: { number: '4111111111111111', exp_month: '12', exp_year: '2028', cvv: '123' }
        },
        expectedHttpStatus: '400',
        expectedErrorCode: 'missing_fields',
        description: 'Servidor debe rechazar payload sin affiliate_code'
    },
    {
        name: 'E2E: Missing order_id',
        payload: {
            affiliate_code: AFFILIATE_CODE, amount: 150.50, currency: 'MXN',
            card: { number: '4111111111111111', exp_month: '12', exp_year: '2028', cvv: '123' }
        },
        expectedHttpStatus: '400',
        expectedErrorCode: 'missing_fields',
        description: 'Servidor debe rechazar payload sin order_id'
    },
    {
        name: 'E2E: Missing card object',
        payload: {
            affiliate_code: AFFILIATE_CODE, order_id: 'ORD-123', amount: 150.50, currency: 'MXN'
        },
        expectedHttpStatus: '400',
        expectedErrorCode: 'missing_fields',
        description: 'Servidor debe rechazar payload sin objeto card'
    },
    {
        name: 'E2E: Missing card.number',
        payload: {
            affiliate_code: AFFILIATE_CODE, order_id: 'ORD-123', amount: 150.50, currency: 'MXN',
            card: { exp_month: '12', exp_year: '2028', cvv: '123' }
        },
        expectedHttpStatus: '400',
        expectedErrorCode: 'missing_fields',
        description: 'Servidor debe rechazar payload sin card.number'
    },
    {
        name: 'E2E: Missing card.cvv',
        payload: {
            affiliate_code: AFFILIATE_CODE, order_id: 'ORD-123', amount: 150.50, currency: 'MXN',
            card: { number: '4111111111111111', exp_month: '12', exp_year: '2028' }
        },
        expectedHttpStatus: '400',
        expectedErrorCode: 'missing_fields',
        description: 'Servidor debe rechazar payload sin card.cvv'
    },
    {
        name: 'E2E: Negative amount',
        payload: {
            affiliate_code: AFFILIATE_CODE, order_id: 'ORD-123', amount: -50.00, currency: 'MXN',
            card: { number: '4111111111111111', exp_month: '12', exp_year: '2028', cvv: '123' }
        },
        expectedHttpStatus: '400',
        expectedErrorCode: 'invalid_amount',
        description: 'Servidor debe rechazar monto negativo'
    },
    {
        name: 'E2E: Zero amount',
        payload: {
            affiliate_code: AFFILIATE_CODE, order_id: 'ORD-123', amount: 0, currency: 'MXN',
            card: { number: '4111111111111111', exp_month: '12', exp_year: '2028', cvv: '123' }
        },
        expectedHttpStatus: '400',
        expectedErrorCode: 'invalid_amount',
        description: 'Servidor debe rechazar monto en cero'
    },
    {
        name: 'E2E: Amount as string',
        payload: {
            affiliate_code: AFFILIATE_CODE, order_id: 'ORD-123', amount: 'abc', currency: 'MXN',
            card: { number: '4111111111111111', exp_month: '12', exp_year: '2028', cvv: '123' }
        },
        expectedHttpStatus: '400',
        expectedErrorCode: 'invalid_amount',
        description: 'Servidor debe rechazar monto no numérico'
    },
    {
        name: 'E2E: Card number too short',
        payload: {
            affiliate_code: AFFILIATE_CODE, order_id: 'ORD-123', amount: 150.50, currency: 'MXN',
            card: { number: '4111111111111', exp_month: '12', exp_year: '2028', cvv: '123' }
        },
        expectedHttpStatus: '400',
        expectedErrorCode: 'invalid_card',
        description: 'Servidor debe rechazar tarjeta con menos de 16 dígitos'
    },
    {
        name: 'E2E: Unsupported card brand (Amex)',
        payload: {
            affiliate_code: AFFILIATE_CODE, order_id: 'ORD-123', amount: 150.50, currency: 'MXN',
            card: { number: '378282246310005', exp_month: '12', exp_year: '2028', cvv: '1234' }
        },
        expectedHttpStatus: '400',
        expectedErrorCode: 'invalid_card',
        description: 'Servidor debe rechazar tarjeta American Express'
    },
    {
        name: 'E2E: Invalid exp_month (13)',
        payload: {
            affiliate_code: AFFILIATE_CODE, order_id: 'ORD-123', amount: 150.50, currency: 'MXN',
            card: { number: '4111111111111111', exp_month: '13', exp_year: '2028', cvv: '123' }
        },
        expectedHttpStatus: '400',
        expectedErrorCode: 'invalid_expiry',
        description: 'Servidor debe rechazar mes 13'
    },
    {
        name: 'E2E: Expired card',
        payload: {
            affiliate_code: AFFILIATE_CODE, order_id: 'ORD-123', amount: 150.50, currency: 'MXN',
            card: { number: '4111111111111111', exp_month: '01', exp_year: '2020', cvv: '123' }
        },
        expectedHttpStatus: '400',
        expectedErrorCode: 'expired_card',
        description: 'Servidor debe rechazar tarjeta expirada'
    },
    {
        name: 'E2E: CVV with 2 digits',
        payload: {
            affiliate_code: AFFILIATE_CODE, order_id: 'ORD-123', amount: 150.50, currency: 'MXN',
            card: { number: '4111111111111111', exp_month: '12', exp_year: '2028', cvv: '12' }
        },
        expectedHttpStatus: '400',
        expectedErrorCode: 'invalid_cvv',
        description: 'Servidor debe rechazar CVV de 2 dígitos'
    },
    {
        name: 'E2E: Invalid currency (USD)',
        payload: {
            affiliate_code: AFFILIATE_CODE, order_id: 'ORD-123', amount: 150.50, currency: 'USD',
            card: { number: '4111111111111111', exp_month: '12', exp_year: '2028', cvv: '123' }
        },
        expectedHttpStatus: '400',
        expectedErrorCode: 'invalid_currency',
        description: 'Servidor debe rechazar moneda USD'
    },
    {
        name: 'E2E: Empty payload',
        payload: {},
        expectedHttpStatus: '400',
        expectedErrorCode: 'missing_fields',
        description: 'Servidor debe rechazar payload vacío'
    },
    {
        name: 'E2E: Card as string instead of object',
        payload: {
            affiliate_code: AFFILIATE_CODE, order_id: 'ORD-123', amount: 150.50, currency: 'MXN',
            card: '4111111111111111'
        },
        expectedHttpStatus: '400',
        expectedErrorCode: 'missing_fields',
        description: 'Servidor debe rechazar card como string en lugar de objeto'
    }
];

function runBadPayloadE2E(baseUrl) {
    console.log('\n' + '═'.repeat(70));
    console.log('📋 FASE 2: E2E Bad Payload Tests (requiere servidor)');
    console.log('═'.repeat(70));
    console.log(`  Enviando ${E2E_BAD_PAYLOAD_SCENARIOS.length} payloads mal formados al servidor...\n`);

    let passed = 0;
    let failed = 0;

    for (const scenario of E2E_BAD_PAYLOAD_SCENARIOS) {
        const jsonBody = JSON.stringify(scenario.payload);
        const curlCommand = [
            'curl', '-s',
            '-w', '"\\n__HTTP_STATUS__:%{http_code}"',
            '-X', 'POST',
            `${baseUrl}/payments/affiliate/payment`,
            '-H', '"Content-Type: application/json"',
            '-H', '"User-Agent: SandboxTest/1.0"',
            '-H', '"Accept: application/json"',
            '-d', `'${jsonBody.replace(/'/g, "'\\\\''")}'`,
            '--max-time', '10'
        ].join(' ');

        let result;
        try {
            const output = execSync(curlCommand, { encoding: 'utf8', timeout: 15000 });
            const lines = output.split('\n');
            const httpStatusMatch = lines[lines.length - 1].match(/__HTTP_STATUS__:(\d+)/);
            const httpStatus = httpStatusMatch ? httpStatusMatch[1] : 'unknown';
            const responseBody = lines.slice(0, -1).join('\n');
            result = { httpStatus, parsed: JSON.parse(responseBody) };
        } catch (error) {
            result = { httpStatus: 'error', parsed: null };
        }

        const checks = [];

        // Check HTTP status
        const statusOk = result.httpStatus === scenario.expectedHttpStatus;
        checks.push({
            check: `HTTP ${scenario.expectedHttpStatus}`,
            passed: statusOk,
            detail: `Got: ${result.httpStatus}`
        });

        // Check error code
        if (result.parsed) {
            const errorCode = result.parsed.error?.code || result.parsed.error_code || null;
            const codeOk = errorCode === scenario.expectedErrorCode;
            checks.push({
                check: `error.code === "${scenario.expectedErrorCode}"`,
                passed: codeOk,
                detail: `Got: "${errorCode}"`
            });
        } else {
            checks.push({
                check: `error.code === "${scenario.expectedErrorCode}"`,
                passed: false,
                detail: 'No JSON response'
            });
        }

        const allPassed = checks.every(c => c.passed);
        const icon = allPassed ? '✅' : '❌';

        console.log(`${icon} ${scenario.name}`);
        console.log(`   ${scenario.description}`);
        console.log(`   HTTP: ${result.httpStatus} | error.code: ${result.parsed?.error?.code || result.parsed?.error_code || 'N/A'}`);
        checks.forEach(c => {
            console.log(`   ${c.passed ? '✅' : '❌'} ${c.check} ${c.passed ? '' : `→ ${c.detail}`}`);
        });
        console.log('');

        if (allPassed) passed++; else failed++;
    }

    console.log(`  📊 E2E Bad Payload Results: ${passed} passed, ${failed} failed, ${E2E_BAD_PAYLOAD_SCENARIOS.length} total\n`);
    return { passed, failed };
}

function runValidationScenarios() {
    console.log('\n' + '═'.repeat(70));
    console.log('📋 FASE 1: Validación de Payload (sin servidor)');
    console.log('═'.repeat(70));
    console.log(`  Probando ${VALIDATION_SCENARIOS.length} casos de validación...\n`);

    let passed = 0;
    let failed = 0;

    for (const scenario of VALIDATION_SCENARIOS) {
        const result = paymentValidator.validateAffiliatePaymentPayload(scenario.payload);
        const actualValid = result.valid;
        const actualCode = result.error ? result.error.code : null;

        let passedThis = false;
        let detail = '';

        if (scenario.expectValid) {
            passedThis = actualValid === true;
            detail = actualValid ? 'valid ✓' : `invalid (unexpected) → ${actualCode}: ${result.error?.message}`;
        } else {
            passedThis = actualValid === false && actualCode === scenario.expectedCode;
            detail = actualValid
                ? 'valid (unexpected - should have failed)'
                : `code="${actualCode}"${actualCode === scenario.expectedCode ? '' : ` (expected "${scenario.expectedCode}")`}`;
        }

        const icon = passedThis ? '✅' : '❌';
        console.log(`${icon} ${scenario.name}`);
        console.log(`   ${scenario.description}`);
        console.log(`   Result: ${detail}\n`);

        if (passedThis) passed++; else failed++;
    }

    console.log(`\n  📊 Validation Results: ${passed} passed, ${failed} failed, ${VALIDATION_SCENARIOS.length} total\n`);
    return { passed, failed };
}

function main() {
    const args = process.argv.slice(2);
    const scenarioArg = args.find(a => a.startsWith('--scenario='));
    const baseUrlArg = args.find(a => a.startsWith('--base-url='));

    const baseUrl = baseUrlArg ? baseUrlArg.split('=')[1] : BASE_URL;
    const envMode = process.env.SELIA_ISO_MODE || '(not set)';

    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║          🧪 TaakPay Sandbox Test Script                          ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log(`\n  Base URL:        ${baseUrl}`);
    console.log(`  Endpoint:        POST /payments/affiliate/payment`);
    console.log(`  Environment:     ${envMode}`);
    console.log(`  Affiliate Code:  ${AFFILIATE_CODE}`);
    console.log(`  Phase 1 - Local Validation: ${VALIDATION_SCENARIOS.length} cases`);
    console.log(`  Phase 2 - E2E Bad Payload:  ${E2E_BAD_PAYLOAD_SCENARIOS.length} cases`);
    console.log(`  Phase 3 - E2E Sandbox:      ${TEST_SCENARIOS.length} scenarios\n`);

    const envUpper = (envMode || '').toUpperCase();
    if (envUpper !== 'DEV') {
        console.log('⚠️  WARNING: SELIA_ISO_MODE is not set to "DEV". Test card validation may not work as expected.');
        console.log('   Set SELIA_ISO_MODE=DEV in your .env file to enable sandbox mode.\n');
    }

    let scenarios = TEST_SCENARIOS;
    if (scenarioArg) {
        const filter = scenarioArg.split('=')[1].toLowerCase();
        scenarios = TEST_SCENARIOS.filter(s => s.name.toLowerCase().includes(filter));
        if (scenarios.length === 0) {
            console.log(`❌ No scenarios matching "${filter}"`);
            process.exit(1);
        }
    }

    // Phase 1: Payload validation (no server required)
    const valResults = runValidationScenarios();
    let passed = valResults.passed;
    let failed = valResults.failed;

    // Phase 2: E2E bad payload tests (requires server)
    const badPayloadResults = runBadPayloadE2E(baseUrl);
    passed += badPayloadResults.passed;
    failed += badPayloadResults.failed;

    // Phase 3: End-to-end sandbox tests (requires server)
    console.log('\n' + '═'.repeat(70));
    console.log('📋 FASE 3: Pruebas E2E Sandbox (requiere servidor)');
    console.log('═'.repeat(70) + '\n');

    for (const scenario of scenarios) {
        const result = runCurlRequest(scenario);
        const checks = validateResponse(scenario, result);
        printResult(scenario, result, checks);

        if (checks.length > 0 && checks.every(c => c.passed)) {
            passed++;
        } else {
            failed++;
        }
    }

    const totalTests = VALIDATION_SCENARIOS.length + E2E_BAD_PAYLOAD_SCENARIOS.length + scenarios.length;
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`📊 Overall Results: ${passed} passed, ${failed} failed, ${totalTests} total`);
    console.log(`   ├── Phase 1 (Local Validation): ${valResults.passed} passed, ${valResults.failed} failed`);
    console.log(`   ├── Phase 2 (E2E Bad Payload):  ${badPayloadResults.passed} passed, ${badPayloadResults.failed} failed`);
    console.log(`   └── Phase 3 (E2E Sandbox):      ${passed - valResults.passed - badPayloadResults.passed} passed, ${failed - valResults.failed - badPayloadResults.failed} failed`);
    console.log(`${'═'.repeat(70)}\n`);

    process.exit(failed > 0 ? 1 : 0);
}

main();
