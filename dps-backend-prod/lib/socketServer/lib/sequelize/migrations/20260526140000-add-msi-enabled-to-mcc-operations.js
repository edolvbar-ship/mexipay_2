// migrations/20260526140000-add-msi-enabled-to-mcc-operations.js
'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('mcc_operations', 'msi_enabled', {
            type: Sequelize.INTEGER,
            defaultValue: 1,
            allowNull: false,
            comment: 'Flag to enable/disable MSI for this operation (0=disabled, 1=enabled)'
        });

        // Set existing operations to enabled by default for backward compatibility
        await queryInterface.sequelize.query(`
            UPDATE mcc_operations 
            SET msi_enabled = 1 
            WHERE msi_enabled IS NULL
        `);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('mcc_operations', 'msi_enabled');
    }
};
