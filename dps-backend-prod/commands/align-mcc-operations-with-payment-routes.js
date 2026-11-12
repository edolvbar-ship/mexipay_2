#!/usr/bin/env node

/**
 * Align MCC Operations with Payment Processing Routes
 * 
 * This script aligns the MCC operations system with the actual payment processing
 * routes defined in the analysis document. It removes the 95 duplicate
 * operations and creates the 22 correct operations that the payment system
 * actually uses.
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gw_db',
  multipleStatements: true
};

/**
 * Define the 22 correct operations from the analysis document
 */
const CORRECT_OPERATIONS = [
  {
    operation_code: 'ADJUSTMENT',
    name: 'Ajuste',
    description: 'Ajuste de transacción',
    msg_type: '0200',
    processing_code: '000000',
    requires_amount: 1,
    requires_tip: 0,
    display_order: 1,
    icon_name: 'edit',
    category_code: 'RETAIL_5XX'
  },
  {
    operation_code: 'CHECK_IN',
    name: 'Check In',
    description: 'Registro de huésped y preautorización',
    msg_type: '0200',
    processing_code: '000000',
    requires_amount: 1,
    requires_tip: 0,
    display_order: 2,
    icon_name: 'login',
    category_code: 'FOOD_58X'
  },
  {
    operation_code: 'CHECK_OUT',
    name: 'Check Out',
    description: 'Pago final y cierre de cuenta',
    msg_type: '0200',
    processing_code: '000000',
    requires_amount: 1,
    requires_tip: 1,
    display_order: 3,
    icon_name: 'logout',
    category_code: 'FOOD_58X'
  },
  {
    operation_code: 'DEPOSIT',
    name: 'Depósito',
    description: 'Depósito para garantía o servicios',
    msg_type: '0200',
    processing_code: '000000',
    requires_amount: 1,
    requires_tip: 0,
    display_order: 4,
    icon_name: 'download',
    category_code: 'BUSINESS_7XX'
  },
  {
    operation_code: 'DISTANCE_FARE',
    name: 'Tarifa por Distancia',
    description: 'Cálculo basado en distancia recorrida',
    msg_type: '0200',
    processing_code: '000000',
    requires_amount: 1,
    requires_tip: 1,
    display_order: 5,
    icon_name: 'route',
    category_code: 'TRANSPORT_4XX'
  },
  {
    operation_code: 'EDUCATION_PAYMENT',
    name: 'Educación',
    description: 'Pago por servicios educativos',
    msg_type: '0200',
    processing_code: '000000',
    requires_amount: 1,
    requires_tip: 0,
    display_order: 6,
    icon_name: 'book',
    category_code: 'PROFESSIONAL_8XX'
  },
  {
    operation_code: 'INSTALLMENT_SALE',
    name: 'Venta con Cuotas',
    description: 'Venta en cuotas (MSI)',
    msg_type: '0200',
    processing_code: '000000',
    requires_amount: 1,
    requires_tip: 0,
    display_order: 7,
    icon_name: 'calendar',
    category_code: 'RETAIL_5XX'
  },
  {
    operation_code: 'MEDICAL_PAYMENT',
    name: 'Consulta Médica',
    description: 'Pago por servicios médicos',
    msg_type: '0200',
    processing_code: '000000',
    requires_amount: 1,
    requires_tip: 0,
    display_order: 8,
    icon_name: 'medical',
    category_code: 'PROFESSIONAL_8XX'
  },
  {
    operation_code: 'PHARMACY_PAYMENT',
    name: 'Pago de Farmacia',
    description: 'Compra en farmacia',
    msg_type: '0200',
    processing_code: '000000',
    requires_amount: 1,
    requires_tip: 0,
    display_order: 9,
    icon_name: 'pill',
    category_code: 'RETAIL_5XX'
  },
  {
    operation_code: 'PREAUTHORIZATION',
    name: 'Preautorización',
    description: 'Preautorización de monto',
    msg_type: '0200',
    processing_code: '000000',
    requires_amount: 1,
    requires_tip: 0,
    display_order: 10,
    icon_name: 'lock',
    category_code: 'RETAIL_5XX'
  },
  {
    operation_code: 'PREPAY',
    name: 'Prepago',
    description: 'Recarga o prepago de servicios',
    msg_type: '0200',
    processing_code: '000000',
    requires_amount: 1,
    requires_tip: 0,
    display_order: 11,
    icon_name: 'wallet',
    category_code: 'TRANSPORT_4XX'
  },
  {
    operation_code: 'PROFESSIONAL_SERVICE',
    name: 'Servicio Profesional',
    description: 'Pago por servicios profesionales',
    msg_type: '0200',
    processing_code: '000000',
    requires_amount: 1,
    requires_tip: 0,
    display_order: 12,
    icon_name: 'user_tie',
    category_code: 'PROFESSIONAL_8XX'
  },
  {
    operation_code: 'PURCHASE_ORDER',
    name: 'Orden de Compra',
    description: 'Creación de orden de compra para pago posterior',
    msg_type: '0200',
    processing_code: '000000',
    requires_amount: 1,
    requires_tip: 0,
    display_order: 13,
    icon_name: 'clipboard',
    category_code: 'RETAIL_5XX'
  },
  {
    operation_code: 'RENT_IN',
    name: 'Renta In',
    description: 'Inicio de contrato de renta',
    msg_type: '0200',
    processing_code: '000000',
    requires_amount: 1,
    requires_tip: 0,
    display_order: 14,
    icon_name: 'arrow_in',
    category_code: 'BUSINESS_7XX'
  },
  {
    operation_code: 'RENT_OUT',
    name: 'Renta Out',
    description: 'Fin de contrato de renta y cobro final',
    msg_type: '0200',
    processing_code: '000000',
    requires_amount: 1,
    requires_tip: 0,
    display_order: 15,
    icon_name: 'arrow_out',
    category_code: 'BUSINESS_7XX'
  },
  {
    operation_code: 'RETURN',
    name: 'Devolución',
    description: 'Procesamiento de devolución',
    msg_type: '0220',
    processing_code: '000000',
    requires_amount: 1,
    requires_tip: 0,
    display_order: 16,
    icon_name: 'return',
    category_code: 'RETAIL_5XX'
  },
  {
    operation_code: 'REAUTHORIZATION',
    name: 'Reautorización',
    description: 'Extender límite de cuenta',
    msg_type: '0200',
    processing_code: '000000',
    requires_amount: 1,
    requires_tip: 0,
    display_order: 17,
    icon_name: 'refresh',
    category_code: 'RETAIL_5XX'
  },
  {
    operation_code: 'ROOM_CHARGE',
    name: 'Cargo Adicional',
    description: 'Cargo adicional a habitación',
    msg_type: '0200',
    processing_code: '000000',
    requires_amount: 1,
    requires_tip: 0,
    display_order: 18,
    icon_name: 'plus',
    category_code: 'FOOD_58X'
  },
  {
    operation_code: 'SALE',
    name: 'Venta',
    description: 'Venta estándar',
    msg_type: '0200',
    processing_code: '000000',
    requires_amount: 1,
    requires_tip: 0,
    display_order: 19,
    icon_name: 'shopping_cart',
    category_code: 'RETAIL_5XX'
  },
  {
    operation_code: 'SALE_WITH_TIP',
    name: 'Venta con Propina',
    description: 'Procesamiento de venta con opción de propina',
    msg_type: '0200',
    processing_code: '000000',
    requires_amount: 1,
    requires_tip: 1,
    display_order: 20,
    icon_name: 'restaurant',
    category_code: 'FOOD_58X'
  },
  {
    operation_code: 'SERVICE_PAYMENT',
    name: 'Pago de Servicio',
    description: 'Pago por servicios profesionales',
    msg_type: '0200',
    processing_code: '000000',
    requires_amount: 1,
    requires_tip: 0,
    display_order: 21,
    icon_name: 'briefcase',
    category_code: 'PROFESSIONAL_8XX'
  },
  {
    operation_code: 'TRANSPORT_PAYMENT',
    name: 'Pago de Transporte',
    description: 'Pago por servicios de transporte',
    msg_type: '0200',
    processing_code: '000000',
    requires_amount: 1,
    requires_tip: 1,
    display_order: 22,
    icon_name: 'car',
    category_code: 'TRANSPORT_4XX'
  }
];

/**
 * Analyze current state and show the mismatch
 */
async function analyzeCurrentState() {
  console.log('🔍 Analyzing Current MCC Operations State');
  console.log('==========================================\n');
  
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // Get current operations count
    const [currentResult] = await connection.execute('SELECT COUNT(*) as count FROM mcc_operations');
    console.log(`📊 Current operations in database: ${currentResult[0].count}`);
    
    // Get unique operation codes
    const [uniqueResult] = await connection.execute(`
      SELECT DISTINCT operation_code, COUNT(*) as count 
      FROM mcc_operations 
      GROUP BY operation_code 
      ORDER BY count DESC
    `);
    
    console.log('\n📋 Current Operation Codes:');
    uniqueResult.forEach(op => {
      console.log(`  ${op.operation_code}: ${op.count} occurrences`);
    });
    
    // Show what should be vs what is
    console.log('\n🎯 Expected vs Actual:');
    console.log(`  Expected operations: ${CORRECT_OPERATIONS.length}`);
    console.log(`  Actual operations: ${currentResult[0].count}`);
    console.log(`  Expected unique codes: ${CORRECT_OPERATIONS.length}`);
    console.log(`  Actual unique codes: ${uniqueResult.length}`);
    
    // Show operations that should exist but don't
    const expectedCodes = CORRECT_OPERATIONS.map(op => op.operation_code);
    const actualCodes = uniqueResult.map(op => op.operation_code);
    
    const missing = expectedCodes.filter(code => !actualCodes.includes(code));
    const extra = actualCodes.filter(code => !expectedCodes.includes(code));
    
    if (missing.length > 0) {
      console.log('\n❌ Missing expected operations:');
      missing.forEach(code => {
        const expected = CORRECT_OPERATIONS.find(op => op.operation_code === code);
        console.log(`  ${code}: ${expected.name}`);
      });
    }
    
    if (extra.length > 0) {
      console.log('\n⚠️  Extra operations not in expected list:');
      extra.forEach(code => {
        console.log(`  ${code}: Should be removed`);
      });
    }
    
    return {
      currentCount: currentResult[0].count,
      expectedCount: CORRECT_OPERATIONS.length,
      missing,
      extra
    };
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

/**
 * Fix the operations by replacing with correct ones
 */
async function fixOperations() {
  console.log('\n🛠️  Fixing MCC Operations');
  console.log('=============================\n');
  
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // Create backup
    await connection.execute('CREATE TABLE mcc_operations_backup AS SELECT * FROM mcc_operations');
    console.log('✅ Created backup table: mcc_operations_backup');
    
    // Clear existing operations
    await connection.execute('DELETE FROM mcc_operations');
    console.log('✅ Cleared existing operations');
    
    // Insert correct operations
    for (const op of CORRECT_OPERATIONS) {
      await connection.execute(`
        INSERT INTO mcc_operations (
          operation_code, name, description, msg_type, processing_code,
          requires_amount, requires_tip, display_order, icon_name, category_code,
          active, creation_date, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
      `, [
        op.operation_code, op.name, op.description, op.msg_type, op.processing_code,
        op.requires_amount, op.requires_tip, op.display_order, op.icon_name, op.category_code
      ]);
      
      console.log(`✅ Created: ${op.name} (${op.operation_code})`);
    }
    
    console.log(`\n🎉 Created ${CORRECT_OPERATIONS.length} correct operations`);
    
    // Verify the fix
    const [verifyResult] = await connection.execute('SELECT COUNT(*) as count FROM mcc_operations');
    console.log(`\n📊 Verification: ${verifyResult[0].count} operations in database`);
    
    // Show final operations list
    const [finalOps] = await connection.execute(`
      SELECT operation_code, name, category_code, display_order
      FROM mcc_operations 
      ORDER BY display_order, operation_code
    `);
    
    console.log('\n📋 Final Operations List:');
    finalOps.forEach(op => {
      console.log(`  ${op.display_order}. ${op.name} (${op.operation_code}) - ${op.category_code}`);
    });
    
    return verifyResult[0].count;
    
  } catch (error) {
    console.error('❌ Fix failed:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

/**
 * Main function
 */
async function alignMccOperationsWithPaymentRoutes() {
  console.log('🔧 Align MCC Operations with Payment Routes');
  console.log('=====================================\n');
  
  try {
    // Step 1: Analyze current state
    const analysis = await analyzeCurrentState();
    
    console.log('\n📊 Analysis Summary:');
    console.log(`  Current operations: ${analysis.currentCount}`);
    console.log(`  Expected operations: ${analysis.expectedCount}`);
    console.log(`  Missing operations: ${analysis.missing.length}`);
    console.log(`  Extra operations: ${analysis.extra.length}`);
    
    if (analysis.missing.length === 0 && analysis.extra.length === 0) {
      console.log('\n✅ Operations are already correctly aligned!');
      return;
    }
    
    // Step 2: Confirm fix
    console.log('\n⚠️  WARNING: This will:');
    console.log('  1. Backup current operations to mcc_operations_backup');
    console.log('  2. Remove all duplicate/incorrect operations');
    console.log(`  3. Create ${analysis.expectedCount} correct operations`);
    console.log('  4. Align with payment processing routes');
    
    // Step 3: Apply fix
    const finalCount = await fixOperations();
    
    console.log('\n🎉 Alignment completed successfully!');
    console.log('\n📝 Next Steps:');
    console.log('1. Test payment processing routes with correct operations');
    console.log('2. Verify MCC operations view shows 22 operations');
    console.log('3. Remove backup when confirmed: DROP TABLE mcc_operations_backup');
    console.log('4. Update any frontend code that expects the old operations');
    
  } catch (error) {
    console.error('❌ Alignment failed:', error.message);
    throw error;
  }
}

// Run the alignment
if (require.main === module) {
  alignMccOperationsWithPaymentRoutes()
    .then(() => {
      console.log('\n🏁 MCC operations alignment completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Alignment failed:', error);
      process.exit(1);
    });
}

module.exports = {
  alignMccOperationsWithPaymentRoutes,
  CORRECT_OPERATIONS,
  analyzeCurrentState,
  fixOperations
};
