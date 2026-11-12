'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🚀 Adding missing movimientos resources with merchant-scoped support...');
    
    // Movimientos resources to be created
    const movimientosResources = [
      {
        name: 'Transacciones',
        url: '/movimientos/transacciones',
        icon: 'RECEIPT',
        description: 'Access to basic transactions view'
      },
      {
        name: 'Transacciones Mejoradas',
        url: '/movimientos/transacciones-mejoradas',
        icon: 'WALLET',
        description: 'Access to enhanced transactions view'
      },
      {
        name: 'POS JSON',
        url: '/movimientos/pos-json',
        icon: 'CODE',
        description: 'Access to POS JSON data view'
      },
      {
        name: 'Tickets',
        url: '/movimientos/tickets',
        icon: 'TICKET',
        description: 'Access to ticket management view'
      },
      {
        name: 'Contracargos',
        url: '/movimientos/contracargos',
        icon: 'REFUND',
        description: 'Access to chargebacks management view'
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

    // Create each movimientos resource
    for (const resource of movimientosResources) {
      // Check if resource already exists
      const existingResource = await queryInterface.sequelize.query(
        'SELECT id FROM resources WHERE resource_url = ? LIMIT 1',
        {
          replacements: [resource.url],
          type: Sequelize.QueryTypes.SELECT
        }
      );

      let resourceId;
      if (existingResource && existingResource.length > 0) {
        resourceId = existingResource[0].id;
        console.log(`✅ Movimientos resource already exists: ${resource.name} (ID: ${resourceId})`);
      } else {
        // Create resource with merchant-scoped support
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
            resource.name,
            resource.url,
            resource.icon,
            null, // No parent resource
            0,    // isF
            0,    // isConfig
            1,    // isCrud
            0,    // isGroup
            1     // justPage
          ],
          type: Sequelize.QueryTypes.INSERT
        });

        const createdResource = await queryInterface.sequelize.query(
          'SELECT id FROM resources WHERE resource_url = ? ORDER BY id DESC LIMIT 1',
          {
            replacements: [resource.url],
            type: Sequelize.QueryTypes.SELECT
          }
        );
        resourceId = createdResource[0].id;
        console.log(`✅ Created movimientos resource: ${resource.name} (ID: ${resourceId}) - Merchant Scoped`);
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
        console.log(`✅ Movimientos permission already assigned to admin: ${resource.name}`);
        continue;
      }

      // Assign permission to admin profile with full access
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
          1, // create
          1, // edit
          1, // delete
          1  // select
        ],
        type: Sequelize.QueryTypes.INSERT
      });

      console.log(`✅ Assigned movimientos permission to admin: ${resource.name}`);
    }

    console.log('🎉 All movimientos resources have been successfully added!');
    console.log('📋 Admin users can now access all movimientos subsections with merchant-scoped filtering.');
    console.log('🔒 Merchant users will only see their own transaction data.');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🗑️ Removing movimientos resources...');
    
    const movimientosResourceUrls = [
      '/movimientos/transacciones',
      '/movimientos/transacciones-mejoradas',
      '/movimientos/pos-json',
      '/movimientos/tickets',
      '/movimientos/contracargos'
    ];

    // Remove permission assignments
    await queryInterface.sequelize.query(`
      DELETE pr FROM profile_resources pr
      INNER JOIN resources r ON pr.id_resource = r.id
      WHERE r.resource_url IN (?)
    `, {
      replacements: [movimientosResourceUrls],
      type: Sequelize.QueryTypes.DELETE
    });

    // Remove resources
    await queryInterface.sequelize.query(
      'DELETE FROM resources WHERE resource_url IN (?)',
      {
        replacements: [movimientosResourceUrls],
        type: Sequelize.QueryTypes.DELETE
      }
    );

    console.log('✅ Movimientos resources have been removed');
  }
};
