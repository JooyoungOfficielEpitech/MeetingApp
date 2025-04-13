'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add columns for profile image URLs (JSON) and business card image URL (STRING)
    await Promise.all([
      queryInterface.addColumn('Users', 'profileImageUrls', {
        type: Sequelize.JSON, // Use JSON to store an array of strings
        allowNull: true,      // Can be null initially
      }),
      queryInterface.addColumn('Users', 'businessCardImageUrl', {
        type: Sequelize.STRING,
        allowNull: true,      // Can be null initially
      }),
    ]);
    console.log('Added profileImageUrls and businessCardImageUrl columns to Users table.');
  },

  async down (queryInterface, Sequelize) {
    // Remove the added columns
    await Promise.all([
      queryInterface.removeColumn('Users', 'profileImageUrls'),
      queryInterface.removeColumn('Users', 'businessCardImageUrl'),
    ]);
    console.log('Removed profileImageUrls and businessCardImageUrl columns from Users table.');
  }
};
