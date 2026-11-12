'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🚀 Adding admin menu permissions for permissions manager and permission tester...');
    
    // Admin menu permissions to be created
    const adminMenuPermissions = [
      {
        name: 'Gestión de Permisos',
        url: '/permissions-manager',
        icon: 'KEY',
        description: 'Access to permissions management interface'
      },
      {
        name: 'Probador de Permisos',
        url: '/permission-tester',
        icon: 'TEST',
        description: 'Access to permission testing interface'
      }
    ];

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

    // Create each admin menu permission resource
    for (const permission of adminMenuPermissions) {
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
        console.log(`✅ Admin menu permission resource already exists: ${permission.name} (ID: ${resourceId})`);
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
            null, // No parent resource
            0,    // isF
            1,    // isConfig (this is a configuration item)
            1,    // isCrud
            0,    // isGroup
            1     // justPage (this is a page, not a permission)
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
        console.log(`✅ Created admin menu permission resource: ${permission.name} (ID: ${resourceId})`);
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
        console.log(`✅ Admin menu permission already assigned to admin: ${permission.name}`);
        continue;
      }

      // Assign permission to admin profile with select access
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
          0, // create (not needed for menu access)
          0, // edit (not needed for menu access)
          0, // delete (not needed for menu access)
          1  // select (needed for menu access)
        ],
        type: Sequelize.QueryTypes.INSERT
      });

      console.log(`✅ Assigned admin menu permission to admin: ${permission.name}`);
    }

    console.log('🎉 Admin menu permissions have been successfully added!');
    console.log('📋 Admin users can now access "Gestión de Permisos" and "Probador de Permisos" menu items.');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🗑️ Removing admin menu permissions...');
    
    const adminMenuPermissionUrls = [
      '/permissions-manager',
      '/permission-tester'
    ];

    // Remove permission assignments
    await queryInterface.sequelize.query(`
      DELETE pr FROM profile_resources pr
      INNER JOIN resources r ON pr.id_resource = r.id
      WHERE r.resource_url IN (?)
    `, {
      replacements: [adminMenuPermissionUrls],
      type: Sequelize.QueryTypes.DELETE
    });

    // Remove the resources
    await queryInterface.sequelize.query(
      'DELETE FROM resources WHERE resource_url IN (?)',
      {
        replacements: [adminMenuPermissionUrls],
        type: Sequelize.QueryTypes.DELETE
      }
    );

    console.log('✅ Admin menu permissions have been removed');
  }
};
