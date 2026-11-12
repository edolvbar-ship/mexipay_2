#!/usr/bin/env node

/**
 * Script to run MCC operations migration and seeder
 * Usage: node run-mcc-migration.js
 */

const { execSync } = require('child_process');
const path = require('path');

async function runMigrationAndSeeder() {
  try {
    console.log('🚀 Starting MCC operations migration and seeder...');
    
    // Change to project directory
    process.chdir(__dirname);
    
    // Run migration
    console.log('📦 Running migration...');
    execSync('npx sequelize-cli db:migrate --migrations-path lib/socketServer/lib/sequelize/migrations', { 
      stdio: 'inherit',
      cwd: __dirname 
    });
    
    console.log('✅ Migration completed!');
    
    // Run seeder
    console.log('🌱 Running seeder...');
    execSync('npx sequelize-cli db:seed:all --seeders-path lib/socketServer/lib/sequelize/seeders', { 
      stdio: 'inherit',
      cwd: __dirname 
    });
    
    console.log('✅ Seeder completed!');
    console.log('🎉 MCC operations module successfully installed!');
    
  } catch (error) {
    console.error('❌ Error running migration/seeder:', error.message);
    process.exit(1);
  }
}

runMigrationAndSeeder();
