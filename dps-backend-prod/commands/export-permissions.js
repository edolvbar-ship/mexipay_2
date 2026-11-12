#!/usr/bin/env node

/**
 * Permission Manager Export Tool
 * 
 * Exports the complete permission manager database configuration in a compatible format
 * for importing into other environments (QA, production, etc.)
 * 
 * Exports:
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

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

async function exportUserProfiles() {
  logInfo('Exporting user profiles...');
  
  try {
    const profiles = await db.profileUsers.findAll({
      attributes: [
        'id_profile', 
        'profile_name', 
        'admin', 
        'comments', 
        'datos_bancarios',
        'created_at', 
        'deleted_at', 
        'last_update'
      ],
      paranoid: false,
      order: [['id_profile', 'ASC']]
    });

    const cleanProfiles = profiles.map(profile => ({
      id_profile: profile.id_profile,
      profile_name: profile.profile_name,
      admin: profile.admin,
      comments: profile.comments,
      datos_bancarios: profile.datos_bancarios,
      created_at: profile.created_at,
      deleted_at: profile.deleted_at,
      last_update: profile.last_update
    }));

    logSuccess(`Exported ${cleanProfiles.length} user profiles`);
    return cleanProfiles;
  } catch (error) {
    logError(`Error exporting user profiles: ${error.message}`);
    throw error;
  }
}

async function exportResources() {
  logInfo('Exporting resources...');
  
  try {
    const resources = await db.resources.findAll({
      attributes: [
        'id',
        'icon',
        'father_resource',
        'resource_name',
        'resource_url',
        'isF',
        'isConfig',
        'isCrud',
        'isGroup',
        'justPage',
        'createdAt',
        'updatedAt',
        'deletedAt'
      ],
      paranoid: false,
      order: [['id', 'ASC']]
    });

    const cleanResources = resources.map(resource => ({
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
    }));

    logSuccess(`Exported ${cleanResources.length} resources`);
    return cleanResources;
  } catch (error) {
    logError(`Error exporting resources: ${error.message}`);
    throw error;
  }
}

async function exportProfileResources() {
  logInfo('Exporting profile-resource assignments...');
  
  try {
    const profileResources = await db.profileResources.findAll({
      attributes: [
        'id',
        'id_profile',
        'id_resource',
        'icon',
        'father_resource',
        'resource_name',
        'resource_url',
        'create',
        'edit',
        'delete',
        'select',
        'createdAt',
        'updatedAt'
      ],
      order: [['id_profile', 'ASC'], ['id_resource', 'ASC']]
    });

    const cleanProfileResources = profileResources.map(pr => ({
      id: pr.id,
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
    }));

    logSuccess(`Exported ${cleanProfileResources.length} profile-resource assignments`);
    return cleanProfileResources;
  } catch (error) {
    logError(`Error exporting profile-resources: ${error.message}`);
    throw error;
  }
}

async function exportUsers() {
  logInfo('Exporting users...');
  
  try {
    const users = await db.users.findAll({
      attributes: [
        'id_user',
        'id_profile',
        'id_cliente',
        'is_admin',
        'username',
        'name',
        'last_name',
        'sur_name',
        'mail',
        'telephone',
        'picture',
        'change_password',
        'online',
        'updated_at',
        'token_pwd',
        'intento',
        'created_at'
        // Note: password is excluded for security reasons
      ],
      order: [['id_user', 'ASC']]
    });

    const cleanUsers = users.map(user => ({
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
      created_at: user.created_at
    }));

    logSuccess(`Exported ${cleanUsers.length} users (passwords excluded for security)`);
    return cleanUsers;
  } catch (error) {
    logError(`Error exporting users: ${error.message}`);
    throw error;
  }
}

async function exportMccOperations() {
  logInfo('Exporting MCC operations...');
  
  try {
    // First, try to get the actual table structure to avoid missing columns
    let attributes;
    try {
      // Try full attribute list first (includes msi_enabled)
      attributes = [
        'id_operation',
        'mcc_code',
        'name',
        'description',
        'operation_code',
        'msg_type',
        'processing_code',
        'requires_amount',
        'requires_tip',
        'msi_enabled',
        'active',
        'display_order',
        'icon_name',
        'category_code',
        'creation_date',
        'updated_at'
      ];
      
      await db.mccOperations.findOne({ attributes: ['msi_enabled'] });
    } catch (columnError) {
      // If msi_enabled column doesn't exist, use fallback attribute list
      logWarning('msi_enabled column not found, using basic attribute list');
      attributes = [
        'id_operation',
        'mcc_code',
        'name',
        'description',
        'operation_code',
        'msg_type',
        'processing_code',
        'requires_amount',
        'requires_tip',
        'active',
        'display_order',
        'icon_name',
        'category_code',
        'creation_date',
        'updated_at'
      ];
    }

    const mccOperations = await db.mccOperations.findAll({
      attributes: attributes,
      order: [['mcc_code', 'ASC'], ['display_order', 'ASC']]
    });

    const cleanMccOperations = mccOperations.map(op => {
      const result = {
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
      
      // Only include msi_enabled if it exists
      if (op.msi_enabled !== undefined) {
        result.msi_enabled = op.msi_enabled;
      }
      
      return result;
    });

    logSuccess(`Exported ${cleanMccOperations.length} MCC operations`);
    return cleanMccOperations;
  } catch (error) {
    logError(`Error exporting MCC operations: ${error.message}`);
    throw error;
  }
}

async function generateExportSummary(exportData) {
  return {
    export_info: {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      database_host: process.env.DB_HOST || 'unknown',
      export_version: '1.0.0'
    },
    summary: {
      user_profiles: exportData.user_profiles.length,
      resources: exportData.resources.length,
      profile_resources: exportData.profile_resources.length,
      users: exportData.users.length,
      mcc_operations: exportData.mcc_operations.length
    },
    data: exportData
  };
}

async function main() {
  console.log(colors.bright + '\n🔍 PERMISSION MANAGER EXPORT TOOL\n' + colors.reset);
  console.log('Exporting permission manager database configuration...\n');

  try {
    // Test database connection
    await db.seq.authenticate();
    logSuccess('Database connection established');

    // Export all data
    const exportData = {
      user_profiles: await exportUserProfiles(),
      resources: await exportResources(),
      profile_resources: await exportProfileResources(),
      users: await exportUsers(),
      mcc_operations: await exportMccOperations()
    };

    // Generate complete export with metadata
    const completeExport = await generateExportSummary(exportData);

    // Create output filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `permissions-export-${timestamp}.json`;
    const outputPath = path.join(process.cwd(), filename);

    // Write export file
    fs.writeFileSync(outputPath, JSON.stringify(completeExport, null, 2), 'utf8');

    // Display summary
    console.log('\n' + '='.repeat(60));
    logSuccess('Export completed successfully!');
    console.log('='.repeat(60));
    
    logInfo(`Export file: ${filename}`);
    logInfo(`File size: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);
    
    console.log('\nExport Summary:');
    Object.entries(completeExport.summary).forEach(([table, count]) => {
      log(`  ${table}: ${count} records`, 'cyan');
    });

    console.log('\nImportant Notes:');
    logWarning('• User passwords are NOT included in export for security');
    logWarning('• File contains sensitive permission data - handle securely');
    logInfo('• Use import-permissions.js to import to target environment');

    console.log('\nNext Steps:');
    logInfo(`1. Copy ${filename} to target environment`);
    logInfo('2. Run: node commands/import-permissions.js <filename>');
    logInfo('3. Verify import with: node commands/check-database-permissions-status.js');

    process.exit(0);
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    logError('Export failed!');
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
  exportUserProfiles,
  exportResources,
  exportProfileResources,
  exportUsers,
  exportMccOperations,
  generateExportSummary
};
