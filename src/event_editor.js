const { prompt, abbreviateDays, displayEventList } = require('./utils');
const { FieldConfig } = require('./field_config');
const { isValidTime, isValidDate, isValidDay, isValidType, VALID_DAYS, VALID_TYPES } = require('./validators');

/**
 * Determines which fields are editable for a given event.
 * Recurring events have "days", one-off events have "date".
 */
function getEditableFields(event, isRecurring) {
    const fields = ['title'];
    if (isRecurring) {
        fields.push('days');
    } else {
        fields.push('date');
    }
    fields.push('start_time', 'end_time', 'type', 'location');
    return fields;
}

/**
 * Returns a display string for a field's current value.
 */
function displayEventFieldValue(field, value) {
    if (field === 'days' && Array.isArray(value)) {
        return value.length > 0 ? abbreviateDays(value) : '(none)';
    }
    return value || '(none)';
}

/**
 * Prompts user for a new value for the given field, with validation.
 * Returns the validated value (or original if skipped).
 */
async function getEditedValidatedEventFieldValue(field, value) {
    const currentFieldValue = displayEventFieldValue(field, value);
    const config = FieldConfig[field];

    if (!config) return value;

    // message to user about valid inputs
    if (config.prePrompt) {
        config.prePrompt({ VALID_DAYS, VALID_TYPES });
    }

    while (true) {
        const newFieldVal = await prompt(config.getPrompt(currentFieldValue));
        if (!newFieldVal) return value; // keep current

        try {
            return config.validateAndParse(newFieldVal, {
                isValidDay,
                isValidDate,
                isValidTime,
                isValidType,
                VALID_TYPES,
                VALID_DAYS
            });
        } catch (error) {
            console.log(error.message);
        }
    }
}

/**
 * Checks whether an event has missing/TBD fields that would cause it to be skipped on upload.
 */
function hasMissingRequiredFields(event, isRecurring) {
    if (isRecurring) {
        return !event.days || event.days.length === 0 ||
            !event.start_time || !isValidTime(event.start_time) ||
            !event.end_time || !isValidTime(event.end_time);
    }
    return !event.date || !isValidDate(event.date) ||
        !event.start_time || !isValidTime(event.start_time) ||
        !event.end_time || !isValidTime(event.end_time);
}

/**
 * Checks whether a specific field is missing/invalid for a given event.
 */
function isFieldMissing(event, field, isRecurring) {
    const config = FieldConfig[field];
    if (!config || !config.isRequired(isRecurring)) return false;

    switch (field) {
        case 'days':       return !event.days || event.days.length === 0;
        case 'date':       return !event.date || !isValidDate(event.date);
        case 'start_time': return !event.start_time || !isValidTime(event.start_time);
        case 'end_time':   return !event.end_time || !isValidTime(event.end_time);
        default:           return !event[field];
    }
}

async function editSingleEvent(event, isRecurring, quarterStart, quarterEnd) {
    while (true) {
        const fields = getEditableFields(event, isRecurring);

        console.log('  ┌─────────────────────────────────────');
        for (let i = 0; i < fields.length; i++) {
            const f = fields[i];
            const missing = isFieldMissing(event, f, isRecurring) ? ' ⚠️  REQUIRED' : '';
            console.log(`  │  [${i + 1}] ${f}: ${displayEventFieldValue(f, event[f])}${missing}`);
        }
        console.log('  └─────────────────────────────────────');

        const fieldInput = await prompt('  Pick a field to edit (1-' + fields.length + '), or press Enter when done: ');

        if (!fieldInput) break; // done editing this event

        const fieldNum = Number(fieldInput);
        if (isNaN(fieldNum) || fieldNum < 1 || fieldNum > fields.length) {
            console.log(`  Invalid. Enter a number between 1 and ${fields.length}.`);
            continue;
        }

        const fieldName = fields[fieldNum - 1];
        let newFieldValue;
        while (true) {
            newFieldValue = await getEditedValidatedEventFieldValue(fieldName, event[fieldName]);
            if (fieldName === "date") {
                if (newFieldValue < quarterStart || newFieldValue > quarterEnd) {
                    console.log(`  ❌ Date is outside the ${quarterStart} - ${quarterEnd} range.`);
                    continue;
                }
            } else if (fieldName === "start_time") {
                if (newFieldValue > event.end_time) {
                    console.log('  ❌ Start time must be before end time.');
                    continue;
                }
            } else if (fieldName === "end_time") {
                if (newFieldValue < event.start_time) {
                    console.log('  ❌ End time must be after start time.');
                    continue;
                }
            }

            break;
        }
        event[fieldName] = newFieldValue;
        console.log(`  ✅ Updated ${fieldName} → ${displayEventFieldValue(fieldName, event[fieldName])}`);
    }
}

/**
 * Interactive event editor. Lets users pick events by number and edit their fields.
 * @param {Object} result - Filtered result with recurring and one_off arrays
 * @returns {Promise<Object>} Modified result
 */
async function editEvents(result, quarterStart, quarterEnd) {
    const recurring = result.recurring || [];
    const oneOff = result.one_off || [];
    const total = recurring.length + oneOff.length;

    if (total === 0) return result;

    // Edit loop
    while (true) {
        // Show current event list so user always has context
        displayEventList(recurring, oneOff);

        // Recalculate which required fields are still incomplete
        const incomplete = [];
        recurring.forEach((e, i) => {
            if (hasMissingRequiredFields(e, true)) incomplete.push({ num: i + 1, title: e.title });
        });
        oneOff.forEach((e, i) => {
            if (hasMissingRequiredFields(e, false)) incomplete.push({ num: recurring.length + i + 1, title: e.title });
        });

        if (incomplete.length > 0) {
            console.log('  🚫 The following events still have missing required fields:');
            for (const w of incomplete) {
                console.log(`     [${w.num}] ${w.title}`);
            }
            console.log('  These events MUST be edited before continuing.\n');
        }

        const hint = incomplete.length === 0
            ? ', press Enter to continue, or "back" to return to selection'
            : ', or "back" to return to selection';
        const input = await prompt('  Edit an event? Enter its number (1-' + total + ')' + hint + ': ');

        if (input.toLowerCase() === 'back') {
            return null; // signal to go back to event selection
        }

        if (!input) {
            if (incomplete.length > 0) {
                console.log(`  ❌ Cannot continue — ${incomplete.length} event(s) still have missing required fields. Please edit them first or type "back" to return to selection.`);
                continue;
            }
            break; // all good, continue to confirmation
        }

        const num = Number(input);
        if (isNaN(num) || num < 1 || num > total) {
            console.log(`  Invalid selection. Enter a number between 1 and ${total}.`);
            continue;
        }

        // Determine which event and whether it's recurring
        let event, isRecurring;
        if (num <= recurring.length) {
            event = recurring[num - 1];
            isRecurring = true;
        } else {
            event = oneOff[num - recurring.length - 1];
            isRecurring = false;
        }

        console.log(`\n  Editing: ${event.title}`);

        // Field edit loop for this event
        await editSingleEvent(event, isRecurring, quarterStart, quarterEnd);

        console.log('\n');
    }

    return result;
}

module.exports = { editEvents };
