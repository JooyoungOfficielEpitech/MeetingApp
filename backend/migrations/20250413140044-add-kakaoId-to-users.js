'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'kakaoId', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Kakao User ID for social login',
      after: 'googleId'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Users', 'kakaoId');
  }
};
