const { DataTypes } = require('sequelize');

module.exports = (sequelize, type) => {
    return sequelize.define('ActivityLog', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id_user'
            }
        },
        action: {
            type: DataTypes.STRING,
            allowNull: false
        },
        method: {
            type: DataTypes.STRING,
            allowNull: false
        },
        url: {
            type: DataTypes.STRING,
            allowNull: false
        },
        statusCode: {
            type: DataTypes.INTEGER,
            field: 'status_code'
        },
        ipAddress: {
            type: DataTypes.STRING,
            field: 'ip_address'
        },
        userAgent: {
            type: DataTypes.TEXT,
            field: 'user_agent'
        },
        requestBody: {
            type: DataTypes.JSON,
            field: 'request_body'
        },
        responseTime: {
            type: DataTypes.INTEGER,
            comment: 'Response time in milliseconds',
            field: 'response_time'
        },
        metadata: {
            type: DataTypes.JSON,
            comment: 'Additional context data'
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: type.literal('CURRENT_TIMESTAMP')
        },
        updated_at: {
            type: DataTypes.DATE,
            defaultValue: type.literal('CURRENT_TIMESTAMP')
        }
    }, {
        tableName: 'activity_logs',
        paranoid: false,
        timestamps: false, // Prevent camelCase timestamps
        underscored: true, // Enforce snake_case
        attributes: { exclude: ['createdAt', 'updatedAt'] }, // Exclude camelCase
        indexes: [
            { fields: ['userId'] },
            { fields: ['created_at'] },
            { fields: ['action'] }
        ]
    });
};