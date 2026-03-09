const VALID_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const VALID_TYPES = ['lecture', 'office_hours', 'exam', 'deadline', 'lab'];
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function isValidTime(time) {
    return TIME_REGEX.test(time);
}

function isValidDate(date) {
    return DATE_REGEX.test(date);
}

function isValidDay(day) {
    return VALID_DAYS.includes(day);
}

function isValidType(type) {
    return VALID_TYPES.includes(type);
}

module.exports = {
    isValidTime,
    isValidDate,
    isValidDay,
    isValidType,
    VALID_DAYS,
    VALID_TYPES
}