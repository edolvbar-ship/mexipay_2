/**
 * @fileoverview Sandbox Card Handler - Environment-based test card validation and
 * dummy transaction processing for the BlissCore payment API.
 *
 * ## WHY THIS MODULE EXISTS
 *
 * The payment platform operates in two environments:
 *   - `dev`  (sandbox): Used by integrators to test their implementation.
 *   - `prod` (live):     Real customer transactions are processed here.
 *
 * Without this module, there was no mechanism to:
 *   1. Prevent test card numbers from accidentally reaching the live Selia
 *      gateway in production (which could cause confusion, audit issues, or
 *      gateway-side errors).
 *   2. Prevent real card numbers from being used in the sandbox environment
 *      (where they would fail or expose sensitive data unnecessarily).
 *   3. Simulate specific failure scenarios (insufficient funds, declined,
 *      processor error) without needing the gateway to be available.
 *
 * ## HOW IT WORKS
 *
 * Every payment endpoint calls `validateCardForEnvironment(cardNumber)` before
 * processing. This function returns an object with:
 *   - `allowed`    (boolean): Whether the card may proceed.
 *   - `useDummy`   (boolean): Whether to use the dummy handler instead of Selia.
 *   - `error/code` (string):  Present only when `allowed` is false.
 *
 * ### DEV mode behavior
 *
 *   ┌──────────────────────────────┬──────────┬───────────┐
 *   │ Card                         │ useDummy │ Flow      │
 *   ├──────────────────────────────┼──────────┼───────────┤
 *   │ 4111111111111111 (approved)  │ false    │ → Selia   │
 *   │ 5555555555554444 (approved)  │ false    │ → Selia   │
 *   │ 4242424242424242 (approved)  │ false    │ → Selia   │
 *   │ 4111111111111112 (insuf. $)  │ true     │ → Dummy   │
 *   │ 4111111111111113 (declined)  │ true     │ → Dummy   │
 *   │ 5555555555554445 (proc err)  │ true     │ → Dummy   │
 *   │ Any other card               │ —        │ Rejected  │
 *   └──────────────────────────────┴──────────┴───────────┘
 *
 * Approved test cards travel to the real Selia gateway so integrators can
 * verify the full connection, payload format, and response parsing. The
 * gateway recognizes these as sandbox transactions.
 *
 * Declined/error cards are handled locally by `processDummyPayment()` to
 * simulate the failure without hitting the gateway. This lets integrators
 * test their error-handling code even when the gateway is unavailable.
 *
 * ### PROD mode behavior
 *
 *   ┌──────────────────────────────┬──────────┬───────────┐
 *   │ Card                         │ useDummy │ Flow      │
 *   ├──────────────────────────────┼──────────┼───────────┤
 *   │ Any test card                │ —        │ Rejected  │
 *   │ Any real card                │ false    │ → Selia   │
 *   └──────────────────────────────┴──────────┴───────────┘
 *
 * Test cards are blocked immediately with a 403 response. Real cards proceed
 * to the Selia gateway as normal.
 *
 * ## DUMMY RESPONSE FORMAT
 *
 * `processDummyPayment()` returns an object that mimics the real
 * `seliaService.processPayment()` response shape:
 *
 *   {
 *     success: boolean,
 *     responseCode: string,       // ISO 8583 code ('51', '5', '96', etc.)
 *     responseMessage: string,    // Human-readable message
 *     transactionId: string,      // Generated dummy ID (field 8)
 *     authorizationCode: string|null, // 6-digit code (field 50), null on decline
 *     rawResponse: string,        // Simulated Selia raw response string
 *     parsedFields: object,       // Map of field numbers to values
 *     _sandbox: true,             // Marker for logging/debugging
 *     _scenario: string           // Scenario name for logging
 *   }
 *
 * This allows the existing endpoint code (extractBankAuthorizationCode,
 * ISO message storage, response formatting) to work without modification.
 *
 * ## ENVIRONMENT DETECTION
 *
 * The module reads `process.env.SELIA_ISO_MODE` (case-insensitive):
 *   - `DEV`  → dev mode
 *   - `PROD` → prod mode
 *   - Anything else (including unset) → rejected with `unknown_environment`
 *
 * This is intentionally strict: if the environment is not configured, all
 * transactions are blocked to prevent accidental misrouting.
 *
 * ## ENDPOINTS PROTECTED
 *
 * 1. `POST /payments/affiliate/payment` — ecommerce.links.routes.js
 * 2. `POST /payments/payment/selia` — ecommerce.links.routes.js
 * 3. `POST /payments/payment/payout` — ecommerce.links.routes.js (validation only)
 * 4. `POST /api/payment/selia` — api.routes.js
 * 5. `POST /gateway/v1/api/affiliate/payment` — affiliatePayments.routes.js
 *
 * ## TROUBLESHOOTING
 *
 * | Symptom | Likely Cause | Fix |
 * |---------|-------------|-----|
 * | All cards rejected with `unknown_environment` | `SELIA_ISO_MODE` env var not set | Set `SELIA_ISO_MODE=DEV` in `.env` |
 * | Test card rejected with `non_test_card_in_dev` in dev | Card number not in TEST_CARDS | Use one of the defined test card numbers |
 * | Test card rejected with `test_card_in_prod` in prod | Running in prod with a test card | Switch to a real card or set `SELIA_ISO_MODE=DEV` |
 * | Approved test card fails with Selia error | Selia gateway unreachable or credentials wrong | Check SELIA_HOST, SELIA_PORT, SELIA_USERNAME, SELIA_PASSWORD |
 * | `⚠️ Field 50 is invalid or empty` in logs | Declined transaction has no auth code | This is expected for declines, not an error |
 * | `Data too long for column 'card_type'` | getCardType() returning brand name instead of code | Ensure getCardType() returns 'C'/'D'/'G' (varchar(2)) |
 * | `Data too long for column 'folio'` | order_id exceeds 15 chars | Shorten the order_id in the request |
 *
 * @module sandboxCardHandler
 */

const TEST_CARDS = {
    '4111111111111111': {
        brand: 'VISA',
        scenario: 'approved',
        success: true,
        responseCode: '0',
        responseMessage: 'Transacción aprobada',
        authorizationCode: 'DUMMY1',
        transactionId: null,
        useSelia: true
    },
    '4111111111111112': {
        brand: 'VISA',
        scenario: 'insufficient_funds',
        success: false,
        responseCode: '51',
        responseMessage: 'Fondos insuficientes',
        authorizationCode: null,
        transactionId: null
    },
    '4111111111111113': {
        brand: 'VISA',
        scenario: 'card_declined',
        success: false,
        responseCode: '5',
        responseMessage: 'Transacción declinada - No honrar',
        authorizationCode: null,
        transactionId: null
    },
    '5555555555554444': {
        brand: 'MC',
        scenario: 'approved',
        success: true,
        responseCode: '0',
        responseMessage: 'Transacción aprobada',
        authorizationCode: 'DUMMY2',
        transactionId: null,
        useSelia: true
    },
    '5555555555554445': {
        brand: 'MC',
        scenario: 'processor_error',
        success: false,
        responseCode: '96',
        responseMessage: 'Falla en el sistema',
        authorizationCode: null,
        transactionId: null
    },
    '4242424242424242': {
        brand: 'VISA',
        scenario: 'approved',
        success: true,
        responseCode: '0',
        responseMessage: 'Transacción aprobada',
        authorizationCode: 'DUMMY3',
        transactionId: null,
        useSelia: true
    }
};

const TEST_CARD_NUMBERS = new Set(Object.keys(TEST_CARDS));

const DEV_WARNING = 'Dev test card numbers are not allowed in a production environment. Please refer to the integration manual for further information.';
const NON_TEST_CARD_WARNING = 'Non-test card numbers are not allowed in a dev/sandbox environment. Please refer to the integration manual for further information.';

function isDevMode() {
    const env = (process.env.SELIA_ISO_MODE || '').trim().toUpperCase();
    return env === 'DEV';
}

function isProdMode() {
    const env = (process.env.SELIA_ISO_MODE || '').trim().toUpperCase();
    return env === 'PROD';
}

function isTestCard(cardNumber) {
    const clean = (cardNumber || '').replace(/\D/g, '');
    return TEST_CARD_NUMBERS.has(clean);
}

function getTestCardData(cardNumber) {
    const clean = (cardNumber || '').replace(/\D/g, '');
    return TEST_CARDS[clean] || null;
}

function generateDummyTransactionId() {
    const ts = Date.now().toString();
    const rand = Math.floor(1000 + Math.random() * 9000).toString();
    return `DUMMY${ts}${rand}`.substring(0, 16);
}

function generateDummyAuthorizationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function processDummyPayment(paymentData) {
    const cleanCard = (paymentData.cardNumber || '').replace(/\D/g, '');
    const cardData = TEST_CARDS[cleanCard];

    if (!cardData) {
        return {
            success: false,
            responseCode: '99',
            responseMessage: NON_TEST_CARD_WARNING,
            transactionId: null,
            authorizationCode: null,
            rawResponse: '{}',
            parsedFields: {},
            _sandbox: true,
            _blocked: true
        };
    }

    const transactionId = generateDummyTransactionId();
    const authorizationCode = cardData.success ? generateDummyAuthorizationCode() : null;

    const parsedFields = {
        '8': transactionId,
        '14': cardData.responseCode,
        '19': transactionId
    };

    if (authorizationCode) {
        parsedFields['50'] = authorizationCode;
    }

    const rawResponse = `{8:${transactionId};14:${cardData.responseCode};19:${transactionId}${authorizationCode ? `;50:${authorizationCode}` : ''}}`;

    return {
        success: cardData.success,
        responseCode: cardData.responseCode,
        responseMessage: cardData.responseMessage,
        transactionId: transactionId,
        authorizationCode: authorizationCode,
        rawResponse: rawResponse,
        parsedFields: parsedFields,
        _sandbox: true,
        _scenario: cardData.scenario
    };
}

function validateCardForEnvironment(cardNumber) {
    const clean = (cardNumber || '').replace(/\D/g, '');
    const testCard = isTestCard(clean);

    if (isDevMode()) {
        if (!testCard) {
            return {
                allowed: false,
                error: NON_TEST_CARD_WARNING,
                code: 'non_test_card_in_dev'
            };
        }
        const cardData = getTestCardData(clean);
        const useDummy = cardData ? !cardData.useSelia : true;
        return { allowed: true, mode: 'dev', useDummy: useDummy };
    }

    if (isProdMode()) {
        if (testCard) {
            return {
                allowed: false,
                error: DEV_WARNING,
                code: 'test_card_in_prod'
            };
        }
        return { allowed: true, mode: 'prod', useDummy: false };
    }

    return {
        allowed: false,
        error: `Unknown SELIA_ISO_MODE value: "${process.env.SELIA_ISO_MODE}". Must be 'DEV' or 'PROD'.`,
        code: 'unknown_environment'
    };
}

module.exports = {
    TEST_CARDS,
    TEST_CARD_NUMBERS,
    isDevMode,
    isProdMode,
    isTestCard,
    getTestCardData,
    processDummyPayment,
    validateCardForEnvironment,
    DEV_WARNING,
    NON_TEST_CARD_WARNING
};
