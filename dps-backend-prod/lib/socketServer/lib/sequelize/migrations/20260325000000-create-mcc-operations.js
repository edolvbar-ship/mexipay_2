'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('mcc_operations', {
      id_operation: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      mcc_code: {
        type: Sequelize.STRING(4),
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      description: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      operation_code: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      msg_type: {
        type: Sequelize.STRING(4),
        allowNull: true
      },
      processing_code: {
        type: Sequelize.STRING(6),
        allowNull: true
      },
      requires_amount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      requires_tip: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      active: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      display_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      icon_name: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      category_code: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      creation_date: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('now')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('now')
      }
    }, { ifNotExists: true });

    // Add indexes
    await queryInterface.addIndex('mcc_operations', ['mcc_code'], { name: 'idx_mcc_code' });
    await queryInterface.addIndex('mcc_operations', ['category_code'], { name: 'idx_category_code' });
    await queryInterface.addIndex('mcc_operations', ['active'], { name: 'idx_operation_active' });
    await queryInterface.addIndex('mcc_operations', ['operation_code'], { name: 'idx_operation_code' });
    await queryInterface.addIndex('mcc_operations', ['mcc_code', 'operation_code'], {
      name: 'unique_mcc_operation',
      unique: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('mcc_operations');
  }
};
