#!/usr/bin/env node

const scheduledReports = require('../lib/socketServer/lib/services/scheduled-reports.service');

console.log('🧪 Testing Scheduled Transaction Reports with Distributed Locking');
console.log('================================================================\n');

// Check if environment variables are set
const requiredEnvVars = ['SMTP_USER', 'SMTP_PASS', 'DB_NAME', 'EMAIL_SENDER'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => {
    console.error(`   ${varName}`);
  });
  console.log('\nPlease set these environment variables before testing.');
  process.exit(1);
}

console.log('✅ Environment variables check passed\n');

// Test different scenarios based on command line arguments
const command = process.argv[2];

switch (command) {
  case 'test-fetch':
    console.log('📥 Testing fetchLast24HoursTransactions...');
    scheduledReports.fetchLast24HoursTransactions().then(transactions => {
      console.log(`Found ${transactions.length} transactions`);
      if (transactions.length > 0) {
        console.log('Sample transaction:', {
          id: transactions[0].id_message,
          merchant: transactions[0].name_merchant,
          amount: transactions[0].amount,
          date: transactions[0].creation_date
        });
      }
    }).catch(console.error);
    break;

  case 'test-excel':
    console.log('📊 Testing Excel generation...');
    scheduledReports.fetchLast24HoursTransactions().then(transactions => {
      if (transactions.length === 0) {
        console.log('No transactions to test with');
        return;
      }
      
      const filename = `test_transactions_${Date.now()}.xlsx`;
      return scheduledReports.generateExcelFile(transactions, filename);
    }).then(filename => {
      if (filename) {
        console.log(`✅ Excel file generated: ${filename}`);
      }
    }).catch(console.error);
    break;

  case 'test-email':
    console.log('📧 Testing email sending...');
    scheduledReports.fetchLast24HoursTransactions().then(transactions => {
      if (transactions.length === 0) {
        console.log('No transactions to test with');
        return;
      }
      
      const filename = `test_transactions_${Date.now()}.xlsx`;
      return scheduledReports.generateExcelFile(transactions, filename);
    }).then(filename => {
      if (filename) {
        return scheduledReports.sendEmailWithExcel(filename, 'edson.n@muukpay.com.mx', 'Test Run');
      }
    }).then(success => {
      if (success) {
        console.log('✅ Email test completed successfully');
      } else {
        console.log('❌ Email test failed');
      }
    }).catch(console.error);
    break;

  case 'test-full':
    console.log('🚀 Running full test report with distributed locking...');
    scheduledReports.testScheduledReport('Manual Test').then(() => {
      console.log('✅ Full test completed');
    }).catch(console.error);
    break;

  case 'test-lock':
    console.log('🔒 Testing distributed lock mechanism...');
    testDistributedLock().then(() => {
      console.log('✅ Lock test completed');
    }).catch(console.error);
    break;

  case 'test-concurrent':
    console.log('🔄 Testing concurrent execution (simulating multiple instances)...');
    testConcurrentExecution().then(() => {
      console.log('✅ Concurrent test completed');
    }).catch(console.error);
    break;

  case 'init':
    console.log('🕐 Initializing scheduler (will run in background)...');
    scheduledReports.initializeScheduledReports().then(() => {
      console.log('Scheduler initialized. Press Ctrl+C to stop.');
      
      // Keep the process running
      process.on('SIGINT', () => {
        console.log('\n👋 Shutting down scheduler...');
        process.exit(0);
      });
      
      // Prevent process from exiting
      setInterval(() => {
        // Keep alive
      }, 1000);
    }).catch(console.error);
    break;

  default:
    console.log('Usage: node test-scheduled-reports.js [command]\n');
    console.log('Available commands:');
    console.log('  test-fetch      - Test fetching transactions from last 24 hours');
    console.log('  test-excel      - Test Excel file generation');
    console.log('  test-email      - Test email sending with Excel attachment');
    console.log('  test-full       - Run complete test (fetch + Excel + email) with locking');
    console.log('  test-lock       - Test distributed lock mechanism');
    console.log('  test-concurrent - Test concurrent execution simulation');
    console.log('  init            - Initialize the scheduler and keep running');
    console.log('\nExample:');
    console.log('  node test-scheduled-reports.js test-full');
    break;
}

// Test distributed lock functionality
async function testDistributedLock() {
  const { DistributedLock } = require('../lib/socketServer/lib/services/scheduled-reports.service');
  
  console.log('Testing basic lock acquisition and release...');
  
  const lock1 = new DistributedLock('test_lock', 1); // 1 minute TTL
  
  // Test acquisition
  const acquired1 = await lock1.acquire();
  console.log(`Lock 1 acquired: ${acquired1}`);
  
  if (acquired1) {
    // Try to acquire same lock with another instance
    const lock2 = new DistributedLock('test_lock', 1);
    const acquired2 = await lock2.acquire();
    console.log(`Lock 2 acquired (should be false): ${acquired2}`);
    
    // Release first lock
    const released = await lock1.release();
    console.log(`Lock 1 released: ${released}`);
    
    // Try to acquire with second lock now
    const acquired3 = await lock2.acquire();
    console.log(`Lock 2 acquired after release: ${acquired3}`);
    
    if (acquired3) {
      await lock2.release();
      console.log('Lock 2 released');
    }
  }
}

// Test concurrent execution simulation
async function testConcurrentExecution() {
  console.log('Simulating 3 instances trying to run the same report...');
  
  const promises = [];
  
  // Simulate 3 instances trying to run the same report
  for (let i = 1; i <= 3; i++) {
    promises.push(
      scheduledReports.testScheduledReport(`Instance ${i}`)
        .then(() => console.log(`Instance ${i} completed`))
        .catch(error => console.log(`Instance ${i} error:`, error.message))
    );
  }
  
  await Promise.all(promises);
  console.log('All instances attempted to run the report');
}
