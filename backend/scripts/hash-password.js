const bcrypt = require('bcrypt');

const password = process.argv[2]; // Get password from command line argument
if (!password) {
    console.error('Usage: node hash-password.js <password>');
    process.exit(1);
}

const saltRounds = 10;
const hash = bcrypt.hashSync(password, saltRounds);
console.log(hash); // Output only the hash 