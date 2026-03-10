const fs = require('fs');
const path = require('path');
const { getProvider } = require('./providers/factory');
const { getQuarterDates } = require('./terminal/date_prompt');
const { runBatch } = require('./processing/batch_runner');

// Single file imports
const { extractText } = require('./utils/pdf_extractor');
const { parseSyllabus } = require('./processing/llm_parser');
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
        await runBatch(resolvedPath, provider, quarterStart, quarterEnd);
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

module.exports = { run };
