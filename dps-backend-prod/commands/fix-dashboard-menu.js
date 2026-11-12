require('dotenv').config();
const { Sequelize } = require('sequelize');
const initModels = require('../lib/socketServer/lib/sequelize/initModels');
const initRelations = require('../lib/socketServer/lib/sequelize/initRelations');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false
  }
);

const db = { seq: sequelize, options: { sync: false } };
initModels(sequelize, Sequelize, db);
initRelations(db);

async function fix() {
  console.log('\n=== FIXING DASHBOARD MENU ===\n');

  // Get Dashboard profile
  const dashboardProfile = await db.profileUsers.findOne({
    where: { profile_name: 'Dashboard' }
  });
  
  if (!dashboardProfile) {
    console.log('❌ Dashboard profile not found!');
    process.exit(1);
  }

  const profileId = dashboardProfile.id_profile;
  console.log(`Dashboard Profile ID: ${profileId}\n`);

  // Resources that need to be assigned (the missing parents)
  const missingResources = [21]; // Transaccionales

  for (const resourceId of missingResources) {
    // Check if already assigned
    const existing = await db.profileResources.findOne({
      where: { 
        id_profile: profileId,
        id_resource: resourceId 
      }
    });

    if (existing) {
      console.log(`Resource ${resourceId} already assigned`);
      continue;
    }

    // Get resource details
    const resource = await db.resources.findByPk(resourceId);
    
    // Create permission
    await db.profileResources.create({
      id_profile: profileId,
      id_resource: resourceId,
      create: 0,
      edit: 0,
      delete: 0,
      select: 1  // This makes it visible in menu
    });

    console.log(`✅ Assigned ${resource.resource_name} (ID: ${resourceId}) to Dashboard`);
  }

  console.log('\n=== VERIFYING ===');
  const perms = await db.profileResources.findAll({
    where: { id_profile: profileId },
    include: [{ model: db.resources, as: 'resource' }]
  });
  
  const movPerms = perms.filter(p => 
    p.resource?.resource_url?.includes('movimientos') ||
    p.resource?.resource_name?.toLowerCase().includes('movimientos') ||
    p.resource?.resource_name?.toLowerCase().includes('transaccionales')
  );

  console.table(movPerms.map(p => ({
    resource: p.resource?.resource_name,
    id: p.id_resource,
    father: p.resource?.father_resource,
    select: p.select
  })));

  console.log('\n✅ Done! User needs to refresh the page to see the menu.');
  await sequelize.close();
}

fix().catch(err => {
  console.error(err);
  process.exit(1);
});
