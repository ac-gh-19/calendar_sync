const readline = require('readline');

/**
 * Prompts the user for a single line of input.
 * @param {string} question - The prompt text to display
 * @returns {Promise<string>} The user's trimmed input
 */
function prompt(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

/** Maps full day names to short abbreviations. */
const DAY_ABBREV = {
    monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
    friday: 'Fri', saturday: 'Sat', sunday: 'Sun'
};

/** Converts an array of full day names to abbreviated, comma-separated string. */
function abbreviateDays(days) {
    return (days || []).map(d => DAY_ABBREV[d.toLowerCase()] || d).join(', ');
}

module.exports = { prompt, abbreviateDays };
