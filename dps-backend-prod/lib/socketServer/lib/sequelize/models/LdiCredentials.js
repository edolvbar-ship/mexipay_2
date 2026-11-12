/**
 * LDI Credentials Model
 * 
 * PCI DSS 4 Requirements Covered:
 * - Requirement 3.5.2: Password and secret stored encrypted using AWS KMS
 * - Requirement 8.2.1: Strong cryptography used to protect authentication credentials
 * - Requirement 8.2.3: All stored account data (passwords, secrets) secured with encryption
 * - Requirement 7.1.1: Access to credentials restricted by selia_id and active flag
 * - Requirement 10.2.1: Audit trail maintained via created_at and updated_at timestamps
 * 
 * Security Notes:
 * - Password field stores KMS-encrypted base64 string (not plaintext)
 * - Secret field stores KMS-encrypted base64 string (not plaintext)
 * - Credentials are decrypted at runtime using AWS KMS before use
 * - Only active credentials are returned by credential lookup methods
 */

const { INTEGER, STRING, DATE, BOOLEAN } = require('sequelize').DataTypes;

module.exports = sequelize => {
  return sequelize.define('ldi_credentials', {
    id: {
      type: INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    selia_id: {
      type: INTEGER,
      allowNull: false,
      unique: true,
      comment: 'Selia identifier for the merchant'
    },
    username: {
      type: STRING(100),
      allowNull: false,
      comment: 'LDI username for authentication'
    },
    password: {
      type: STRING(255),
      allowNull: false,
      // PCI DSS 4 Requirement 3.5.2: Password stored encrypted using AWS KMS
      comment: 'LDI password for authentication (KMS encrypted)'
    },
    secret: {
      type: STRING(255),
      allowNull: false,
      // PCI DSS 4 Requirement 3.5.2: Secret stored encrypted using AWS KMS
      comment: 'LDI secret key for authentication (KMS encrypted)'
    },
    active: {
      type: BOOLEAN,
      defaultValue: true,
      // PCI DSS 4 Requirement 7.1.1: Active flag controls credential access
      comment: 'Whether these credentials are active'
    },
    created_at: {
      type: DATE,
      defaultValue: sequelize.fn('now'),
      // PCI DSS 4 Requirement 10.2.1: Audit trail - record creation timestamp
      comment: 'Record creation timestamp'
    },
    updated_at: {
      type: DATE,
      defaultValue: sequelize.fn('now'),
      // PCI DSS 4 Requirement 10.2.1: Audit trail - record last update timestamp
      comment: 'Record last update timestamp'
    }
  }, {
    tableName: 'ldi_credentials',
    timestamps: false,
    indexes: [
      {
        name: 'idx_ldi_credentials_selia_id',
        unique: true,
        fields: ['selia_id']
      },
      {
        name: 'idx_ldi_credentials_active',
        fields: ['active']
      }
    ]
  });
};
