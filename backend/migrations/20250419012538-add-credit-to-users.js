'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'credit', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: '사용자 크레딧 (초기값: 0)'
    });
    
    console.log('Added credit column to Users table');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Users', 'credit');
    console.log('Removed credit column from Users table');
  }
};
