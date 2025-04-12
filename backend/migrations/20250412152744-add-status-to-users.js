'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'status', { // 'Users' 테이블에 'status' 컬럼 추가
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'pending_approval', // 기존 사용자들도 기본값으로 설정될 수 있음 (필요시 업데이트 로직 추가)
    });
    // Optional: Add index for better query performance on status
    await queryInterface.addIndex('Users', ['status']);
  },

  async down (queryInterface, Sequelize) {
    // Optional: Remove index first if added
    await queryInterface.removeIndex('Users', ['status']);
    await queryInterface.removeColumn('Users', 'status'); // 롤백 시 'status' 컬럼 제거
  }
};