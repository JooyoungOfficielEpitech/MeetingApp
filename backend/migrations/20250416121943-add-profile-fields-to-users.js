'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // 이미 모든 필드가 이전 마이그레이션으로 추가되었으므로 아무것도 하지 않음
    console.log('모든 필요한 필드가 이미 존재합니다. 이 마이그레이션은 불필요합니다.');
  },

  async down (queryInterface, Sequelize) {
    // 아무것도 하지 않음
    console.log('이 마이그레이션은 실제로 아무런 변경을 수행하지 않았습니다.');
  }
};