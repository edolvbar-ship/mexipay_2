'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      global.dd('[Migration] Creating MSI BIN ranges table...');
      
      // Create msi_bin_ranges table
      await queryInterface.createTable('msi_bin_ranges', {
        id_msi_bin: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false
        },
        bin_start: {
          type: Sequelize.STRING(6),
          allowNull: false,
          validate: {
            isNumeric: true,
            len: [6, 6]
          }
        },
        bin_end: {
          type: Sequelize.STRING(6),
          allowNull: false,
          validate: {
            isNumeric: true,
            len: [6, 6]
          }
        },
        bank_name: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        card_brand: {
          type: Sequelize.STRING(50),
          allowNull: false,
          validate: {
            isIn: [['Visa', 'Mastercard', 'Amex', 'Discover']]
          }
        },
        country_code: {
          type: Sequelize.STRING(2),
          allowNull: false,
          defaultValue: 'MX'
        },
        active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      });

      // Add indexes for performance
      await queryInterface.addIndex('msi_bin_ranges', ['bin_start', 'bin_end']);
      await queryInterface.addIndex('msi_bin_ranges', ['card_brand']);
      await queryInterface.addIndex('msi_bin_ranges', ['country_code']);
      await queryInterface.addIndex('msi_bin_ranges', ['active']);

      global.dd('[Migration] MSI BIN ranges table created successfully');
      
    } catch (error) {
      console.error('[Migration] Error creating MSI BIN ranges table:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      global.dd('[Migration] Dropping MSI BIN ranges table...');
      
      await queryInterface.dropTable('msi_bin_ranges');
      
      global.dd('[Migration] MSI BIN ranges table dropped successfully');
      
    } catch (error) {
      console.error('[Migration] Error dropping MSI BIN ranges table:', error);
      throw error;
    }
  }
};