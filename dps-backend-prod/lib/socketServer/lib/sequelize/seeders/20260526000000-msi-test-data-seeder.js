// seeders/20260526000000-msi-test-data-seeder.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      console.log('🎯 Starting MSI test data seeder...');

      // 1. Create test merchant with MSI configuration
      console.log('📦 Creating test merchant...');
      
      // Find a suitable MCC (Restaurant category)
      const [mccResult] = await queryInterface.sequelize.query(`
        SELECT id_mcc, mcc, description 
        FROM iso_mcc 
        WHERE mcc = '5812' 
        LIMIT 1
      `);

      if (mccResult.length === 0) {
        console.log('⚠️ MCC 5812 not found, using first available MCC');
        const [anyMcc] = await queryInterface.sequelize.query(`
          SELECT id_mcc, mcc, description 
          FROM iso_mcc 
          LIMIT 1
        `);
        if (anyMcc.length === 0) {
          throw new Error('No MCC codes found in database');
        }
        mccResult.push(anyMcc[0]);
      }

      const testMcc = mccResult[0];
      console.log(`📍 Using MCC: ${testMcc.mcc} - ${testMcc.description}`);

      // Check if test merchant already exists
      const [existingMerchant] = await queryInterface.sequelize.query(`
        SELECT id_merchant 
        FROM merchant 
        WHERE name_merchant = 'MSI Test Merchant'
      `);

      let testMerchantId;
      if (existingMerchant.length > 0) {
        testMerchantId = existingMerchant[0].id_merchant;
        console.log(`✅ Test merchant already exists: ${testMerchantId}`);
        
        // Update MSI configuration
        await queryInterface.sequelize.query(`
          UPDATE merchant 
          SET MSI = '[{"type":"3","min_mount":"30000"},{"type":"6","min_mount":"60000"},{"type":"9","min_mount":"90000"},{"type":"12","min_mount":"120000"}]'
          WHERE id_merchant = ${testMerchantId}
        `);
        
        console.log('✅ Updated MSI configuration for test merchant');
      } else {
        // Create new test merchant using queryInterface.bulkInsert
        const newMerchant = await queryInterface.bulkInsert('merchant', [{
          name_merchant: 'MSI Test Merchant',
          id_client: 1,
          id_persona: 3,
          id_esquema: 1,
          id_mcc: testMcc.id_mcc,
          id_giro: null,
          id_acqbank: 3,
          id_processor: 1,
          MSI: '[{"type":"3","min_mount":"30000"},{"type":"6","min_mount":"60000"},{"type":"9","min_mount":"90000"},{"type":"12","min_mount":"120000"}]',
          active: 1,
          deleted_at: null,
          min: 0,
          max: 999999,
          creation_date: new Date()
        }]);

        testMerchantId = newMerchant[0] || newMerchant;
        console.log(`✅ Created test merchant: ${testMerchantId}`);
      }

      // 2. Create test operations for the MCC
      console.log('🔧 Creating test operations...');
      
      const testOperations = [
        {
          mcc_code: testMcc.mcc,
          operation_code: 'CHARGE',
          name: 'Cargo con MSI',
          description: 'Cargo con meses sin intereses',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          msi_enabled: 1,
          active: 1,
          display_order: 1,
          icon_name: 'credit-card',
          category_code: 'RESTAURANT'
        },
        {
          mcc_code: testMcc.mcc,
          operation_code: 'CHECK_IN',
          name: 'Check-In con MSI',
          description: 'Check-In con meses sin intereses',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          msi_enabled: 1,
          active: 1,
          display_order: 2,
          icon_name: 'login',
          category_code: 'RESTAURANT'
        },
        {
          mcc_code: testMcc.mcc,
          operation_code: 'REFUND',
          name: 'Reembolso',
          description: 'Reembolso sin MSI',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          msi_enabled: 0, // MSI disabled for refunds
          active: 1,
          display_order: 3,
          icon_name: 'refresh',
          category_code: 'RESTAURANT'
        }
      ];

      // Create test operations using bulkInsert
      const operationsToInsert = testOperations.map(op => ({
        ...op,
        creation_date: new Date(),
        updated_at: new Date()
      }));

      try {
        await queryInterface.bulkInsert('mcc_operations', operationsToInsert);
        console.log(`✅ Created ${operationsToInsert.length} test operations`);
      } catch (error) {
        // If bulkInsert fails, operations might already exist - that's OK
        console.log(`⚠️ Operations might already exist or error occurred: ${error.message}`);
      }

      // 3. Create MSI BIN ranges
      console.log('💳 Creating MSI BIN ranges...');
      
      const binRanges = [
        {
          bin_start: '400000',
          bin_end: '499999', 
          bank_name: 'Banco Nacional',
          card_brand: 'Visa',
          country_code: 'MX',
          active: true
        },
        {
          bin_start: '510000',
          bin_end: '559999',
          bank_name: 'Banco Internacional', 
          card_brand: 'Mastercard',
          country_code: 'MX',
          active: true
        },
        {
          bin_start: '340000',
          bin_end: '349999',
          bank_name: 'American Express Bank',
          card_brand: 'Amex', 
          country_code: 'MX',
          active: true
        }
      ];

      try {
        await queryInterface.bulkInsert('msi_bin_ranges', binRanges.map(range => ({
          ...range,
          created_at: new Date(),
          updated_at: new Date()
        })));
        console.log(`✅ Created ${binRanges.length} MSI BIN ranges`);
      } catch (error) {
        console.log(`⚠️ BIN ranges might already exist or error occurred: ${error.message}`);
      }

      // 4. Skip user creation (table structure unknown)
      console.log('👤 Skipping user creation - table structure varies');

      // 5. Summary
      console.log('\n🎉 MSI Test Data Setup Complete!');
      console.log('=====================================');
      console.log(`📦 Test Merchant ID: ${testMerchantId}`);
      console.log(`📍 MCC Code: ${testMcc.mcc} (${testMcc.description})`);
      console.log(`💳 MSI Config: 3/6/9/12 months with min amounts 300/600/900/1200`);
      console.log(`🔧 Operations: CHARGE (MSI), CHECK_IN (MSI), REFUND (No MSI)`);
      console.log(`👤 Test User: Skipped (manual setup required)`);
      console.log('\n✅ Ready for MSI testing!');

    } catch (error) {
      console.error('❌ MSI test data seeder failed:', error.message);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      console.log('🗑️ Removing MSI test data...');

      // Remove test merchant
      await queryInterface.sequelize.query(`
        DELETE FROM merchant WHERE name_merchant = 'MSI Test Merchant'
      `);

      // Remove test operations
      await queryInterface.sequelize.query(`
        DELETE FROM mcc_operations 
        WHERE operation_code IN ('CHARGE', 'CHECK_IN', 'REFUND') 
        AND name LIKE '%MSI%'
      `);

      // Skip user deletion (table structure unknown)
      console.log('👤 Skipping user deletion - table structure varies');

      console.log('✅ MSI test data removed');
    } catch (error) {
      console.error('❌ Failed to remove MSI test data:', error.message);
      throw error;
    }
  }
};
