'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add id_giro column to merchant table
    await queryInterface.addColumn('merchant', 'id_giro', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Foreign key to iso_giro table'
    });

    // Add index for faster lookups
    await queryInterface.addIndex('merchant', ['id_giro'], {
      name: 'idx_merchant_id_giro',
      using: 'BTREE'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove the column if rolling back
    await queryInterface.removeIndex('merchant', 'idx_merchant_id_giro');
    await queryInterface.removeColumn('merchant', 'id_giro');
  }
};
