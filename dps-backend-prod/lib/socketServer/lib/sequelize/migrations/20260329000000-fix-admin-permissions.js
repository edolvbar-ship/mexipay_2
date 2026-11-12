'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      console.log('🔧 Fixing admin profile permissions...');
      
      // Add missing permissions for admin profile (id_profile = 1)
      const missingPermissions = [
        // Catálogos section
        {id_profile: 1, id_resource: 35, create: 1, edit: 1, delete: 1, select: 1}, // Operaciones MCC
        {id_profile: 1, id_resource: 41, create: 1, edit: 1, delete: 1, select: 1}, // Perfiles Transaccionales
        
        // Archivos section
        {id_profile: 1, id_resource: 42, create: 1, edit: 1, delete: 1, select: 1}, // Archivos (parent)
        {id_profile: 1, id_resource: 43, create: 1, edit: 1, delete: 1, select: 1}, // Conciliación
        {id_profile: 1, id_resource: 44, create: 1, edit: 1, delete: 1, select: 1}, // Contracargos (Archivos)
        {id_profile: 1, id_resource: 46, create: 1, edit: 1, delete: 1, select: 1}, // Liquidación (Archivos)
        
        // Links section
        {id_profile: 1, id_resource: 47, create: 1, edit: 1, delete: 1, select: 1}, // Links (parent)
        {id_profile: 1, id_resource: 48, create: 1, edit: 1, delete: 1, select: 1}, // Generación de Links
        {id_profile: 1, id_resource: 49, create: 1, edit: 1, delete: 1, select: 1}, // Consulta de Links
        
        // Reportes section
        {id_profile: 1, id_resource: 50, create: 1, edit: 1, delete: 1, select: 1}, // Reportes
        {id_profile: 1, id_resource: 45, create: 1, edit: 1, delete: 1, select: 1}, // Contracargos (Reportes)
      ];

      // Insert missing permissions using INSERT IGNORE to avoid duplicates
      for (const permission of missingPermissions) {
        await queryInterface.sequelize.query(`
          INSERT IGNORE INTO profile_resources (id_profile, id_resource, \`create\`, \`edit\`, \`delete\`, \`select\`)
          VALUES (:id_profile, :id_resource, :create, :edit, :delete, :select)
        `, {
          replacements: permission,
          type: Sequelize.QueryTypes.INSERT
        });
      }

      console.log('✅ Admin permissions fixed successfully!');
      console.log('📊 Added permissions for resources:');
      console.log('   - Operaciones MCC (/catalogos/mcc-operations)');
      console.log('   - All Archivos sections');
      console.log('   - All Links sections');
      console.log('   - Reportes section');
      
    } catch (error) {
      console.error('❌ Error fixing admin permissions:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      console.log('⏪ Rolling back admin permissions...');
      
      // Remove the permissions we added
      const resourceIds = [35, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50];
      
      await queryInterface.sequelize.query(`
        DELETE FROM profile_resources 
        WHERE id_profile = 1 AND id_resource IN (:resourceIds)
      `, {
        replacements: { resourceIds },
        type: Sequelize.QueryTypes.DELETE
      });

      console.log('✅ Admin permissions rollback completed!');
      
    } catch (error) {
      console.error('❌ Error rolling back admin permissions:', error);
      throw error;
    }
  }
};
