/**
 * EMV Tag Validator - Standalone Unit Tests
 *
 * Tests the EMVTagValidator class directly without needing a running server.
 * Validates all entry modes, error conditions, and edge cases.
 *
 * Usage:
 *   node tests/emv-validation/runUnitTests.js
 */

const EMVTagValidator = require('../../lib/socketServer/lib/services/emvTagValidator');

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
    if (condition) {
        passed++;
    } else {
        failed++;
        failures.push(message);
        console.log(`  FAIL: ${message}`);
    }
}

function assertHasError(result, expectedCode) {
    const found = result.errors && result.errors.some(e => e.code === expectedCode);
    assert(found, `Expected error code "${expectedCode}" not found. Errors: ${JSON.stringify(result.errors?.map(e => e.code))}`);
}

function assertHasWarning(result, expectedCode) {
    const found = result.warnings && result.warnings.some(w => w.code === expectedCode);
    assert(found, `Expected warning code "${expectedCode}" not found. Warnings: ${JSON.stringify(result.warnings?.map(w => w.code))}`);
}

function assertNoErrors(result) {
    assert(result.errors.length === 0, `Expected no errors but got: ${JSON.stringify(result.errors.map(e => e.code))}`);
}

function assertValid(result) {
    assert(result.valid === true, `Expected valid=true but got valid=${result.valid}. Errors: ${JSON.stringify(result.errors.map(e => e.code))}`);
}

function assertInvalid(result) {
    assert(result.valid === false, `Expected valid=false but got valid=${result.valid}`);
}

// ============================================================
// TEST DATA
// ============================================================

const validChipTags = {
    '4F': 'A0000000031010',
    '5A': '4152314611664742',
    '57': '4152314611664742D31112210000073705002',
    '5F24': '311130',
    '5F2A': '484',
    '5F30': '201F',
    '5F34': '01',
    '50': 'VISA DEBIT',
    '82': '3800',
    '84': 'A0000000031010',
    '8E': '0000000000000000020142041E0402054203440341035E031F02',
    '95': '0000000000',
    '9A': '260711',
    '9B': 'E800',
    '9C': '00',
    '9F02': '000000000321',
    '9F03': '000000000000',
    '9F09': '0096',
    '9F10': '06011203A0A811',
    '9F1A': '0484',
    '9F1E': '303030313035',
    '9F21': '061802',
    '9F26': '4E8966E4B52EE8A9',
    '9F27': '80',
    '9F33': 'E0B0C8',
    '9F34': '410301',
    '9F35': '22',
    '9F36': '0052',
    '9F37': '7E279C51',
    '9F39': '05',
};

const validContactlessTags = {
    ...validChipTags,
    '9F39': '07',
    '9F4C': 'A4B2C3D4E5F6A7B8',
    '9F6E': '00000001',
};

const validMagstripeTags = {
    '5A': '4152314611664742',
    '57': '4152314611664742D31112210000073705002',
    '5F24': '311130',
    '5F2A': '484',
    '5F30': '101F',
    '5F34': '01',
    '9A': '260711',
    '9C': '00',
    '9F02': '000000000321',
    '9F03': '000000000000',
    '9F1A': '0484',
};

const validFallbackTags = {
    '5A': '4152314611664742',
    '57': '4152314611664742D31112210000073705002',
    '5F24': '311130',
    '5F2A': '484',
    '5F30': '201F',
    '5F34': '01',
    '9A': '260711',
    '9C': '00',
    '9F02': '000000000321',
    '9F03': '000000000000',
    '9F1A': '0484',
    '9F26': '4E8966E4B52EE8A9',
    '9F27': '80',
    '9F36': '0052',
    '9F37': '7E279C51',
};

const validContactlessMagTags = {
    ...validMagstripeTags,
    '9F6E': '00000001',
};

// ============================================================
// TESTS
// ============================================================

console.log('');
console.log('='.repeat(80));
console.log('  EMV TAG VALIDATOR - UNIT TESTS');
console.log('='.repeat(80));
console.log('');

// --- Test 1: Valid Chip ---
console.log('  [TEST] 01: Valid Chip (Entry Mode 05)');
{
    const result = EMVTagValidator.validate(validChipTags, '051', '201', { amount: 321 });
    assertValid(result);
    assertNoErrors(result);
}
console.log('');

// --- Test 2: Valid Contactless ---
console.log('  [TEST] 02: Valid Contactless (Entry Mode 07)');
{
    const result = EMVTagValidator.validate(validContactlessTags, '071', '201', { amount: 321 });
    assertValid(result);
    assertNoErrors(result);
}
console.log('');

// --- Test 3: Contactless Missing 9F6E ---
console.log('  [TEST] 03: Contactless Missing 9F6E (Form Factor)');
{
    const tags = { ...validContactlessTags };
    delete tags['9F6E'];
    delete tags['9F4C'];
    const result = EMVTagValidator.validate(tags, '071', '201');
    assertInvalid(result);
    assertHasError(result, 'MISSING_FORM_FACTOR');
    assertHasError(result, 'MISSING_ICC_DYNAMIC');
}
console.log('');

// --- Test 4: Contactless Wrong Cryptogram ---
console.log('  [TEST] 04: Contactless Wrong Cryptogram (AAC instead of ARQC)');
{
    const tags = { ...validContactlessTags, '9F27': '00' };
    const result = EMVTagValidator.validate(tags, '071', '201');
    assertInvalid(result);
    assertHasError(result, 'CONTACTLESS_ARQC_REQUIRED');
}
console.log('');

// --- Test 5: Chip TVR DDA Failed ---
console.log('  [TEST] 05: Chip TVR DDA Failed (byte1 bit3=1)');
{
    const tags = { ...validChipTags, '95': '1800800800' };
    const result = EMVTagValidator.validate(tags, '051', '201');
    assertInvalid(result);
    assertHasError(result, 'DDA_FAILED');
}
console.log('');

// --- Test 6: Valid Magstripe ---
console.log('  [TEST] 06: Valid Magstripe (Entry Mode 90)');
{
    const result = EMVTagValidator.validate(validMagstripeTags, '901', '101');
    assertValid(result);
    assertNoErrors(result);
}
console.log('');

// --- Test 7: Magstripe With Forbidden Cryptogram ---
console.log('  [TEST] 07: Magstripe With Forbidden Cryptogram Tags');
{
    const tags = {
        ...validMagstripeTags,
        '9F26': '4E8966E4B52EE8A9',
        '9F27': '80',
        '9F36': '0052',
        '9F37': '7E279C51',
    };
    const result = EMVTagValidator.validate(tags, '901', '101');
    assertInvalid(result);
    assertHasError(result, 'FORBIDDEN_TAG_PRESENT');
}
console.log('');

// --- Test 8: Chip Missing Required Tags ---
console.log('  [TEST] 08: Chip Missing Required Cryptogram Tags');
{
    const tags = { ...validChipTags };
    delete tags['9F26'];
    delete tags['9F27'];
    delete tags['9F36'];
    delete tags['9F37'];
    const result = EMVTagValidator.validate(tags, '051', '201');
    assertInvalid(result);
    assertHasError(result, 'MISSING_REQUIRED_TAG');
}
console.log('');

// --- Test 9: Valid Fallback ---
console.log('  [TEST] 09: Valid Fallback (Entry Mode 80)');
{
    const result = EMVTagValidator.validate(validFallbackTags, '801', '201');
    assertValid(result);
    assertNoErrors(result);
}
console.log('');

// --- Test 10: Chip Wrong ARQC Length ---
console.log('  [TEST] 10: Chip Wrong ARQC Length (8 instead of 16)');
{
    const tags = { ...validChipTags, '9F26': '4E8966E4' };
    const result = EMVTagValidator.validate(tags, '051', '201');
    assertInvalid(result);
    assertHasError(result, 'INVALID_LENGTH');
}
console.log('');

// --- Test 11: Valid Contactless Magstripe ---
console.log('  [TEST] 11: Valid Contactless Magstripe (Entry Mode 91)');
{
    const result = EMVTagValidator.validate(validContactlessMagTags, '911', '101');
    assertValid(result);
    assertNoErrors(result);
}
console.log('');

// --- Test 12: normalizeEmvTags - Array Format ---
console.log('  [TEST] 12: normalizeEmvTags - Array [{tag, value}] Format');
{
    const input = [
        { tag: '5A', value: '4152314611664742' },
        { tag: '9F27', value: '80' },
    ];
    const result = EMVTagValidator.normalizeEmvTags(input);
    assert(result['5A'] === '4152314611664742', 'Expected 5A tag');
    assert(result['9F27'] === '80', 'Expected 9F27 tag');
    assert(Object.keys(result).length === 2, 'Expected 2 tags');
}
console.log('');

// --- Test 13: normalizeEmvTags - Object Format ---
console.log('  [TEST] 13: normalizeEmvTags - Object {tag: value} Format');
{
    const input = { '5A': '4152314611664742', '9F27': '80' };
    const result = EMVTagValidator.normalizeEmvTags(input);
    assert(result['5A'] === '4152314611664742', 'Expected 5A tag');
    assert(result['9F27'] === '80', 'Expected 9F27 tag');
}
console.log('');

// --- Test 14: normalizeEmvTags - TLV String Format ---
console.log('  [TEST] 14: normalizeEmvTags - TLV Hex String Format');
{
    // 9F27 03 80 -> tag=9F27, len=3, value=80... wait, 9F27 is 1 byte value
    // Actually: 9F270180 -> tag=9F27, len=01, value=80
    const input = '9F2701805A084152314611664742';
    const result = EMVTagValidator.normalizeEmvTags(input);
    assert(result['9F27'] === '80', `Expected 9F27=80, got ${result['9F27']}`);
    assert(result['5A'] === '4152314611664742', `Expected 5A, got ${result['5A']}`);
}
console.log('');

// --- Test 15: normalizeEmvTags - Empty/Null ---
console.log('  [TEST] 15: normalizeEmvTags - Empty/Null Input');
{
    assert(Object.keys(EMVTagValidator.normalizeEmvTags(null)).length === 0, 'null should return empty');
    assert(Object.keys(EMVTagValidator.normalizeEmvTags(undefined)).length === 0, 'undefined should return empty');
    assert(Object.keys(EMVTagValidator.normalizeEmvTags([])).length === 0, 'empty array should return empty');
    assert(Object.keys(EMVTagValidator.normalizeEmvTags({})).length === 0, 'empty object should return empty');
    assert(Object.keys(EMVTagValidator.normalizeEmvTags('')).length === 0, 'empty string should return empty');
}
console.log('');

// --- Test 16: extractServiceCode - From 5F30 ---
console.log('  [TEST] 16: extractServiceCode - From Tag 5F30');
{
    const tags = { '5F30': '323031' }; // "201" in hex ASCII
    const sc = EMVTagValidator.extractServiceCode(tags, '');
    assert(sc === '201', `Expected service code 201, got ${sc}`);
}
console.log('');

// --- Test 17: extractServiceCode - From Track2 ---
console.log('  [TEST] 17: extractServiceCode - From Track 2 Data');
{
    const track2 = '4152314611664742D31112210000073705002';
    // After D: 31112210000073705002
    // YYMM = 3111, SC = 221
    const sc = EMVTagValidator.extractServiceCode({}, track2);
    assert(sc === '221', `Expected service code 221, got ${sc}`);
}
console.log('');

// --- Test 18: Chip with Invalid Hex Format ---
console.log('  [TEST] 18: Chip With Invalid Hex Format in Tag');
{
    const tags = { ...validChipTags, '5A': 'XYZNOTHEX' };
    const result = EMVTagValidator.validate(tags, '051', '201');
    assertInvalid(result);
    assertHasError(result, 'INVALID_FORMAT');
}
console.log('');

// --- Test 19: Chip with PIN Verification Failed in TVR ---
console.log('  [TEST] 19: Chip TVR PIN Verification Failed (byte1 bit4=1)');
{
    const tags = { ...validChipTags, '95': '1000000000' };
    const result = EMVTagValidator.validate(tags, '051', '201');
    assertInvalid(result);
    assertHasError(result, 'PIN_VERIFICATION_FAILED');
}
console.log('');

// --- Test 20: Contactless with Wrong 9F6E Length ---
console.log('  [TEST] 20: Contactless Wrong 9F6E Length (4 instead of 8)');
{
    const tags = { ...validContactlessTags, '9F6E': '0001' };
    const result = EMVTagValidator.validate(tags, '071', '201');
    assertInvalid(result);
    assertHasError(result, 'INVALID_FORM_FACTOR_LENGTH');
}
console.log('');

// --- Test 21: Unknown Entry Mode ---
console.log('  [TEST] 21: Unknown Entry Mode (99)');
{
    const result = EMVTagValidator.validate(validChipTags, '991', '201');
    assertInvalid(result);
    assertHasError(result, 'UNKNOWN_ENTRY_MODE');
}
console.log('');

// --- Test 22: Chip with Invalid ATC Value ---
console.log('  [TEST] 22: Chip With Invalid ATC (length=2 instead of 4)');
{
    const tags = { ...validChipTags, '9F36': '00' };
    const result = EMVTagValidator.validate(tags, '051', '201');
    assertInvalid(result);
    assertHasError(result, 'INVALID_ATC_LENGTH');
}
console.log('');

// --- Test 23: Amount Mismatch Warning ---
console.log('  [TEST] 23: Amount Mismatch Between 9F02 and P-004');
{
    const tags = { ...validChipTags, '9F02': '000000000999' };
    const result = EMVTagValidator.validate(tags, '051', '201', { amount: 321 });
    assertHasWarning(result, 'AMOUNT_MISMATCH');
}
console.log('');

// --- Test 24: Tag Analysis ---
console.log('  [TEST] 24: Tag Analysis Counts');
{
    const result = EMVTagValidator.validate(validChipTags, '051', '201');
    assert(result.tagAnalysis.total === Object.keys(validChipTags).length, `Expected total=${Object.keys(validChipTags).length}, got ${result.tagAnalysis.total}`);
    assert(result.tagAnalysis.present === result.tagAnalysis.required, `All required tags should be present. present=${result.tagAnalysis.present}, required=${result.tagAnalysis.required}`);
    assert(result.tagAnalysis.missing.length === 0, `No tags should be missing, got: ${JSON.stringify(result.tagAnalysis.missing)}`);
}
console.log('');

// --- Test 25: Manual Entry Mode (No EMV Tags Needed) ---
console.log('  [TEST] 25: Manual Entry Mode (01) - No EMV Tags');
{
    const manualTags = {
        '5A': '4152314611664742',
        '5F24': '311130',
        '5F2A': '484',
        '5F30': '201F',
        '5F34': '01',
        '9A': '260711',
        '9C': '00',
        '9F02': '000000000321',
        '9F03': '000000000000',
        '9F1A': '0484',
    };
    const result = EMVTagValidator.validate(manualTags, '011', '201');
    assertValid(result);
    assertNoErrors(result);
}
console.log('');

// ============================================================
// RESULTS
// ============================================================

console.log('='.repeat(80));
console.log(`  UNIT TEST RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('='.repeat(80));

if (failures.length > 0) {
    console.log('');
    console.log('  Failures:');
    failures.forEach(f => console.log(`    - ${f}`));
}

console.log('');
process.exit(failed > 0 ? 1 : 0);
