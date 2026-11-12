'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🚀 Adding is_merchant_scoped field to resources table...');
    
    // Check if column already exists
    const tableDescription = await queryInterface.describeTable('resources');
    
    if (tableDescription.is_merchant_scoped) {
      console.log('✅ is_merchant_scoped column already exists');
      return;
    }
    
    // Add the is_merchant_scoped column
    await queryInterface.addColumn('resources', 'is_merchant_scoped', {
      type: Sequelize.BOOLEAN,
      defaultValue: 0, // Default to false (platform-wide access)
      allowNull: false,
      comment: 'Whether this resource should be filtered by merchant access'
    });
    
    console.log('✅ is_merchant_scoped column added to resources table');
    
    // Update existing movimientos resources to be merchant-scoped
    const movimientosUrls = [
      '/movimientos/transacciones',
      '/movimientos/transacciones-mejoradas', 
      '/movimientos/pos-json',
      '/movimientos/tickets',
      '/movimientos/contracargos'
    ];
    
    await queryInterface.sequelize.query(`
      UPDATE resources 
      SET is_merchant_scoped = 1 
      WHERE resource_url IN (?)
    `, {
      replacements: [movimientosUrls],
      type: Sequelize.QueryTypes.UPDATE
    });
    
    console.log('✅ Existing movimientos resources updated to be merchant-scoped');
    console.log('🎉 Merchant filtering is now enabled for movimientos section');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🗑️ Removing is_merchant_scoped field from resources table...');
    
    // Remove the column
    await queryInterface.removeColumn('resources', 'is_merchant_scoped');
    
    console.log('✅ is_merchant_scoped column removed from resources table');
  }
};
