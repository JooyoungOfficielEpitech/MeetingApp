'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Message extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // ★ Define association with User model (as Sender) ★
      this.belongsTo(models.User, {
        foreignKey: 'senderId',
        as: 'Sender', // This alias must match the include in the route
        onDelete: 'SET NULL', // Optional: Handle user deletion
        onUpdate: 'CASCADE' // Optional: Handle user ID updates
      });
      // Add association with Match model if needed
      // this.belongsTo(models.Match, { foreignKey: 'matchId', targetKey: 'matchId', as: 'MatchInfo' });
    }
  }
  Message.init({
    matchId: DataTypes.STRING,
    senderId: DataTypes.INTEGER,
    // ★ Revert field name back to 'text' to match DB column ★
    text: DataTypes.TEXT,
    timestamp: DataTypes.DATE, // Consider naming consistency (e.g., createdAt?)
    read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'Message',
    // Ensure timestamps are handled if not using default createdAt/updatedAt
    // timestamps: true, // or false if using custom 'timestamp' column only
    // createdAt: 'timestamp', // Map createdAt to custom 'timestamp' column if needed
    // updatedAt: false, // Disable updatedAt if not used
  });
  return Message;
};