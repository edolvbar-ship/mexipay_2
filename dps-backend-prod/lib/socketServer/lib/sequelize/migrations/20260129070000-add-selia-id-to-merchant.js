'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add selia_id column to merchant table
    await queryInterface.addColumn('merchant', 'selia_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Selia identifier for the merchant'
    });

    // Optional: Add index for faster lookups
    await queryInterface.addIndex('merchant', ['selia_id'], {
      name: 'idx_merchant_selia_id',
      using: 'BTREE'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove the column if rolling back
    await queryInterface.removeColumn('merchant', 'selia_id');
  }
};