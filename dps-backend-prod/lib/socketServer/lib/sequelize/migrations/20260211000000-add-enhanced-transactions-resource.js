'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if the resource already exists
    const existingResource = await queryInterface.sequelize.query(
      'SELECT id FROM resources WHERE resource_url = "/movimientos/transacciones-mejoradas"',
      { type: Sequelize.QueryTypes.SELECT }
    );

    let resourceId = existingResource && existingResource[0] && existingResource[0].id;
    if (resourceId) {
      console.log(`✅ Enhanced transactions resource already exists with ID: ${resourceId}`);
    } else {
      // Insert the new resource
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
          'Transacciones Mejoradas',
          '/movimientos/transacciones-mejoradas',
          'WALLET',
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
        'SELECT id FROM resources WHERE resource_url = "/movimientos/transacciones-mejoradas" ORDER BY id DESC LIMIT 1',
        { type: Sequelize.QueryTypes.SELECT }
      );
      resourceId = createdResource && createdResource[0] && createdResource[0].id;
      console.log(`✅ Enhanced transactions resource created with ID: ${resourceId}`);
    }
    
    // Get admin profile ID (assuming admin has ID 1 or the highest ID)
    // First, let's check what tables exist
    const tables = await queryInterface.sequelize.query(
      'SHOW TABLES LIKE "%profile%"',
      { type: Sequelize.QueryTypes.SELECT }
    );
    
    console.log('📋 Found profile tables:', tables);
    
    // Try different possible table names
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
        // Table doesn't exist, try next one
        continue;
      }
    }
    
    if (!adminProfile || adminProfile.length === 0) {
      console.log('❌ No admin profile found, falling back to id_profile = 1');
      adminProfile = [{ id_profile: 1 }];
    }
    
    if (!adminProfile || adminProfile.length === 0) {
      console.log('❌ No admin profile found, skipping resource assignment');
      console.log('🎉 Enhanced transactions resource created but not assigned to any profile');
      return;
    }
    
    const adminProfileId = adminProfile[0].id_profile;
    console.log(`📋 Found admin profile ID: ${adminProfileId}`);

    const existingAssignment = await queryInterface.sequelize.query(
      'SELECT 1 FROM profile_resources WHERE id_profile = ? AND id_resource = ? LIMIT 1',
      {
        replacements: [adminProfileId, resourceId],
        type: Sequelize.QueryTypes.SELECT
      }
    );

    if (existingAssignment && existingAssignment.length > 0) {
      console.log('✅ Enhanced transactions resource already assigned to admin profile');
      console.log('🎉 Enhanced transactions menu item should now be visible for admin users!');
      return;
    }
    
    // Assign the resource to admin profile with all permissions
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
    
    console.log('✅ Enhanced transactions resource assigned to admin profile');
    console.log('🎉 Enhanced transactions menu item should now be visible for admin users!');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the resource from admin profiles
    await queryInterface.sequelize.query(`
      DELETE pr FROM profile_resources pr
      INNER JOIN resources r ON pr.id_resource = r.id
      WHERE r.resource_url = "/movimientos/transacciones-mejoradas"
    `, { type: Sequelize.QueryTypes.DELETE });
    
    // Remove the resource
    await queryInterface.sequelize.query(
      'DELETE FROM resources WHERE resource_url = "/movimientos/transacciones-mejoradas"',
      { type: Sequelize.QueryTypes.DELETE }
    );
    
    console.log('✅ Enhanced transactions resource removed');
  }
};
