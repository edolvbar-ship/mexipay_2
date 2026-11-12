#!/usr/bin/env node

/**
 * Permission Manager Import Tool
 * 
 * Imports permission manager database configuration from an export file
 * Compatible with the export format from export-permissions.js
 * 
 * Imports:
 * - User profiles (user_profile table)
 * - Resources (resources table) 
 * - Profile-resource assignments (profile_resources table)
 * - User accounts (users table)
 * - MCC operations (mcc_operations table)
 */

require('dotenv').config();
const db = require('../lib/socketServer/lib/sequelize/init');
const fs = require('fs');
const path = require('path');

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
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

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logProgress(message) {
  log(`🔄 ${message}`, 'magenta');
}

// Parse command line arguments
function getArguments() {
  const args = process.argv.slice(2);
  const options = {
    filename: null,
    dryRun: false,
    force: false,
    skipUsers: false,
    skipMccOps: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--force':
        options.force = true;
        break;
      case '--skip-users':
        options.skipUsers = true;
        break;
      case '--skip-mcc-ops':
        options.skipMccOps = true;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
      default:
        if (!arg.startsWith('--') && !options.filename) {
          options.filename = arg;
        }
    }
  }

  if (!options.filename) {
    logError('Export filename is required');
    showHelp();
    process.exit(1);
  }

  return options;
}

function showHelp() {
  console.log(colors.bright + '\n🔍 PERMISSION MANAGER IMPORT TOOL\n' + colors.reset);
  console.log('Usage: node import-permissions.js <export-file> [options]\n');
  console.log('Arguments:');
  console.log('  export-file          Path to the export JSON file');
  console.log('\nOptions:');
  console.log('  --dry-run            Show what would be imported without making changes');
  console.log('  --force              Force import even if data already exists');
  console.log('  --skip-users         Skip user account import (recommended)');
  console.log('  --skip-mcc-ops       Skip MCC operations import');
  console.log('  --help, -h           Show this help message\n');
  console.log('Examples:');
  console.log('  node import-permissions.js permissions-export-2024-05-28.json');
  console.log('  node import-permissions.js permissions-export-2024-05-28.json --dry-run');
  console.log('  node import-permissions.js permissions-export-2024-05-28.json --force --skip-users\n');
}

async function loadExportFile(filename) {
  logInfo(`Loading export file: ${filename}`);
  
  if (!fs.existsSync(filename)) {
    throw new Error(`Export file not found: ${filename}`);
  }

  try {
    const content = fs.readFileSync(filename, 'utf8');
    const exportData = JSON.parse(content);
    
    // Validate export structure
    if (!exportData.export_info || !exportData.data) {
      throw new Error('Invalid export file format - missing export_info or data sections');
    }

    logSuccess(`Export file loaded successfully`);
    logInfo(`Export version: ${exportData.export_info.export_version}`);
    logInfo(`Export timestamp: ${exportData.export_info.timestamp}`);
    logInfo(`Source environment: ${exportData.export_info.environment}`);
    
    return exportData;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in export file: ${error.message}`);
    }
    throw error;
  }
}

async function checkExistingData() {
  logInfo('Checking existing data in target database...');
  
  const checks = {
    user_profiles: await db.profileUsers.count(),
    resources: await db.resources.count(),
    profile_resources: await db.profileResources.count(),
    users: await db.users.count(),
    mcc_operations: await db.mccOperations.count()
  };

  Object.entries(checks).forEach(([table, count]) => {
    if (count > 0) {
      logWarning(`Existing ${table}: ${count} records`);
    } else {
      logInfo(`No existing ${table}`);
    }
  });

  return checks;
}

async function importUserProfiles(profiles, dryRun = false) {
  logProgress(`Importing user profiles (${dryRun ? 'DRY RUN' : 'LIVE'})...`);
  
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const profile of profiles) {
    try {
      // Check if profile already exists
      const existing = await db.profileUsers.findOne({
        where: { id_profile: profile.id_profile },
        paranoid: false
      });

      if (existing) {
        log(`  Skipping existing profile: ${profile.profile_name} (ID: ${profile.id_profile})`, 'yellow');
        skipped++;
        continue;
      }

      if (!dryRun) {
        await db.profileUsers.create({
          id_profile: profile.id_profile,
          profile_name: profile.profile_name,
          admin: profile.admin,
          comments: profile.comments,
          datos_bancarios: profile.datos_bancarios,
          created_at: profile.created_at,
          deleted_at: profile.deleted_at,
          last_update: profile.last_update
        });
      }

      log(`  ${dryRun ? 'Would import' : 'Imported'} profile: ${profile.profile_name} (ID: ${profile.id_profile})`, dryRun ? 'cyan' : 'green');
      imported++;
    } catch (error) {
      log(`  Error importing profile ${profile.profile_name}: ${error.message}`, 'red');
      errors++;
    }
  }

  return { imported, skipped, errors };
}

async function importResources(resources, dryRun = false) {
  logProgress(`Importing resources (${dryRun ? 'DRY RUN' : 'LIVE'})...`);
  
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const resource of resources) {
    try {
      // Check if resource already exists
      const existing = await db.resources.findOne({
        where: { id: resource.id },
        paranoid: false
      });

      if (existing) {
        log(`  Skipping existing resource: ${resource.resource_name} (ID: ${resource.id})`, 'yellow');
        skipped++;
        continue;
      }

      if (!dryRun) {
        await db.resources.create({
          id: resource.id,
          icon: resource.icon,
          father_resource: resource.father_resource,
          resource_name: resource.resource_name,
          resource_url: resource.resource_url,
          isF: resource.isF,
          isConfig: resource.isConfig,
          isCrud: resource.isCrud,
          isGroup: resource.isGroup,
          justPage: resource.justPage,
          createdAt: resource.createdAt,
          updatedAt: resource.updatedAt,
          deletedAt: resource.deletedAt
        });
      }

      log(`  ${dryRun ? 'Would import' : 'Imported'} resource: ${resource.resource_name} (ID: ${resource.id})`, dryRun ? 'cyan' : 'green');
      imported++;
    } catch (error) {
      log(`  Error importing resource ${resource.resource_name}: ${error.message}`, 'red');
      errors++;
    }
  }

  return { imported, skipped, errors };
}

async function importProfileResources(profileResources, dryRun = false) {
  logProgress(`Importing profile-resource assignments (${dryRun ? 'DRY RUN' : 'LIVE'})...`);
  
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const pr of profileResources) {
    try {
      // Check if assignment already exists
      const existing = await db.profileResources.findOne({
        where: { 
          id_profile: pr.id_profile, 
          id_resource: pr.id_resource 
        }
      });

      if (existing) {
        log(`  Skipping existing assignment: Profile ${pr.id_profile} -> Resource ${pr.id_resource}`, 'yellow');
        skipped++;
        continue;
      }

      if (!dryRun) {
        await db.profileResources.create({
          id_profile: pr.id_profile,
          id_resource: pr.id_resource,
          icon: pr.icon,
          father_resource: pr.father_resource,
          resource_name: pr.resource_name,
          resource_url: pr.resource_url,
          create: pr.create,
          edit: pr.edit,
          delete: pr.delete,
          select: pr.select,
          createdAt: pr.createdAt,
          updatedAt: pr.updatedAt
        });
      }

      log(`  ${dryRun ? 'Would import' : 'Imported'} assignment: Profile ${pr.id_profile} -> Resource ${pr.id_resource}`, dryRun ? 'cyan' : 'green');
      imported++;
    } catch (error) {
      log(`  Error importing assignment Profile ${pr.id_profile} -> Resource ${pr.id_resource}: ${error.message}`, 'red');
      errors++;
    }
  }

  return { imported, skipped, errors };
}

async function importUsers(users, dryRun = false) {
  logProgress(`Importing users (${dryRun ? 'DRY RUN' : 'LIVE'})...`);
  
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of users) {
    try {
      // Check if user already exists
      const existing = await db.users.findOne({
        where: { username: user.username }
      });

      if (existing) {
        log(`  Skipping existing user: ${user.username}`, 'yellow');
        skipped++;
        continue;
      }

      if (!dryRun) {
        await db.users.create({
          id_user: user.id_user,
          id_profile: user.id_profile,
          id_cliente: user.id_cliente,
          is_admin: user.is_admin,
          username: user.username,
          name: user.name,
          last_name: user.last_name,
          sur_name: user.sur_name,
          mail: user.mail,
          telephone: user.telephone,
          picture: user.picture,
          change_password: user.change_password,
          online: user.online,
          updated_at: user.updated_at,
          token_pwd: user.token_pwd,
          intento: user.intento,
          created_at: user.created_at,
          // Note: Password is not imported - user will need to reset
          password: '$2b$10$placeholder.password.hash.for.import'
        });
      }

      log(`  ${dryRun ? 'Would import' : 'Imported'} user: ${user.username} (password reset required)`, dryRun ? 'cyan' : 'green');
      imported++;
    } catch (error) {
      log(`  Error importing user ${user.username}: ${error.message}`, 'red');
      errors++;
    }
  }

  return { imported, skipped, errors };
}

async function importMccOperations(mccOperations, dryRun = false) {
  logProgress(`Importing MCC operations (${dryRun ? 'DRY RUN' : 'LIVE'})...`);
  
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  // Check if msi_enabled column exists in target database
  let hasMsiEnabled = false;
  try {
    await db.mccOperations.findOne({ attributes: ['msi_enabled'] });
    hasMsiEnabled = true;
  } catch (error) {
    logWarning('Target database does not have msi_enabled column, will skip this field');
  }

  for (const op of mccOperations) {
    try {
      // Check if operation already exists
      const existing = await db.mccOperations.findOne({
        where: { 
          mcc_code: op.mcc_code,
          operation_code: op.operation_code 
        }
      });

      if (existing) {
        log(`  Skipping existing operation: ${op.mcc_code} - ${op.operation_code}`, 'yellow');
        skipped++;
        continue;
      }

      if (!dryRun) {
        const createData = {
          id_operation: op.id_operation,
          mcc_code: op.mcc_code,
          name: op.name,
          description: op.description,
          operation_code: op.operation_code,
          msg_type: op.msg_type,
          processing_code: op.processing_code,
          requires_amount: op.requires_amount,
          requires_tip: op.requires_tip,
          active: op.active,
          display_order: op.display_order,
          icon_name: op.icon_name,
          category_code: op.category_code,
          creation_date: op.creation_date,
          updated_at: op.updated_at
        };
        
        // Only include msi_enabled if the column exists in target database
        if (hasMsiEnabled && op.msi_enabled !== undefined) {
          createData.msi_enabled = op.msi_enabled;
        }

        await db.mccOperations.create(createData);
      }

      log(`  ${dryRun ? 'Would import' : 'Imported'} operation: ${op.mcc_code} - ${op.operation_code} - ${op.name}`, dryRun ? 'cyan' : 'green');
      imported++;
    } catch (error) {
      log(`  Error importing operation ${op.mcc_code} - ${op.operation_code}: ${error.message}`, 'red');
      errors++;
    }
  }

  return { imported, skipped, errors };
}

async function main() {
  const options = getArguments();
  
  console.log(colors.bright + '\n🔍 PERMISSION MANAGER IMPORT TOOL\n' + colors.reset);
  console.log(`Importing permission configuration from: ${options.filename}\n`);

  if (options.dryRun) {
    logWarning('DRY RUN MODE - No changes will be made to the database');
  }

  try {
    // Test database connection
    await db.seq.authenticate();
    logSuccess('Database connection established');

    // Load export file
    const exportData = await loadExportFile(options.filename);

    // Check existing data
    const existingData = await checkExistingData();

    // Warn about existing data unless force is used
    if (!options.force && Object.values(existingData).some(count => count > 0)) {
      logWarning('Target database already contains data');
      logWarning('Use --force to proceed with import, or run with --dry-run to preview');
      
      if (!options.dryRun) {
        logError('Import cancelled due to existing data. Use --force to override.');
        process.exit(1);
      }
    }

    const results = {
      user_profiles: await importUserProfiles(exportData.data.user_profiles, options.dryRun),
      resources: await importResources(exportData.data.resources, options.dryRun),
      profile_resources: await importProfileResources(exportData.data.profile_resources, options.dryRun),
      users: options.skipUsers ? { imported: 0, skipped: exportData.data.users.length, errors: 0 } : 
               await importUsers(exportData.data.users, options.dryRun),
      mcc_operations: options.skipMccOps ? { imported: 0, skipped: exportData.data.mcc_operations.length, errors: 0 } :
                        await importMccOperations(exportData.data.mcc_operations, options.dryRun)
    };

    // Display results
    console.log('\n' + '='.repeat(60));
    logSuccess(`${options.dryRun ? 'Dry run' : 'Import'} completed!`);
    console.log('='.repeat(60));

    console.log('\nResults Summary:');
    Object.entries(results).forEach(([table, result]) => {
      console.log(`\n${table}:`);
      log(`  Imported: ${result.imported}`, 'green');
      log(`  Skipped: ${result.skipped}`, 'yellow');
      if (result.errors > 0) {
        log(`  Errors: ${result.errors}`, 'red');
      }
    });

    if (!options.dryRun) {
      console.log('\nPost-Import Actions:');
      logInfo('1. Run: node commands/check-database-permissions-status.js');
      logInfo('2. Test permission access in the application');
      if (!options.skipUsers) {
        logWarning('3. Users will need to reset their passwords');
      }
      logInfo('4. Verify all resources and permissions are working correctly');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    logError(`${options.dryRun ? 'Dry run' : 'Import'} failed!`);
    console.log('='.repeat(60));
    logError(`Error: ${error.message}`);
    
    if (error.stack) {
      console.log('\nStack trace:');
      console.log(error.stack);
    }
    
    process.exit(1);
  } finally {
    // Close database connection
    if (db.seq) {
      await db.seq.close();
    }
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  logError(`Unhandled Rejection: ${reason}`);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logError(`Uncaught Exception: ${error.message}`);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  importUserProfiles,
  importResources,
  importProfileResources,
  importUsers,
  importMccOperations
};
