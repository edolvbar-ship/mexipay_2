#!/usr/bin/env node

/**
 * Environment Switcher
 * Switches between development, production, and QA configurations using dedicated environment files
 * 
 * Usage:
 *   node commands/env-switch.js --dev   # Switch to development mode
 *   node commands/env-switch.js --prod  # Switch to production mode
 *   node commands/env-switch.js --qa    # Switch to QA mode
 *   node commands/env-switch.js --staging # Switch to staging mode
 */

const fs = require('fs');
const path = require('path');

// Paths relative to gw-backend-backup directory
const envPath = path.join(__dirname, '..', '.env');
const configPath = path.join(__dirname, '..', 'config', 'config.json');
const nginxConfPath = path.join(__dirname, '..', '..', 'gw-frontend-backup', '.platform', 'nginx', 'nginx.conf');

function switchEnvironment(mode) {
  let envModified = false;
  let configModified = false;
  let nginxModified = false;

  // Determine source environment files
  const sourceEnvPath = path.join(__dirname, '..', `.env.${mode}`);
  const sourceConfigPath = path.join(__dirname, '..', 'config', `config.${mode}.json`);
  
  // Handle .env file replacement
  if (fs.existsSync(sourceEnvPath)) {
    console.log(`🔄 Switching .env to ${mode} mode...`);
    
    try {
      const sourceContent = fs.readFileSync(sourceEnvPath, 'utf8');
      fs.writeFileSync(envPath, sourceContent);
      envModified = true;
      console.log(`✅ .env updated successfully from .env.${mode}`);
    } catch (error) {
      console.error(`❌ Error copying .env.${mode} to .env:`, error.message);
      return;
    }
  } else {
    console.error(`❌ Source environment file .env.${mode} not found`);
    return;
  }

  // Handle config.json file replacement
  if (fs.existsSync(sourceConfigPath)) {
    console.log(`🔄 Switching config.json to ${mode} mode...`);
    
    try {
      const sourceContent = fs.readFileSync(sourceConfigPath, 'utf8');
      fs.writeFileSync(configPath, sourceContent);
      configModified = true;
      console.log(`✅ config.json updated successfully from config.${mode}.json`);
    } catch (error) {
      console.error(`❌ Error copying config.${mode}.json to config.json:`, error.message);
      return;
    }
  } else {
    console.log(`⚠️  Source config file config.${mode}.json not found, skipping config update...`);
  }

  // Handle NLB endpoint replacements for prod and qa
  if (mode === 'prod' || mode === 'qa' || mode === 'staging') {
    console.log(`🔄 Updating NLB endpoints for ${mode} mode...`);
    
    try {
      // Read NLB values from the newly copied .env file
      const envContent = fs.readFileSync(envPath, 'utf8');
      const nlbValues = parseNlbValues(envContent);
      
      if (!nlbValues.NLB3000 || !nlbValues.NLB3001 || !nlbValues.NLB3002) {
        console.error('❌ Missing NLB environment variables. Required: NLB3000, NLB3001, NLB3002');
        return;
      }
      
      // Update nginx.conf
      nginxModified = updateNginxConf(nginxConfPath, nlbValues);
      
      if (nginxModified) {
        console.log(`✅ NLB endpoints updated successfully in nginx.conf`);
      } else {
        console.log(`⚠️  No NLB endpoint updates needed or failed`);
      }
    } catch (error) {
      console.error('❌ Error updating NLB endpoints:', error.message);
    }
  }

  // Summary
  if (envModified || configModified || nginxModified) {
    console.log(`\n✅ Successfully switched to ${mode} mode`);
    
    // Show current status
    console.log('\n📊 Current environment status:');
    console.log(`   Environment: ${mode}`);
    console.log(`   .env file: Updated from .env.${mode}`);
    
    if (configModified) {
      console.log(`   config.json: Updated from config.${mode}.json`);
    }
    
    if (nginxModified) {
      console.log(`   nginx.conf: NLB endpoints updated`);
    }
  } else {
    console.log(`⚠️  No changes made`);
  }
}

function parseNlbValues(envContent) {
  const nlbValues = {};
  const lines = envContent.split('\n');
  
  lines.forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('NLB3000=')) {
      nlbValues.NLB3000 = trimmedLine.split('=')[1].replace(/['"]/g, '');
    } else if (trimmedLine.startsWith('NLB3001=')) {
      nlbValues.NLB3001 = trimmedLine.split('=')[1].replace(/['"]/g, '');
    } else if (trimmedLine.startsWith('NLB3002=')) {
      nlbValues.NLB3002 = trimmedLine.split('=')[1].replace(/['"]/g, '');
    }
  });
  
  return nlbValues;
}

function updateNginxConf(nginxPath, nlbValues) {
  if (!fs.existsSync(nginxPath)) {
    console.log('⚠️  nginx.conf not found, skipping NLB updates...');
    return false;
  }
  
  try {
    let nginxContent = fs.readFileSync(nginxPath, 'utf8');
    const lines = nginxContent.split('\n');
    let modified = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Update NLB3000 (admin 3000) - line with "# admin 3000" comment
      if (trimmedLine.includes('# admin 3000') && trimmedLine.includes('server ') && trimmedLine.includes(':80')) {
        const newLine = line.replace(/server\s+[^:]+:80/, `server ${nlbValues.NLB3000}:80`);
        if (newLine !== line) {
          lines[i] = newLine;
          modified = true;
          console.log(`🔧 nginx.conf: Updated NLB3000 endpoint`);
        }
      }
      
      // Update NLB3001 (payments 3001) - line with "# payemnts 3001" comment
      if (trimmedLine.includes('# payemnts 3001') && trimmedLine.includes('server ') && trimmedLine.includes(':80')) {
        const newLine = line.replace(/server\s+[^:]+:80/, `server ${nlbValues.NLB3001}:80`);
        if (newLine !== line) {
          lines[i] = newLine;
          modified = true;
          console.log(`🔧 nginx.conf: Updated NLB3001 endpoint`);
        }
      }
      
      // Update NLB3002 (heavy 3002) - line with "# heavy 3002" comment
      if (trimmedLine.includes('# heavy 3002') && trimmedLine.includes('server ') && trimmedLine.includes(':80')) {
        const newLine = line.replace(/server\s+[^:]+:80/, `server ${nlbValues.NLB3002}:80`);
        if (newLine !== line) {
          lines[i] = newLine;
          modified = true;
          console.log(`🔧 nginx.conf: Updated NLB3002 endpoint`);
        }
      }
    }
    
    if (modified) {
      fs.writeFileSync(nginxPath, lines.join('\n'));
    }
    
    return modified;
  } catch (error) {
    console.error('❌ Error updating nginx.conf:', error.message);
    return false;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage:');
  console.log('  node commands/env-switch.js --dev   # Switch to development mode');
  console.log('  node commands/env-switch.js --prod  # Switch to production mode');
  console.log('  node commands/env-switch.js --qa    # Switch to QA mode');
  console.log('  node commands/env-switch.js --staging # Switch to staging mode');
  process.exit(1);
}

const mode = args[0];

if (mode === '--dev') {
  switchEnvironment('dev');
} else if (mode === '--prod') {
  switchEnvironment('prod');
} else if (mode === '--qa') {
  switchEnvironment('qa');
} else if (mode === '--staging') {
  switchEnvironment('staging');
} else {
  console.error('❌ Invalid argument. Use --dev, --prod, --qa, or --staging');
  process.exit(1);
}
