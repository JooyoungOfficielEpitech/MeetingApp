'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'rejectionReason', {
      type: Sequelize.TEXT, // TEXT 타입 사용
      allowNull: true,
      comment: 'Reason for profile rejection by admin',
      after: 'status' // Optional: Add column after status for organization
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Users', 'rejectionReason');
  }
};
