require('dotenv').config();
const db = require('../lib/socketServer/lib/sequelize/init');
const fs = require('fs');

async function fixAllPermissionsEnhanced() {
  try {
    console.log('ENHANCED COMPREHENSIVE PERMISSION FIX - ALL IN ONE...\n');

    // ==================== STEP 1: ANALYZE CURRENT STATE ====================
    console.log('STEP 1: Analyzing current permission state...');
    
    const currentCount = await db.seq.query(
      'SELECT COUNT(*) as total FROM profile_resources',
      { type: db.seq.QueryTypes.SELECT }
    );
    
    const currentDuplicates = await db.seq.query(
      `SELECT COUNT(*) as duplicates FROM (
        SELECT id_profile, id_resource, COUNT(*) as count
        FROM profile_resources 
        GROUP BY id_profile, id_resource 
        HAVING COUNT(*) > 1
      ) as dup`,
      { type: db.seq.QueryTypes.SELECT }
    );
    
    console.log(`  Current total records: ${currentCount[0].total}`);
    console.log(`  Duplicate combinations: ${currentDuplicates[0].duplicates}`);

    // ==================== STEP 2: DEDUPLICATE PERMISSIONS ====================
    console.log('\nSTEP 2: Deduplicating permission records...');
    
    const duplicateGroups = await db.seq.query(
      `SELECT id_profile, id_resource, COUNT(*) as count
       FROM profile_resources 
       GROUP BY id_profile, id_resource 
       HAVING COUNT(*) > 1
       ORDER BY id_profile, id_resource`,
      { type: db.seq.QueryTypes.SELECT }
    );
    
    console.log(`  Found ${duplicateGroups.length} duplicate groups to fix...`);
    
    let totalDeleted = 0;
    
    for (const group of duplicateGroups) {
      // Get all records for this combination
      const allRecords = await db.seq.query(
        'SELECT id, `create`, edit, `delete`, `select`, createdAt FROM profile_resources WHERE id_profile = ? AND id_resource = ? ORDER BY createdAt, id',
        { 
          replacements: [group.id_profile, group.id_resource],
          type: db.seq.QueryTypes.SELECT 
        }
      );
      
      if (allRecords.length > 1) {
        // Strategy: Keep the record with the most permissive values (highest score)
        let bestRecord = allRecords[0];
        let bestScore = bestRecord.create + bestRecord.edit + bestRecord.delete + bestRecord.select;
        
        for (const record of allRecords) {
          const score = record.create + record.edit + record.delete + record.select;
          if (score > bestScore) {
            bestScore = score;
            bestRecord = record;
          }
        }
        
        const toDelete = allRecords.filter(r => r.id !== bestRecord.id);
        
        console.log(`    Profile ${group.id_profile}, Resource ${group.id_resource}:`);
        console.log(`      Keeping: ID ${bestRecord.id} (score: ${bestScore})`);
        console.log(`      Deleting: ${toDelete.length} records: ${toDelete.map(r => r.id).join(', ')}`);
        
        // Delete duplicates
        for (const record of toDelete) {
          await db.seq.query(
            'DELETE FROM profile_resources WHERE id = ?',
            { 
              replacements: [record.id],
              type: db.seq.QueryTypes.DELETE 
            }
          );
          totalDeleted++;
        }
      }
    }
    
    console.log(`  Deduplication complete! Deleted ${totalDeleted} duplicate records`);

    // ==================== STEP 3: FIX DUPLICATE RESOURCES WITH ROUTE TESTING ====================
    console.log('\nSTEP 3: Fixing duplicate resources with route validation...');
    
    // Try to load route recommendations from previous test
    let routeRecommendations = {};
    try {
      if (fs.existsSync('./route-recommendations.json')) {
        routeRecommendations = JSON.parse(fs.readFileSync('./route-recommendations.json', 'utf8'));
        console.log('    Loaded route recommendations from previous test');
      }
    } catch (error) {
      console.log('    No route recommendations found, using oldest entry strategy');
    }
    
    const duplicateResources = await db.seq.query(
      `SELECT resource_name, COUNT(*) as count
       FROM resources 
       GROUP BY resource_name 
       HAVING COUNT(*) > 1`,
      { type: db.seq.QueryTypes.SELECT }
    );
    
    let resourcesFixed = 0;
    
    for (const resource of duplicateResources) {
      console.log(`    Fixing duplicate resource: ${resource.resource_name} (${resource.count} entries)`);
      
      // Get all entries for this resource
      const allEntries = await db.seq.query(
        'SELECT id, resource_url, createdAt FROM resources WHERE resource_name = ? ORDER BY createdAt, id',
        { 
          replacements: [resource.resource_name],
          type: db.seq.QueryTypes.SELECT 
        }
      );
      
      if (allEntries.length > 1) {
        let toKeep;
        const toRemove = [];
        
        // Use route recommendations if available
        if (routeRecommendations[resource.resource_name]) {
          const recommendedId = routeRecommendations[resource.resource_name];
          toKeep = allEntries.find(e => e.id === recommendedId);
          console.log(`      Using route recommendation: Keep ID ${toKeep.id} - ${toKeep.resource_url}`);
        } else {
          // Fallback to oldest entry
          toKeep = allEntries[0];
          console.log(`      No route recommendation, keeping oldest: ID ${toKeep.id} - ${toKeep.resource_url}`);
        }
        
        // Mark others for removal
        for (const entry of allEntries) {
          if (entry.id !== toKeep.id) {
            toRemove.push(entry);
          }
        }
        
        for (const duplicate of toRemove) {
          console.log(`      Removing: ID ${duplicate.id} - ${duplicate.resource_url}`);
          
          // Remove profile_resources assignments first
          await db.seq.query(
            'DELETE FROM profile_resources WHERE id_resource = ?',
            { replacements: [duplicate.id], type: db.seq.QueryTypes.DELETE }
          );
          
          // Remove the resource
          await db.seq.query(
            'DELETE FROM resources WHERE id = ?',
            { replacements: [duplicate.id], type: db.seq.QueryTypes.DELETE }
          );
          
          resourcesFixed++;
        }
      }
    }
    
    console.log(`  Resource deduplication complete! Fixed ${resourcesFixed} duplicate resources`);
    
    if (Object.keys(routeRecommendations).length === 0) {
      console.log(`  NOTE: Run 'node test-routes-production.js' first for optimal results`);
    }

    // ==================== STEP 4: ADD MISSING CONTABILIDAD PERMISSIONS ====================
    console.log('\nSTEP 4: Adding missing Contabilidad permissions...');
    
    // Get Contabilidad profile ID
    const contabilidadProfile = await db.seq.query(
      'SELECT id_profile FROM user_profile WHERE profile_name = ? AND deleted_at IS NULL',
      { replacements: ['Contabilidad'], type: db.seq.QueryTypes.SELECT }
    );
    
    if (contabilidadProfile.length === 0) {
      console.log('  Contabilidad profile not found!');
    } else {
      const profileId = contabilidadProfile[0].id_profile;
      console.log(`  Found Contabilidad profile ID: ${profileId}`);
      
      // Define required permissions for Contabilidad
      const requiredPermissions = [
        { name: 'Dashboard', url: '/dashboard', create: 1, edit: 1, delete: 1, select: 1 },
        { name: 'Movimientos', url: '/movimientos', create: 1, edit: 1, delete: 1, select: 1 },
        { name: 'Transaccionales', url: '/movimientos/transacciones', create: 1, edit: 1, delete: 1, select: 1 },
        { name: 'Transacciones', url: '/movimientos/transacciones', create: 1, edit: 1, delete: 1, select: 1 },
        { name: 'Tickets', url: '/movimientos/tickets', create: 1, edit: 1, delete: 1, select: 1 },
        { name: 'JSON', url: '/movimientos/pos-json', create: 1, edit: 1, delete: 1, select: 1 }
      ];
      
      let permissionsAdded = 0;
      
      for (const perm of requiredPermissions) {
        // Check if resource exists
        const resource = await db.seq.query(
          'SELECT id FROM resources WHERE resource_name = ?',
          { replacements: [perm.name], type: db.seq.QueryTypes.SELECT }
        );
        
        if (resource.length === 0) {
          console.log(`    Resource '${perm.name}' not found, creating...`);
          
          // Create the resource
          const newResource = await db.seq.query(
            'INSERT INTO resources (resource_name, resource_url, createdAt, updatedAt) VALUES (?, ?, NOW(), NOW())',
            { 
              replacements: [perm.name, perm.url],
              type: db.seq.QueryTypes.INSERT 
            }
          );
          
          const resourceId = newResource[0];
          
          // Add permission for Contabilidad
          await db.seq.query(
            'INSERT INTO profile_resources (id_profile, id_resource, `create`, edit, `delete`,  `select`,  createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
            { 
              replacements: [profileId, resourceId, perm.create, perm.edit, perm.delete,  perm.select],
              type: db.seq.QueryTypes.INSERT 
            }
          );
          
          console.log(`      Created resource and added permission for ${perm.name}`);
          permissionsAdded++;
        } else {
          const resourceId = resource[0].id;
          
          // Check if permission already exists
          const existingPermission = await db.seq.query(
            'SELECT id FROM profile_resources WHERE id_profile = ? AND id_resource = ?',
            { replacements: [profileId, resourceId], type: db.seq.QueryTypes.SELECT }
          );
          
          if (existingPermission.length === 0) {
            // Add missing permission
            await db.seq.query(
              'INSERT INTO profile_resources (id_profile, id_resource, `create`, edit, `delete`,  `select`,  createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
              { 
                replacements: [profileId, resourceId, perm.create, perm.edit, perm.delete,  perm.select],
                type: db.seq.QueryTypes.INSERT 
              }
            );
            
            console.log(`      Added missing permission for ${perm.name}`);
            permissionsAdded++;
          } else {
            console.log(`      Permission for ${perm.name} already exists`);
          }
        }
      }
      
      console.log(`  Contabilidad permissions complete! Added ${permissionsAdded} missing permissions`);
    }

    // ==================== STEP 5: FINAL VERIFICATION ====================
    console.log('\nSTEP 5: Final verification...');
    
    const finalCount = await db.seq.query(
      'SELECT COUNT(*) as total FROM profile_resources',
      { type: db.seq.QueryTypes.SELECT }
    );
    
    const finalDuplicates = await db.seq.query(
      `SELECT COUNT(*) as duplicates FROM (
        SELECT id_profile, id_resource, COUNT(*) as count
        FROM profile_resources 
        GROUP BY id_profile, id_resource 
        HAVING COUNT(*) > 1
      ) as dup`,
      { type: db.seq.QueryTypes.SELECT }
    );
    
    const finalResourceDuplicates = await db.seq.query(
      `SELECT COUNT(*) as duplicates FROM (
        SELECT resource_name, COUNT(*) as count
        FROM resources 
        GROUP BY resource_name 
        HAVING COUNT(*) > 1
      ) as dup`,
      { type: db.seq.QueryTypes.SELECT }
    );
    
    console.log(`  Final total records: ${finalCount[0].total}`);
    console.log(`  Remaining permission duplicates: ${finalDuplicates[0].duplicates}`);
    console.log(`  Remaining resource duplicates: ${finalResourceDuplicates[0].duplicates}`);
    console.log(`  Records deleted: ${totalDeleted}`);
    console.log(`  Resources fixed: ${resourcesFixed}`);

    // ==================== STEP 6: SHOW FINAL STATE ====================
    console.log('\nSTEP 6: Final permission state by profile:');
    
    const finalRecords = await db.seq.query(
      `SELECT pr.id_profile, pr.id_resource, pr.create, pr.edit, pr.delete,  pr.select, 
              up.profile_name, r.resource_name, r.resource_url
       FROM profile_resources pr 
       JOIN user_profile up ON pr.id_profile = up.id_profile 
       JOIN resources r ON pr.id_resource = r.id 
       WHERE up.deleted_at IS NULL 
       ORDER BY up.profile_name, r.resource_name`,
      { type: db.seq.QueryTypes.SELECT }
    );
    
    // Group by profile
    const groupedByProfile = {};
    finalRecords.forEach(r => {
      if (!groupedByProfile[r.profile_name]) {
        groupedByProfile[r.profile_name] = [];
      }
      groupedByProfile[r.profile_name].push(r);
    });
    
    Object.keys(groupedByProfile).forEach(profileName => {
      console.log(`\n${profileName} (${groupedByProfile[profileName].length} permissions):`);
      groupedByProfile[profileName].forEach(r => {
        const permissions = `${r.create}${r.edit}${r.delete}${r.select}`;
        console.log(`  ${r.resource_name.padEnd(25)} | ${permissions} | ${r.resource_url || 'NULL'}`);
      });
    });

    console.log('\nENHANCED COMPREHENSIVE PERMISSION FIX COMPLETE!');
    console.log('RULE: Exactly ONE permission per route per role');
    console.log('RULE: No duplicate resources');
    console.log('RULE: Contabilidad profile has all required permissions');
    
    console.log('\nNext steps:');
    console.log('1. Restart the application server');
    console.log('2. Clear browser cache');
    console.log('3. Test with different user profiles');
    console.log('4. Verify menu items appear correctly');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

fixAllPermissionsEnhanced();
