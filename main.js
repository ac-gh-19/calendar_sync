require('dotenv').config();
const { extractText } = require('./pdf_extractor');
const { parseSyllabus } = require('./llm_parser');
const { combineEvents } = require('./date_expander');
const { authorize, createEvents } = require('./calendar_client');
const { getQuarterDates } = require('./cli');

async function run(pdfPath) {
    if (!pdfPath) {
        console.error('Usage: node main.js <path-to-syllabus.pdf>');
        process.exit(1);
    }

    // Stage 1: Extract text from PDF
    console.log('\n--- Stage 1: PDF Extraction ---');
    const text = await extractText(pdfPath);

    // Stage 2: Parse with Claude (first pass)
    console.log('\n--- Stage 2: LLM Parsing ---');
    let result = await parseSyllabus(text);

    // Stage 3: Get quarter dates if needed, then expand
    console.log('\n--- Stage 3: Date Expansion ---');
    let quarterStart, quarterEnd;

    if (result.has_ambiguous_dates || result.recurring.length > 0) {
        console.log('Recurring events detected — need quarter range.');
        ({ start: quarterStart, end: quarterEnd } = await getQuarterDates());

        // Re-parse with quarter context for better date resolution
        console.log('Re-parsing with quarter dates for better accuracy...');
        result = await parseSyllabus(text, quarterStart, quarterEnd);
    }

    const allEvents = combineEvents(result, quarterStart, quarterEnd);

    if (allEvents.length === 0) {
        console.log('No events to create. Exiting.');
        return;
    }

    // Preview events
    console.log('\nEvent preview (first 5):');
    for (const event of allEvents.slice(0, 5)) {
        console.log(`  ${event.date} ${event.start_time}-${event.end_time} | ${event.title} [${event.type}]`);
    }
    if (allEvents.length > 5) {
        console.log(`  ... and ${allEvents.length - 5} more`);
    }

    // Stage 4: Push to Google Calendar
    console.log('\n--- Stage 4: Google Calendar ---');
    const auth = await authorize();
    const { created, failed } = await createEvents(auth, allEvents);

    console.log(`\nDone! Created ${created} calendar events.`);
    if (failed.length > 0) {
        console.log(`${failed.length} event(s) failed — see errors above.`);
    }
}

// Entry point
const pdfPath = process.argv[2];
run(pdfPath).catch((err) => {
    console.error('\nFatal error:', err.message);
    process.exit(1);
});
