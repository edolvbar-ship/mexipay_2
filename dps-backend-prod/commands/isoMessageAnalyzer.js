require('dotenv').config();
const { seq: sequelize, ...db } = require('../lib/socketServer/lib/sequelize/init');
const fs = require('fs');
const path = require('path');

// Helper function to flatten nested objects
function flattenObject(obj, prefix = '') {
  if (!obj || typeof obj !== 'object') {
    return {};
  }

  const result = {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      const newKey = prefix ? `${prefix}_${key}` : key;

      if (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)) {
        // Recursively flatten nested objects
        Object.assign(result, flattenObject(value, newKey));
      } else {
        result[newKey] = value;
      }
    }
  }

  return result;
}

// Helper function to safely parse JSON from more_info field
function parseIsoMessage(moreInfo) {
  if (!moreInfo) {
    return {};
  }

  try {
    let jsonStr = moreInfo;

    // Handle different JSON formats
    if (typeof jsonStr === 'string') {
      jsonStr = jsonStr.trim();

      // Remove outer quotes if present
      if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
        jsonStr = jsonStr.slice(1, -1);
      }

      // Unescape quotes
      jsonStr = jsonStr.replace(/\\"/g, '"');

      // Fix common JSON issues
      jsonStr = jsonStr.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
      jsonStr = jsonStr.replace(/:\s*([a-zA-Z_][a-zA-Z0-9_]*)(?=\s*[,}])/g, ': "$1"');
      jsonStr = jsonStr.replace(/,\s*}/g, '}');
      jsonStr = jsonStr.replace(/,\s*]/g, ']');

      // Try to parse
      try {
        return JSON.parse(jsonStr);
      } catch (parseError) {
        // If still fails, try to extract the valid part
        console.log(`⚠️  JSON parse failed, attempting recovery...`);

        const jsonStart = jsonStr.indexOf('{');
        const jsonEnd = jsonStr.lastIndexOf('}');

        if (jsonStart >= 0 && jsonEnd > jsonStart) {
          const potentialJson = jsonStr.substring(jsonStart, jsonEnd + 1);
          try {
            return JSON.parse(potentialJson);
          } catch (e) {
            console.log(`❌ Could not recover JSON`);
            return {};
          }
        } else {
          return {};
        }
      }
    } else if (typeof jsonStr === 'object') {
      return jsonStr;
    }
  } catch (e) {
    console.log(`⚠️  Failed to parse JSON: ${e.message}`);
    return {};
  }

  return {};
}

// Function to get ALL columns dynamically for a specific transaction
async function getTransactionDetails(txnId) {
  try {
    console.log(`🔍 Getting ALL details for transaction ID: ${txnId}\n`);

    // Get the specific transaction with ALL columns
    const transaction = await db.isoMessage.findByPk(txnId);
    
    if (!transaction) {
      console.log(`❌ Transaction with ID ${txnId} not found`);
      return;
    }

    console.log(`✅ Found transaction: ${txnId}\n`);

    // Get all column names from the model attributes
    const allColumns = Object.keys(db.isoMessage.rawAttributes);
    
    console.log(`📊 FOUND ${allColumns.length} COLUMNS IN iso_message TABLE:\n`);

    for (const columnName of allColumns) {
      const value = transaction[columnName];
      const dataType = db.isoMessage.rawAttributes[columnName].type.key || 'STRING';
      
      // Format value for display - SHOW COMPLETE VALUES, NO CUTTING
      let displayValue = value;
      if (value === null || value === undefined) {
        displayValue = 'NULL';
      } else if (typeof value === 'string') {
        displayValue = `"${value}"`;
      } else if (typeof value === 'object') {
        displayValue = JSON.stringify(value, null, 2);
      }

      console.log(`🔹 ${columnName} (${dataType}):`);
      console.log(`   ${displayValue}\n`);
    }

    // Parse and display more_info JSON if it exists
    if (transaction.more_info) {
      console.log(`\n🔍 DETAILED more_info JSON ANALYSIS:`);
      console.log('=' .repeat(80));
      
      try {
        const isoMessage = parseIsoMessage(transaction.more_info);
        const flattenedData = flattenObject(isoMessage);
        
        console.log(`\n📋 Found ${Object.keys(flattenedData).length} fields in more_info JSON:\n`);

        for (const [fieldName, value] of Object.entries(flattenedData)) {
          let displayValue = value;
          if (value === null || value === undefined) {
            displayValue = 'NULL';
          } else if (typeof value === 'string') {
            displayValue = `"${value}"`;
          } else if (typeof value === 'object') {
            displayValue = JSON.stringify(value, null, 2);
          }

          console.log(`🔹 ${fieldName}:`);
          console.log(`   ${displayValue}\n`);
        }

        // Save complete transaction details to file
        const completeData = {
          transaction_id: txnId,
          table_columns: {},
          more_info_json: flattenedData
        };

        // Add all table columns
        for (const columnName of allColumns) {
          completeData.table_columns[columnName] = {
            value: transaction[columnName],
            data_type: db.isoMessage.rawAttributes[columnName].type.key || 'STRING'
          };
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const detailFile = `transaction_${txnId}_details_${timestamp}.json`;
        
        fs.writeFileSync(detailFile, JSON.stringify(completeData, null, 2));
        console.log(`\n💾 Complete transaction details saved to: ${detailFile}`);

      } catch (parseError) {
        console.log(`\n❌ Error parsing more_info JSON: ${parseError.message}`);
        console.log(`Raw more_info: ${transaction.more_info.substring(0, 200)}...`);
      }
    }

  } catch (error) {
    console.error('❌ Error getting transaction details:', error);
  }
}

// Function to search for specific patterns in column names
function searchColumns(columnData, searchTerm) {
  const searchLower = searchTerm.toLowerCase();
  const matches = [];

  for (const [columnName, values] of columnData.entries()) {
    if (columnName.toLowerCase().includes(searchLower)) {
      matches.push({
        column: columnName,
        uniqueCount: values.size,
        sampleValues: Array.from(values).slice(0, 5)
      });
    }
  }

  return matches;
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  console.log('🚀 ISO MESSAGE TRANSACTION ANALYZER');
  console.log('=' .repeat(50));

  // Check for --txn flag
  const txnIndex = args.indexOf('--txn');
  if (txnIndex !== -1 && args[txnIndex + 1]) {
    const txnId = parseInt(args[txnIndex + 1]);
    if (isNaN(txnId)) {
      console.log('❌ Invalid transaction ID. Please provide a number.');
      console.log('Usage: node isoMessageAnalyzer.js --txn 12345');
      return;
    }
    await getTransactionDetails(txnId);
  } else {
    console.log('❌ Please provide a transaction ID using --txn flag');
    console.log('Usage: node isoMessageAnalyzer.js --txn 12345');
    console.log('\nThis will show ALL columns and their values for the specific transaction.');
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  getTransactionDetails,
  parseIsoMessage,
  flattenObject,
  searchColumns
};
