'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🚀 Adding export permissions for enhanced transactions...');
    
    // Export permission resources to be created
    const exportPermissions = [
      {
        name: 'Exportar Transacciones CSV',
        url: 'enhanced-transactions-export-csv',
        icon: 'FILE_ALT',
        description: 'Exportar transacciones mejoradas a formato CSV'
      },
      {
        name: 'Exportar Transacciones Excel',
        url: 'enhanced-transactions-export-excel',
        icon: 'FILE_EXCEL',
        description: 'Exportar transacciones mejoradas a formato Excel'
      },
      {
        name: 'Exportar Transacciones PDF',
        url: 'enhanced-transactions-export-pdf',
        icon: 'FILE_PDF',
        description: 'Exportar transacciones mejoradas a formato PDF'
      }
    ];

    // Get the enhanced transactions parent resource
    const parentResource = await queryInterface.sequelize.query(
      'SELECT id FROM resources WHERE resource_url = "/movimientos/transacciones-mejoradas" LIMIT 1',
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (!parentResource || parentResource.length === 0) {
      console.log('❌ Parent enhanced transactions resource not found. Please run the enhanced transactions resource migration first.');
      return;
    }

    const parentResourceId = parentResource[0].id;
    console.log(`📋 Found parent resource ID: ${parentResourceId}`);

    // Get admin profile ID
    let adminProfile = null;
    const possibleTables = ['user_profile', 'profile_users', 'profiles', 'profile'];
    
    for (const tableName of possibleTables) {
      try {
        if (tableName === 'user_profile') {
          adminProfile = await queryInterface.sequelize.query(
            'SELECT id_profile FROM user_profile ORDER BY id_profile LIMIT 1',
            { type: Sequelize.QueryTypes.SELECT }
          );
        } else {
          adminProfile = await queryInterface.sequelize.query(
            `SELECT id_profile FROM ${tableName} ORDER BY id_profile LIMIT 1`,
            { type: Sequelize.QueryTypes.SELECT }
          );
        }
        if (adminProfile && adminProfile.length > 0) {
          console.log(`📋 Found admin profile in table: ${tableName}`);
          break;
        }
      } catch (error) {
        continue;
      }
    }
    
    if (!adminProfile || adminProfile.length === 0) {
      console.log('❌ No admin profile found, using fallback id_profile = 1');
      adminProfile = [{ id_profile: 1 }];
    }
    
    const adminProfileId = adminProfile[0].id_profile;
    console.log(`📋 Using admin profile ID: ${adminProfileId}`);

    // Create each export permission resource
    for (const permission of exportPermissions) {
      // Check if resource already exists
      const existingResource = await queryInterface.sequelize.query(
        'SELECT id FROM resources WHERE resource_url = ? LIMIT 1',
        {
          replacements: [permission.url],
          type: Sequelize.QueryTypes.SELECT
        }
      );

      let resourceId;
      if (existingResource && existingResource.length > 0) {
        resourceId = existingResource[0].id;
        console.log(`✅ Export permission resource already exists: ${permission.name} (ID: ${resourceId})`);
      } else {
        // Create the resource
        await queryInterface.sequelize.query(`
          INSERT INTO resources (
            resource_name, 
            resource_url, 
            icon, 
            father_resource, 
            isF, 
            isConfig, 
            isCrud, 
            isGroup, 
            justPage,
            createdAt,
            updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `, {
          replacements: [
            permission.name,
            permission.url,
            permission.icon,
            parentResourceId, // Parent is the enhanced transactions resource
            0,    // isF
            0,    // isConfig
            1,    // isCrud
            0,    // isGroup
            0     // justPage (this is a permission, not a page)
          ],
          type: Sequelize.QueryTypes.INSERT
        });

        const createdResource = await queryInterface.sequelize.query(
          'SELECT id FROM resources WHERE resource_url = ? ORDER BY id DESC LIMIT 1',
          {
            replacements: [permission.url],
            type: Sequelize.QueryTypes.SELECT
          }
        );
        resourceId = createdResource[0].id;
        console.log(`✅ Created export permission resource: ${permission.name} (ID: ${resourceId})`);
      }

      // Check if permission is already assigned to admin
      const existingAssignment = await queryInterface.sequelize.query(
        'SELECT 1 FROM profile_resources WHERE id_profile = ? AND id_resource = ? LIMIT 1',
        {
          replacements: [adminProfileId, resourceId],
          type: Sequelize.QueryTypes.SELECT
        }
      );

      if (existingAssignment && existingAssignment.length > 0) {
        console.log(`✅ Export permission already assigned to admin: ${permission.name}`);
        continue;
      }

      // Assign permission to admin profile with select access (for export functionality)
      await queryInterface.sequelize.query(`
        INSERT INTO profile_resources (
          id_profile, 
          id_resource, 
          \`create\`, 
          edit, 
          \`delete\`, 
          \`select\`,
          createdAt,
          updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, {
        replacements: [
          adminProfileId,
          resourceId,
          0, // create (not needed for export)
          0, // edit (not needed for export)
          0, // delete (not needed for export)
          1  // select (needed for export access)
        ],
        type: Sequelize.QueryTypes.INSERT
      });

      console.log(`✅ Assigned export permission to admin: ${permission.name}`);
    }

    console.log('🎉 Export permissions for enhanced transactions have been successfully added!');
    console.log('📋 Admin users can now grant export permissions (CSV, Excel, PDF) to other profiles through the Permissions Management interface.');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🗑️ Removing export permissions for enhanced transactions...');
    
    const exportPermissionUrls = [
      'enhanced-transactions-export-csv',
      'enhanced-transactions-export-excel',
      'enhanced-transactions-export-pdf'
    ];

    // Remove permission assignments
    await queryInterface.sequelize.query(`
      DELETE pr FROM profile_resources pr
      INNER JOIN resources r ON pr.id_resource = r.id
      WHERE r.resource_url IN (?)
    `, {
      replacements: [exportPermissionUrls],
      type: Sequelize.QueryTypes.DELETE
    });

    // Remove the resources
    await queryInterface.sequelize.query(
      'DELETE FROM resources WHERE resource_url IN (?)',
      {
        replacements: [exportPermissionUrls],
        type: Sequelize.QueryTypes.DELETE
      }
    );

    console.log('✅ Export permissions for enhanced transactions have been removed');
  }
};
