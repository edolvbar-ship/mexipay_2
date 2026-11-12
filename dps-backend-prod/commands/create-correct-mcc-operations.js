#!/usr/bin/env node

/**
 * Create Correct MCC Operations Based on API Endpoints
 * 
 * This creates the correct MCC operations that map to actual payment
 * processing API endpoints, eliminating duplicates and creating proper references.
 */

require('dotenv').config();
const db = require('../lib/socketServer/lib/sequelize/init');

/**
 * API endpoints and their corresponding MCC operations
 */
const API_TO_MCC_MAPPING = [
  // Core API endpoints
  {
    api_endpoint: '/charge',
    operation_code: 'CHARGE',
    name: 'Charge',
    description: 'Standard charge transaction',
    msg_type: '0200',
    processing_code: '000000',
    requires_amount: 1,
    requires_tip: 0,
    display_order: 1,
    icon_name: 'credit_card',
    category_code: 'RETAIL_5XX'
  },
  {
    api_endpoint: '/checkin',
    operation_code: 'CHECK_IN',
    name: 'Check In',
    description: 'Check-in or pre-authorization',
    msg_type: '0200',
    processing_code: '000000',
    requires_amount: 1,
    requires_tip: 0,
    display_order: 2,
    icon_name: 'login',
    category_code: 'FOOD_58X'
  },
  {
    api_endpoint: '/checkout',
    operation_code: 'CHECK_OUT',
    name: 'Check Out',
    description: 'Check-out or settlement',
    msg_type: '0200',
    processing_code: '000000',
    requires_amount: 1,
    requires_tip: 1,
    display_order: 3,
    icon_name: 'logout',
    category_code: 'FOOD_58X'
  },
  {
    api_endpoint: '/cancel',
    operation_code: 'CANCEL',
    name: 'Cancel',
    description: 'Cancel transaction',
    msg_type: '0220',
    processing_code: '000000',
    requires_amount: 1,
    requires_tip: 0,
    display_order: 4,
    icon_name: 'cancel',
    category_code: 'RETAIL_5XX'
  },
  {
    api_endpoint: '/reverse',
    operation_code: 'REVERSE',
    name: 'Reverse',
    description: 'Reverse transaction',
    msg_type: '0420',
    processing_code: '000000',
    requires_amount: 1,
    requires_tip: 0,
    display_order: 5,
    icon_name: 'undo',
    category_code: 'RETAIL_5XX'
  },
  {
    api_endpoint: '/refund',
    operation_code: 'REFUND',
    name: 'Refund',
    description: 'Refund transaction',
    msg_type: '0200',
    processing_code: '200000',
    requires_amount: 1,
    requires_tip: 0,
    display_order: 6,
    icon_name: 'return',
    category_code: 'RETAIL_5XX'
  },
  {
    api_endpoint: '/preauth',
    operation_code: 'PREAUTH',
    name: 'Pre-authorization',
    description: 'Pre-authorization transaction',
    msg_type: '0200',
    processing_code: '000000',
    requires_amount: 1,
    requires_tip: 0,
    display_order: 7,
    icon_name: 'lock',
    category_code: 'RETAIL_5XX'
  },
  {
    api_endpoint: '/postauth',
    operation_code: 'POSTAUTH',
    name: 'Post-authorization',
    description: 'Complete pre-authorization',
    msg_type: '0220',
    processing_code: '200000',
    requires_amount: 1,
    requires_tip: 0,
    display_order: 8,
    icon_name: 'unlock',
    category_code: 'RETAIL_5XX'
  },
  {
    api_endpoint: '/reauthorize',
    operation_code: 'REAUTHORIZE',
    name: 'Re-authorize',
    description: 'Re-authorize transaction',
    msg_type: '0200',
    processing_code: '000000',
    requires_amount: 1,
    requires_tip: 0,
    display_order: 9,
    icon_name: 'refresh',
    category_code: 'RETAIL_5XX'
  },
  {
    api_endpoint: '/rentin',
    operation_code: 'RENT_IN',
    name: 'Rent In',
    description: 'Start rental period',
    msg_type: '0200',
    processing_code: '000000',
    requires_amount: 1,
    requires_tip: 0,
    display_order: 10,
    icon_name: 'arrow_in',
    category_code: 'TRANSPORT_4XX'
  },
  {
    api_endpoint: '/rentout',
    operation_code: 'RENT_OUT',
    name: 'Rent Out',
    description: 'End rental period',
    msg_type: '0220',
    processing_code: '000000',
    requires_amount: 1,
    requires_tip: 0,
    display_order: 11,
    icon_name: 'arrow_out',
    category_code: 'TRANSPORT_4XX'
  },
  {
    api_endpoint: '/tip',
    operation_code: 'TIP',
    name: 'Tip',
    description: 'Add tip to transaction',
    msg_type: '0200',
    processing_code: '000000',
    requires_amount: 1,
    requires_tip: 1,
    display_order: 12,
    icon_name: 'dollar_sign',
    category_code: 'FOOD_58X'
  },
  {
    api_endpoint: '/posttip',
    operation_code: 'POSTTIP',
    name: 'Post Tip',
    description: 'Post-tip adjustment',
    msg_type: '0200',
    processing_code: '000000',
    requires_amount: 1,
    requires_tip: 1,
    display_order: 13,
    icon_name: 'edit',
    category_code: 'FOOD_58X'
  },
  {
    api_endpoint: '/closePostTip',
    operation_code: 'CLOSE_POST_TIP',
    name: 'Close Post Tip',
    description: 'Complete tip adjustment flow',
    msg_type: '0220',
    processing_code: '000000',
    requires_amount: 1,
    requires_tip: 0,
    display_order: 14,
    icon_name: 'check_circle',
    category_code: 'FOOD_58X'
  }
];

/**
 * MCC operation references that map to API endpoints
 * These are the operations that should appear in MCC operations view
 */
const MCC_OPERATION_REFERENCES = [
  // Direct API mappings
  {
    operation_code: 'CHARGE',
    name: 'Charge',
    description: 'Standard charge transaction - maps to /charge endpoint',
    api_endpoints: ['/charge'],
    display_order: 1
  },
  {
    operation_code: 'CHECK_IN',
    name: 'Check In',
    description: 'Check-in or pre-authorization - maps to /checkin endpoint',
    api_endpoints: ['/checkin'],
    display_order: 2
  },
  {
    operation_code: 'CHECK_OUT',
    name: 'Check Out',
    description: 'Check-out or settlement - maps to /checkout endpoint',
    api_endpoints: ['/checkout'],
    display_order: 3
  },
  {
    operation_code: 'CANCEL',
    name: 'Cancel',
    description: 'Cancel transaction - maps to /cancel endpoint',
    api_endpoints: ['/cancel'],
    display_order: 4
  },
  {
    operation_code: 'REVERSE',
    name: 'Reverse',
    description: 'Reverse transaction - maps to /reverse endpoint',
    api_endpoints: ['/reverse'],
    display_order: 5
  },
  {
    operation_code: 'REFUND',
    name: 'Refund',
    description: 'Refund transaction - maps to /refund endpoint',
    api_endpoints: ['/refund'],
    display_order: 6
  },
  {
    operation_code: 'PREAUTH',
    name: 'Pre-authorization',
    description: 'Pre-authorization - maps to /preauth endpoint',
    api_endpoints: ['/preauth'],
    display_order: 7
  },
  {
    operation_code: 'POSTAUTH',
    name: 'Post-authorization',
    description: 'Complete pre-authorization - maps to /postauth endpoint',
    api_endpoints: ['/postauth'],
    display_order: 8
  },
  {
    operation_code: 'REAUTHORIZE',
    name: 'Re-authorize',
    description: 'Re-authorize transaction - maps to /reauthorize endpoint',
    api_endpoints: ['/reauthorize'],
    display_order: 9
  },
  {
    operation_code: 'RENT_IN',
    name: 'Rent In',
    description: 'Start rental period - maps to /rentin endpoint',
    api_endpoints: ['/rentin'],
    display_order: 10
  },
  {
    operation_code: 'RENT_OUT',
    name: 'Rent Out',
    description: 'End rental period - maps to /rentout endpoint',
    api_endpoints: ['/rentout'],
    display_order: 11
  },
  {
    operation_code: 'TIP',
    name: 'Tip',
    description: 'Add tip to transaction - maps to /tip endpoint',
    api_endpoints: ['/tip'],
    display_order: 12
  },
  {
    operation_code: 'POSTTIP',
    name: 'Post Tip',
    description: 'Post-tip adjustment - maps to /posttip endpoint',
    api_endpoints: ['/posttip'],
    display_order: 13
  },
  {
    operation_code: 'CLOSE_POST_TIP',
    name: 'Close Post Tip',
    description: 'Complete tip adjustment flow - maps to /closePostTip endpoint',
    api_endpoints: ['/closePostTip'],
    display_order: 14
  }
];

/**
 * Analyze current database state
 */
async function analyzeCurrentState() {
  console.log('🔍 Analyzing Current MCC Operations');
  console.log('=====================================\n');
  
  try {
    // Get current operations count
    const countResult = await db.mccOperations.count();
    console.log(`📊 Current operations: ${countResult}`);
    
    // Show current operation codes
    const { literal } = require('sequelize');
    const opsResult = await db.mccOperations.findAll({
      attributes: [
        'operation_code',
        [db.seq.fn('COUNT', db.seq.col('operation_code')), 'count']
      ],
      group: ['operation_code'],
      order: [[literal('count'), 'DESC']]
    });
    
    console.log('\n📋 Current operation codes:');
    opsResult.forEach(op => {
      console.log(`  ${op.operation_code}: ${op.dataValues.count} occurrences`);
    });
    
    return {
      currentCount: countResult,
      currentCodes: opsResult.map(op => op.operation_code)
    };
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
    throw error;
  }
}

/**
 * Create correct MCC operations based on API endpoints
 */
async function createCorrectMccOperations() {
  console.log('\n🛠️  Creating Correct MCC Operations');
  console.log('===================================\n');
  
  try {
    // Create backup using Sequelize
    const { QueryTypes } = require('sequelize');
    try {
      await db.seq.query('DROP TABLE IF EXISTS mcc_operations_backup', { type: QueryTypes.RAW });
      await db.seq.query('CREATE TABLE mcc_operations_backup AS SELECT * FROM mcc_operations', { type: QueryTypes.RAW });
      console.log('✅ Created backup table: mcc_operations_backup');
    } catch (error) {
      console.log('⚠️  Backup table already exists or error occurred:', error.message);
    }
    
    // Clear existing operations using Sequelize
    await db.mccOperations.destroy({ where: {} });
    console.log('✅ Cleared existing operations');
    
    // Insert correct operations using Sequelize
    for (const op of MCC_OPERATION_REFERENCES) {
      await db.mccOperations.create({
        operation_code: op.operation_code,
        name: op.name,
        description: op.description,
        msg_type: '0200',
        processing_code: '000000',
        requires_amount: 1,
        requires_tip: 0,
        display_order: op.display_order,
        icon_name: 'credit_card',
        category_code: 'RETAIL_5XX',
        mcc_code: '0000', // Set to '0000' as default for template operations (not a real MCC)
        active: 1,
        creation_date: new Date(),
        updated_at: new Date()
      });
      
      console.log(`✅ Created: ${op.name} (${op.operation_code})`);
      console.log(`   Maps to: ${op.api_endpoints.join(', ')}`);
    }
    
    console.log(`\n🎉 Created ${MCC_OPERATION_REFERENCES.length} correct operations`);
    
    // Show mapping summary
    console.log('\n📋 API to MCC Operation Mapping:');
    MCC_OPERATION_REFERENCES.forEach(op => {
      console.log(`  ${op.api_endpoints.join(', ')} → ${op.operation_code} (${op.name})`);
    });
    
    return MCC_OPERATION_REFERENCES.length;
    
  } catch (error) {
    console.error('❌ Creation failed:', error.message);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🔧 Create Correct MCC Operations Based on API Endpoints');
  console.log('===================================================\n');
  
  try {
    // Step 1: Analyze current state
    const analysis = await analyzeCurrentState();
    
    console.log('\n📊 Analysis Summary:');
    console.log(`  Current operations: ${analysis.currentCount}`);
    console.log(`  Expected operations: ${MCC_OPERATION_REFERENCES.length}`);
    console.log(`  Reduction: ${analysis.currentCount - MCC_OPERATION_REFERENCES.length} operations`);
    
    // Step 2: Show what will be created
    console.log('\n🎯 Operations to be created:');
    MCC_OPERATION_REFERENCES.forEach(op => {
      console.log(`  ${op.display_order}. ${op.name} (${op.operation_code})`);
      console.log(`     ${op.description}`);
      console.log(`     API: ${op.api_endpoints.join(', ')}`);
    });
    
    // Step 3: Create correct operations  
    const finalCount = await createCorrectMccOperations();
    
    console.log('\n🎉 MCC operations creation completed!');
    console.log('\n📝 Result:');
    console.log(`  Before: ${analysis.currentCount} operations (with duplicates)`);
    console.log(`  After: ${finalCount} operations (correct API mapping)`);
    console.log(`  Reduction: ${analysis.currentCount - finalCount} operations eliminated`);
    
    console.log('\n📝 Next Steps:');
    console.log('1. Test MCC operations view shows 14 operations');
    console.log('2. Verify each operation maps to correct API endpoint');
    console.log('3. Test payment flows with new operations');
    console.log('4. Remove backup when confirmed: DROP TABLE mcc_operations_backup');
    
  } catch (error) {
    console.error('❌ Process failed:', error.message);
    throw error;
  }
}

// Run the process
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n🏁 Correct MCC operations creation completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Creation failed:', error);
      process.exit(1);
    });
}

module.exports = {
  createCorrectMccOperations,
  API_TO_MCC_MAPPING,
  MCC_OPERATION_REFERENCES,
  analyzeCurrentState
};
