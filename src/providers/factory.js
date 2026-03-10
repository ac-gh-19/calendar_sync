const AnthropicProvider = require('./anthropic_provider');
const OllamaProvider = require('./ollama_provider');

/**
 * Initializes the LLM provider based on environment variables.
 * Includes a pre-flight check for Ollama.
 * @returns {Promise<LLMProvider>}
 */
async function getProvider() {
    const providerName = process.env.LLM_PROVIDER?.toLowerCase() || 'ollama';
    let provider;
    
    if (providerName === 'anthropic') {
        provider = new AnthropicProvider();
    } else {
        provider = new OllamaProvider();

        // Pre-flight check: make sure Ollama is actually running
        const ollamaBase = process.env.OLLAMA_URL || 'http://localhost:11434';
        const healthUrl = ollamaBase.replace(/\/api\/chat\/?$/, '') + '/api/tags';
        try {
            const res = await fetch(healthUrl);
            if (!res.ok) throw new Error(`status ${res.status}`);
        } catch (err) {
            console.error(
                `\nOllama is not running at ${ollamaBase}\n` +
                `   To fix this:\n` +
                `     1. Start Ollama:  ollama serve\n` +
                `     2. Pull a model:  ollama pull ${process.env.OLLAMA_MODEL || 'qwen2.5:7b-instruct'}\n` +
                `   Or switch to Anthropic by setting LLM_PROVIDER=anthropic in your .env`
            );
            process.exit(1);
        }
    }
    return provider;
}

module.exports = { getProvider };
