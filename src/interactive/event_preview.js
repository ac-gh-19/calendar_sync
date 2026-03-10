const { prompt } = require('../utils/prompt');
const { abbreviateDays, printHeader, printInfo, printError, COLORS } = require('../terminal/display');


function pad(str, width) {
    return str.length >= width ? str.slice(0, width) : str + ' '.repeat(width - str.length);
}
function truncate(str, max) {
    return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function formatTime(start, end) {
    if (!start || !end) return 'TBD';
    return `${start} - ${end}`;
}

/**
 * Prints a formatted summary table of selected events for user review.
 */
function printEventSummary(result, quarterStart, quarterEnd) {
    const recurring = result.recurring || [];
    const oneOff = result.one_off || [];
    const exceptions = result.exceptions || [];

    printHeader('Event Summary — Review before pushing to Google Calendar');

    const line = '─'.repeat(78);

    // Recurring events table
    if (recurring.length > 0) {
        console.log(`\n  ${COLORS.bright}Recurring Events${COLORS.reset}`);
        console.log('  ' + line);
        console.log('  ' + COLORS.bright + pad('#', 4) + pad('Title', 28) + pad('Days', 18) + pad('Time', 15) + 'Type' + COLORS.reset);
        console.log('  ' + line);
        recurring.forEach((e, i) => {
            const days = abbreviateDays(e.days);
            const time = formatTime(e.start_time, e.end_time);
            console.log('  ' + pad(String(i + 1), 4) + pad(truncate(e.title, 26), 28) + pad(days, 18) + pad(time, 15) + (e.type || ''));
        });
    }

    // One-off events table
    if (oneOff.length > 0) {
        console.log(`\n  ${COLORS.bright}One-Off Events${COLORS.reset}`);
        console.log('  ' + line);
        console.log('  ' + COLORS.bright + pad('#', 4) + pad('Title', 28) + pad('Date', 18) + pad('Time', 15) + 'Type' + COLORS.reset);
        console.log('  ' + line);
        oneOff.forEach((e, i) => {
            const date = e.date || 'TBD';
            const time = formatTime(e.start_time, e.end_time);
            console.log('  ' + pad(String(recurring.length + i + 1), 4) + pad(truncate(e.title, 26), 28) + pad(date, 18) + pad(time, 15) + (e.type || ''));
        });
    }

    // Exceptions
    if (exceptions.length > 0) {
        console.log(`\n  ${COLORS.bright}Exceptions (excluded dates)${COLORS.reset}`);
        console.log('  ' + line);
        exceptions.forEach(exc => {
            console.log(`    ${exc.date}  —  ${exc.reason}`);
        });
    }

    // Summary footer
    console.log('\n  ' + line);
    console.log(`  ${COLORS.bright}Total: ${recurring.length} recurring series + ${oneOff.length} one-off events${COLORS.reset}`);
    printInfo(`Quarter: ${quarterStart} → ${quarterEnd}`);
}

/**
 * Shows the event summary and prompts the user to confirm (y) or go back (n).
 * @returns {Promise<boolean>} true if the user confirmed
 */
async function confirmEvents(result, quarterStart, quarterEnd) {
    printEventSummary(result, quarterStart, quarterEnd);

    while (true) {
        const answer = (await prompt('\n  Push these events to Google Calendar? (y/n): ')).toLowerCase().trim();
        if (answer === 'y' || answer === 'yes') {
            return true;
        }
        if (answer === 'n' || answer === 'no') {
            return false;
        }
        printError('Invalid input. Please enter "y" or "n".');
    }
}

module.exports = { printEventSummary, confirmEvents };
