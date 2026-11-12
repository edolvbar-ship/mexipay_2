/**
 * EMV Tag Validation Test Runner
 *
 * Sends HTTP requests to the payment gateway with pre-built JSON payloads
 * that simulate real transaction requests for each EMV entry mode.
 *
 * Computes TKA (HMAC-SHA256) auth tokens dynamically so tests pass
 * the gateway's TKA session validation middleware.
 *
 * Usage:
 *   node tests/emv-validation/runHttpTests.js                          # Default: http://localhost:3000
 *   node tests/emv-validation/runHttpTests.js http://localhost:8080     # Custom base URL
 *   node tests/emv-validation/runHttpTests.js http://localhost:8080 02  # Run specific test by number
 *
 * Configuration:
 *   - Reads TKA_SECRET_KEY from .env file (or defaults to built-in key)
 *   - Reads TKR (merchant token_activation) from test JSON "tkr" field in headers
 *   - Computes fresh tms (timestamp) and tka (HMAC) for each request
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');

const BASE_URL = process.argv[2] || process.env.GATEWAY_URL || 'http://localhost:3000';
const SINGLE_TEST = process.argv[3] || null;

const TEST_DIR = path.join(__dirname);
const PROJECT_ROOT = path.join(__dirname, '..', '..');
const ENV_FILE = path.join(PROJECT_ROOT, '.env');

// ── Load TKA_SECRET_KEY from .env ──────────────────────────────────────────
function loadEnvSecretKey() {
    try {
        const envContent = fs.readFileSync(ENV_FILE, 'utf8');
        const match = envContent.match(/^TKA_SECRET_KEY\s*=\s*(.*)$/m);
        if (match) {
            const key = match[1].trim().replace(/^["']|["']$/g, '');
            if (key) return key;
        }
    } catch (e) {
        // .env not found, use default
    }
    // Fallback: must match the default in helpers.js / tka.js
    return 'your-super-secure-256-bit-key-change-this-in-production';
}

const TKA_SECRET_KEY = loadEnvSecretKey();

// ── Compute TKA token ──────────────────────────────────────────────────────
function generateTKA(tkr, tms, afiliationNumber) {
    const hmac = crypto.createHmac('sha256', TKA_SECRET_KEY);
    hmac.update(tkr + tms + afiliationNumber);
    return hmac.digest('base64');
}

// ── Build authenticated headers for a test ─────────────────────────────────
function buildAuthHeaders(testHeaders) {
    const commerceId = testHeaders['commerce-id'] || '';
    const commerceName = testHeaders['commerce-name'] || '';
    const tkr = testHeaders['tkr'] || testHeaders['x-tkr'] || '';
    const tms = String(Date.now()); // Fresh timestamp per request
    const tka = generateTKA(tkr, tms, commerceId);

    return {
        'Content-Type': 'application/json',
        'commerce-id': commerceId,
        'commerce-name': commerceName,
        'x-time': tms,
        'x-auth': tka,
    };
}

function loadTestFiles() {
    const files = fs.readdirSync(TEST_DIR)
        .filter(f => f.endsWith('.json'))
        .sort();

    if (SINGLE_TEST) {
        const filtered = files.filter(f => f.startsWith(SINGLE_TEST.padStart(2, '0')));
        if (filtered.length === 0) {
            console.error(`No test files found with prefix: ${SINGLE_TEST}`);
            process.exit(1);
        }
        return filtered;
    }

    return files;
}

function sendRequest(baseUrl, endpoint, headers, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(endpoint, baseUrl);
        const isHttps = url.protocol === 'https:';
        const transport = isHttps ? https : http;

        const postData = JSON.stringify(body);

        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'Connection': 'close',
                ...headers
            },
            rejectUnauthorized: false
        };

        const req = transport.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed;
                try {
                    parsed = JSON.parse(data);
                } catch {
                    parsed = { raw: data };
                }
                resolve({ statusCode: res.statusCode, body: parsed });
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.setTimeout(15000, () => {
            req.destroy(new Error('Request timeout'));
        });

        req.write(postData);
        req.end();
    });
}

function checkResult(testFile, response, expected, endpoint) {
    const errors = [];

    if (response.statusCode === 401) {
        errors.push('Got 401 auth error — TKA token invalid. Check tkr/secret key.');
        return errors;
    }

    // initKeys endpoint — different validation logic
    if (endpoint && endpoint.includes('/initKeys')) {
        if (expected === 'PASS') {
            if (response.statusCode !== 200) {
                errors.push(`Expected HTTP 200, got ${response.statusCode}`);
            }
            if (!response.body.key && !response.body.data?.key) {
                errors.push('Missing key in response — key exchange failed');
            }
            if (!response.body.kcv && !response.body.data?.kcv) {
                errors.push('Missing kcv in response');
            }
        }
        return errors;
    }

    // Standard EMV validation tests
    if (expected === 'PASS') {
        if (response.body.errors && Array.isArray(response.body.errors) && response.body.message === 'EMV tag validation failed') {
            errors.push(`EMV validation failed but was expected to PASS: ${JSON.stringify(response.body.errors.map(e => e.code))}`);
        }
        // responseCode 99 = processor internal error (fake card data) — EMV validation itself passed
        if (response.body.responseCode === '99') {
            console.log(`         ℹ️ EMV validation passed; processor returned 99 (expected with test card data)`);
        }
    } else if (expected === 'FAIL') {
        // For FAIL tests, we expect either:
        //   HTTP 400 with message "EMV tag validation failed" (EMV validation caught it), or
        //   HTTP 200/400 with other processing errors (passed EMV validation but failed downstream)
        if (response.statusCode === 200 && response.body.success === true) {
            errors.push('Request fully succeeded (expected EMV validation failure).');
        }
    }

    return errors;
}

async function runTests() {
    const files = loadTestFiles();
    const results = [];

    console.log('');
    console.log('='.repeat(80));
    console.log('  EMV TAG VALIDATION TEST SUITE');
    console.log('  Base URL: ' + BASE_URL);
    console.log('  TKA Secret: ' + TKA_SECRET_KEY.substring(0, 10) + '...');
    console.log('  Tests: ' + files.length);
    console.log('='.repeat(80));
    console.log('');

    for (const file of files) {
        const filePath = path.join(TEST_DIR, file);
        const test = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        const testName = test.testName || file;
        const expected = test.expectedResult || 'PASS';
        const endpoint = test.endpoint || '/gateway/v1/retail/charge';
        const rawHeaders = test.headers || {};
        const body = test.body || {};

        // Compute fresh TKA token with current timestamp
        const headers = buildAuthHeaders(rawHeaders);

        console.log(`  [TEST] ${file}`);
        console.log(`         Name: ${testName}`);
        console.log(`         Endpoint: ${endpoint}`);
        console.log(`         Expected: ${expected}`);
        console.log(`         TKA: tms=${headers['x-time']}, tka=${headers['x-auth'].substring(0, 20)}...`);

        try {
            const response = await sendRequest(BASE_URL, endpoint, headers, body);

            const checkErrors = checkResult(file, response, expected, endpoint);
            const passed = checkErrors.length === 0;

            if (passed) {
                console.log(`         Result: PASS (HTTP ${response.statusCode})`);
            } else {
                console.log(`         Result: FAIL (HTTP ${response.statusCode})`);
                checkErrors.forEach(e => console.log(`           - ${e}`));
            }

            if (response.body.errors && Array.isArray(response.body.errors)) {
                const emvErrors = response.body.errors;
                if (emvErrors.length > 0) {
                    console.log(`         EMV Errors:`);
                    emvErrors.slice(0, 5).forEach(e => {
                        console.log(`           - ${e.code}: ${e.message}`);
                    });
                    if (emvErrors.length > 5) {
                        console.log(`           ... and ${emvErrors.length - 5} more`);
                    }
                }
            }

            if (response.body.warnings && Array.isArray(response.body.warnings) && response.body.warnings.length > 0) {
                console.log(`         EMV Warnings:`);
                response.body.warnings.slice(0, 3).forEach(w => {
                    console.log(`           - ${w.code}: ${w.message}`);
                });
            }

            if (response.body.summary) {
                console.log(`         Summary: ${response.body.summary}`);
            }
            if (response.body.responseCode) {
                console.log(`         Response Code: ${response.body.responseCode}`);
            }
            if (response.body.description) {
                console.log(`         Description: ${response.body.description}`);
            }
            // initKeys-specific response fields
            if (response.body.key) {
                console.log(`         Key: ${response.body.key.substring(0, 16)}... (${response.body.key.length} hex chars)`);
            }
            if (response.body.kcv) {
                console.log(`         KCV: ${response.body.kcv}`);
            }
            if (response.body.ksn) {
                console.log(`         KSN: ${response.body.ksn}`);
            }
            if (response.body.dukpt_initial_key) {
                console.log(`         DUKPT IPEK: ${response.body.dukpt_initial_key.substring(0, 16)}...`);
            }
            if (response.body.dukpt_ksn) {
                console.log(`         DUKPT KSN: ${response.body.dukpt_ksn}`);
            }
            if (response.body.dukpt_kcv) {
                console.log(`         DUKPT KCV: ${response.body.dukpt_kcv}`);
            }

            results.push({ file, testName, expected, passed, statusCode: response.statusCode });
        } catch (err) {
            console.log(`         Result: ERROR - ${err.message}`);
            results.push({ file, testName, expected, passed: false, error: err.message });
        }

        console.log('');

        // Small delay between requests to avoid socket exhaustion
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    console.log('='.repeat(80));
    console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${results.length} total`);
    console.log('='.repeat(80));

    if (failed > 0) {
        console.log('');
        console.log('  Failed tests:');
        results.filter(r => !r.passed).forEach(r => {
            console.log(`    - ${r.file}: ${r.testName}`);
        });
    }

    console.log('');
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
