#!/usr/bin/env node

/**
 * Script to fix production issues:
 * 1. Run the id_giro migration for merchant table
 * 2. Run the resources seeder to add MCC Operations menu
 * 3. Run the MCC operations seeder
 * Usage: node fix-production-issues.js
 */

const { execSync } = require('child_process');

async function fixProductionIssues() {
  try {
    console.log('🔧 Starting production fixes...');
    
    // Change to project directory
    process.chdir(__dirname);
    
    console.log('📦 Step 1: Running id_giro migration...');
    execSync('npx sequelize-cli db:migrate --migrations-path lib/socketServer/lib/sequelize/migrations', { 
      stdio: 'inherit',
      cwd: __dirname 
    });
    
    console.log('📦 Step 2: Running resources seeder...');
    execSync('npx sequelize-cli db:seed --seed 20260326000000-resources-seeder.js --seeders-path lib/socketServer/lib/sequelize/seeders', { 
      stdio: 'inherit',
      cwd: __dirname 
    });
    
    console.log('📦 Step 3: Running MCC operations seeder...');
    execSync('npx sequelize-cli db:seed --seed 20260325000000-mcc-operations-seeder.js --seeders-path lib/socketServer/lib/sequelize/seeders', { 
      stdio: 'inherit',
      cwd: __dirname 
    });
    
    console.log('✅ All production fixes completed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing production issues:', error.message);
    process.exit(1);
  }
}

fixProductionIssues();
