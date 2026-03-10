import { describe, it, expect } from 'vitest';
import { abbreviateDays } from './display';

describe('display utils', () => {
    describe('abbreviateDays', () => {
        it('should correctly abbreviate single days', () => {
            expect(abbreviateDays(['monday'])).toBe('Mon');
            expect(abbreviateDays(['tuesday'])).toBe('Tue');
            expect(abbreviateDays(['wednesday'])).toBe('Wed');
            expect(abbreviateDays(['thursday'])).toBe('Thu');
            expect(abbreviateDays(['friday'])).toBe('Fri');
            expect(abbreviateDays(['saturday'])).toBe('Sat');
            expect(abbreviateDays(['sunday'])).toBe('Sun');
        });

        it('should correctly abbreviate multiple days', () => {
            expect(abbreviateDays(['monday', 'wednesday', 'friday'])).toBe('Mon, Wed, Fri');
            expect(abbreviateDays(['tuesday', 'thursday'])).toBe('Tue, Thu');
        });

        it('should handle case insensitivity', () => {
            expect(abbreviateDays(['MONDAY', 'Tuesday'])).toBe('Mon, Tue');
        });

        it('should handle empty or missing inputs gracefully', () => {
            expect(abbreviateDays([])).toBe('');
            expect(abbreviateDays(null)).toBe('');
            expect(abbreviateDays(undefined)).toBe('');
        });

        it('should pass through unknown days unchanged', () => {
            expect(abbreviateDays(['funday'])).toBe('funday');
        });
    });
});
