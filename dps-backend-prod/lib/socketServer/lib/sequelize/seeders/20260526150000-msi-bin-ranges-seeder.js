'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      console.log('[Seeder] Creating MSI BIN ranges for Mexican cards...');
      
      // Mexican BIN ranges for major banks and financial institutions
      const mexicanBinRanges = [
        // Visa ranges
        {
          bin_start: '400000',
          bin_end: '499999',
          bank_name: 'Visa Mexico',
          card_brand: 'Visa',
          country_code: 'MX',
          active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          bin_start: '450000', 
          bin_end: '459999',
          bank_name: 'Bancomer Visa',
          card_brand: 'Visa',
          country_code: 'MX',
          active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          bin_start: '470000',
          bin_end: '479999', 
          bank_name: 'Banorte Visa',
          card_brand: 'Visa',
          country_code: 'MX',
          active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        
        // Mastercard ranges
        {
          bin_start: '510000',
          bin_end: '559999',
          bank_name: 'Mastercard Mexico',
          card_brand: 'Mastercard',
          country_code: 'MX',
          active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          bin_start: '520000',
          bin_end: '529999',
          bank_name: 'Bancomer Mastercard',
          card_brand: 'Mastercard',
          country_code: 'MX',
          active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          bin_start: '530000',
          bin_end: '539999',
          bank_name: 'Banorte Mastercard',
          card_brand: 'Mastercard',
          country_code: 'MX',
          active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          bin_start: '540000',
          bin_end: '549999',
          bank_name: 'Santander Mastercard',
          card_brand: 'Mastercard',
          country_code: 'MX',
          active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          bin_start: '550000',
          bin_end: '559999',
          bank_name: 'HSBC Mastercard',
          card_brand: 'Mastercard',
          country_code: 'MX',
          active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        
        // American Express ranges
        {
          bin_start: '340000',
          bin_end: '349999',
          bank_name: 'American Express Mexico',
          card_brand: 'Amex',
          country_code: 'MX',
          active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          bin_start: '370000',
          bin_end: '379999',
          bank_name: 'Amex Bancomer',
          card_brand: 'Amex',
          country_code: 'MX',
          active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        
        // Additional Mexican bank ranges
        {
          bin_start: '480000',
          bin_end: '489999',
          bank_name: 'Banorte Visa Additional',
          card_brand: 'Visa',
          country_code: 'MX',
          active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          bin_start: '490000',
          bin_end: '499999',
          bank_name: 'Santander Visa',
          card_brand: 'Visa',
          country_code: 'MX',
          active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          bin_start: '560000',
          bin_end: '569999',
          bank_name: 'HSBC Visa',
          card_brand: 'Visa',
          country_code: 'MX',
          active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          bin_start: '570000',
          bin_end: '579999',
          bank_name: 'Citibanamex Visa',
          card_brand: 'Visa',
          country_code: 'MX',
          active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          bin_start: '580000',
          bin_end: '589999',
          bank_name: 'Scotiabank Visa',
          card_brand: 'Visa',
          country_code: 'MX',
          active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          bin_start: '590000',
          bin_end: '599999',
          bank_name: 'Inbursa Visa',
          card_brand: 'Visa',
          country_code: 'MX',
          active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];
      
      // Insert BIN ranges using bulkInsert
      await queryInterface.bulkInsert('msi_bin_ranges', mexicanBinRanges);
      
      console.log(`[Seeder] Successfully created ${mexicanBinRanges.length} Mexican BIN ranges`);
      
    } catch (error) {
      console.error('[Seeder] Error creating MSI BIN ranges:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      console.log('[Seeder] Removing MSI BIN ranges...');
      
      await queryInterface.bulkDelete('msi_bin_ranges', {
        country_code: 'MX'
      });
      
      console.log('[Seeder] Successfully removed Mexican BIN ranges');
      
    } catch (error) {
      console.error('[Seeder] Error removing MSI BIN ranges:', error);
      throw error;
    }
  }
};
