'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class MatchingWaitList extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      // MatchingWaitList belongs to one User
      MatchingWaitList.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'User' // Optional alias
      });
    }
  }
  MatchingWaitList.init({
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true
    },
    gender: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [['male', 'female']]
      }
    }
  }, {
    sequelize,
    modelName: 'MatchingWaitList',
  });
  return MatchingWaitList;
};