const LLMProvider = require('./llm_provider');

class OllamaProvider extends LLMProvider {
  constructor(url = process.env.OLLAMA_URL || 'http://localhost:11434/api/chat', model = process.env.OLLAMA_MODEL || 'qwen2.5:7b-instruct') {
    super();
    this.url = url;
    this.model = model;
  }

  async generate(systemPrompt, userMessage) {
    // Using Ollama's native chat API with Node's built-in fetch
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        stream: false,
        format: 'json'
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API returned status ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return data.message.content;
  }
}

module.exports = OllamaProvider;
