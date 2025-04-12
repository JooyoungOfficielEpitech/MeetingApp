'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'isAdmin', { // 'Users' 테이블에 'isAdmin' 컬럼 추가
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('Users', 'isAdmin'); // 롤백 시 'isAdmin' 컬럼 제거
  }
};