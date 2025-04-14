'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('MatchingWaitLists', 'gender', { // 테이블 이름 확인 (대소문자 구분)
      type: Sequelize.STRING,
      allowNull: false,
      validate: { // 마이그레이션 레벨에서의 validate는 동작하지 않을 수 있음. 모델 레벨에서 처리됨.
        isIn: [['male', 'female']],
      },
      // 특정 컬럼 뒤에 추가하고 싶다면:
      // after: 'userId'
    });
    // Optional: 인덱스 추가 (성능 향상 목적)
    // await queryInterface.addIndex('MatchingWaitLists', ['gender']);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('MatchingWaitLists', 'gender'); // 테이블 이름 확인
    // await queryInterface.removeIndex('MatchingWaitLists', ['gender']);
  }
};