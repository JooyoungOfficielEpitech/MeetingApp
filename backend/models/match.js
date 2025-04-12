'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Match extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      // Match belongs to User (as User1)
      Match.belongsTo(models.User, {
        foreignKey: 'user1Id',
        as: 'User1', // Alias used in the query
      });
      // Match belongs to User (as User2)
      Match.belongsTo(models.User, {
        foreignKey: 'user2Id',
        as: 'User2', // Alias used in the query
      });
    }
  }
  Match.init({
    matchId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
    },
    user1Id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { // Optional: Add foreign key constraint
        model: 'Users', 
        key: 'id',
      },
    },
    user2Id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { // Optional: Add foreign key constraint
        model: 'Users',
        key: 'id',
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    status: {
        type: DataTypes.STRING,
        allowNull: true // Or set a default status
    },
    // timestamps are handled by Sequelize by default (createdAt, updatedAt)
  }, {
    sequelize,
    modelName: 'Match',
    // Optional: If your table name is different from 'Matches'
    // tableName: 'your_match_table_name'
  });
  return Match;
};