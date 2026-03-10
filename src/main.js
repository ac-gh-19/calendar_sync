require('dotenv').config();
const { run } = require('./runner');

const inputPath = process.argv[2];
run(inputPath).catch((err) => {
    console.error('\nFatal error:', err.stack);
    process.exit(1);
});
