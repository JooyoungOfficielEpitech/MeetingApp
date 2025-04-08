'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  User.init({
    email: DataTypes.STRING,
    passwordHash: DataTypes.STRING,
    name: DataTypes.STRING,
    dob: DataTypes.DATEONLY,
    age: DataTypes.INTEGER,
    weight: DataTypes.FLOAT,
    phone: DataTypes.STRING,
    address1: DataTypes.STRING,
    address2: DataTypes.STRING,
    occupation: DataTypes.STRING,
    income: DataTypes.STRING,
    profilePictureUrl: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'User',
  });
  return User;
};