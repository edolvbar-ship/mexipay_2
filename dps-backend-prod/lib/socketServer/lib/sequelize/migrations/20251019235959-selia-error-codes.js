'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // 1. First create the fucking selia_error_codes table with unique codigo
        await queryInterface.createTable('selia_error_codes', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            campo_origen: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            codigo: {
                type: Sequelize.INTEGER,
                allowNull: false,
                unique: true // This makes it fucking unique for the foreign key
            },
            descripcion: {
                type: Sequelize.STRING(255),
                allowNull: false
            },
            mensaje_terminal: {
                type: Sequelize.STRING(500),
                allowNull: true
            },
            type: {
                type: Sequelize.STRING(50),
                allowNull: true
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.fn('NOW')
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.fn('NOW')
            }
        });

        // 2. Now add the fucking columns to links_pago with the foreign key
        await queryInterface.addColumn('links_pago', 'selia_transaction_id', {
            type: Sequelize.STRING(50),
            allowNull: true
        });

        await queryInterface.addColumn('links_pago', 'selia_authorization_code', {
            type: Sequelize.STRING(50),
            allowNull: true
        });

        await queryInterface.addColumn('links_pago', 'selia_response_data', {
            type: Sequelize.TEXT,
            allowNull: true
        });

        await queryInterface.addColumn('links_pago', 'processor_type', {
            type: Sequelize.STRING(20),
            allowNull: true,
            defaultValue: 'default'
        });

        await queryInterface.addColumn('links_pago', 'selia_response_code', {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: 'selia_error_codes', // Now this fucking table exists
                key: 'codigo' // And this fucking column is unique
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
        });
    },

    async down(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();

        try {
            // First check if columns exist before trying to remove them
            const tableDescription = await queryInterface.describeTable('links_pago');

            // Remove the fucking columns only if they exist
            if (tableDescription.selia_response_code) {
                await queryInterface.removeColumn('links_pago', 'selia_response_code', { transaction });
            }

            if (tableDescription.selia_transaction_id) {
                await queryInterface.removeColumn('links_pago', 'selia_transaction_id', { transaction });
            }

            if (tableDescription.selia_authorization_code) {
                await queryInterface.removeColumn('links_pago', 'selia_authorization_code', { transaction });
            }

            if (tableDescription.selia_response_data) {
                await queryInterface.removeColumn('links_pago', 'selia_response_data', { transaction });
            }

            if (tableDescription.processor_type) {
                await queryInterface.removeColumn('links_pago', 'processor_type', { transaction });
            }

            // Check if the fucking table exists before dropping it
            const tableExists = await queryInterface.showAllTables();
            if (tableExists.includes('selia_error_codes')) {
                await queryInterface.dropTable('selia_error_codes', { transaction });
            }

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
};