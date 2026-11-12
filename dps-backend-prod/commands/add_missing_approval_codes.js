'use strict';

require('dotenv').config();

// Force production environment
process.env.NODE_ENV = 'production';

const db = require('../lib/socketServer/lib/sequelize/init');

async function addMissingApprovalCodes() {
  console.log('=== Adding Missing Approval Response Codes ===\n');

  try {
    // Check which approval codes are missing
    const [existingCodes] = await db.seq.query(
      `SELECT codigo FROM selia_error_codes WHERE codigo IN ('00', '0', '01', '05', '55')`,
      { type: db.seq.QueryTypes.SELECT }
    );

    const existingCodeNumbers = existingCodes.map(row => row.codigo);
    console.log('Existing approval codes:', existingCodeNumbers);

    // Missing codes to add
    const missingCodes = [];
    
    if (!existingCodeNumbers.includes('00')) {
      missingCodes.push({ codigo: '00', descripcion: 'APROBADO', mensaje_terminal: 'Aprobado', type: 'success' });
    }
    
    if (!existingCodeNumbers.includes('0')) {
      missingCodes.push({ codigo: '0', descripcion: 'APROBADO', mensaje_terminal: 'Aprobado', type: 'success' });
    }
    
    if (!existingCodeNumbers.includes('01')) {
      missingCodes.push({ codigo: '01', descripcion: 'RECHAZADA', mensaje_terminal: 'Rechazada', type: 'error' });
    }
    
    if (!existingCodeNumbers.includes('05')) {
      missingCodes.push({ codigo: '05', descripcion: 'NO APROBADA', mensaje_terminal: 'No aprobada', type: 'error' });
    }
    
    if (!existingCodeNumbers.includes('55')) {
      missingCodes.push({ codigo: '55', descripcion: 'PIN INVALIDO', mensaje_terminal: 'PIN inválido', type: 'error' });
    }

    if (missingCodes.length > 0) {
      console.log(`Adding ${missingCodes.length} missing response codes:`);
      missingCodes.forEach(code => {
        console.log(`  ${code.codigo}: ${code.descripcion} (${code.type})`);
      });

      // Insert missing codes
      for (const code of missingCodes) {
        await db.seq.query(
          `INSERT INTO selia_error_codes (codigo, descripcion, mensaje_terminal, type) VALUES (?, ?, ?, ?)`,
          { 
            replacements: [code.codigo, code.descripcion, code.mensaje_terminal, code.type],
            type: db.seq.QueryTypes.INSERT 
          }
        );
      }

      console.log(`✅ Successfully inserted ${missingCodes.length} missing response codes`);
    } else {
      console.log('✅ All approval codes already exist');
    }

    // Verify the additions
    const [updatedCodes] = await db.seq.query(
      `SELECT codigo, descripcion, mensaje_terminal, type FROM selia_error_codes WHERE codigo IN ('00', '0', '01', '05', '55') ORDER BY codigo`,
      { type: db.seq.QueryTypes.SELECT }
    );

    console.log('\nUpdated approval codes:');
    updatedCodes.forEach(code => {
      console.log(`  ${code.codigo}: ${code.descripcion} (${code.type}) - ${code.mensaje_terminal}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

addMissingApprovalCodes();
