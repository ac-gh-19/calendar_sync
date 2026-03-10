const { prompt, abbreviateDays, displayEventList, printInfo, printSuccess } = require('./utils');

/**
 * Displays parsed events and lets the user select which ones to keep.
 * @param {Object} llmResult - Parsed LLM output with recurring, one_off, exceptions
 * @returns {Promise<Object>} Filtered LLM result with only selected events
 */
async function selectEvents(llmResult) {
    const recurring = llmResult.recurring || [];
    const oneOff = llmResult.one_off || [];

    if (recurring.length === 0 && oneOff.length === 0) {
        console.log('No events found to select.');
        return llmResult;
    }

    displayEventList(recurring, oneOff);

    printInfo('Events marked \x1b[31m[SKIPS ON UPLOAD]\x1b[0m have missing required fields.');
    printInfo('You will be able to edit them after selection.');
    console.log('  ' + '-'.repeat(60));

    // --- Prompt for selection (with validation loop) ---
    const totalEvents = recurring.length + oneOff.length;
    console.log('\n  Enter the numbers of events to KEEP, separated by commas.');
    console.log('  Examples: "1,2,5" or "1-4,7" or "all" to keep everything.\n');

    while (true) {
        const input = await prompt('  Select events: ');

        if (input.toLowerCase() === 'all') {
            console.log('  Keeping all events.');
            return llmResult;
        }

        // Validate: only allow digits, commas, dashes, and spaces
        if (!/^[\d,\-\s]+$/.test(input)) {
            console.log('  Invalid input. Use numbers, commas, and dashes only (e.g. "1,3,5-7").');
            continue;
        }

        // Parse selection (supports "1,2,5" and "1-4,7" ranges)
        const selected = new Set();
        const parts = input.split(',').map(s => s.trim()).filter(s => s.length > 0);
        let hasInvalid = false;

        for (const part of parts) {
            if (part.includes('-')) {
                const tokens = part.split('-').map(Number);
                if (tokens.length !== 2 || isNaN(tokens[0]) || isNaN(tokens[1]) || tokens[0] > tokens[1]) {
                    console.log(`  Invalid range: "${part}". Use format like "2-5".`);
                    hasInvalid = true;
                    break;
                }
                for (let i = tokens[0]; i <= tokens[1]; i++) selected.add(i);
            } else {
                const num = Number(part);
                if (isNaN(num)) {
                    hasInvalid = true;
                    break;
                }
                selected.add(num);
            }
        }

        if (hasInvalid) continue;

        // Check all indices are in valid range
        const outOfRange = [...selected].filter(n => n < 1 || n > totalEvents);
        if (outOfRange.length > 0) {
            console.log(`  Out of range: ${outOfRange.join(', ')}. Valid range is 1-${totalEvents}.`);
            continue;
        }

        // Check at least one selected
        if (selected.size === 0) {
            console.log('  No events selected. Please pick at least one, or type "all".');
            continue;
        }

        // Filter recurring (indices 1..recurring.length)
        const filteredRecurring = recurring.filter((_, i) => selected.has(i + 1));

        // Filter one-off (indices recurring.length+1..total)
        const offset = recurring.length;
        const filteredOneOff = oneOff.filter((_, i) => selected.has(offset + i + 1));

        printSuccess(`Keeping ${filteredRecurring.length} recurring + ${filteredOneOff.length} one-off events`);

        return {
            ...llmResult,
            recurring: filteredRecurring,
            one_off: filteredOneOff
        };
    }
}

module.exports = { selectEvents };
