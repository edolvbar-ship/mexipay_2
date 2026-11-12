#!/usr/bin/env node

/**
 * DIRECT SQL FIX for production issues
 * Bypasses sequelize CLI and uses direct MySQL connection
 * Usage: node direct-fix-production.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function directFixProduction() {
  let connection;
  
  try {
    console.log('🔧 Starting DIRECT production fixes...');
    
    // Create direct MySQL connection like transactions.js
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME,
      timezone: 'local'
    });

    console.log('✅ Database connected successfully');

    // Step 1: Add id_giro column if it doesn't exist
    console.log('📦 Step 1: Adding id_giro column to merchant table...');
    try {
      await connection.execute(`
        ALTER TABLE merchant 
        ADD COLUMN id_giro INT NULL 
        COMMENT 'Foreign key to iso_giro table'
      `);
      console.log('✅ id_giro column added successfully');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ id_giro column already exists');
      } else {
        throw error;
      }
    }

    // Step 2: Add MCC Operations menu item to resources
    console.log('📦 Step 2: Adding MCC Operations menu item...');
    const [existingResources] = await connection.execute(
      'SELECT * FROM resources WHERE resource_url = ? LIMIT 1',
      ['/catalogos/mcc-operations']
    );
    
    if (existingResources.length === 0) {
      await connection.execute(`
        INSERT INTO resources (
          id, isF, icon, father_resource, resource_name, resource_url, 
          isConfig, isCrud, isGroup, justPage, created_at, updated_at
        ) VALUES (
          35, 0, NULL, 26, 'Operaciones MCC', '/catalogos/mcc-operations', 
          1, 0, 0, 0, NOW(), NOW()
        )
        ON DUPLICATE KEY UPDATE
          resource_name = VALUES(resource_name),
          resource_url = VALUES(resource_url),
          isConfig = VALUES(isConfig),
          updated_at = NOW()
      `);
      console.log('✅ MCC Operations menu item added successfully');
    } else {
      console.log('ℹ️ MCC Operations menu item already exists');
    }

    // Step 3: Create mcc_operations table if it doesn't exist
    console.log('📦 Step 3: Creating mcc_operations table...');
    try {
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS mcc_operations (
          id_operation INT AUTO_INCREMENT PRIMARY KEY,
          mcc_range_start VARCHAR(3) NOT NULL,
          mcc_range_end VARCHAR(3) NULL,
          name VARCHAR(100) NOT NULL,
          description VARCHAR(500) NULL,
          operation_code VARCHAR(20) NOT NULL,
          msg_type VARCHAR(4) NULL,
          processing_code VARCHAR(6) NULL,
          requires_amount INT NOT NULL DEFAULT 1,
          requires_tip INT NOT NULL DEFAULT 0,
          active INT NOT NULL DEFAULT 1,
          display_order INT NOT NULL DEFAULT 0,
          icon_name VARCHAR(50) NULL,
          creation_date DATETIME NOT NULL DEFAULT NOW(),
          updated_at DATETIME NOT NULL DEFAULT NOW(),
          UNIQUE KEY unique_mcc_operation (mcc_range_start, operation_code),
          KEY idx_mcc_range_start (mcc_range_start),
          KEY idx_mcc_range_end (mcc_range_end),
          KEY idx_operation_active (active),
          KEY idx_operation_code (operation_code)
        )
      `);
      console.log('✅ mcc_operations table created/verified successfully');
    } catch (error) {
      console.log('ℹ️ mcc_operations table might already exist:', error.message);
    }

    // Step 4: Insert sample MCC operations data
    console.log('📦 Step 4: Inserting MCC operations data...');
    const operations = [
      // 300-399: Travel & Entertainment
      ['300', '399', 'Check In', 'Registro de huésped y preautorización', 'CHECK_IN', '0200', '000000', 1, 0, 1, 1, 'login'],
      ['300', '399', 'Check Out', 'Pago final y cierre de cuenta', 'CHECK_OUT', '0200', '000000', 1, 1, 1, 2, 'logout'],
      ['300', '399', 'Venta con Propina', 'Procesamiento de venta con opción de propina', 'SALE_WITH_TIP', '0200', '000000', 1, 1, 1, 3, 'restaurant'],
      ['300', '399', 'Preautorización', 'Preautorización de monto', 'PREAUTH', '0200', '000000', 1, 0, 1, 4, 'lock'],
      ['300', '399', 'Cargo Adicional', 'Cargo adicional a habitación', 'ROOM_CHARGE', '0200', '000000', 1, 0, 1, 5, 'plus'],
      // 500-599: Retail Stores
      ['500', '599', 'Venta', 'Venta estándar de retail', 'SALE', '0200', '000000', 1, 0, 1, 1, 'shopping_cart'],
      ['500', '599', 'Devolución', 'Procesamiento de devolución', 'RETURN', '0220', '000000', 1, 0, 1, 2, 'return'],
      ['500', '599', 'Venta con Cuotas', 'Venta en cuotas (MSI)', 'INSTALLMENT_SALE', '0200', '000000', 1, 0, 1, 3, 'calendar'],
      ['500', '599', 'Orden de Compra', 'Creación de orden de compra para pago posterior', 'PURCHASE_ORDER', '0200', '000000', 1, 0, 1, 4, 'clipboard']
    ];

    for (const op of operations) {
      await connection.execute(`
        INSERT IGNORE INTO mcc_operations (
          mcc_range_start, mcc_range_end, name, description, operation_code, 
          msg_type, processing_code, requires_amount, requires_tip, active, 
          display_order, icon_name, creation_date, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, op);
    }
    console.log('✅ MCC operations data inserted successfully');

    console.log('🎉 ALL PRODUCTION FIXES COMPLETED SUCCESSFULLY!');
    console.log('📋 Summary:');
    console.log('  ✅ Added id_giro column to merchant table');
    console.log('  ✅ Added MCC Operations menu item');
    console.log('  ✅ Created mcc_operations table');
    console.log('  ✅ Inserted sample MCC operations data');
    console.log('🚀 MCC Operations should now be visible and working!');

  } catch (error) {
    console.error('❌ Error in direct fix:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

directFixProduction().catch(error => {
  console.error('💥 Critical error:', error);
  process.exit(1);
});
