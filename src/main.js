require('dotenv').config();
const path = require('path');
const { extractText } = require('./pdf_extractor');
const { parseSyllabus } = require('./llm_parser');
const AnthropicProvider = require('./providers/anthropic_provider');
const OllamaProvider = require('./providers/ollama_provider');
const { processOneOffs } = require('./date_expander');
const { authorize, createEvents, createRecurringEvents } = require('./calendar_client');
const { getQuarterDates } = require('./cli');
const { selectEvents } = require('./event_selector');
const { confirmEvents } = require('./event_preview');

async function run(pdfPath) {
    if (!pdfPath) {
        console.error('Usage: node main.js <path-to-syllabus.pdf>');
        process.exit(1);
    }

    // Stage 1: Extract text (PDF or Text)
    console.log('\n--- Stage 1: Extraction ---');
    let text;
    const ext = path.extname(pdfPath).toLowerCase();

    if (ext === '.txt') {
        const fs = require('fs');
        text = fs.readFileSync(pdfPath, 'utf8');
        console.log(`Loaded ${text.length} characters from ${path.basename(pdfPath)}`);
    } else {
        text = await extractText(pdfPath);
    }

    // Stage 2: Get quarter dates
    console.log('\n--- Stage 2: Quarter Date Range ---');
    const { start: quarterStart, end: quarterEnd } = await getQuarterDates();

    // Stage 3: Parse with LLM
    console.log('\n--- Stage 3: LLM Parsing ---');
    const providerName = process.env.LLM_PROVIDER?.toLowerCase() || 'ollama';
    let provider;
    if (providerName === 'anthropic') {
        provider = new AnthropicProvider();
    } else {
        provider = new OllamaProvider();

        // Pre-flight check: make sure Ollama is actually running
        const ollamaBase = process.env.OLLAMA_URL || 'http://localhost:11434';
        const healthUrl = ollamaBase.replace(/\/api\/chat\/?$/, '') + '/api/tags';
        try {
            const res = await fetch(healthUrl);
            if (!res.ok) throw new Error(`status ${res.status}`);
        } catch (err) {
            console.error(
                `\nOllama is not running at ${ollamaBase}\n` +
                `   To fix this:\n` +
                `     1. Start Ollama:  ollama serve\n` +
                `     2. Pull a model:  ollama pull ${process.env.OLLAMA_MODEL || 'qwen2.5:7b-instruct'}\n` +
                `   Or switch to Anthropic by setting LLM_PROVIDER=anthropic in your .env`
            );
            process.exit(1);
        }
    }
    let result = await parseSyllabus(provider, text, quarterStart, quarterEnd);

    // Stage 4: Event selection → summary → confirmation loop
    const fullResult = result;
    while (true) {
        console.log('\n--- Event Selection ---');
        result = await selectEvents(fullResult);

        const confirmed = await confirmEvents(result, quarterStart, quarterEnd);
        if (confirmed) break;

        console.log('\n  ↩  Returning to event selection...');
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
        console.log(`  Created recurring: ${pattern.title} (${days}) — ${created}/${recurringPatterns.length}`);
        totalCreated += recurResult.created;
        allFailures.push(...recurResult.failed);
    }

    // Create one-off events individually
    const oneOffEvents = processOneOffs(result.one_off);

    if (oneOffEvents.length > 0) {
        console.log(`\nCreating ${oneOffEvents.length} one-off events...`);
        const oneOffResult = await createEvents(auth, oneOffEvents);
        console.log()
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
