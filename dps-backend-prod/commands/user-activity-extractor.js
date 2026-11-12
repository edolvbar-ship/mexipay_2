#!/usr/bin/env node

const optimist = require('optimist');
const db = require('../lib/socketServer/lib/sequelize/init');
const dbTDM = require('../lib/App-TDM/src/sequelize/init');

// Parse command line arguments
const argv = optimist
  .usage('Usage: $0 --email <email> OR --serial <serial> [options]')
  .describe('email', 'User email to look up activity')
  .describe('serial', 'Terminal serial number to look up activity')
  .describe('hours', 'Number of hours to look back (24, 48, or 72)')
  .describe('format', 'Output format: table, json, csv')
  .describe('limit', 'Maximum number of records to return')
  .describe('action', 'Filter by specific action (e.g., CREATE_CLIENTS, VIEW_CLIENTS)')
  .default('hours', '24')
  .default('format', 'table')
  .default('limit', '100')
  .alias('h', 'help')
  .alias('e', 'email')
  .alias('s', 'serial')
  .alias('r', 'hours')
  .alias('f', 'format')
  .alias('l', 'limit')
  .alias('a', 'action')
  .argv;

const options = {
  email: argv.email,
  serial: argv.serial,
  hours: argv.hours,
  format: argv.format,
  limit: argv.limit,
  action: argv.action
};

// Validate hours
const validHours = [24, 48, 72];
if (!validHours.includes(parseInt(options.hours))) {
  console.error('❌ Hours must be one of: 24, 48, or 72');
  process.exit(1);
}

// Validate format
const validFormats = ['table', 'json', 'csv'];
if (!validFormats.includes(options.format)) {
  console.error('❌ Format must be one of: table, json, csv');
  process.exit(1);
}

async function findUserByEmail(email) {
  console.log(`🔍 Looking up user with email: ${email}`);
  
  try {
    // Try TDM users first to get the mapping
    const tdmUsers = await dbTDM.sequelize.query(`
      SELECT iduser, email, first_name, last_name, active
      FROM user 
      WHERE email = ?
    `, { replacements: [email], type: dbTDM.sequelize.QueryTypes.SELECT });

    if (tdmUsers && tdmUsers.length > 0) {
      console.log(`✅ Found TDM user:`, {
        iduser: tdmUsers[0].iduser,
        email: tdmUsers[0].email,
        first_name: tdmUsers[0].first_name,
        active: tdmUsers[0].active
      });
      
      // Try to find corresponding Gateway user with same ID
      const gatewayUsers = await db.seq.query(`
        SELECT id_user, username, name, mail, is_admin
        FROM users 
        WHERE id_user = ?
      `, { replacements: [tdmUsers[0].iduser], type: db.seq.QueryTypes.SELECT });

      if (gatewayUsers && gatewayUsers.length > 0) {
        console.log(`✅ Found corresponding Gateway user:`, {
          id_user: gatewayUsers[0].id_user,
          username: gatewayUsers[0].username,
          mail: gatewayUsers[0].mail,
          is_admin: gatewayUsers[0].is_admin
        });
        return { type: 'both', tdmUser: tdmUsers[0], gatewayUser: gatewayUsers[0] };
      } else {
        console.log(`📝 No corresponding Gateway user found, will track TDM activity only`);
        return { type: 'tdm', user: tdmUsers[0] };
      }
    }

    // Try Gateway users directly (for Gateway-only users)
    const gatewayUsers = await db.seq.query(`
      SELECT id_user, username, name, mail, is_admin
      FROM users 
      WHERE mail = ?
    `, { replacements: [email], type: db.seq.QueryTypes.SELECT });

    if (gatewayUsers && gatewayUsers.length > 0) {
      console.log(`✅ Found Gateway user:`, {
        id_user: gatewayUsers[0].id_user,
        username: gatewayUsers[0].username,
        mail: gatewayUsers[0].mail,
        is_admin: gatewayUsers[0].is_admin
      });
      return { type: 'gateway', user: gatewayUsers[0] };
    }

    console.log(`❌ User with email "${email}" not found in Gateway or TDM`);
    return null;

  } catch (error) {
    console.error(`❌ Error looking up user "${email}":`, error.message);
    return null;
  }
}

async function findUserByTerminalSerial(serial) {
  console.log(`🔍 Looking up terminal with serial: ${serial}`);
  
  try {
    // Find terminal device and associated users
    const terminalData = await db.seq.query(`
      SELECT 
        td.idterm_device, 
        td.serial,
        u.id_user,
        u.username,
        u.mail,
        u.name
      FROM terminal_device td
      JOIN smart_device_has_terminal_device smdh ON td.idterm_device = smdh.terminal_device_idterm_device
      JOIN user_has_smart_device uhsd ON smdh.smart_device_idsmtdevice = uhsd.smart_device_idsmtdevice
      JOIN users u ON uhsd.user_iduser = u.id_user
      WHERE td.serial = ?
    `, { replacements: [serial], type: db.seq.QueryTypes.SELECT });

    if (!terminalData || terminalData.length === 0) {
      console.log(`❌ Terminal with serial "${serial}" not found or no associated users`);
      return null;
    }

    const users = terminalData.map(row => ({
      id_user: row.id_user,
      username: row.username,
      mail: row.mail,
      name: row.name
    }));

    console.log(`✅ Found terminal "${serial}" with ${users.length} associated user(s):`);
    users.forEach(user => {
      console.log(`   - User ID: ${user.id_user}, Username: ${user.username}, Email: ${user.mail}`);
    });

    return { type: 'terminal', users, serial };

  } catch (error) {
    console.error(`❌ Error looking up terminal "${serial}":`, error.message);
    return null;
  }
}

async function extractGatewayActivity(userId) {
  console.log(`📊 Extracting Gateway activity for user ID: ${userId}`);
  
  try {
    const hoursAgo = new Date();
    hoursAgo.setHours(hoursAgo.getHours() - parseInt(options.hours));
    
    // Convert to UTC to match database timestamps
    const hoursAgoUTC = new Date(hoursAgo.toUTCString());

    let whereClause = `
      WHERE al.user_id = ? 
        AND al.created_at >= ?
    `;
    let replacements = [userId, hoursAgoUTC];

    if (options.action) {
      whereClause += ` AND al.action = ?`;
      replacements.push(options.action);
    }

    const query = `
      SELECT 
        al.id,
        al.action,
        al.method,
        al.url,
        al.status_code,
        al.ip_address,
        al.user_agent,
        al.response_time,
        al.request_body,
        al.metadata,
        al.created_at,
        u.username,
        u.mail,
        u.name,
        'GATEWAY' as source
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id_user
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ?
    `;

    replacements.push(parseInt(options.limit));

    const activities = await db.seq.query(query, { 
      replacements, 
      type: db.seq.QueryTypes.SELECT 
    });

    console.log(`📈 Found ${activities.length} Gateway activity record(s) in the last ${options.hours} hours`);
    
    return activities;

  } catch (error) {
    console.error(`❌ Error extracting Gateway activity for user ${userId}:`, error.message);
    return [];
  }
}

async function extractTdmActivity(userId) {
  console.log(`📊 Extracting TDM session activity for user ID: ${userId}`);
  
  try {
    const hoursAgo = new Date();
    hoursAgo.setHours(hoursAgo.getHours() - parseInt(options.hours));
    
    // Convert to UTC to match database timestamps
    const hoursAgoUTC = new Date(hoursAgo.toUTCString());

    const query = `
      SELECT 
        s.idsession as id,
        'SESSION_LOGIN' as action,
        'POST' as method,
        '/tdm/auth/login' as url,
        200 as status_code,
        '' as ip_address,
        s.session_uuid as user_agent,
        0 as response_time,
        JSON_OBJECT('session_uuid', s.session_uuid, 'smart_device_idsmtdevice', s.smart_device_idsmtdevice) as request_body,
        JSON_OBJECT('active', s.active, 'created_at', s.created_at) as metadata,
        s.created_at,
        u.first_name as username,
        u.email as mail,
        CONCAT(u.first_name, ' ', u.last_name) as name,
        'TDM' as source
      FROM session s
      LEFT JOIN user u ON s.user_id = u.iduser
      WHERE s.user_id = ? 
        AND s.created_at >= ?
      ORDER BY s.created_at DESC
      LIMIT ?
    `;

    const sessions = await dbTDM.sequelize.query(query, { 
      replacements: [userId, hoursAgoUTC, parseInt(options.limit)], 
      type: dbTDM.sequelize.QueryTypes.SELECT 
    });

    console.log(`📈 Found ${sessions.length} TDM session record(s) in the last ${options.hours} hours`);
    
    return sessions;

  } catch (error) {
    console.error(`❌ Error extracting TDM activity for user ${userId}:`, error.message);
    return [];
  }
}

function formatOutput(activities, userInfo) {
  if (activities.length === 0) {
    console.log(`\n📋 No activity found for the specified criteria`);
    return;
  }

  console.log(`\n📊 User Activity Report`);
  console.log(`========================`);
  if (userInfo.mail) {
    console.log(`👤 User: ${userInfo.mail}`);
  } else if (userInfo.email) {
    console.log(`👤 User: ${userInfo.email}`);
  } else if (userInfo.serial) {
    console.log(`🔧 Terminal: ${userInfo.serial}`);
  }
  console.log(`📅 Period: Last ${options.hours} hours`);
  console.log(`📈 Records: ${activities.length}`);
  console.log(`⏰ Generated: ${new Date().toISOString()}`);
  console.log('');

  switch (options.format) {
    case 'json':
      console.log(JSON.stringify({
        user: userInfo,
        period: `last_${options.hours}_hours`,
        generated_at: new Date().toISOString(),
        total_records: activities.length,
        activities: activities
      }, null, 2));
      break;

    case 'csv':
      console.log('ID,Action,Method,URL,Status Code,IP Address,Response Time,User Agent,Source,Created At');
      activities.forEach(activity => {
        const row = [
          activity.id,
          activity.action,
          activity.method,
          activity.url,
          activity.status_code,
          activity.ip_address,
          activity.response_time,
          `"${activity.user_agent ? activity.user_agent.replace(/"/g, '""') : ''}"`,
          activity.source || 'GATEWAY',
          activity.created_at
        ];
        console.log(row.join(','));
      });
      break;

    case 'table':
    default:
      console.log('┌──────┬─────────────────────┬────────┬─────────────────────────────────┬──────────┬─────────────────┬──────────────┬──────────────────────────────────────┬────────┬──────────────────────────────────────┐');
      console.log('│ ID   │ Action              │ Method │ URL                            │ Status   │ IP Address      │ Response(ms) │ User Agent                           │ Source │ Created At                           │');
      console.log('├──────┼─────────────────────┼────────┼─────────────────────────────────┼──────────┼─────────────────┼──────────────┼──────────────────────────────────────┼────────┼──────────────────────────────────────┤');
      
      activities.forEach(activity => {
        const id = (activity.id || '').toString().padEnd(4);
        const action = (activity.action || '').substring(0, 19).padEnd(19);
        const method = (activity.method || '').padEnd(6);
        const url = (activity.url || '').substring(0, 31).padEnd(31);
        const status = (activity.status_code || '').toString().padEnd(8);
        const ip = (activity.ip_address || '').substring(0, 15).padEnd(15);
        const responseTime = (activity.response_time || '').toString().padEnd(12);
        const userAgent = (activity.user_agent || '').substring(0, 36).padEnd(36);
        const source = (activity.source || 'GATEWAY').padEnd(6);
        const createdAt = (activity.created_at || '').substring(0, 36).padEnd(36);
        
        console.log(`│ ${id} │ ${action} │ ${method} │ ${url} │ ${status} │ ${ip} │ ${responseTime} │ ${userAgent} │ ${source} │ ${createdAt} │`);
      });
      
      console.log('└──────┴─────────────────────┴────────┴─────────────────────────────────┴──────────┴─────────────────┴──────────────┴──────────────────────────────────────┴────────┴──────────────────────────────────────┘');
      
      // Show detailed breakdown
      console.log('\n📈 Activity Summary:');
      const actionCounts = {};
      const statusCounts = {};
      let totalResponseTime = 0;
      
      activities.forEach(activity => {
        actionCounts[activity.action] = (actionCounts[activity.action] || 0) + 1;
        statusCounts[activity.status_code] = (statusCounts[activity.status_code] || 0) + 1;
        if (activity.response_time) {
          totalResponseTime += activity.response_time;
        }
      });
      
      console.log('Actions:');
      Object.entries(actionCounts).forEach(([action, count]) => {
        console.log(`  ${action}: ${count}`);
      });
      
      console.log('\nStatus Codes:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`  ${status}: ${count}`);
      });
      
      if (totalResponseTime > 0) {
        console.log(`\nAverage Response Time: ${(totalResponseTime / activities.length).toFixed(2)}ms`);
      }
      break;
  }
}

async function main() {
  // Show help if requested
  if (argv.help) {
    optimist.showHelp();
    return;
  }

  if (!options.email && !options.serial) {
    console.error('❌ Please specify either --email <email> or --serial <terminal_serial>');
    optimist.showHelp();
    process.exit(1);
  }

  if (options.email && options.serial) {
    console.error('❌ Please specify only one option: either --email or --serial');
    optimist.showHelp();
    process.exit(1);
  }

  console.log('🔍 User Activity Extractor');
  console.log('==========================');
  console.log(`⏰ Time Period: Last ${options.hours} hours`);
  console.log(`📊 Output Format: ${options.format}`);
  console.log(`📋 Record Limit: ${options.limit}`);
  if (options.action) {
    console.log(`🎯 Action Filter: ${options.action}`);
  }
  console.log('');

  let userInfo = null;
  let userIds = [];
  const allActivities = [];

  if (options.email) {
    const result = await findUserByEmail(options.email);
    if (!result) {
      process.exit(1);
    }
    
    userInfo = result;
    
    if (result.type === 'both') {
      // User exists in both systems - get activity from both
      console.log('🔄 Extracting activity from both Gateway and TDM systems');
      const gatewayActivities = await extractGatewayActivity(result.gatewayUser.id_user);
      const tdmActivities = await extractTdmActivity(result.tdmUser.iduser);
      allActivities.push(...gatewayActivities, ...tdmActivities);
    } else if (result.type === 'gateway') {
      // Gateway-only user
      const activities = await extractGatewayActivity(result.user.id_user);
      allActivities.push(...activities);
    } else if (result.type === 'tdm') {
      // TDM-only user
      console.log('📝 TDM-only user - extracting session activity');
      const activities = await extractTdmActivity(result.user.iduser);
      allActivities.push(...activities);
    }
  } else if (options.serial) {
    const result = await findUserByTerminalSerial(options.serial);
    if (!result) {
      process.exit(1);
    }
    
    userInfo = { serial: result.serial, users: result.users };
    
    // Extract Gateway activity for all associated users
    for (const user of result.users) {
      const activities = await extractGatewayActivity(user.id_user);
      allActivities.push(...activities);
    }
  }

  // Sort by created_at desc and apply limit
  allActivities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const limitedActivities = allActivities.slice(0, parseInt(options.limit));

  formatOutput(limitedActivities, userInfo);

  // Close database connections
  try {
    if (db.seq && db.seq.close) {
      await db.seq.close();
    }
    if (dbTDM.sequelize && dbTDM.sequelize.close) {
      await dbTDM.sequelize.close();
    }
  } catch (error) {
    console.warn('Warning: Error closing database connections:', error.message);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Gracefully shutting down...');
  try {
    await db.seq.close();
    await dbTDM.sequelize.close();
  } catch (error) {
    console.error('Error closing connections:', error.message);
  }
  process.exit(0);
});

main().catch(error => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});
