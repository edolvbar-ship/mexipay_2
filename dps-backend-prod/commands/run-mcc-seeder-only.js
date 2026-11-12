#!/usr/bin/env node

/**
 * Script to run ONLY MCC operations seeder
 * Usage: node run-mcc-seeder-only.js
 */

const { execSync } = require('child_process');

async function runMccSeederOnly() {
  try {
    console.log('🌱 Running MCC operations seeder only...');
    
    // Change to project directory
    process.chdir(__dirname);
    
    // Run ONLY the MCC operations seeder
    execSync('npx sequelize-cli db:seed --seed 20260325000000-mcc-operations-seeder.js --seeders-path lib/socketServer/lib/sequelize/seeders', { 
      stdio: 'inherit',
      cwd: __dirname 
    });
    
    console.log('✅ MCC operations seeder completed successfully!');
    
  } catch (error) {
    console.error('❌ Error running MCC seeder:', error.message);
    process.exit(1);
  }
}

runMccSeederOnly();
