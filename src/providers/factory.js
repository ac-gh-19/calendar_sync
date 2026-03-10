const AnthropicProvider = require('./anthropic_provider');
const OllamaProvider = require('./ollama_provider');
const config = require('../config');

/**
 * Initializes the LLM provider based on environment variables.
 * Includes a pre-flight check for Ollama.
 * @returns {Promise<LLMProvider>}
 */
async function getProvider() {
    const providerName = config.llm.provider;
    let provider;

    if (providerName === 'anthropic') {
        provider = new AnthropicProvider();
    } else {
        provider = new OllamaProvider();

        // Pre-flight check: make sure Ollama is actually running
        const ollamaBase = config.llm.ollamaUrl;
        const healthUrl = ollamaBase.replace(/\/api\/chat\/?$/, '') + '/api/tags';
        try {
            const res = await fetch(healthUrl);
            if (!res.ok) throw new Error(`status ${res.status}`);
        } catch (err) {
            console.error(
                `\nOllama is not running at ${ollamaBase}\n` +
                `   To fix this:\n` +
                `     1. Start Ollama:  ollama serve\n` +
                `     2. Pull a model:  ollama pull ${config.llm.ollamaModel}\n` +
                `   Or switch to Anthropic by setting LLM_PROVIDER=anthropic in your .env`
            );
            process.exit(1);
        }
    }
    return provider;
}

module.exports = { getProvider };
