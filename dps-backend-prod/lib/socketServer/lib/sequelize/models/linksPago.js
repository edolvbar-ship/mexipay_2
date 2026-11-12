// models/linkspago.js - Updated version
module.exports = (sequelize, type) => {
    const LinksPago = sequelize.define('links_pago', {
        id: {
            type: type.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        token: type.STRING(100),
        id_user: type.INTEGER,
        id_merchant: type.INTEGER,
        concepto: type.STRING(100),
        monto: type.DECIMAL(10, 2),
        expire_date: type.DATE,
        status: type.INTEGER,
        info_adicional: type.STRING(2000),

        // Selia payment processor fields
        selia_transaction_id: type.STRING(50),
        selia_authorization_code: type.STRING(50),
        selia_response_code: type.INTEGER, // Foreign key to error codes
        selia_response_data: type.TEXT,
        processor_type: {
            type: type.STRING(20),
            defaultValue: 'default'
        },

        created_at: {
            type: type.DATE,
            defaultValue: type.fn('NOW')
        },
        updated_at: {
            type: type.DATE,
            defaultValue: type.fn('NOW')
        },
        deleted_at: type.DATE

    }, {
        tableName: 'links_pago',
        paranoid: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
    });

    // Define association
    LinksPago.associate = function(models) {
        LinksPago.belongsTo(models.selia_error_code, {
            foreignKey: 'selia_response_code',
            targetKey: 'codigo',
            as: 'selia_error_detail'
        });
    };

    return LinksPago;
};