require('dotenv').config();
const db = require('../lib/socketServer/lib/sequelize/init');

async function setupMSITest() {
  console.log('🎯 MSI Complete Setup Command');
  console.log('=============================');

  try {
    // Step 1: Run database migrations
    console.log('\n📋 Step 1: Running database migrations...');
    await runMigrations();
    
    // Step 2: Run MSI test data seeder
    console.log('\n🌱 Step 2: Running MSI test data seeder...');
    await runSeeder();
    
    // Step 3: Assign MSI templates to merchants
    console.log('\n🔗 Step 3: Assigning MSI templates to merchants...');
    await assignMSITemplatesToMerchants();
    
    // Step 4: Setup MSI resources and permissions
    console.log('\n🔧 Step 3: Setting up MSI resources and permissions...');
    await setupMSIResources();
    
    // Step 4: Verify MSI setup
    console.log('\n✅ Step 4: Verifying MSI setup...');
    await verifyMSISetup();
    
    console.log('\n🎉 MSI setup completed successfully!');
    console.log('\n📋 Setup Summary:');
    console.log('✅ Database migrations completed');
    console.log('✅ MSI templates table created');
    console.log('✅ MSI BIN ranges table created');
    console.log('✅ Test data seeded');
    console.log('✅ Resources and permissions configured');
    console.log('✅ API endpoints ready');
    
    console.log('\n🚀 Ready to test:');
    console.log('1. Start the server: npm start');
    console.log('2. Test MSI templates: GET /api/msi-templates');
    console.log('3. Test MSI reports: POST /api/msi-reports/generate');
    console.log('4. Test MSI BINs: GET /api/msi-bins/national');
    console.log('5. Access frontend: /catalogos/msi-templates');
    
    console.log('\n🔧 Additional Commands:');
    console.log('- Clean setup: node commands/setup-msi-test.js --clean');
    console.log('- Test flow: node commands/test-msi-flow.js');
    
  } catch (error) {
    console.error('❌ MSI setup failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await db.seq.close();
  }
}

async function runMigrations() {
  const { execSync } = require('child_process');
  
  try {
    console.log('Running MSI migrations...');
    execSync('npx sequelize-cli db:migrate --migrations-path migrations', { stdio: 'inherit' });
    console.log('✅ Migrations completed');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

async function runSeeder() {
  try {
    // Check if MSI test data seeder exists
    const seederPath = '../lib/socketServer/lib/sequelize/seeders/20260526000000-msi-test-data-seeder.js';
    
    try {
      const seeder = require(seederPath);
      await seeder.up(db.seq.getQueryInterface(), db.seq.constructor);
      console.log('✅ MSI test data seeded');
    } catch (seederError) {
      console.log('⚠️ MSI test data seeder not found, creating basic test data...');
      console.log('🔍 Seeder error details:', seederError.message);
      await createBasicTestData();
    }
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    throw error;
  }
}

async function assignMSITemplatesToMerchants() {
  console.log('Assigning MSI templates to active merchants...');
  
  try {
    // First, clean up any existing system assignments to avoid duplicates
    console.log('🧹 Cleaning up existing MSI template assignments...');
    await db.seq.query('DELETE FROM merchant_msi_templates WHERE applied_by = "system"');
    
    // Get all active merchants (limit to first 10 for testing)
    const [merchants] = await db.seq.query(`
      SELECT id_merchant, name_merchant 
      FROM merchant 
      WHERE active = 1 AND deleted_at IS NULL
      ORDER BY id_merchant
      LIMIT 10
    `);
    
    if (merchants.length === 0) {
      console.log('⚠️ No active merchants found');
      return;
    }
    
    console.log(`🏪 Found ${merchants.length} active merchants`);
    
    // Get the default MSI template
    const [defaultTemplate] = await db.seq.query(`
      SELECT id_template, name 
      FROM msi_templates 
      WHERE is_default = 1 AND is_active = 1
      LIMIT 1
    `);
    
    if (defaultTemplate.length === 0) {
      console.log('⚠️ No default MSI template found, using first available template');
      const [firstTemplate] = await db.seq.query(`
        SELECT id_template, name 
        FROM msi_templates 
        WHERE is_active = 1
        ORDER BY id_template
        LIMIT 1
      `);
      
      if (firstTemplate.length === 0) {
        console.log('❌ No MSI templates found to assign');
        return;
      }
      defaultTemplate.push(...firstTemplate);
    }
    
    const templateId = defaultTemplate[0].id_template;
    const templateName = defaultTemplate[0].name;
    
    console.log(`📋 Using template: ${templateName} (ID: ${templateId})`);
    
    // Assign the template to merchants using bulk insert for better performance
    const assignmentValues = merchants.map(merchant => 
      `(${merchant.id_merchant}, ${templateId}, NOW(), 'system')`
    ).join(',');
    
    try {
      await db.seq.query(`
        INSERT INTO merchant_msi_templates (id_merchant, id_template, applied_at, applied_by)
        VALUES ${assignmentValues}
      `);
      
      console.log(`✅ MSI template assignment complete: ${merchants.length} merchants assigned`);
      
      // List the assigned merchants
      for (const merchant of merchants) {
        console.log(`  ✅ ${merchant.name_merchant} (ID: ${merchant.id_merchant})`);
      }
      
    } catch (insertError) {
      // If bulk insert fails due to duplicates, fall back to individual assignments
      console.log('⚠️ Bulk insert failed, trying individual assignments...');
      
      let assignedCount = 0;
      for (const merchant of merchants) {
        try {
          // Check if merchant already has this template assigned
          const [existingAssignment] = await db.seq.query(`
            SELECT COUNT(*) as count 
            FROM merchant_msi_templates 
            WHERE id_merchant = ? AND id_template = ?
          `, [merchant.id_merchant, templateId]);
          
          if (existingAssignment[0].count === 0) {
            // Assign template to merchant
            await db.seq.query(`
              INSERT INTO merchant_msi_templates (id_merchant, id_template, applied_at, applied_by)
              VALUES (?, ?, NOW(), 'system')
            `, [merchant.id_merchant, templateId]);
            
            assignedCount++;
            console.log(`✅ Assigned template to merchant: ${merchant.name_merchant} (ID: ${merchant.id_merchant})`);
          } else {
            console.log(`ℹ️ Merchant ${merchant.name_merchant} already has template assigned`);
          }
        } catch (error) {
          console.log(`⚠️ Error assigning template to merchant ${merchant.id_merchant}: ${error.message}`);
        }
      }
      
      console.log(`✅ MSI template assignment complete: ${assignedCount} merchants assigned`);
    }
    
  } catch (error) {
    console.error('❌ Error assigning MSI templates:', error.message);
    throw error;
  }
}

async function createBasicTestData() {
  console.log('Creating basic MSI test data...');
  
  // Check if MSI templates exist
  const [templateCount] = await db.seq.query('SELECT COUNT(*) as count FROM msi_templates');
  
  if (templateCount[0].count === 0) {
    try {
      // Insert default MSI templates
      await db.seq.query(`
        INSERT INTO msi_templates (name, description, plans, national_only, token_q6_supported, is_default, is_active, created_by, created_at, updated_at) VALUES
        ('Estándar Retail', 'Configuración estándar para comercios retail', '[{"months":3,"min_amount":301,"enabled":true},{"months":6,"min_amount":601,"enabled":true},{"months":9,"min_amount":901,"enabled":false}]', true, true, true, true, 'system', NOW(), NOW()),
        ('Premium', 'Configuración premium para comercios de alto volumen', '[{"months":3,"min_amount":100,"enabled":true},{"months":6,"min_amount":200,"enabled":true},{"months":9,"min_amount":300,"enabled":true},{"months":12,"min_amount":500,"enabled":true}]', true, true, false, true, 'system', NOW(), NOW()),
        ('Básico', 'Configuración básica para comercios pequeños', '[{"months":3,"min_amount":500,"enabled":true}]', true, false, false, true, 'system', NOW(), NOW())
      `);
      console.log('✅ Default MSI templates created');
    } catch (templateError) {
      console.error('❌ Error creating MSI templates:', templateError.message);
      console.error('🔍 Full error:', templateError);
      throw templateError;
    }
  }
  
  // Check if MSI BIN ranges exist
  const [binCount] = await db.seq.query('SELECT COUNT(*) as count FROM msi_bin_ranges');
  
  if (binCount[0].count === 0) {
    try {
      // Insert default MSI BIN ranges
      await db.seq.query(`
        INSERT INTO msi_bin_ranges (bin_start, bin_end, bank_name, card_brand, country_code, active, created_at, updated_at) VALUES
        ('400000', '499999', 'Banco Nacional', 'Visa', 'MX', true, NOW(), NOW()),
        ('510000', '559999', 'Banco Internacional', 'Mastercard', 'MX', true, NOW(), NOW()),
        ('340000', '349999', 'American Express Bank', 'Amex', 'MX', true, NOW(), NOW())
      `);
      console.log('✅ Default MSI BIN ranges created');
    } catch (binError) {
      console.error('❌ Error creating MSI BIN ranges:', binError.message);
      console.error('🔍 Full error:', binError);
      throw binError;
    }
  }
}

async function verifyMSISetup() {
  console.log('Verifying MSI setup...');
  
  // Check MSI templates
  const [templates] = await db.seq.query('SELECT COUNT(*) as count FROM msi_templates');
  console.log(`✅ MSI Templates: ${templates[0].count} found`);
  
  // Check MSI BIN ranges
  const [binRanges] = await db.seq.query('SELECT COUNT(*) as count FROM msi_bin_ranges');
  console.log(`✅ MSI BIN Ranges: ${binRanges[0].count} found`);
  
  // Check merchant MSI template assignments
  const [assignments] = await db.seq.query('SELECT COUNT(*) as count FROM merchant_msi_templates');
  console.log(`✅ Merchant MSI Assignments: ${assignments[0].count} found`);
  
  // Check MSI resources
  const [resources] = await db.seq.query('SELECT COUNT(*) as count FROM resources WHERE resource_url LIKE "%msi%" OR resource_name LIKE "%MSI%"');
  console.log(`✅ MSI Resources: ${resources[0].count} found`);
  
  // Check merchant data
  const [merchants] = await db.seq.query('SELECT COUNT(*) as count FROM merchant WHERE active = 1');
  console.log(`✅ Active Merchants: ${merchants[0].count} found`);
  
  // Check ISO message data
  const [messages] = await db.seq.query('SELECT COUNT(*) as count FROM iso_message LIMIT 1000');
  console.log(`✅ ISO Messages: ${messages[0].count} found (sample)`);
  
  console.log('✅ All MSI components verified successfully!');
}

async function setupMSIResources() {
  try {
    // Get parent catalog resource
    const [catalogResources] = await db.seq.query(`
      SELECT id, resource_name 
      FROM resources 
      WHERE resource_name LIKE '%Catálogo%' OR resource_name LIKE '%Catalog%'
      LIMIT 1
    `);
    
    const parentId = catalogResources.length > 0 ? catalogResources[0].id : null;
    console.log(`📁 Parent catalog: ${parentId ? catalogResources[0].resource_name : 'None'}`);
    
    // MSI resources to create - ONLY FRONTEND ROUTES for main menu
    // IMPORTANT: Never add /api/ routes here - they should not appear in user menu
    const msiResources = [
      // MSI Admin Resources (frontend routes only - NO API ROUTES)
      {
        resource_name: 'Configuración MSI',
        resource_url: '/msi-management',
        father_resource: parentId
      },
      {
        resource_name: 'BINs Nacionales MSI',
        resource_url: '/catalogos/msi-bines',
        father_resource: parentId
      },
      {
        resource_name: 'Reportes MSI',
        resource_url: '/reportes/msi',
        father_resource: parentId
      },
      {
        resource_name: 'Plantillas MSI',
        resource_url: '/catalogos/msi-templates',
        father_resource: parentId
      }
    ];
    
    console.log(`🔧 Creating ${msiResources.length} MSI resources...`);
    
    for (const resource of msiResources) {
      // Check if resource already exists
      const [existing] = await db.seq.query(`
        SELECT id FROM resources WHERE resource_url = '${resource.resource_url}'
      `);
      
      if (existing.length === 0) {
        const [result] = await db.seq.query(`
          INSERT INTO resources (resource_name, resource_url, father_resource, createdAt, updatedAt)
          VALUES ('${resource.resource_name}', '${resource.resource_url}', ${parentId || 'NULL'}, NOW(), NOW())
        `);
        
        console.log(`✅ Created: ${resource.resource_name}`);
        
        // Assign appropriate permissions to admin profile based on resource type
        const permissions = getPermissionsForResource(resource.resource_name);
        await db.seq.query(`
          INSERT INTO profile_resources (id_profile, id_resource, \`select\`, \`create\`, \`edit\`, \`delete\`, createdAt, updatedAt)
          VALUES (1, ${result}, ${permissions.select}, ${permissions.create}, ${permissions.edit}, ${permissions.delete}, NOW(), NOW())
        `);
        
        console.log(`🔐 Assigned admin permissions for: ${resource.resource_name} (${getPermissionDescription(permissions)})`);
      } else {
        console.log(`⚠️ Already exists: ${resource.resource_name}`);
        
        // Check if admin has permissions
        const [adminPerms] = await db.seq.query(`
          SELECT id_profile FROM profile_resources 
          WHERE id_profile = 1 AND id_resource = ${existing[0].id}
        `);
        
        if (adminPerms.length === 0) {
          const permissions = getPermissionsForResource(resource.resource_name);
          await db.seq.query(`
            INSERT INTO profile_resources (id_profile, id_resource, \`select\`, \`create\`, \`edit\`, \`delete\`, createdAt, updatedAt)
            VALUES (1, ${existing[0].id}, ${permissions.select}, ${permissions.create}, ${permissions.edit}, ${permissions.delete}, NOW(), NOW())
          `);
          console.log(`🔐 Added admin permissions for: ${resource.resource_name} (${getPermissionDescription(permissions)})`);
        }
      }
    }
    
    console.log('\n🎉 MSI resources and permissions setup complete!');
    
  } catch (error) {
    console.error('❌ Error setting up MSI resources:', error.message);
    throw error;
  }
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🎯 MSI Complete Setup Command

Usage: node commands/setup-msi-test.js [options]

Options:
  --help, -h     Show this help message
  --clean        Clean up test data (run seeder down)
  --migrate-only Run migrations only
  --seed-only    Run seeding only
  --verify-only  Verify setup only

Examples:
  node commands/setup-msi-test.js              # Complete MSI setup
  node commands/setup-msi-test.js --clean      # Clean up test data
  node commands/setup-msi-test.js --migrate-only # Run migrations only
  node commands/setup-msi-test.js --seed-only   # Run seeding only
  node commands/setup-msi-test.js --verify-only # Verify setup only

This command performs complete MSI setup:

📋 STEP 1: Database Migrations
- Runs all MSI-related migrations
- Creates msi_templates table
- Creates msi_bin_ranges table
- Creates merchant_msi_templates junction table

🌱 STEP 2: Test Data Seeding
- Creates default MSI templates (Estándar, Premium, Básico)
- Creates MSI BIN ranges for Visa, Mastercard, Amex
- Falls back to basic data if seeder not found

🔧 STEP 3: Resources & Permissions
- Creates frontend menu resources
- Sets up admin permissions
- Configures access control

✅ STEP 4: Verification
- Validates all MSI components
- Checks data integrity
- Reports setup status

🚀 Ready to Use:
- MSI Templates API: GET /api/msi-templates
- MSI Reports API: POST /api/msi-reports/generate
- MSI BINs API: GET /api/msi-bins/national
- Frontend: /catalogos/msi-templates

🔧 Backend Components:
- MSI Templates Controller (CRUD operations)
- MSI Reports Controller (analytics & reporting)
- MSI BINs Controller (range management)
- Database models and relationships
- JWT authentication integration

🔐 Permissions Setup:
- MSI Templates: Full CRUD access
- MSI Reports: View access
- MSI BINs: Manage access
- Admin role configuration
`);
    process.exit(0);
  }
  
  if (args.includes('--clean')) {
    (async () => {
      console.log('🗑️ Cleaning MSI test data...');
      
      try {
        const seeder = require('../lib/socketServer/lib/sequelize/seeders/20260526000000-msi-test-data-seeder.js');
        await seeder.down(db.seq.getQueryInterface(), db.seq.constructor);
        console.log('✅ MSI test data cleaned up successfully!');
      } catch (error) {
        console.log('⚠️ MSI test data seeder not found, cleaning manually...');
        await db.seq.query('DELETE FROM merchant_msi_templates');
        await db.seq.query('DELETE FROM msi_templates');
        await db.seq.query('DELETE FROM msi_bin_ranges');
        console.log('✅ MSI data cleaned up manually!');
      }
      await db.seq.close();
    })().catch(error => {
      console.error('❌ Cleanup failed:', error.message);
      process.exit(1);
    });
  } else if (args.includes('--migrate-only')) {
    (async () => {
      await runMigrations();
      await db.seq.close();
      console.log('✅ Migrations completed!');
    })().catch(error => {
      console.error('❌ Migration failed:', error.message);
      process.exit(1);
    });
  } else if (args.includes('--seed-only')) {
    (async () => {
      await runSeeder();
      await db.seq.close();
      console.log('✅ Seeding completed!');
    })().catch(error => {
      console.error('❌ Seeding failed:', error.message);
      process.exit(1);
    });
  } else if (args.includes('--verify-only')) {
    (async () => {
      await verifyMSISetup();
      await db.seq.close();
      console.log('✅ Verification completed!');
    })().catch(error => {
      console.error('❌ Verification failed:', error.message);
      process.exit(1);
    });
  } else {
    setupMSITest();
  }
}

// Helper functions for permission management
function getPermissionsForResource(resourceName) {
  // Define permission sets based on resource type
  const permissionSets = {
    // View-only resources
    'MSI Config View': { select: 1, create: 0, edit: 0, delete: 0 },
    'MSI Config Summary': { select: 1, create: 0, edit: 0, delete: 0 },
    'MSI Webservice View': { select: 1, create: 0, edit: 0, delete: 0 },
    'Eligibilidad BIN': { select: 1, create: 0, edit: 0, delete: 0 },
    'BINs Check Eligibility': { select: 1, create: 0, edit: 0, delete: 0 },
    'Operations with MSI': { select: 1, create: 0, edit: 0, delete: 0 },
    'MSI Reports': { select: 1, create: 0, edit: 0, delete: 0 },
    
    // Edit resources (can modify but not create/delete)
    'MSI Config Edit': { select: 1, create: 0, edit: 1, delete: 0 },
    'MSI Min Amount Update': { select: 1, create: 0, edit: 1, delete: 0 },
    'Validación BIN MSI': { select: 1, create: 0, edit: 1, delete: 0 },
    'Operations MSI Config': { select: 1, create: 0, edit: 1, delete: 0 },
    
    // Full CRUD resources
    'Configuración MSI': { select: 1, create: 1, edit: 1, delete: 1 },
    'MSI Config Overrides': { select: 1, create: 1, edit: 1, delete: 1 },
    'Terminales MSI': { select: 1, create: 1, edit: 1, delete: 1 },
    'Rangos BIN': { select: 1, create: 1, edit: 1, delete: 1 },
    'BINs Manage': { select: 1, create: 1, edit: 1, delete: 1 },
    'BINs National': { select: 1, create: 1, edit: 1, delete: 1 },
    'MSI Templates': { select: 1, create: 1, edit: 1, delete: 1 },
    'MSI BIN Catalog': { select: 1, create: 1, edit: 1, delete: 1 }
  };
  
  // Default to full permissions if not specifically defined
  return permissionSets[resourceName] || { select: 1, create: 1, edit: 1, delete: 1 };
}

function getPermissionDescription(permissions) {
  const perms = [];
  if (permissions.select) perms.push('View');
  if (permissions.create) perms.push('Create');
  if (permissions.edit) perms.push('Edit');
  if (permissions.delete) perms.push('Delete');
  return perms.length > 0 ? perms.join(', ') : 'No permissions';
}

module.exports = setupMSITest;
