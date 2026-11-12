#!/usr/bin/env node

/**
 * Assign Transacciones Mejoradas resource to ALL users who have id_cliente set.
 * Run once to grant access to every merchant-linked user.
 */

require('dotenv').config();
const db = require('../lib/socketServer/lib/sequelize/init');

(async () => {
  try {
    console.log('🔎 Finding Transacciones Mejoradas resource...');
    const [allRows] = await db.seq.query(
      `SELECT id, resource_name, resource_url FROM resources WHERE resource_url LIKE '%transacciones%'`
    );
    console.log('All transacciones resources:');
    console.table(allRows);

    const resourceId = 1164; // Transacciones Mejoradas resource ID
    console.log(`✅ Using known resource ID: ${resourceId}`);

    console.log('🔎 Finding all users with id_cliente...');
    const [users] = await db.seq.query(
      `SELECT DISTINCT users.id_user, users.id_profile FROM users WHERE users.id_cliente IS NOT NULL AND users.id_profile IS NOT NULL`
    );

    if (!users || users.length === 0) {
      console.log('ℹ️ No users with id_cliente found.');
      process.exit(0);
    }

    console.log(`👥 Found ${users.length} users with id_cliente`);

    let assigned = 0;
    for (const user of users) {
      const [[existing]] = await db.seq.query(
        `SELECT 1 FROM profile_resources WHERE id_profile = ? AND id_resource = ? LIMIT 1`,
        { replacements: [user.id_profile, resourceId] }
      );

      if (!existing || existing.length === 0) {
        await db.seq.query(
          `INSERT INTO profile_resources (id_profile, id_resource, \`create\`, \`edit\`, \`delete\`, \`select\`, createdAt, updatedAt) VALUES (?, ?, 1, 1, 1, 1, NOW(), NOW())`,
          { replacements: [user.id_profile, resourceId] }
        );
        console.log(`🔓 Assigned to profile ${user.id_profile} (user ${user.id})`);
        assigned++;
      } else {
        console.log(`ℹ️ Profile ${user.id_profile} (user ${user.id}) already has access`);
      }
    }

    console.log(`🎉 Done. Assigned Transacciones Mejoradas to ${assigned} profiles.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
})();
