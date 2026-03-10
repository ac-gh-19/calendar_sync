const fs = require('fs');
const path = require('path');
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

/**
 * A simple ASCII spinner for waiting states.
 */
function showSpinner(message) {
    const chars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    process.stdout.write('\x1B[?25l'); // Hide cursor
    const interval = setInterval(() => {
        process.stdout.write(`\r${chars[i]} ${message}`);
        i = (i + 1) % chars.length;
    }, 100);

    return () => {
        clearInterval(interval);
        process.stdout.write('\r\x1B[K'); // Clear line
        process.stdout.write('\x1B[?25h'); // Show cursor
    };
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

/**
 * Displays a numbered list of recurring and one-off events.
 * Reusable across event selection and event editing stages.
 */
function displayEventList(recurring, oneOff) {
    if (recurring.length > 0) {
        console.log('\n  Recurring Events:');
        console.log('  ' + '-'.repeat(60));
        recurring.forEach((e, i) => {
            const days = abbreviateDays(e.days);
            const loc = e.location ? ` @ ${e.location}` : '';
            const startTime = e.start_time || 'TBD';
            const endTime = e.end_time || 'TBD';
            const skipWarning = (days.length === 0 || startTime === 'TBD' || endTime === 'TBD') ? ' [⚠️ SKIPS ON UPLOAD]' : '';
            console.log(`  [${i + 1}] ${e.title} — ${days} ${startTime}-${endTime} [${e.type}]${loc}${skipWarning}`);
        });
    }

    if (oneOff.length > 0) {
        const offset = recurring.length;
        console.log('\n  One-Off Events:');
        console.log('  ' + '-'.repeat(60));
        oneOff.forEach((e, i) => {
            const date = e.date || 'TBD';
            const loc = e.location ? ` @ ${e.location}` : '';
            const startTime = e.start_time || 'TBD';
            const endTime = e.end_time || 'TBD';
            const skipWarning = (date === 'TBD' || startTime === 'TBD' || endTime === 'TBD') ? ' [⚠️ SKIPS ON UPLOAD]' : '';
            console.log(`  [${offset + i + 1}] ${e.title} — ${date} ${startTime}-${endTime} [${e.type}]${loc}${skipWarning}`);
        });
    }

    console.log('\n');
}

module.exports = { prompt, findSyllabusFiles, showSpinner, abbreviateDays, displayEventList };
