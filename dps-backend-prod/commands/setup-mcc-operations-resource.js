#!/usr/bin/env node

/**
 * Setup MCC Operations Resource
 * 
 * This script adds the missing MCC operations resource to the resources table
 * and assigns appropriate permissions to admin profiles.
 */

require('dotenv').config();
const db = require('../lib/socketServer/lib/sequelize/init');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

async function addMccResource() {
  try {
    log('Adding MCC Operations resource to database...', 'bright');
    
    // Check if MCC resource already exists
    const existingResource = await db.resources.findOne({
      where: {
        resource_name: 'Operaciones MCC'
      }
    });
    
    if (existingResource) {
      logInfo('MCC Operations resource already exists');
      
      // Check if admin profiles have permissions and assign if missing
      const adminProfiles = await db.profileUsers.findAll({
        where: { admin: 1 }
      });
      
      logInfo(`Found ${adminProfiles.length} admin profiles`);
      
      for (const profile of adminProfiles) {
        const existingPermission = await db.profileResources.findOne({
          where: {
            id_profile: profile.id_profile,
            id_resource: existingResource.id
          }
        });
        
        if (!existingPermission) {
          await db.profileResources.create({
            id_profile: profile.id_profile,
            id_resource: existingResource.id,
            icon: existingResource.icon,
            father_resource: existingResource.father_resource,
            resource_name: existingResource.resource_name,
            resource_url: existingResource.resource_url,
            create: 1,
            edit: 1,
            delete: 1,
            select: 1
          });
          
          logSuccess(`Assigned full MCC permissions to profile: ${profile.profile_name}`);
        } else {
          logInfo(`Profile ${profile.profile_name} already has MCC permissions`);
        }
      }
      
      return existingResource;
    }
    
    // Create the MCC operations resource
    const mccResource = await db.resources.create({
      resource_name: 'Operaciones MCC',
      resource_url: '/catalogos/mcc-operations',
      icon: 'category',
      father_resource: null, // Top-level resource
      isF: 0,
      isConfig: 0,
      isCrud: 1,
      isGroup: 0,
      justPage: 0
    });
    
    logSuccess(`Created MCC Operations resource with ID: ${mccResource.id}`);
    
    // Get admin profiles
    const adminProfiles = await db.profileUsers.findAll({
      where: { admin: 1 }
    });
    
    logInfo(`Found ${adminProfiles.length} admin profiles`);
    
    // Assign full permissions to admin profiles
    for (const profile of adminProfiles) {
      await db.profileResources.create({
        id_profile: profile.id_profile,
        id_resource: mccResource.id,
        icon: mccResource.icon,
        father_resource: mccResource.father_resource,
        resource_name: mccResource.resource_name,
        resource_url: mccResource.resource_url,
        create: 1,
        edit: 1,
        delete: 1,
        select: 1
      });
      
      logSuccess(`Assigned full MCC permissions to profile: ${profile.profile_name}`);
    }
    
    // Also create a resource for the main catalog section
    const catalogResource = await db.resources.findOne({
      where: { resource_name: 'Catálogos' }
    });
    
    if (catalogResource) {
      // Update MCC resource to be a child of Catálogos
      await mccResource.update({
        father_resource: catalogResource.id
      });
      
      logSuccess('Set Catálogos as parent resource for MCC Operations');
      
      // Update profile resources with the new parent
      for (const profile of adminProfiles) {
        await db.profileResources.update(
          { father_resource: catalogResource.id },
          {
            where: {
              id_profile: profile.id_profile,
              id_resource: mccResource.id
            }
          }
        );
      }
    }
    
    logSuccess('MCC Operations resource setup completed successfully!');
    
    return mccResource;
    
  } catch (error) {
    logError(`Error adding MCC resource: ${error.message}`);
    throw error;
  }
}

async function verifySetup() {
  try {
    log('\nVerifying MCC Operations setup...', 'bright');
    
    // Check resource exists
    const mccResource = await db.resources.findOne({
      where: { resource_name: 'Operaciones MCC' }
    });
    
    if (!mccResource) {
      logError('MCC Operations resource not found');
      return false;
    }
    
    logSuccess('MCC Operations resource found');
    
    // Check permissions
    const permissions = await db.profileResources.findAll({
      where: { id_resource: mccResource.id },
      include: [
        {
          model: db.profileUsers,
          as: 'perfil_user',
          attributes: ['profile_name', 'admin']
        }
      ]
    });
    
    logInfo(`Found ${permissions.length} profile permissions for MCC Operations`);
    
    permissions.forEach(perm => {
      const profileName = perm.perfil_user?.profile_name || 'Unknown';
      const perms = [];
      if (perm.create) perms.push('Create');
      if (perm.edit) perms.push('Edit');
      if (perm.delete) perms.push('Delete');
      if (perm.select) perms.push('Select');
      
      log(`  - ${profileName}: [${perms.join(', ')}]`, 'cyan');
    });
    
    return true;
    
  } catch (error) {
    logError(`Error verifying setup: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log(colors.bright + '\n🔧 MCC OPERATIONS RESOURCE SETUP\n' + colors.reset);
  
  try {
    await addMccResource();
    const verified = await verifySetup();
    
    if (verified) {
      logSuccess('\n🎉 MCC Operations resource is now properly configured!');
      logInfo('You can now run the database validation checks again to verify everything is working.');
    } else {
      logError('\n❌ Verification failed. Please check the errors above.');
    }
    
  } catch (error) {
    logError(`Setup failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  addMccResource,
  verifySetup
};
