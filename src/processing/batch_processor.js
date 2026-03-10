const fs = require('fs');
const path = require('path');
const { extractText } = require('../utils/pdf_extractor');
const { parseSyllabus } = require('./llm_parser');
const logger = require('../utils/logger');

/**
 * States for each file in the batch
 */
const States = {
    QUEUED: 'queued',
    PARSING: 'parsing',
    READY: 'ready',
    INTERACTING: 'interacting',
    DONE: 'done',
    ERROR: 'error'
};

class BatchProcessor {
    constructor(filePaths, provider, quarterStart, quarterEnd, concurrency = 2) {
        this.provider = provider;
        this.quarterStart = quarterStart;
        this.quarterEnd = quarterEnd;
        this.concurrency = concurrency;

        // Initialize state for each file
        this.items = filePaths.map(filePath => ({
            path: filePath,
            basename: path.basename(filePath),
            state: States.QUEUED,
            result: null,
            error: null,
            startTime: null,
            endTime: null
        }));

        this.queue = [...this.items];
        this.activeCount = 0;
        this.onReadyCallback = null;
        this.readyFiles = [];
    }

    /**
     * Starts the background parsing process.
     */
    start() {
        logger.debug(`[BatchProcessor] Starting batch processing for ${this.items.length} files (concurrency: ${this.concurrency})`);
        this._processNext();
    }

    /**
     * Internal runner to maintain concurrency.
     */
    async _processNext() {
        while (this.activeCount < this.concurrency && this.queue.length > 0) {
            const item = this.queue.shift();
            this.activeCount++;
            this._parseItem(item);
        }
    }

    /**
     * Individual item parsing logic.
     */
    async _parseItem(item) {
        item.state = States.PARSING;
        item.startTime = new Date();
        logger.debug(`[BatchProcessor] START parsing: ${item.basename}`);

        try {
            const ext = path.extname(item.path).toLowerCase();
            let text;
            if (ext === '.txt') {
                text = fs.readFileSync(item.path, 'utf8');
            } else {
                text = await extractText(item.path);
            }

            item.result = await parseSyllabus(this.provider, text, this.quarterStart, this.quarterEnd);
            item.state = States.READY;

            if (this.onReadyCallback) {
                const cb = this.onReadyCallback;
                this.onReadyCallback = null;
                cb(item);
            } else {
                this.readyFiles.push(item);
            }
        } catch (err) {
            logger.error(`[BatchProcessor] ERROR parsing ${item.basename}: ${err.message}`, err);
            item.state = States.ERROR;
            item.error = err.message;

            // Even if it's an error, we want to signal "ready" so the main loop can skip/report it
            if (this.onReadyCallback) {
                const cb = this.onReadyCallback;
                this.onReadyCallback = null;
                cb(item);
            } else {
                this.readyFiles.push(item);
            }
        } finally {
            item.endTime = new Date();
            const duration = ((item.endTime - item.startTime) / 1000).toFixed(2);
            logger.debug(`[BatchProcessor] END parsing: ${item.basename} (Took ${duration}s)`);

            this.activeCount--;
            this._processNext();
        }
    }

    /**
     * Waits for the next file to be ready (READY or ERROR state).
     * @returns {Promise<Object>} The next ready item.
     */
    async waitForNextReadyFile() {
        if (this.readyFiles.length > 0) {
            return this.readyFiles.shift();
        }

        return new Promise((resolve) => {
            this.onReadyCallback = resolve;
        });
    }

    /**
     * Checks if all files are processed.
     */
    isFinished() {
        return this.items.every(item => [States.DONE, States.ERROR].includes(item.state));
    }
}

module.exports = { BatchProcessor, States };
