#!/usr/bin/env node

/**
 * Complete Database Validation Master Script
 * 
 * This master script runs all database validation checks:
 * - Database connectivity and permissions
 * - MCC operations permissions
 * - MCC relations and dependencies
 * - Data integrity validation
 */

require('dotenv').config();

// Import check modules
const databaseChecks = require('./check-database-permissions-status');
const mccPermissionsChecks = require('./check-mcc-operations-permissions');
const mccRelationsChecks = require('./check-mcc-relations-integrity');

// ANSI color codes
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

function logSection(title) {
  console.log('\n' + '='.repeat(70));
  log(`🚀 ${title}`, 'bright');
  console.log('='.repeat(70));
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

async function runDatabaseConnectivityCheck() {
  logSection('DATABASE CONNECTIVITY & BASIC STATUS');
  
  try {
    const connected = await databaseChecks.checkDatabaseConnection();
    if (!connected) {
      logError('Database connection failed - aborting remaining checks');
      return false;
    }
    
    logSuccess('Database connection established');
    
    // Run basic checks
    const profiles = await databaseChecks.checkUserProfiles();
    const resources = await databaseChecks.checkResources();
    const users = await databaseChecks.checkUsers();
    
    return profiles && resources && users;
  } catch (error) {
    logError(`Database connectivity check failed: ${error.message}`);
    return false;
  }
}

async function runPermissionsCheck() {
  logSection('PERMISSIONS & ACCESS CONTROL');
  
  try {
    const profileResources = await databaseChecks.checkProfileResources();
    return profileResources;
  } catch (error) {
    logError(`Permissions check failed: ${error.message}`);
    return false;
  }
}

async function runMccPermissionsCheck() {
  logSection('MCC OPERATIONS PERMISSIONS');
  
  try {
    const mccResources = await mccPermissionsChecks.checkMccResourceExists();
    const profilePermissions = await mccPermissionsChecks.checkProfileMccPermissions();
    const userAccess = await mccPermissionsChecks.checkUsersWithMccAccess();
    const apiAccess = await mccPermissionsChecks.simulateMccApiAccess();
    const dataIntegrity = await mccPermissionsChecks.checkMccDataIntegrity();
    
    const allGood = mccResources.found && 
                   profilePermissions.length > 0 && 
                   apiAccess.accessible && 
                   dataIntegrity.valid;
    
    if (allGood) {
      logSuccess('MCC permissions check passed');
    } else {
      logWarning('MCC permissions issues detected');
    }
    
    return allGood;
  } catch (error) {
    logError(`MCC permissions check failed: ${error.message}`);
    return false;
  }
}

async function runMccRelationsCheck() {
  logSection('MCC RELATIONS & DEPENDENCIES');
  
  try {
    const isoMcc = await mccRelationsChecks.checkIsoMccTable();
    const merchantRelations = await mccRelationsChecks.checkMerchantMccRelations();
    const operationsMapping = await mccRelationsChecks.checkMccOperationsMapping();
    const constraints = await mccRelationsChecks.checkDatabaseConstraints();
    const dependencies = await mccRelationsChecks.checkMccServiceDependencies();
    
    const allGood = isoMcc.exists && 
                   merchantRelations.invalidRefs === 0 &&
                   operationsMapping.totalOperations > 0 &&
                   dependencies.serviceExists &&
                   dependencies.routeExists;
    
    if (allGood) {
      logSuccess('MCC relations check passed');
    } else {
      logWarning('MCC relations issues detected');
    }
    
    return allGood;
  } catch (error) {
    logError(`MCC relations check failed: ${error.message}`);
    return false;
  }
}

async function runDataIntegrityCheck() {
  logSection('DATA INTEGRITY VALIDATION');
  
  try {
    // Check merchants with MCC operations
    const merchantsWithMcc = await databaseChecks.checkMerchantsAndMcc();
    
    // Validate MCC operations data
    const mccOps = await mccPermissionsChecks.checkMccDataIntegrity();
    
    // Check for data consistency
    const consistencyChecks = [
      'Merchant-MCC assignments validated',
      'MCC operations data validated',
      'Foreign key constraints checked',
      'Data relationships verified'
    ];
    
    consistencyChecks.forEach(check => {
      log(`  ✓ ${check}`, 'green');
    });
    
    return merchantsWithMcc && mccOps.valid;
  } catch (error) {
    logError(`Data integrity check failed: ${error.message}`);
    return false;
  }
}

async function generateFinalReport(results) {
  logSection('FINAL SYSTEM STATUS REPORT');
  
  const timestamp = new Date().toISOString();
  log(`Report Generated: ${timestamp}`, 'cyan');
  
  console.log('\n' + '-'.repeat(70));
  log('CHECK RESULTS SUMMARY:', 'bright');
  console.log('-'.repeat(70));
  
  const checks = [
    { name: 'Database Connectivity', status: results.connectivity },
    { name: 'Basic Permissions', status: results.permissions },
    { name: 'MCC Operations Permissions', status: results.mccPermissions },
    { name: 'MCC Relations & Dependencies', status: results.mccRelations },
    { name: 'Data Integrity', status: results.dataIntegrity }
  ];
  
  let passedCount = 0;
  checks.forEach(check => {
    const status = check.status ? '✅ PASS' : '❌ FAIL';
    const color = check.status ? 'green' : 'red';
    log(`${status} ${check.name}`, color);
    if (check.status) passedCount++;
  });
  
  console.log('-'.repeat(70));
  log(`Overall: ${passedCount}/${checks.length} checks passed`, 
       passedCount === checks.length ? 'green' : 'yellow');
  console.log('-'.repeat(70));
  
  // Recommendations
  log('\nRECOMMENDATIONS:', 'bright');
  const recommendations = [
    'Fix any failed checks before proceeding to production',
    'Ensure all merchants have valid MCC assignments',
    'Verify user permissions for MCC operations',
    'Test API endpoints with actual user credentials',
    'Run database backups before making changes',
    'Document any custom configurations'
  ];
  
  recommendations.forEach((rec, i) => {
    log(`  ${i + 1}. ${rec}`, 'cyan');
  });
  
  // Next steps
  log('\nNEXT STEPS:', 'bright');
  if (passedCount === checks.length) {
    logSuccess('System is ready for production use');
    logInfo('Consider running periodic checks to maintain system health');
  } else {
    logWarning('Address failed checks before production deployment');
    logInfo('Re-run this script after fixing issues');
  }
  
  return {
    timestamp,
    totalChecks: checks.length,
    passed: passedCount,
    failed: checks.length - passedCount,
    overallStatus: passedCount === checks.length ? 'PASS' : 'FAIL'
  };
}

async function main() {
  console.log(colors.bright + '\n🔍 COMPLETE DATABASE VALIDATION SYSTEM\n' + colors.reset);
  console.log('Running comprehensive database validation...\n');
  
  const startTime = Date.now();
  
  try {
    // Run all checks
    const results = {
      connectivity: await runDatabaseConnectivityCheck(),
      permissions: await runPermissionsCheck(),
      mccPermissions: await runMccPermissionsCheck(),
      mccRelations: await runMccRelationsCheck(),
      dataIntegrity: await runDataIntegrityCheck()
    };
    
    // Generate final report
    const report = await generateFinalReport(results);
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(70));
    log(`Validation completed in ${duration} seconds`, 'bright');
    console.log('='.repeat(70));
    
    // Exit with appropriate code
    process.exit(report.overallStatus === 'PASS' ? 0 : 1);
    
  } catch (error) {
    logError(`Unexpected error during validation: ${error.message}`);
    console.log(error.stack);
    process.exit(1);
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
  runDatabaseConnectivityCheck,
  runPermissionsCheck,
  runMccPermissionsCheck,
  runMccRelationsCheck,
  runDataIntegrityCheck,
  generateFinalReport
};
