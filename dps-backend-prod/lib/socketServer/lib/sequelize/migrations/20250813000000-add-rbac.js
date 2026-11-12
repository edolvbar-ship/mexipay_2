'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('roles', {
      id_role: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING(50), allowNull: false },
      comments: { type: Sequelize.STRING(255) },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      deletedAt: { type: Sequelize.DATE }
    }, { ifNotExists: true });

    await queryInterface.createTable('user_roles', {
      iduser: { type: Sequelize.BIGINT, allowNull: false },
      id_role: { type: Sequelize.INTEGER, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    }, { ifNotExists: true });

    await queryInterface.createTable('profile_resources', {
      id_profile: { type: Sequelize.INTEGER, allowNull: false },
      id_resource: { type: Sequelize.INTEGER, allowNull: false },
      resource_url: { type: Sequelize.STRING(255), allowNull: false },
      allowed_methods: { type: Sequelize.JSON, defaultValue: [] },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    }, { ifNotExists: true });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('user_roles');
    await queryInterface.dropTable('profile_resources');
    await queryInterface.dropTable('roles');
  }
};
