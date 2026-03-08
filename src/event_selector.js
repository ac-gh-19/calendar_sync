const { prompt, abbreviateDays } = require('./utils');

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

    // --- Display recurring events ---
    if (recurring.length > 0) {
        console.log('\n  Recurring Events:');
        console.log('  ' + '-'.repeat(60));
        recurring.forEach((e, i) => {
            const days = abbreviateDays(e.days);
            const loc = e.location ? ` @ ${e.location}` : '';
            const startTime = e.start_time || 'TBD';
            const endTime = e.end_time || 'TBD';
            const skipWarning = (startTime === 'TBD' || endTime === 'TBD') ? ' [⚠️ SKIPS ON UPLOAD]' : '';
            console.log(`  [${i + 1}] ${e.title} — ${days} ${startTime}-${endTime} [${e.type}]${loc}${skipWarning}`);
        });
    }

    // --- Display one-off events ---
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

    console.log('\n  Total: ' + (recurring.length + oneOff.length) + ' events found');
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

        console.log(`  Keeping ${filteredRecurring.length} recurring + ${filteredOneOff.length} one-off events`);

        return {
            ...llmResult,
            recurring: filteredRecurring,
            one_off: filteredOneOff
        };
    }
}

module.exports = { selectEvents };
