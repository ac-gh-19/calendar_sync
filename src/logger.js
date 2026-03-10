const fs = require('fs');
const path = require('path');

class Logger {
    constructor(logFilePath = 'debug.log') {
        this.logPath = path.resolve(logFilePath);
        // Clear previous log on startup
        fs.writeFileSync(this.logPath, `--- Log started at ${new Date().toISOString()} ---\n`);
    }

    /**
     * Internal write helper
     */
    _write(level, message) {
        const timestamp = new Date().toISOString();
        const formatted = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
        fs.appendFileSync(this.logPath, formatted);
    }

    /**
     * For technical tracing (file only)
     */
    debug(message) {
        this._write('debug', message);
    }

    /**
     * For general information (file + optional console)
     */
    info(message, showInConsole = false) {
        this._write('info', message);
        if (showInConsole) {
            console.log(message);
        }
    }

    /**
     * For errors (file + console)
     */
    error(message, err = null) {
        const fullMessage = err ? `${message}: ${err.message}\n${err.stack}` : message;
        this._write('error', fullMessage);
        console.error(`  [ERROR] ${message}`);
    }
}

// Singleton instance
const logger = new Logger();
module.exports = logger;
