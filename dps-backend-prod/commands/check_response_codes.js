'use strict';

require('dotenv').config();

// Force production environment
process.env.NODE_ENV = 'production';

const db = require('../lib/socketServer/lib/sequelize/init');

async function checkAndPopulateResponseCodes() {
  console.log('=== Checking and Populating Response Codes ===\n');

  try {
    // Check if the table exists and has data
    const existingCodesResult = await db.seq.query(
      `SELECT COUNT(*) as count FROM selia_error_codes`,
      { type: db.seq.QueryTypes.SELECT }
    );

    const existingCodes = Array.isArray(existingCodesResult) ? existingCodesResult[0] : existingCodesResult;
    const count = existingCodes ? existingCodes.count : 0;

    console.log(`Existing response codes count: ${count}`);

    if (count === 0) {
      console.log('Table is empty, populating with common response codes...');
      
      // Common response codes for Mexican payment processing
      const responseCodes = [
        { codigo: '00', descripcion: 'APROBADO', mensaje_terminal: 'Aprobado', type: 'success' },
        { codigo: '0', descripcion: 'APROBADO', mensaje_terminal: 'Aprobado', type: 'success' },
        { codigo: '01', descripcion: 'RECHAZADA', mensaje_terminal: 'Rechazada', type: 'error' },
        { codigo: '03', descripcion: 'COMERCIO INVALIDO', mensaje_terminal: 'Comercio inválido', type: 'error' },
        { codigo: '04', descripcion: 'CAPTURA PARCIAL', mensaje_terminal: 'Captura parcial', type: 'warning' },
        { codigo: '05', descripcion: 'NO APROBADA', mensaje_terminal: 'No aprobada', type: 'error' },
        { codigo: '06', descripcion: 'ERROR', mensaje_terminal: 'Error', type: 'error' },
        { codigo: '07', descripcion: 'CAPTURA PARCIAL', mensaje_terminal: 'Captura parcial', type: 'warning' },
        { codigo: '08', descripcion: 'APROBACION CON REV', mensaje_terminal: 'Aprobación con reverificación', type: 'warning' },
        { codigo: '10', descripcion: 'APROBACION PARCIAL', mensaje_terminal: 'Aprobación parcial', type: 'warning' },
        { codigo: '11', descripcion: 'APROBACION VIP', mensaje_terminal: 'Aprobación VIP', type: 'success' },
        { codigo: '12', descripcion: 'TRANSACCION INVALIDA', mensaje_terminal: 'Transacción inválida', type: 'error' },
        { codigo: '13', descripcion: 'MONTO INVALIDO', mensaje_terminal: 'Monto inválido', type: 'error' },
        { codigo: '14', descripcion: 'NUMERO DE TARJETA INVALIDO', mensaje_terminal: 'Número de tarjeta inválido', type: 'error' },
        { codigo: '15', descripcion: 'EMISOR INVALIDO', mensaje_terminal: 'Emisor inválido', type: 'error' },
        { codigo: '30', descripcion: 'ERROR DE FORMATO', mensaje_terminal: 'Error de formato', type: 'error' },
        { codigo: '31', descripcion: 'BANCO NO SOPORTADO', mensaje_terminal: 'Banco no soportado', type: 'error' },
        { codigo: '33', descripcion: 'TARJETA EXPIRADA', mensaje_terminal: 'Tarjeta expirada', type: 'error' },
        { codigo: '34', descripcion: 'SOSPECHA DE FRAUDE', mensaje_terminal: 'Sospecha de fraude', type: 'error' },
        { codigo: '35', descripcion: 'CONTACTAR EMISOR', mensaje_terminal: 'Contactar emisor', type: 'warning' },
        { codigo: '36', descripcion: 'TARJETA RESTRINGIDA', mensaje_terminal: 'Tarjeta restringida', type: 'error' },
        { codigo: '37', descripcion: 'CONTACTAR EMISOR', mensaje_terminal: 'Contactar emisor', type: 'warning' },
        { codigo: '38', descripcion: 'INTENTOS EXCEDIDOS', mensaje_terminal: 'Intentos excedidos', type: 'error' },
        { codigo: '39', descripcion: 'NO HAY CUENTA', mensaje_terminal: 'No hay cuenta', type: 'error' },
        { codigo: '40', descripcion: 'FUNCION NO SOPORTADA', mensaje_terminal: 'Función no soportada', type: 'error' },
        { codigo: '41', descripcion: 'TARJETA PERDIDA', mensaje_terminal: 'Tarjeta perdida', type: 'error' },
        { codigo: '42', descripcion: 'NO HAY CUENTA', mensaje_terminal: 'No hay cuenta', type: 'error' },
        { codigo: '43', descripcion: 'TARJETA ROBADA', mensaje_terminal: 'Tarjeta robada', type: 'error' },
        { codigo: '44', descripcion: 'NO HAY CUENTA', mensaje_terminal: 'No hay cuenta', type: 'error' },
        { codigo: '51', descripcion: 'FONDOS INSUFICIENTES', mensaje_terminal: 'Fondos insuficientes', type: 'error' },
        { codigo: '52', descripcion: 'NO HAY CUENTA CHEQUES', mensaje_terminal: 'No hay cuenta cheques', type: 'error' },
        { codigo: '53', descripcion: 'NO HAY CUENTA', mensaje_terminal: 'No hay cuenta', type: 'error' },
        { codigo: '54', descripcion: 'TARJETA EXPIRADA', mensaje_terminal: 'Tarjeta expirada', type: 'error' },
        { codigo: '55', descripcion: 'PIN INCORRECTO', mensaje_terminal: 'PIN incorrecto', type: 'error' },
        { codigo: '56', descripcion: 'TARJETA INVALIDA', mensaje_terminal: 'Tarjeta inválida', type: 'error' },
        { codigo: '57', descripcion: 'TRANSACCION NO PERMITIDA', mensaje_terminal: 'Transacción no permitida', type: 'error' },
        { codigo: '58', descripcion: 'TRANSACCION NO PERMITIDA', mensaje_terminal: 'Transacción no permitida', type: 'error' },
        { codigo: '59', descripcion: 'SOSPECHA DE FRAUDE', mensaje_terminal: 'Sospecha de fraude', type: 'error' },
        { codigo: '60', descripcion: 'CONTACTAR EMISOR', mensaje_terminal: 'Contactar emisor', type: 'warning' },
        { codigo: '61', descripcion: 'LIMITE DE RETIRO EXCEDIDO', mensaje_terminal: 'Límite de retiro excedido', type: 'error' },
        { codigo: '62', descripcion: 'RESTRINGIDA', mensaje_terminal: 'Restringida', type: 'error' },
        { codigo: '63', descripcion: 'VIOLACION DE SEGURIDAD', mensaje_terminal: 'Violación de seguridad', type: 'error' },
        { codigo: '64', descripcion: 'MONTO ORIGINAL INCORRECTO', mensaje_terminal: 'Monto original incorrecto', type: 'error' },
        { codigo: '65', descripcion: 'LIMITE DE FRECUENCIA EXCEDIDO', mensaje_terminal: 'Límite de frecuencia excedido', type: 'error' },
        { codigo: '66', descripcion: 'CONTACTAR EMISOR', mensaje_terminal: 'Contactar emisor', type: 'warning' },
        { codigo: '67', descripcion: 'CAPTURA PARCIAL', mensaje_terminal: 'Captura parcial', type: 'warning' },
        { codigo: '68', descripcion: 'RESPUESTA TARDIA', mensaje_terminal: 'Respuesta tardía', type: 'warning' },
        { codigo: '75', descripcion: 'INTENTOS DE PIN EXCEDIDOS', mensaje_terminal: 'Intentos de PIN excedidos', type: 'error' },
        { codigo: '76', descripcion: 'REVERSO INCORRECTO', mensaje_terminal: 'Reverso incorrecto', type: 'error' },
        { codigo: '77', descripcion: 'INTENTOS DE PIN EXCEDIDOS', mensaje_terminal: 'Intentos de PIN excedidos', type: 'error' },
        { codigo: '78', descripcion: 'NO HAY CUENTA', mensaje_terminal: 'No hay cuenta', type: 'error' },
        { codigo: '79', descripcion: 'CUERRA DE SESION', mensaje_terminal: 'Cierre de sesión', type: 'error' },
        { codigo: '80', descripcion: 'ERROR TEMPORAL', mensaje_terminal: 'Error temporal', type: 'warning' },
        { codigo: '81', descripcion: 'ERROR DE CRIPTOGRAFIA', mensaje_terminal: 'Error de criptografía', type: 'error' },
        { codigo: '82', descripcion: 'ERROR DE CRIPTOGRAFIA', mensaje_terminal: 'Error de criptografía', type: 'error' },
        { codigo: '83', descripcion: 'ERROR DE CRIPTOGRAFIA', mensaje_terminal: 'Error de criptografía', type: 'error' },
        { codigo: '84', descripcion: 'TRANSACCION INVALIDA', mensaje_terminal: 'Transacción inválida', type: 'error' },
        { codigo: '85', descripcion: 'NO HAY RAZON', mensaje_terminal: 'No hay razón', type: 'error' },
        { codigo: '86', descripcion: 'NO HAY RAZON', mensaje_terminal: 'No hay razón', type: 'error' },
        { codigo: '87', descripcion: 'NO HAY RAZON', mensaje_terminal: 'No hay razón', type: 'error' },
        { codigo: '88', descripcion: 'ERROR DE CRIPTOGRAFIA', mensaje_terminal: 'Error de criptografía', type: 'error' },
        { codigo: '89', descripcion: 'ERROR DE CRIPTOGRAFIA', mensaje_terminal: 'Error de criptografía', type: 'error' },
        { codigo: '90', descripcion: 'CORTE DE DIA', mensaje_terminal: 'Corte de día', type: 'warning' },
        { codigo: '91', descripcion: 'EMISOR NO DISPONIBLE', mensaje_terminal: 'Emisor no disponible', type: 'warning' },
        { codigo: '92', descripcion: 'IMPOSIBLE CONECTAR', mensaje_terminal: 'Imposible conectar', type: 'warning' },
        { codigo: '93', descripcion: 'TRANSACCION INVALIDA', mensaje_terminal: 'Transacción inválida', type: 'error' },
        { codigo: '94', descripcion: 'TRANSACCION DUPLICADA', mensaje_terminal: 'Transacción duplicada', type: 'error' },
        { codigo: '95', descripcion: 'ERROR DE CRIPTOGRAFIA', mensaje_terminal: 'Error de criptografía', type: 'error' },
        { codigo: '96', descripcion: 'ERROR DEL SISTEMA', mensaje_terminal: 'Error del sistema', type: 'error' },
        { codigo: '97', descripcion: 'REVERSO INCORRECTO', mensaje_terminal: 'Reverso incorrecto', type: 'error' },
        { codigo: '98', descripcion: 'ERROR TEMPORAL', mensaje_terminal: 'Error temporal', type: 'warning' },
        { codigo: '99', descripcion: 'ERROR TEMPORAL', mensaje_terminal: 'Error temporal', type: 'warning' }
      ];

      // Insert the response codes
      for (const code of responseCodes) {
        await db.seq.query(
          `INSERT INTO selia_error_codes (codigo, descripcion, mensaje_terminal, type) VALUES (?, ?, ?, ?)`,
          { 
            replacements: [code.codigo, code.descripcion, code.mensaje_terminal, code.type],
            type: db.seq.QueryTypes.INSERT 
          }
        );
      }

      console.log(`✅ Successfully inserted ${responseCodes.length} response codes`);
    } else {
      console.log('✅ Response codes table already has data');
      
      // Show some sample codes
      const sampleCodesResult = await db.seq.query(
        `SELECT codigo, descripcion, mensaje_terminal, type FROM selia_error_codes ORDER BY codigo LIMIT 10`,
        { type: db.seq.QueryTypes.SELECT }
      );
      
      const sampleCodes = Array.isArray(sampleCodesResult) ? sampleCodesResult : [];
      
      console.log('\nSample response codes:');
      sampleCodes.forEach(code => {
        console.log(`  ${code.codigo}: ${code.descripcion} (${code.type})`);
      });
    }

    // Test the getResponseCodeLabels method directly
    console.log('\n=== Testing getResponseCodeLabels method ===');
    
    // Create a simple test function with the same logic as the controller
    const testGetResponseCodeLabels = async () => {
      try {
        const results = await db.seq.query(
          `SELECT codigo, descripcion, mensaje_terminal, type FROM selia_error_codes ORDER BY codigo`,
          { type: db.seq.QueryTypes.SELECT }
        );
        
        const codeMap = {};
        if (results && Array.isArray(results)) {
          results.forEach(row => {
            if (row && row.codigo !== undefined) {
              codeMap[row.codigo.toString()] = {
                description: row.descripcion,
                terminalMessage: row.mensaje_terminal,
                type: row.type
              };
            }
          });
        } else if (results) {
          // Handle case where results is not an array (might be an object with array property)
          const dataArray = results[0] ? (Array.isArray(results[0]) ? results[0] : [results[0]]) : [];
          dataArray.forEach(row => {
            if (row && row.codigo !== undefined) {
              codeMap[row.codigo.toString()] = {
                description: row.descripcion,
                terminalMessage: row.mensaje_terminal,
                type: row.type
              };
            }
          });
        }
        
        return codeMap;
      } catch (error) {
        console.error('Error fetching response code labels:', error);
        return {};
      }
    };
    
    const responseCodeLabels = await testGetResponseCodeLabels();
    
    console.log(`✅ Loaded ${Object.keys(responseCodeLabels).length} response code labels`);
    
    // Test specific codes
    const testCodes = ['00', '0', '01', '05', '51', '55'];
    console.log('\nTesting specific response codes:');
    testCodes.forEach(code => {
      const label = responseCodeLabels[code];
      if (label) {
        console.log(`  ${code}: ${label.description} (${label.type})`);
      } else {
        console.log(`  ${code}: NOT FOUND`);
      }
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

checkAndPopulateResponseCodes();
