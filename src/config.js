if (process.env.NODE_ENV !== 'test') {
    require('dotenv').config();
}
const path = require('path');

/**
 * Validates and loads all required environment variables.
 * Throws descriptive errors if any mandatory ones are missing.
 */
function loadConfig() {
    // 1. LLM Provider configuration
    const llmProvider = (process.env.LLM_PROVIDER || 'ollama').toLowerCase();

    if (llmProvider !== 'anthropic' && llmProvider !== 'ollama') {
        throw new Error(`[Config Error] Invalid LLM_PROVIDER: "${llmProvider}". Must be "anthropic" or "ollama".`);
    }

    if (llmProvider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
        throw new Error(
            '[Config Error] ANTHROPIC_API_KEY is missing.\n' +
            'You selected "anthropic" as the LLM_PROVIDER, but no API key was found.\n' +
            'Please add ANTHROPIC_API_KEY=your-key to your .env file or export it in your terminal.'
        );
    }

    const anthropicModel = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434/api/chat';
    const ollamaModel = process.env.OLLAMA_MODEL || 'qwen2.5:7b-instruct';

    // 2. Google Calendar configuration
    const googleCredentialsPath = path.resolve(
        process.env.GOOGLE_CREDENTIALS_PATH || path.join(__dirname, '../config/credentials.json')
    );
    const googleTokenPath = path.resolve(
        process.env.GOOGLE_TOKEN_PATH || path.join(__dirname, '../config/token.json')
    );

    // 3. App configuration
    const timezone = process.env.DEFAULT_TIMEZONE || 'America/Los_Angeles';

    return {
        llm: {
            provider: llmProvider,
            anthropicModel,
            ollamaUrl,
            ollamaModel,
            // Keep the API key out of the final config object if possible, 
            // but the Anthropic SDK expects us to pass it or it will read process.env implicitly.
            // We validated its existence above.
        },
        google: {
            credentialsPath: googleCredentialsPath,
            tokenPath: googleTokenPath
        },
        timezone
    };
}

// Export a singleton instance of the config
const config = loadConfig();
config.loadConfig = loadConfig; // Expose for testing

module.exports = config;
