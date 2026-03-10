import { describe, it, expect } from 'vitest';
import { isValidTime, isValidDate, isValidDay, isValidType, VALID_DAYS, VALID_TYPES } from './validators';

describe('validators', () => {
    describe('isValidTime', () => {
        it('should return true for valid times', () => {
            expect(isValidTime('00:00')).toBe(true);
            expect(isValidTime('09:30')).toBe(true);
            expect(isValidTime('12:15')).toBe(true);
            expect(isValidTime('23:59')).toBe(true);
        });

        it('should return false for invalid times', () => {
            expect(isValidTime('24:00')).toBe(false);
            expect(isValidTime('09:60')).toBe(false);
            expect(isValidTime('9:30')).toBe(false); // missing leading zero
            expect(isValidTime('12-15')).toBe(false);
            expect(isValidTime('random')).toBe(false);
        });
    });

    describe('isValidDate', () => {
        it('should return true for valid dates', () => {
            expect(isValidDate('2026-01-01')).toBe(true);
            expect(isValidDate('2026-12-31')).toBe(true);
            expect(isValidDate('2026-03-15')).toBe(true);
            expect(isValidDate('2026-02-28')).toBe(true);
        });

        it('should return false for invalid dates', () => {
            expect(isValidDate('2026-13-01')).toBe(false); // invalid month
            expect(isValidDate('2026-00-01')).toBe(false); // invalid month
            expect(isValidDate('2026-01-32')).toBe(false); // invalid day
            expect(isValidDate('26-03-15')).toBe(false); // invalid year
            expect(isValidDate('2026/03/15')).toBe(false); // wrong separator
        });
    });

    describe('isValidDay', () => {
        it('should return true for valid days', () => {
            VALID_DAYS.forEach(day => {
                expect(isValidDay(day)).toBe(true);
            });
        });

        it('should return false for invalid days', () => {
            expect(isValidDay('Mon')).toBe(false);
            expect(isValidDay('MONDAY')).toBe(false); // lowercase required
            expect(isValidDay('funday')).toBe(false);
        });
    });

    describe('isValidType', () => {
        it('should return true for valid types', () => {
            VALID_TYPES.forEach(type => {
                expect(isValidType(type)).toBe(true);
            });
        });

        it('should return false for invalid types', () => {
            expect(isValidType('Lecture')).toBe(false); // lowercase required
            expect(isValidType('homework')).toBe(false);
            expect(isValidType('test')).toBe(false);
        });
    });
});
