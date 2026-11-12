'use strict';

require('dotenv').config();

// Force production environment
process.env.NODE_ENV = 'production';

const db = require('../lib/socketServer/lib/sequelize/init');

async function checkResponseCodesImproved() {
  console.log('=== Checking Response Codes (Improved) ===\n');

  try {
    // Check all codes in database (both string and numeric)
    const allCodesResult = await db.seq.query(
      `SELECT codigo, descripcion, mensaje_terminal, type FROM selia_error_codes ORDER BY codigo`,
      { type: db.seq.QueryTypes.SELECT }
    );

    // Debug: Log the actual result format
    console.log('Raw result type:', typeof allCodesResult);
    console.log('Raw result:', allCodesResult);
    console.log('Is array?', Array.isArray(allCodesResult));
    if (allCodesResult && allCodesResult[0]) {
      console.log('Has [0] property:', true);
      console.log('Is [0] array?', Array.isArray(allCodesResult[0]));
    }

    // Handle different Sequelize result formats
    const allCodes = Array.isArray(allCodesResult) ? allCodesResult : 
                    (allCodesResult && allCodesResult[0] && Array.isArray(allCodesResult[0])) ? allCodesResult[0] : [];

    console.log(`Total response codes in database: ${allCodes.length}`);

    // Create a comprehensive map that handles both string and numeric codes
    const codeMap = {};
    allCodes.forEach(row => {
      const codeKey = row.codigo.toString(); // Convert to string for consistent lookup
      codeMap[codeKey] = {
        description: row.descripcion,
        terminalMessage: row.mensaje_terminal,
        type: row.type
      };
    });

    // Test specific codes that should exist
    const testCodes = ['00', '0', '01', '05', '51', '55'];
    console.log('\nTesting specific response codes:');
    
    testCodes.forEach(code => {
      const label = codeMap[code];
      if (label) {
        console.log(`  ${code}: ${label.description} (${label.type}) - ${label.terminalMessage}`);
      } else {
        console.log(`  ${code}: NOT FOUND`);
      }
    });

    // Check for codes that might be stored as numbers
    console.log('\nChecking for numeric codes:');
    const numericTestCodes = [0, 1, 5, 51, 55];
    
    numericTestCodes.forEach(code => {
      const codeKey = code.toString();
      const label = codeMap[codeKey];
      if (label) {
        console.log(`  ${codeKey} (numeric ${code}): ${label.description} (${label.type})`);
      }
    });

    // Show all approval/success codes
    console.log('\nAll success/approval codes in database:');
    const successCodes = allCodes.filter(row => 
      row.type && (row.type.toLowerCase().includes('success') || row.type.toLowerCase().includes('correct'))
    );
    
    successCodes.forEach(row => {
      console.log(`  ${row.codigo}: ${row.descripcion} (${row.type}) - ${row.mensaje_terminal}`);
    });

    // Show codes 0 and 00 specifically
    console.log('\nLooking for codes 0 and 00:');
    const zeroCodes = allCodes.filter(row => 
      row.codigo === 0 || row.codigo === '0' || row.codigo === '00'
    );
    
    if (zeroCodes.length > 0) {
      zeroCodes.forEach(row => {
        console.log(`  Found: ${row.codigo} -> ${row.descripcion} (${row.type})`);
      });
    } else {
      console.log('  Codes 0 and 00 NOT FOUND in database');
    }

    // Show first 20 codes to understand data structure
    console.log('\nFirst 20 codes in database:');
    allCodes.slice(0, 20).forEach(row => {
      console.log(`  ${row.codigo} (${typeof row.codigo}): ${row.descripcion} (${row.type})`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

checkResponseCodesImproved();
