const { prompt } = require('./utils/prompt');

/**
 * Field configuration schema 
 * Encapsulates the prompts and validation logic for each editable event field
 */
const FieldConfig = {
    title: {
        isRequired: () => true,
        getPrompt: (currentFieldValue) => `    New title [${currentFieldValue}]: `,
        validateAndParse: (input) => input
    },
    days: {
        isRequired: () => true,
        getPrompt: (currentFieldValue) => `    New days - (comma-separated) EX: monday, tuesday, thursday | Current days - [${currentFieldValue}]: `,
        validateAndParse: (input, context) => {
            const days = input.split(',').map(d => d.trim().toLowerCase());
            const invalid = days.filter(d => !context.isValidDay(d));
            if (invalid.length > 0) {
                throw new Error(`    [ERROR] Invalid day(s): ${invalid.join(', ')}. Try again.`);
            }
            return days;
        },
        prePrompt: (context) => console.log(`    Valid days: ${context.VALID_DAYS.join(', ')}`)
    },
    date: {
        isRequired: () => true,
        getPrompt: (currentFieldValue) => `    New date (YYYY-MM-DD) [${currentFieldValue}]: `,
        validateAndParse: (input, context) => {
            if (!context.isValidDate(input)) {
                throw new Error('    [ERROR] Invalid format. Use YYYY-MM-DD (e.g. 2026-03-15). Try again.');
            }
            return input;
        }
    },
    start_time: {
        isRequired: () => true,
        getPrompt: (currentFieldValue) => `    New start time (HH:MM) [${currentFieldValue}]: `,
        validateAndParse: (input, context) => {
            if (!context.isValidTime(input)) {
                throw new Error('    [ERROR] Invalid format. Use HH:MM in 24-hour format (e.g. 09:30, 14:00). Try again.');
            }
            return input;
        }
    },
    end_time: {
        isRequired: () => true,
        getPrompt: (currentFieldValue) => `    New end time (HH:MM) [${currentFieldValue}]: `,
        validateAndParse: (input, context) => {
            if (!context.isValidTime(input)) {
                throw new Error('    [ERROR] Invalid format. Use HH:MM in 24-hour format (e.g. 09:30, 14:00). Try again.');
            }
            return input;
        }
    },
    type: {
        isRequired: () => false,
        getPrompt: (currentFieldValue) => `    New type [${currentFieldValue}]: `,
        validateAndParse: (input, context) => {
            const normalized = input.trim().toLowerCase();
            if (!context.isValidType(normalized)) {
                throw new Error(`    [ERROR] Invalid type "${input}". Choose from: ${context.VALID_TYPES.join(', ')}. Try again.`);
            }
            return normalized;
        },
        prePrompt: (context) => console.log(`    Valid types: ${context.VALID_TYPES.join(', ')}`)
    },
    location: {
        isRequired: () => false,
        getPrompt: (currentFieldValue) => `    New location [${currentFieldValue}]: `,
        validateAndParse: (input) => input
    }
};

module.exports = { FieldConfig };
