const { processOneOffs } = require('./one_off_processor');
const { authorize, createEvents, createRecurringEvents } = require('./calendar_client');
const { selectEvents } = require('./event_selector');
const { confirmEvents } = require('./event_preview');
const { editEvents } = require('./event_editor');
const { prompt } = require('./utils');

/**
 * Orchestrates the interactive flow for a single parsed syllabus result.
 * @param {Object} result - Structured schedule JSON from LLM
 * @param {string} quarterStart - YYYY-MM-DD
 * @param {string} quarterEnd - YYYY-MM-DD
 */
async function processSyllabus(result, quarterStart, quarterEnd) {
    // Stage 4: Event selection → summary → confirmation loop
    const fullResult = result;
    while (true) {
        console.log('\n--- Event Selection ---');
        result = await selectEvents(fullResult);

        console.log('\n--- Event Editor ---');
        result = await editEvents(result, quarterStart, quarterEnd);

        if (result === null) {
            console.log('\n  [INFO] Returning to event selection...');
            continue;
        }

        const confirmed = await confirmEvents(result, quarterStart, quarterEnd);
        if (confirmed) {
            // Prompt for an optional class name prefix
            console.log('\n--- Class Name ---');
            const className = await prompt('  Enter a class name to prepend to each event (e.g. CS166), or press Enter to skip: ');
            if (className) {
                for (const e of result.recurring || []) {
                    e.title = `${className} ${e.title}`;
                }
                for (const e of result.one_off || []) {
                    e.title = `${className} ${e.title}`;
                }
                console.log(`  Prepended "${className}" to all event titles.`);
            }
            break;
        }

        console.log('\n  [INFO] Returning to event selection...');
    }

    // Stage 5: Push to Google Calendar
    console.log('\n--- Stage 5: Google Calendar ---');
    const auth = await authorize();

    let totalCreated = 0;
    const allFailures = [];

    // Create recurring events as RRULE series (one API call per pattern)
    if (result.recurring.length > 0 && quarterStart && quarterEnd) {
        console.log(`\nCreating ${result.recurring.length} recurring event series...`);
        const recurResult = await createRecurringEvents(
            auth,
            result.recurring,
            result.exceptions || [],
            quarterStart,
            quarterEnd
        );
        totalCreated += recurResult.created;
        allFailures.push(...recurResult.failed);
    }

    // Create one-off events individually
    const oneOffEvents = processOneOffs(result.one_off);

    if (oneOffEvents.length > 0) {
        console.log(`\nCreating ${oneOffEvents.length} one-off events...`);
        const oneOffResult = await createEvents(auth, oneOffEvents);
        totalCreated += oneOffResult.created;
        allFailures.push(...oneOffResult.failed);
    }

    // Summary
    if (allFailures.length > 0) {
        console.log(`\nFailed to create ${allFailures.length} event(s):`);
        for (const f of allFailures) {
            console.log(`  - ${f.event.title}: ${f.error}`);
        }
    }

    console.log(`\nDone! Created ${totalCreated} calendar entries (${result.recurring.length} recurring series + ${oneOffEvents.length} one-off).`);
}

module.exports = { processSyllabus };
