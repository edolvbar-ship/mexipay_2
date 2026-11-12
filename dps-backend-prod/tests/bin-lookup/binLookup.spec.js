'use strict';

/**
 * Standalone test suite for binLookupHelper.
 * Run: node tests/bin-lookup/binLookup.spec.js
 * Uses .spec.js suffix to avoid gitignore *test*.js pattern.
 */

const assert = require('assert');

let mod, importError = null;
try {
  mod = require('../../lib/socketServer/lib/lib/binLookupHelper');
} catch (e) {
  importError = e;
}

const tests = [];
let passed = 0, failed = 0;

function test(name, fn) { tests.push({ name, fn }); }

async function run() {
  console.log('=== binLookupHelper Test Suite ===\n');

  if (importError) {
    console.error('FAIL import:', importError.message);
    failed++;
    console.log(`\n${passed} passed, ${failed} failed`);
    return;
  }

  const { getBinDataInfoInt, getDefaultBinInfo, detectBrandByFirstDigit } = mod;

  // --- detectBrandByFirstDigit ---
  test('AMEX for "3"', () => assert.strictEqual(detectBrandByFirstDigit('3'), 'AMEX'));
  test('VISA for "4"', () => assert.strictEqual(detectBrandByFirstDigit('4'), 'VISA'));
  test('MASTERCARD for "5"', () => assert.strictEqual(detectBrandByFirstDigit('5'), 'MASTERCARD'));
  test('MASTERCARD for "6"', () => assert.strictEqual(detectBrandByFirstDigit('6'), 'MASTERCARD'));
  test('GENERAL for "1"', () => assert.strictEqual(detectBrandByFirstDigit('1'), 'GENERAL'));
  test('GENERAL for empty', () => assert.strictEqual(detectBrandByFirstDigit(''), 'GENERAL'));
  test('GENERAL for null', () => assert.strictEqual(detectBrandByFirstDigit(null), 'GENERAL'));
  test('VISA for "411111"', () => assert.strictEqual(detectBrandByFirstDigit('411111'), 'VISA'));
  test('AMEX for "374245"', () => assert.strictEqual(detectBrandByFirstDigit('374245'), 'AMEX'));

  // --- getDefaultBinInfo ---
  test('default structure with bin', () => {
    const i = getDefaultBinInfo('411111');
    assert.strictEqual(i.id_bin, 0);
    assert.strictEqual(i.id_processor, null);
    assert.strictEqual(i.processor, 'Definido por comercio');
    assert.strictEqual(i.bin, '411111');
    assert.strictEqual(i.bank, 'INTERNACIONAL');
    assert.strictEqual(i.product, 'INTERNACIONAL');
    assert.strictEqual(i.type, 'GENERAL');
    assert.strictEqual(i.brand, 'GENERAL');
  });
  test('default empty bin when no arg', () => {
    assert.strictEqual(getDefaultBinInfo().bin, '');
  });

  // --- getBinDataInfoInt (null/invalid — no DB needed) ---
  test('null input returns default', async () => {
    const i = await getBinDataInfoInt(null);
    assert.strictEqual(i.id_bin, 0);
    assert.strictEqual(i.brand, 'GENERAL');
    assert.strictEqual(i.bin, '');
  });
  test('undefined input returns default', async () => {
    const i = await getBinDataInfoInt(undefined);
    assert.strictEqual(i.id_bin, 0);
    assert.strictEqual(i.brand, 'GENERAL');
  });
  test('non-string input returns default', async () => {
    const i = await getBinDataInfoInt(12345);
    assert.strictEqual(i.id_bin, 0);
    assert.strictEqual(i.brand, 'GENERAL');
  });

  // --- getBinDataInfoInt (fallback path — DB may be unreachable) ---
  test('VISA fallback for "411111"', async () => {
    const i = await getBinDataInfoInt('411111');
    assert.strictEqual(i.bin, '411111');
    assert.ok(i.brand === 'VISA' || i.id_bin > 0, `got brand=${i.brand}`);
  });
  test('AMEX fallback for "374245"', async () => {
    const i = await getBinDataInfoInt('374245');
    assert.ok(i.brand === 'AMEX' || i.id_bin > 0, `got brand=${i.brand}`);
  });
  test('MASTERCARD fallback for "542418"', async () => {
    const i = await getBinDataInfoInt('542418');
    assert.ok(i.brand === 'MASTERCARD' || i.id_bin > 0, `got brand=${i.brand}`);
  });

  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  PASS: ${t.name}`);
      passed++;
    } catch (e) {
      console.error(`  FAIL: ${t.name} — ${e.message}`);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
