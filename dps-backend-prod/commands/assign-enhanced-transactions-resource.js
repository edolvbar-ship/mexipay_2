'use strict';

require('dotenv').config();

const db = require('../lib/socketServer/lib/sequelize/init');

async function main() {
  const resourceUrl = '/movimientos/transacciones-mejoradas';
  const resourceName = 'Transacciones Mejoradas';

  const [existing] = await db.seq.query(
    'SELECT id FROM resources WHERE resource_url = ? ORDER BY id DESC LIMIT 1',
    { replacements: [resourceUrl] }
  );

  let resourceId = existing && existing[0] && existing[0].id;

  if (!resourceId) {
    await db.seq.query(
      `INSERT INTO resources (
        resource_name,
        resource_url,
        icon,
        father_resource,
        isF,
        isConfig,
        isCrud,
        isGroup,
        justPage,
        createdAt,
        updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      {
        replacements: [
          resourceName,
          resourceUrl,
          'WALLET',
          null,
          0,
          0,
          1,
          0,
          1
        ]
      }
    );

    const [created] = await db.seq.query(
      'SELECT id FROM resources WHERE resource_url = ? ORDER BY id DESC LIMIT 1',
      { replacements: [resourceUrl] }
    );

    resourceId = created && created[0] && created[0].id;
  }

  if (!resourceId) {
    throw new Error('Could not determine resourceId for enhanced transactions');
  }

  let adminProfileId = 1;
  try {
    const [profiles] = await db.seq.query(
      'SELECT id_profile FROM user_profile ORDER BY id_profile LIMIT 1'
    );
    if (profiles && profiles[0] && profiles[0].id_profile) {
      adminProfileId = profiles[0].id_profile;
    }
  } catch (e) {
    adminProfileId = 1;
  }

  const [assignment] = await db.seq.query(
    'SELECT 1 FROM profile_resources WHERE id_profile = ? AND id_resource = ? LIMIT 1',
    { replacements: [adminProfileId, resourceId] }
  );

  if (!assignment || assignment.length === 0) {
    await db.seq.query(
      'INSERT INTO profile_resources (id_profile, id_resource, `create`, edit, `delete`, `select`, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
      { replacements: [adminProfileId, resourceId, 1, 1, 1, 1] }
    );
  }

  console.log(JSON.stringify({
    ok: true,
    resourceId,
    adminProfileId,
    assigned: !assignment || assignment.length === 0
  }));

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
