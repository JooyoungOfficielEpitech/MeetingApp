#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.

# Navigate to the script's directory (backend) to ensure paths are correct
cd "$(dirname "$0")"

DB_FILE="./dev.sqlite" # Path to the database file relative to the backend directory

echo "Attempting to delete existing database file: $DB_FILE"
rm -f "$DB_FILE"
echo "Database file deleted (if it existed)."

echo "Running database migrations..."
npx sequelize-cli db:migrate
echo "Database migrations completed."

echo "Database reset successful!" 