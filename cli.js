const { prompt } = require('./utils');

/**
 * Validates a date string is in YYYY-MM-DD format and is a real date.
 * @param {string} dateStr
 * @returns {Date|null} Parsed Date object or null if invalid
 */
function parseDate(dateStr) {
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;

    const [, year, month, day] = match.map(Number);
    const date = new Date(year, month - 1, day);

    // Verify the date components match (catches things like 2025-02-30)
    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }

    return date;
}

/**
 * Adds N months to a date (clamping to month end if needed).
 */
function addMonths(date, months) {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
}

/**
 * Prompts the user for quarter start and end dates with validation:
 * - Must be valid YYYY-MM-DD format
 * - Start date must be today or later
 * - End date must be after start date
 * - End date must be within 5 months of start date
 * Re-prompts on invalid input.
 * @returns {Promise<{start: string, end: string}>}
 */
async function getQuarterDates() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let startDate;
    let startStr;

    // --- Get start date ---
    while (true) {
        startStr = await prompt('Quarter start date (YYYY-MM-DD): ');
        startDate = parseDate(startStr);

        if (!startDate) {
            console.log('  Invalid format. Please use YYYY-MM-DD (e.g. 2025-03-31).');
            continue;
        }

        if (startDate < today) {
            console.log(`  Start date must be today (${today.toISOString().split('T')[0]}) or later.`);
            continue;
        }

        break;
    }

    // --- Get end date ---
    const num_months = 4;
    const maxEnd = addMonths(startDate, num_months);
    let endDate;
    let endStr;

    while (true) {
        endStr = await prompt('Quarter end date   (YYYY-MM-DD): ');
        endDate = parseDate(endStr);

        if (!endDate) {
            console.log('  Invalid format. Please use YYYY-MM-DD (e.g. 2025-06-13).');
            continue;
        }

        if (endDate <= startDate) {
            console.log(`  End date must be after start date (${startStr}).`);
            continue;
        }

        if (endDate > maxEnd) {
            console.log(`  End date must be within ${num_months} months of start date (no later than ${maxEnd.toISOString().split('T')[0]}).`);
            continue;
        }

        break;
    }

    console.log(`Quarter range: ${startStr} to ${endStr}`);
    return { start: startStr, end: endStr };
}

module.exports = { getQuarterDates };
