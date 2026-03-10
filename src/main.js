require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { extractText } = require('./utils/pdf_extractor');
const { parseSyllabus } = require('./processing/llm_parser');
const { getQuarterDates } = require('./terminal/date_prompt');
const { findSyllabusFiles } = require('./utils/files');
const { showSpinner } = require('./terminal/display');
const { BatchProcessor, States } = require('./processing/batch_processor');
const { getProvider } = require('./providers/factory');
const { processSyllabus } = require('./interactive/interactive_flow');
const logger = require('./utils/logger');

async function run(inputPath) {
    if (!inputPath) {
        console.error('Usage: node main.js <path-to-syllabus.pdf OR directory>');
        process.exit(1);
    }

    const resolvedPath = path.resolve(inputPath);
    if (!fs.existsSync(resolvedPath)) {
        console.error(`Error: Path does not exist: ${resolvedPath}`);
        process.exit(1);
    }

    const stats = fs.statSync(resolvedPath);
    const provider = await getProvider();
    const { start: quarterStart, end: quarterEnd } = await getQuarterDates();

    if (stats.isDirectory()) {
        const files = findSyllabusFiles(resolvedPath);
        if (files.length === 0) {
            console.log('No .pdf or .txt files found in directory.');
            return;
        }

        console.log(`\nFound ${files.length} syllabus files. Starting background parsing...`);
        const processor = new BatchProcessor(files, provider, quarterStart, quarterEnd);
        processor.start();

        for (let i = 0; i < files.length; i++) {
            let item;
            if (processor.readyFiles.length === 0) {
                const stopSpinner = showSpinner(`Parsing next syllabus (${i + 1}/${files.length})...`);
                item = await processor.waitForNextReadyFile();
                stopSpinner();
            } else {
                item = await processor.waitForNextReadyFile();
            }

            console.log(`\n==================================================`);
            console.log(`Processing File [${i + 1}/${files.length}]: ${item.basename}`);
            console.log(`==================================================`);

            if (item.state === States.ERROR) {
                console.error(`  [ERROR] Skipping ${item.basename} due to parsing error: ${item.error}`);
                item.state = States.DONE;
                continue;
            }

            item.state = States.INTERACTING;
            await processSyllabus(item.result, quarterStart, quarterEnd);
            item.state = States.DONE;
        }
    } else {
        // Single file mode
        logger.debug(`--- Stage 1: Extraction ---`);
        let text;
        const ext = path.extname(resolvedPath).toLowerCase();
        if (ext === '.txt') {
            text = fs.readFileSync(resolvedPath, 'utf8');
            logger.debug(`Loaded ${text.length} characters from ${path.basename(resolvedPath)}`);
        } else {
            text = await extractText(resolvedPath);
        }

        logger.debug('--- Stage 3: LLM Parsing ---');
        const result = await parseSyllabus(provider, text, quarterStart, quarterEnd);
        await processSyllabus(result, quarterStart, quarterEnd);
    }
}

// Entry point
const inputPath = process.argv[2];
run(inputPath).catch((err) => {
    console.error('\nFatal error:', err.stack);
    process.exit(1);
});
