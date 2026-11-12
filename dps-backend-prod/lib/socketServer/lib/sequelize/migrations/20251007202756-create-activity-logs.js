module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('activity_logs', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            userId: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            action: {
                type: Sequelize.STRING(100),
                allowNull: false
            },
            method: {
                type: Sequelize.STRING(10),
                allowNull: false
            },
            url: {
                type: Sequelize.STRING(500),
                allowNull: false
            },
            status_code: {
                type: Sequelize.INTEGER
            },
            ip_address: {
                type: Sequelize.STRING(45)
            },
            user_agent: {
                type: Sequelize.TEXT
            },
            request_body: {
                type: Sequelize.JSON
            },
            response_time: {
                type: Sequelize.INTEGER,
                comment: 'Response time in milliseconds'
            },
            metadata: {
                type: Sequelize.JSON
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            }
        });

        // Add indexes for better performance
        await queryInterface.addIndex('activity_logs', ['userId']);
        await queryInterface.addIndex('activity_logs', ['created_at']);
        await queryInterface.addIndex('activity_logs', ['action']);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('activity_logs');
    }
};