import { describe, it, expect, vi } from 'vitest';
import { FieldConfig } from './field_config';

describe('FieldConfig', () => {
    describe('days configuration', () => {
        const daysConfig = FieldConfig.days;

        it('should parse valid days correctly', () => {
            const mockContext = { isValidDay: vi.fn().mockReturnValue(true) };
            const result = daysConfig.validateAndParse('monday, tuesday, wednesday', mockContext);
            expect(result).toEqual(['monday', 'tuesday', 'wednesday']);
        });

        it('should throw an error for invalid days', () => {
            const mockContext = { isValidDay: vi.fn((day) => day === 'monday') };
            expect(() => {
                daysConfig.validateAndParse('monday, funday', mockContext);
            }).toThrow('Invalid day(s): funday');
        });
    });

    describe('date configuration', () => {
        const dateConfig = FieldConfig.date;

        it('should accept valid dates', () => {
            const mockContext = { isValidDate: vi.fn().mockReturnValue(true) };
            const result = dateConfig.validateAndParse('2026-03-15', mockContext);
            expect(result).toBe('2026-03-15');
        });

        it('should throw an error for invalid dates', () => {
            const mockContext = { isValidDate: vi.fn().mockReturnValue(false) };
            expect(() => {
                dateConfig.validateAndParse('03-15-2026', mockContext);
            }).toThrow('Invalid format. Use YYYY-MM-DD');
        });
    });

    describe('time configurations', () => {
        const startTimeConfig = FieldConfig.start_time;

        it('should accept valid times', () => {
            const mockContext = { isValidTime: vi.fn().mockReturnValue(true) };
            expect(startTimeConfig.validateAndParse('09:30', mockContext)).toBe('09:30');
            expect(FieldConfig.end_time.validateAndParse('14:00', mockContext)).toBe('14:00');
        });

        it('should throw an error for invalid times', () => {
            const mockContext = { isValidTime: vi.fn().mockReturnValue(false) };
            expect(() => {
                startTimeConfig.validateAndParse('9:30 AM', mockContext);
            }).toThrow('Invalid format. Use HH:MM in 24-hour format');
        });
    });

    describe('type configuration', () => {
        const typeConfig = FieldConfig.type;
        const mockContext = {
            isValidType: (val) => ['lecture', 'exam'].includes(val),
            VALID_TYPES: ['lecture', 'exam']
        };

        it('should normalize and accept valid types', () => {
            const result = typeConfig.validateAndParse(' LECTURE ', mockContext);
            expect(result).toBe('lecture');
        });

        it('should throw an error for invalid types', () => {
            expect(() => {
                typeConfig.validateAndParse('homework', mockContext);
            }).toThrow('Invalid type "homework". Choose from: lecture, exam. Try again.');
        });
    });
});
