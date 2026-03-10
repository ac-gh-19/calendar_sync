import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import configObj from './config';

describe('config', () => {
    let originalEnv;

    beforeEach(() => {
        // Save original process.env
        originalEnv = { ...process.env };

        // Reset process.env for each test
        process.env = {};
    });

    afterEach(() => {
        // Restore original process.env
        process.env = originalEnv;
    });

    it('should load default values when no env vars are set', () => {
        const config = configObj.loadConfig();

        expect(config.llm.provider).toBe('ollama');
        expect(config.llm.ollamaUrl).toBe('http://localhost:11434/api/chat');
        expect(config.timezone).toBe('America/Los_Angeles');
    });

    it('should throw an error if LLM_PROVIDER is invalid', () => {
        process.env.LLM_PROVIDER = 'invalid_provider';

        expect(() => configObj.loadConfig()).toThrow(/Invalid LLM_PROVIDER/);
    });

    it('should throw an error if anthropic is selected but no key is provided', () => {
        process.env.LLM_PROVIDER = 'anthropic';
        // API key intentionally not set

        expect(() => configObj.loadConfig()).toThrow(/ANTHROPIC_API_KEY is missing/);
    });

    it('should load anthropic config if key is provided', () => {
        process.env.LLM_PROVIDER = 'anthropic';
        process.env.ANTHROPIC_API_KEY = 'test_key';

        const config = configObj.loadConfig();

        expect(config.llm.provider).toBe('anthropic');
        expect(config.llm.anthropicModel).toBe('claude-3-5-sonnet-20241022'); // Default fallback
    });
});
