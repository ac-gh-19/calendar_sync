const fs = require('fs');
const path = require('path');

/**
 * Discovers syllabus files (.pdf, .txt) in a directory.
 * @param {string} dirPath 
 * @returns {string[]} Array of absolute file paths
 */
function findSyllabusFiles(dirPath) {
    const files = fs.readdirSync(dirPath);
    return files
        .filter(f => {
            const ext = path.extname(f).toLowerCase();
            return ext === '.pdf' || ext === '.txt';
        })
        .map(f => path.resolve(dirPath, f));
}

module.exports = { findSyllabusFiles };
