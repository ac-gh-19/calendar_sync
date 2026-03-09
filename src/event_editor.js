const { prompt, abbreviateDays, displayEventList } = require('./utils');

const VALID_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const VALID_TYPES = ['lecture', 'office_hours', 'exam', 'deadline', 'lab'];
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

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
function displayValue(event, field) {
    const val = event[field];
    if (field === 'days' && Array.isArray(val)) {
        return val.length > 0 ? abbreviateDays(val) : '(none)';
    }
    return val || '(none)';
}

/**
 * Prompts user for a new value for the given field, with validation.
 * Returns the validated value (or original if skipped).
 */
async function promptForField(event, field) {
    const current = displayValue(event, field);

    switch (field) {
        case 'title': {
            const val = await prompt(`    New title [${current}]: `);
            if (!val) return event[field]; // keep current
            return val;
        }

        case 'days': {
            console.log(`    Valid days: ${VALID_DAYS.join(', ')}`);
            while (true) {
                const val = await prompt(`    New days - (comma-separated) EX: monday, tuesday, thursday | Current days - [${current}]: `);
                if (!val) return event[field]; // keep current
                const days = val.split(',').map(d => d.trim().toLowerCase());
                const invalid = days.filter(d => !VALID_DAYS.includes(d));
                if (invalid.length > 0) {
                    console.log(`    ❌ Invalid day(s): ${invalid.join(', ')}. Try again.`);
                    continue;
                }
                return days;
            }
        }

        case 'date': {
            while (true) {
                const val = await prompt(`    New date (YYYY-MM-DD) [${current}]: `);
                if (!val) return event[field]; // keep current
                if (!DATE_REGEX.test(val)) {
                    console.log('    ❌ Invalid format. Use YYYY-MM-DD (e.g. 2026-03-15). Try again.');
                    continue;
                }
                return val;
            }
        }

        case 'start_time':
        case 'end_time': {
            const label = field === 'start_time' ? 'start time' : 'end time';
            while (true) {
                const val = await prompt(`    New ${label} (HH:MM) [${current}]: `);
                if (!val) return event[field]; // keep current
                if (!TIME_REGEX.test(val)) {
                    console.log('    ❌ Invalid format. Use HH:MM in 24-hour format (e.g. 09:30, 14:00). Try again.');
                    continue;
                }
                return val;
            }
        }

        case 'type': {
            console.log(`    Valid types: ${VALID_TYPES.join(', ')}`);
            while (true) {
                const val = await prompt(`    New type [${current}]: `);
                if (!val) return event[field]; // keep current
                const normalized = val.trim().toLowerCase();
                if (!VALID_TYPES.includes(normalized)) {
                    console.log(`    ❌ Invalid type "${val}". Choose from: ${VALID_TYPES.join(', ')}. Try again.`);
                    continue;
                }
                return normalized;
            }
        }

        case 'location': {
            const val = await prompt(`    New location [${current}]: `);
            if (!val) return event[field]; // keep current
            return val;
        }

        default:
            return event[field];
    }
}

/**
 * Checks whether an event has missing/TBD fields that would cause it to be skipped on upload.
 */
function hasMissingFields(event, isRecurring) {
    if (isRecurring) {
        return !event.days || event.days.length === 0 ||
            !event.start_time || !TIME_REGEX.test(event.start_time) ||
            !event.end_time || !TIME_REGEX.test(event.end_time);
    }
    return !event.date || !DATE_REGEX.test(event.date) ||
        !event.start_time || !TIME_REGEX.test(event.start_time) ||
        !event.end_time || !TIME_REGEX.test(event.end_time);
}

/**
 * Checks whether a specific field is missing/invalid for a given event.
 */
function isFieldMissing(event, field, isRecurring) {
    switch (field) {
        case 'days':       return isRecurring && (!event.days || event.days.length === 0);
        case 'date':       return !isRecurring && (!event.date || !DATE_REGEX.test(event.date));
        case 'start_time': return !event.start_time || !TIME_REGEX.test(event.start_time);
        case 'end_time':   return !event.end_time || !TIME_REGEX.test(event.end_time);
        default:           return false;
    }
}

/**
 * Interactive event editor. Lets users pick events by number and edit their fields.
 * @param {Object} result - Filtered result with recurring and one_off arrays
 * @returns {Promise<Object>} Modified result
 */
async function editEvents(result) {
    const recurring = result.recurring || [];
    const oneOff = result.one_off || [];
    const total = recurring.length + oneOff.length;

    if (total === 0) return result;

    // Edit loop
    while (true) {
        // Show current event list so user always has context
        displayEventList(recurring, oneOff);

        // Recalculate which events are still incomplete
        const incomplete = [];
        recurring.forEach((e, i) => {
            if (hasMissingFields(e, true)) incomplete.push({ num: i + 1, title: e.title });
        });
        oneOff.forEach((e, i) => {
            if (hasMissingFields(e, false)) incomplete.push({ num: recurring.length + i + 1, title: e.title });
        });

        if (incomplete.length > 0) {
            console.log('\n  🚫 The following events still have missing required fields:');
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
        while (true) {
            const fields = getEditableFields(event, isRecurring);

            console.log('  ┌─────────────────────────────────────');
            for (let i = 0; i < fields.length; i++) {
                const f = fields[i];
                const missing = isFieldMissing(event, f, isRecurring) ? ' ⚠️  REQUIRED' : '';
                console.log(`  │  [${i + 1}] ${f}: ${displayValue(event, f)}${missing}`);
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
            event[fieldName] = await promptForField(event, fieldName);
            console.log(`  ✅ Updated ${fieldName} → ${displayValue(event, fieldName)}`);
        }

        console.log('');
    }

    return result;
}

module.exports = { editEvents };
