module.exports = (sequelize, type) => {
  return sequelize.define('Session', {
    session_id: {
      type: type.STRING(128),
      primaryKey: true
    },
    sid: {
      type: type.STRING(128),
      field: 'session_id'
    },
    expires: {
        type: type.DataTypes.INTEGER,
        allowNull: false
    },
    data: type.DataTypes.TEXT('medium')
  }, {
    tableName: 'sessions',
    timestamps: false
  });
};
