/** ANSI Color Codes */
const COLORS = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
};

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
            const skipWarning = (days.length === 0 || startTime === 'TBD' || endTime === 'TBD') ? ' \x1b[31m[SKIPS ON UPLOAD]\x1b[0m' : '';
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
            const skipWarning = (date === 'TBD' || startTime === 'TBD' || endTime === 'TBD') ? ' \x1b[31m[SKIPS ON UPLOAD]\x1b[0m' : '';
            console.log(`  [${offset + i + 1}] ${e.title} — ${date} ${startTime}-${endTime} [${e.type}]${loc}${skipWarning}`);
        });
    }

    console.log('\n');
}

/**
 * Prints a formatted section header.
 * @param {string} text 
 */
function printHeader(text) {
    console.log(`\n\n${COLORS.bright}${COLORS.cyan}=== ${text.toUpperCase()} ===${COLORS.reset}\n`);
}

/**
 * Prints a success message.
 * @param {string} text 
 */
function printSuccess(text) {
    console.log(`${COLORS.green}✔ ${text}${COLORS.reset}`);
}

/**
 * Prints an informational message.
 * @param {string} text 
 */
function printInfo(text) {
    console.log(`${COLORS.yellow}ℹ ${text}${COLORS.reset}`);
}

/**
 * Prints an error message.
 * @param {string} text 
 */
function printError(text) {
    console.log(`${COLORS.red}✖ ${text}${COLORS.reset}`);
}

/**
 * Adds vertical spacing.
 */
function spacing() {
    console.log('\n');
}

module.exports = {
    showSpinner,
    abbreviateDays,
    displayEventList,
    printHeader,
    printSuccess,
    printInfo,
    printError,
    spacing,
    COLORS
};
