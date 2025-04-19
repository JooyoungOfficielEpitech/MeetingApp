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
      // User has many Matches (as User1)
      User.hasMany(models.Match, {
        foreignKey: 'user1Id',
        as: 'MatchesAsUser1' // Define an alias for this association
      });
      // User has many Matches (as User2)
      User.hasMany(models.Match, {
        foreignKey: 'user2Id',
        as: 'MatchesAsUser2' // Define an alias for this association
      });
      // User has one MatchingWaitList entry
      User.hasOne(models.MatchingWaitList, {
        foreignKey: 'userId',
        as: 'WaitlistEntry' // Optional alias
      });
    }
  }
  User.init({
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      // validate: {
      //   isEmail: true,
      // },
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: true, // Allow null for social logins
    },
    googleId: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true,
    },
    kakaoId: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      comment: 'Kakao User ID for social login'
    },
    name: DataTypes.STRING,
    nickname: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '사용자의 닉네임'
    },
    age: DataTypes.INTEGER,
    height: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    gender: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '사용자가 거주하는 도시'
    },
    mbti: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    occupation: DataTypes.STRING,
    profilePictureUrl: DataTypes.STRING,
    profileImageUrls: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    businessCardImageUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isAdmin: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pending_approval',
      validate: {
        isIn: [['pending_profile', 'pending_approval', 'active', 'rejected', 'suspended']]
      }
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Reason for profile rejection by admin'
    },
    credit: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: '사용자 크레딧 (초기값: 0)'
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: 'User',
    paranoid: true,
  });
  return User;
};