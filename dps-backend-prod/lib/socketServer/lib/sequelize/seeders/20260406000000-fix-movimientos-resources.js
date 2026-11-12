'use strict';

require('dotenv').config();
const db = require('../../sequelize/init');

async function fixMovimientosProfileResources() {
  try {
    console.log('🔧 Fixing movimientos profile resources...');

    // Get admin profile
    const [adminProfile] = await db.seq.query(
      'SELECT id_profile FROM user_profile ORDER BY id_profile LIMIT 1',
      { type: db.seq.QueryTypes.SELECT }
    );

    if (!adminProfile) {
      console.log('❌ No admin profile found');
      return;
    }

    const adminProfileId = adminProfile.id_profile;
    console.log(`📋 Using admin profile ID: ${adminProfileId}`);

    // Movimientos resource URLs that should exist
    const movimientosResources = [
      '/movimientos/transacciones',
      '/movimientos/transacciones-mejoradas',
      '/movimientos/pos-json', 
      '/movimientos/tickets',
      '/movimientos/contracargos'
    ];

    // Get current resources
    const currentResources = await db.seq.query(
      'SELECT id, resource_url FROM resources WHERE resource_url IN (?)',
      { 
        replacements: [movimientosResources],
        type: db.seq.QueryTypes.SELECT 
      }
    );

    console.log('📋 Found resources:', currentResources);

    // Handle both array and single object results
    const resourcesArray = Array.isArray(currentResources) ? currentResources : [currentResources];

    // Check if enhanced-transacciones is missing and add it if needed
    const hasEnhancedTransactions = resourcesArray.some(r => r.resource_url === '/movimientos/transacciones-mejoradas');
    
    if (!hasEnhancedTransactions) {
      console.log('⚠️ Enhanced transactions resource not found, checking if it exists...');
      const [enhancedResource] = await db.seq.query(
        'SELECT id, resource_url FROM resources WHERE resource_url = ?',
        { 
          replacements: ['/movimientos/transacciones-mejoradas'],
          type: db.seq.QueryTypes.SELECT 
        }
      );
      
      if (enhancedResource) {
        resourcesArray.push(enhancedResource);
        console.log('✅ Found enhanced transactions resource:', enhancedResource);
      }
    }

    // For each resource, ensure admin has access
    for (const resource of resourcesArray) {
      const [existingAssignment] = await db.seq.query(
        'SELECT 1 FROM profile_resources WHERE id_profile = ? AND id_resource = ? LIMIT 1',
        {
          replacements: [adminProfileId, resource.id],
          type: db.seq.QueryTypes.SELECT
        }
      );

      if (!existingAssignment) {
        // Assign to admin profile with full permissions
        await db.seq.query(`
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
            resource.id,
            1, // create
            1, // edit
            1, // delete
            1  // select
          ],
          type: db.seq.QueryTypes.INSERT
        });

        console.log(`✅ Assigned permissions for: ${resource.resource_url}`);
      } else {
        console.log(`✅ Permissions already exist for: ${resource.resource_url}`);
      }
    }

    console.log('🎉 Movimientos profile resources fixed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing movimientos profile resources:', error);
    throw error;
  }
}

module.exports = {
  fixMovimientosProfileResources
};

// Allow direct execution
if (require.main === module) {
  fixMovimientosProfileResources()
    .then(() => {
      console.log('✅ Seeder completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeder failed:', error);
      process.exit(1);
    });
}
