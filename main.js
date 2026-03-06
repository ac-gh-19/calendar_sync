require('dotenv').config();
const { extractText } = require('./pdf_extractor');
const { parseSyllabus } = require('./llm_parser');
const { combineEvents } = require('./date_expander');
const { authorize, createEvents, createRecurringEvents } = require('./calendar_client');
const { getQuarterDates } = require('./cli');
const { selectEvents } = require('./event_selector');

async function run(pdfPath) {
    if (!pdfPath) {
        console.error('Usage: node main.js <path-to-syllabus.pdf>');
        process.exit(1);
    }

    // Stage 1: Extract text from PDF
    console.log('\n--- Stage 1: PDF Extraction ---');
    const text = await extractText(pdfPath);

    // Stage 2: Get quarter dates
    console.log('\n--- Stage 2: Quarter Date Range ---');
    const { start: quarterStart, end: quarterEnd } = await getQuarterDates();

    // Stage 3: Parse with Claude
    console.log('\n--- Stage 3: LLM Parsing ---');
    const result = await parseSyllabus(text, quarterStart, quarterEnd);

    // Stage 4: Let user select which events to keep
    console.log('\n--- Event Selection ---');
    result = await selectEvents(result);

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
    const oneOffEvents = combineEvents(
        { recurring: [], one_off: result.one_off, exceptions: [] },
        quarterStart,
        quarterEnd
    );

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

// Entry point
const pdfPath = process.argv[2];
run(pdfPath).catch((err) => {
    console.error('\nFatal error:', err.message);
    process.exit(1);
});
