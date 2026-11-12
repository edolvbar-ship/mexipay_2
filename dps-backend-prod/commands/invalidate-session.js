#!/usr/bin/env node

const db = require('../lib/socketServer/lib/sequelize/init');
const dbTDM = require('../lib/App-TDM/src/sequelize/init');

// Simple argument parsing without commander dependency
const args = process.argv.slice(2);
const options = {
  serial: null,
  user: null,
  dryRun: false,
  help: false
};

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--help' || arg === '-h') {
    options.help = true;
  } else if (arg === '--dry-run') {
    options.dryRun = true;
  } else if (arg === '--serial' && i + 1 < args.length) {
    options.serial = args[++i];
  } else if (arg === '--user' && i + 1 < args.length) {
    options.user = args[++i];
  }
}

function showHelp() {
  console.log('Usage: invalidate-session [options]');
  console.log('');
  console.log('Invalidate session for terminal or TDM user');
  console.log('');
  console.log('Options:');
  console.log('  -h, --help           Show help');
  console.log('  --serial <serial>     Terminal serial number to invalidate session');
  console.log('  --user <email>        TDM user email to invalidate session');
  console.log('  --dry-run             Show what would be invalidated without actually doing it');
  console.log('');
  console.log('Examples:');
  console.log('  node commands/invalidate-session.js --serial 123456789');
  console.log('  node commands/invalidate-session.js --user user@example.com');
  console.log('  node commands/invalidate-session.js --serial 123456789 --dry-run');
}

if (options.help) {
  showHelp();
  process.exit(0);
}

async function invalidateByTerminalSerial(serial) {
  console.log(`🔍 Looking up terminal with serial: ${serial}`);
  
  try {
    // Find terminal device by serial
    const terminalDevices = await db.seq.query(`
      SELECT td.idterm_device, td.serial, smdh.smart_device_idsmtdevice, sm.idsmtdevice
      FROM terminal_device td
      JOIN smart_device_has_terminal_device smdh ON td.idterm_device = smdh.terminal_device_idterm_device
      JOIN smart_device sm ON smdh.smart_device_idsmtdevice = sm.idsmtdevice
      WHERE td.serial = ?
    `, { replacements: [serial], type: db.seq.QueryTypes.SELECT });

    if (!terminalDevices || terminalDevices.length === 0) {
      console.log(`❌ Terminal with serial "${serial}" not found`);
      return false;
    }

    const device = terminalDevices[0];
    console.log(`✅ Found terminal:`, {
      idterm_device: device.idterm_device,
      serial: device.serial,
      smart_device_idsmtdevice: device.smart_device_idsmtdevice,
      idsmtdevice: device.idsmtdevice
    });

    // Find active sessions for this device
    const activeSessions = await dbTDM.session.findAll({
      where: {
        smart_device_idsmtdevice: device.smart_device_idsmtdevice,
        active: 1
      }
    });

    if (!activeSessions || activeSessions.length === 0) {
      console.log(`ℹ️  No active sessions found for terminal "${serial}"`);
      return true;
    }

    console.log(`🔍 Found ${activeSessions.length} active session(s) for terminal "${serial}":`);
    activeSessions.forEach(session => {
      console.log(`   - Session ID: ${session.idsession}, UUID: ${session.session_uuid}, User ID: ${session.user_id}`);
    });

    if (options.dryRun) {
      console.log(`🔒 DRY RUN: Would invalidate ${activeSessions.length} session(s) for terminal "${serial}"`);
      return true;
    }

    // Invalidate sessions
    const result = await dbTDM.session.update(
      { active: 0 },
      { 
        where: {
          smart_device_idsmtdevice: device.smart_device_idsmtdevice,
          active: 1
        }
      }
    );

    console.log(`✅ Successfully invalidated ${result} session(s) for terminal "${serial}"`);
    
    // Also set Gateway users offline if they're associated with this device
    const gatewayUsers = await db.seq.query(`
      SELECT u.id_user, u.username
      FROM users u
      JOIN user_has_smart_device uhsd ON u.id_user = uhsd.user_iduser
      WHERE uhsd.smart_device_idsmtdevice = ? AND u.online = 1
    `, { replacements: [device.smart_device_idsmtdevice], type: db.seq.QueryTypes.SELECT });

    if (gatewayUsers && gatewayUsers.length > 0) {
      console.log(`🔍 Found ${gatewayUsers.length} Gateway user(s) associated with this device:`);
      gatewayUsers.forEach(user => {
        console.log(`   - User ID: ${user.id_user}, Username: ${user.username}`);
      });

      if (!options.dryRun) {
        await db.users.update(
          { online: 0 },
          { 
            where: {
              id_user: gatewayUsers.map(u => u.id_user)
            }
          }
        );
        console.log(`✅ Also set ${gatewayUsers.length} Gateway user(s) offline`);
      }
    }

    return true;

  } catch (error) {
    console.error(`❌ Error invalidating session for terminal "${serial}":`, error.message);
    return false;
  }
}

async function invalidateByUserEmail(email) {
  console.log(`🔍 Looking up TDM user with email: ${email}`);
  
  try {
    // Find TDM user by email
    const tdmUsers = await dbTDM.user.findAll({
      where: { email: email }
    });

    if (!tdmUsers || tdmUsers.length === 0) {
      console.log(`❌ TDM user with email "${email}" not found`);
      return false;
    }

    const user = tdmUsers[0];
    console.log(`✅ Found TDM user:`, {
      iduser: user.iduser,
      email: user.email,
      first_name: user.first_name,
      active: user.active
    });

    // Find active sessions for this user
    const activeSessions = await dbTDM.session.findAll({
      where: {
        user_id: user.iduser,
        active: 1
      }
    });

    if (!activeSessions || activeSessions.length === 0) {
      console.log(`ℹ️  No active sessions found for user "${email}"`);
      return true;
    }

    console.log(`🔍 Found ${activeSessions.length} active session(s) for user "${email}":`);
    activeSessions.forEach(session => {
      console.log(`   - Session ID: ${session.idsession}, UUID: ${session.session_uuid}, Device ID: ${session.smart_device_idsmtdevice}`);
    });

    if (options.dryRun) {
      console.log(`🔒 DRY RUN: Would invalidate ${activeSessions.length} session(s) for user "${email}"`);
      return true;
    }

    // Invalidate sessions
    const result = await dbTDM.session.update(
      { active: 0 },
      { 
        where: {
          user_id: user.iduser,
          active: 1
        }
      }
    );

    console.log(`✅ Successfully invalidated ${result} session(s) for user "${email}"`);
    return true;

  } catch (error) {
    console.error(`❌ Error invalidating session for user "${email}":`, error.message);
    return false;
  }
}

async function main() {
  if (!options.serial && !options.user) {
    console.error('❌ Please specify either --serial <terminal_serial> or --user <email>');
    process.exit(1);
  }

  if (options.serial && options.user) {
    console.error('❌ Please specify only one option: either --serial or --user');
    process.exit(1);
  }

  console.log('🚨 Session Invalidation Tool');
  console.log('================================');
  
  if (options.dryRun) {
    console.log('🔒 DRY RUN MODE - No actual changes will be made');
    console.log('');
  }

  let success = false;

  if (options.serial) {
    success = await invalidateByTerminalSerial(options.serial);
  } else if (options.user) {
    success = await invalidateByUserEmail(options.user);
  }

  if (success) {
    console.log('');
    console.log('✅ Session invalidation completed successfully');
    console.log('💡 The device/user will need to re-authenticate on their next request');
    console.log('🔍 Check the JWT authentication logs to see the detailed verification process');
  } else {
    console.log('');
    console.log('❌ Session invalidation failed');
    process.exit(1);
  }

  // Close database connections gracefully
  try {
    if (db && db.seq && typeof db.seq.close === 'function') {
      await db.seq.close();
    }
    if (dbTDM && dbTDM.sequelize && typeof dbTDM.sequelize.close === 'function') {
      await dbTDM.sequelize.close();
    }
  } catch (error) {
    console.error('⚠️  Error closing database connections:', error.message);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Gracefully shutting down...');
  try {
    if (db && db.seq && typeof db.seq.close === 'function') {
      await db.seq.close();
    }
    if (dbTDM && dbTDM.sequelize && typeof dbTDM.sequelize.close === 'function') {
      await dbTDM.sequelize.close();
    }
  } catch (error) {
    console.error('Error closing connections:', error.message);
  }
  process.exit(0);
});

main().catch(error => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});
