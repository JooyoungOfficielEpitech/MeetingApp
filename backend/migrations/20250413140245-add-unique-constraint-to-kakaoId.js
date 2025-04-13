'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addConstraint('Users', {
      fields: ['kakaoId'],
      type: 'unique',
      name: 'unique_kakaoId'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeConstraint('Users', 'unique_kakaoId');
  }
};
