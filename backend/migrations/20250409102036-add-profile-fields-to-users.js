'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    // Add columns one by one or use Promise.all for potentially better performance 
    await queryInterface.addColumn('Users', 'height', {
      type: Sequelize.INTEGER,
      allowNull: true,
      after: 'age' // Optional: specify column order
    });
    await queryInterface.addColumn('Users', 'gender', {
      type: Sequelize.STRING,
      allowNull: true,
      after: 'height' // Optional: specify column order
    });
    await queryInterface.addColumn('Users', 'mbti', {
        type: Sequelize.STRING,
        allowNull: true,
        after: 'gender' // Optional: specify column order
    });
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.removeColumn('Users', 'mbti');
    await queryInterface.removeColumn('Users', 'gender');
    await queryInterface.removeColumn('Users', 'height');
  }
};
