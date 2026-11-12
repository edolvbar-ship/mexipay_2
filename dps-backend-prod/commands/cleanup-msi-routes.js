require('dotenv').config();
const db = require('../lib/socketServer/lib/sequelize/init');

async function cleanupMSIRoutes() {
  console.log('🧹 MSI Routes Cleanup Command');
  console.log('============================');

  try {
    // Remove all MSI-related resources with API routes
    console.log('\n🗑️ Removing MSI API routes from database...');
    
    const apiRoutesToDelete = [
      // Merchant MSI API routes
      '/api/merchants/{id}/msi-config',
      '/api/msi-config/{id_merchant}',
      '/api/msi-config/{id_merchant}/summary',
      '/api/msi-config/{id_merchant}/overrides',
      '/api/msi-config/{id_merchant}/min-amount',
      
      // Terminal MSI API routes
      '/api/terminal/msi-config',
      '/api/terminal/validate-bin',
      '/api/webservice/msi-config',
      
      // BIN Management API routes
      '/api/msi-bins/national',
      '/api/msi-bins/check-eligibility',
      '/api/msi-bines',
      
      // Reports and Templates API routes
      '/api/reports/msi',
      '/api/catalogs/msi-templates',
      '/api/catalogs/msi-bines',
      
      // Operations API routes
      '/api/operations/{id}/msi-config',
      '/api/operations/msi-enabled'
    ];

    let deletedCount = 0;
    
    // First, get all MSI resource IDs that need to be deleted
    const msiResourceIds = [];
    for (const route of apiRoutesToDelete) {
      // Escape curly braces for SQL LIKE
      const escapedRoute = route.replace(/[{}]/g, '\\_');
      
      const [resources] = await db.seq.query(`
        SELECT id FROM resources 
        WHERE resource_url LIKE '${escapedRoute}' 
        OR resource_url = '${route}'
      `);
      
      if (resources.length > 0) {
        resources.forEach(resource => msiResourceIds.push(resource.id));
      }
    }

    // Also find URL-encoded MSI resources
    const [encodedResources] = await db.seq.query(`
      SELECT id FROM resources 
      WHERE resource_url LIKE '%7B%' OR resource_url LIKE '%7D%'
      AND (resource_name LIKE '%MSI%' OR resource_url LIKE '%msi%')
    `);

    // Also find the specific API routes that might not match exactly
    const [specificApiRoutes] = await db.seq.query(`
      SELECT id FROM resources 
      WHERE resource_url IN ('/api/msi-bines/check-eligibility', '/api/msi-bines/national')
    `);
    
    if (encodedResources.length > 0) {
      encodedResources.forEach(resource => msiResourceIds.push(resource.id));
    }
    
    if (specificApiRoutes.length > 0) {
      specificApiRoutes.forEach(resource => msiResourceIds.push(resource.id));
    }

    // Remove duplicates
    const uniqueIds = [...new Set(msiResourceIds)];
    
    if (uniqueIds.length > 0) {
      // Delete profile resources first (foreign key constraint)
      const idList = uniqueIds.join(',');
      const [profileResult] = await db.seq.query(`
        DELETE FROM profile_resources 
        WHERE id_resource IN (${idList})
      `);
      
      console.log(`✅ Deleted ${profileResult.affectedRows} profile resource assignments`);
      
      // Then delete the main resources
      const [resourceResult] = await db.seq.query(`
        DELETE FROM resources 
        WHERE id IN (${idList})
      `);
      
      console.log(`✅ Deleted ${resourceResult.affectedRows} MSI resources`);
      deletedCount = profileResult.affectedRows + resourceResult.affectedRows;
    }

    console.log(`\n🎯 Cleanup Summary:`);
    console.log(`   Total routes deleted: ${deletedCount}`);
    
    if (deletedCount > 0) {
      console.log('\n📋 Next Steps:');
      console.log('1. Run clean MSI setup: node commands/setup-msi-test.js');
      console.log('2. Restart the application');
      console.log('3. Check main menu - should only show frontend MSI routes');
    } else {
      console.log('\n✅ No problematic MSI routes found - database is clean');
    }

  } catch (error) {
    console.error('❌ MSI routes cleanup failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await db.seq.close();
  }
}

// Allow direct execution
if (require.main === module) {
  cleanupMSIRoutes()
    .then(() => {
      console.log('\n✅ MSI routes cleanup completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ MSI routes cleanup failed:', error);
      process.exit(1);
    });
}

module.exports = { cleanupMSIRoutes };
