const { findSyllabusFiles } = require('../utils/files');
const { showSpinner } = require('../terminal/display');
const { BatchProcessor, States } = require('./batch_processor');
const { processSyllabus } = require('../interactive/interactive_flow');

async function runBatch(dirPath, provider, quarterStart, quarterEnd) {
    const files = findSyllabusFiles(dirPath);
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
}

module.exports = { runBatch };
