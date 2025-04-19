'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * 사용하지 않는 필드 제거
     */
    await queryInterface.removeColumn('Users', 'dob');
    await queryInterface.removeColumn('Users', 'weight');
    await queryInterface.removeColumn('Users', 'phone');
    await queryInterface.removeColumn('Users', 'address1');
    await queryInterface.removeColumn('Users', 'address2');
    await queryInterface.removeColumn('Users', 'income');
  },

  async down (queryInterface, Sequelize) {
    /**
     * 제거된 필드 복원
     */
    await queryInterface.addColumn('Users', 'dob', {
      type: Sequelize.DATEONLY,
      allowNull: true
    });
    await queryInterface.addColumn('Users', 'weight', {
      type: Sequelize.FLOAT,
      allowNull: true
    });
    await queryInterface.addColumn('Users', 'phone', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('Users', 'address1', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('Users', 'address2', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('Users', 'income', {
      type: Sequelize.STRING,
      allowNull: true
    });
  }
};
