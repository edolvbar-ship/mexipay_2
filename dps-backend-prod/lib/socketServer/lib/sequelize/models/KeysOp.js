module.exports = (sequelize,type) => {
  return sequelize.define('keys_op',{
    id_key: {
      type: type.DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    key: {
      type: type.DataTypes.STRING(1000),
      allowNull:false
    },
    id_medio: {
      type: type.DataTypes.STRING(10),
      allowNull:false,
    },
    pos_serie: {
      type: type.DataTypes.STRING(20),
      allowNull:false,
    },
    creation_date:      {type: type.DataTypes.DATE, defaultValue: type.fn('now') },
    last_update:        {type: type.DataTypes.DATE, defaultValue: type.fn('now') }
  },{
    tableName: 'keys_op',
    timestamps: false,
    paranoid: false
  });
}