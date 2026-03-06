/**
 * Expands recurring event patterns into individual dated events
 * and combines them with one-off events.
 */

const DAY_MAP = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6
};

/**
 * Expands recurring events across a quarter date range, skipping exceptions.
 * @param {Array} recurringEvents - Recurring event patterns from LLM
 * @param {Array} exceptions - Exception dates to skip
 * @param {string} quarterStart - Start date (YYYY-MM-DD)
 * @param {string} quarterEnd - End date (YYYY-MM-DD)
 * @returns {Array} Flat array of individual dated events
 */
function expandRecurring(recurringEvents, exceptions, quarterStart, quarterEnd) {
    const exceptionDates = new Set(exceptions.map(e => e.date));
    const allEvents = [];

    for (const event of recurringEvents) {
        const targetDays = event.days.map(d => DAY_MAP[d.toLowerCase()]);
        const cursor = new Date(quarterStart + 'T00:00:00');
        const end = new Date(quarterEnd + 'T00:00:00');

        while (cursor <= end) {
            const dateStr = cursor.toISOString().split('T')[0];

            if (targetDays.includes(cursor.getDay()) && !exceptionDates.has(dateStr)) {
                allEvents.push({
                    title: event.title,
                    date: dateStr,
                    start_time: event.start_time,
                    end_time: event.end_time,
                    type: event.type,
                    location: event.location || null,
                    description: event.description || null
                });
            }

            cursor.setDate(cursor.getDate() + 1);
        }
    }

    return allEvents;
}

/**
 * Combines expanded recurring events with valid one-off events.
 * Filters out one-off events that have no date.
 * @param {Object} llmResult - Parsed LLM output
 * @param {string} quarterStart - Start date (YYYY-MM-DD)
 * @param {string} quarterEnd - End date (YYYY-MM-DD)
 * @returns {Array} Complete flat array of all events ready for calendar
 */
function combineEvents(llmResult, quarterStart, quarterEnd) {
    const expanded = expandRecurring(
        llmResult.recurring,
        llmResult.exceptions || [],
        quarterStart,
        quarterEnd
    );

    // Filter one-off events: must have valid YYYY-MM-DD date and HH:MM times
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const timeRegex = /^\d{2}:\d{2}$/;
    const validOneOffs = (llmResult.one_off || [])
        .filter(e => {
            const hasDate = e.date && typeof e.date === 'string' && dateRegex.test(e.date);
            const hasTime = e.start_time && timeRegex.test(e.start_time) && e.end_time && timeRegex.test(e.end_time);
            return hasDate && hasTime;
        })
        .map(e => ({
            title: e.title,
            date: e.date,
            start_time: e.start_time,
            end_time: e.end_time,
            type: e.type,
            location: e.location || null,
            description: null
        }));

    const skippedCount = (llmResult.one_off || []).length - validOneOffs.length;
    if (skippedCount > 0) {
        console.log(`Skipped ${skippedCount} one-off event(s) with missing date or times`);
    }

    const allEvents = [...expanded, ...validOneOffs];

    // Sort by date, then start_time (with null-safe fallbacks)
    allEvents.sort((a, b) => {
        const dateCompare = (a.date || '').localeCompare(b.date || '');
        if (dateCompare !== 0) return dateCompare;
        return (a.start_time || '').localeCompare(b.start_time || '');
    });

    console.log(`Expanded to ${allEvents.length} total events (${expanded.length} from recurring, ${validOneOffs.length} one-off)`);

    return allEvents;
}

module.exports = { expandRecurring, combineEvents };
