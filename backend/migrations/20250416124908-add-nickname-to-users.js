'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'nickname', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: '사용자의 닉네임'
    });
    console.log('닉네임 필드가 Users 테이블에 추가되었습니다.');
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('Users', 'nickname');
    console.log('닉네임 필드가 Users 테이블에서 제거되었습니다.');
  }
};
