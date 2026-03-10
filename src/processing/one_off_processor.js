const { isValidDate, isValidTime } = require('../utils/validators');

/**
 * Filters and validates one-off events.
 * @param {Array} oneOffRaw - Raw one-off events from LLM
 * @returns {Array} Validated one-off events with formatted fields
 */
function processOneOffs(oneOffRaw) {
    const validOneOffs = (oneOffRaw || [])
        .filter(e => {
            const hasDate = e.date && typeof e.date === 'string' && isValidDate(e.date);
            const hasTime = e.start_time && isValidTime(e.start_time) && e.end_time && isValidTime(e.end_time);
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

    const skippedCount = (oneOffRaw || []).length - validOneOffs.length;
    if (skippedCount > 0) {
        console.log(`Skipped ${skippedCount} one-off event(s) with missing date or times`);
    }

    // Sort by date, then start_time
    validOneOffs.sort((a, b) => {
        const dateCompare = (a.date || '').localeCompare(b.date || '');
        if (dateCompare !== 0) return dateCompare;
        return (a.start_time || '').localeCompare(b.start_time || '');
    });

    return validOneOffs;
}

module.exports = { processOneOffs };
