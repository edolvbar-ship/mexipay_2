'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create the ldi_credentials table
    await queryInterface.createTable('ldi_credentials', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: 'Primary key for LDI credentials'
      },
      selia_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        comment: 'Selia identifier for the merchant'
      },
      username: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'LDI username for authentication'
      },
      password: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'LDI password for authentication'
      },
      secret: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'LDI secret key for authentication'
      },
      active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'Whether these credentials are active'
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now'),
        comment: 'Record creation timestamp'
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('now'),
        comment: 'Record last update timestamp'
      }
    });

    // Add indexes for better performance
    await queryInterface.addIndex('ldi_credentials', ['selia_id'], {
      name: 'idx_ldi_credentials_selia_id',
      unique: true,
      using: 'BTREE'
    });

    await queryInterface.addIndex('ldi_credentials', ['active'], {
      name: 'idx_ldi_credentials_active',
      using: 'BTREE'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove the table if rolling back
    await queryInterface.dropTable('ldi_credentials');
  }
};
