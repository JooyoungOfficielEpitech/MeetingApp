'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('Matches', 'status', { // 'Matches' 테이블에 'status' 컬럼 추가
      type: Sequelize.STRING,
      allowNull: true // 또는 필요에 따라 기본값 설정: defaultValue: 'pending'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('Matches', 'status'); // 롤백 시 'status' 컬럼 제거
  }
};