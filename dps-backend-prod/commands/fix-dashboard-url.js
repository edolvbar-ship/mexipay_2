require('dotenv').config();
const db = require('../lib/socketServer/lib/sequelize/init');

async function fixDashboardResourceUrl() {
  try {
    console.log('🔧 Fixing Dashboard resource URL from /profile to /dashboard...\n');

    // Update the dashboard resource URL
    const [updateResult] = await db.seq.query(
      'UPDATE resources SET resource_url = ? WHERE id = 1 AND resource_name = ?',
      { 
        replacements: ['/dashboard', 'Dashboard'], 
        type: db.seq.QueryTypes.UPDATE 
      }
    );

    console.log(`📋 Updated ${updateResult.affectedRows} row(s)`);

    // Verify the update
    const [verifyResult] = await db.seq.query(
      'SELECT id, resource_name, resource_url FROM resources WHERE id = 1',
      { type: db.seq.QueryTypes.SELECT }
    );

    console.log('\n📋 Verification:');
    console.table(verifyResult);

    console.log('\n✅ Dashboard resource URL fixed!');
    console.log('✅ Non-admin roles should now see correct dashboard menu item');

  } catch (error) {
    console.error('❌ Error fixing dashboard resource URL:', error);
  } finally {
    process.exit(0);
  }
}

fixDashboardResourceUrl();
