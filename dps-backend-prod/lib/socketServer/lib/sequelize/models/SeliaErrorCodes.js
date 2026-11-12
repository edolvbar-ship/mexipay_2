// models/seliaerrorcode.js
module.exports = (sequelize, type) => {
    return sequelize.define('selia_error_code', {
        id: {
            type: type.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        campo_origen: {
            type: type.INTEGER,
            allowNull: false
        },
        codigo: {
            type: type.INTEGER,
            allowNull: false,
            unique: true // ADD THIS
        },
        descripcion: {
            type: type.STRING(255),
            allowNull: false
        },
        mensaje_terminal: {
            type: type.STRING(500),
            allowNull: true
        },
        type: {
            type: type.STRING(50),
            allowNull: true
        },
        created_at: {
            type: type.DATE,
            defaultValue: type.fn('NOW')
        },
        updated_at: {
            type: type.DATE,
            defaultValue: type.fn('NOW')
        }
    }, {
        tableName: 'selia_error_codes',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                unique: true,
                fields: ['codigo'] // Only this unique index
            }
        ]
    });
};