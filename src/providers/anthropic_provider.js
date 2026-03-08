const LLMProvider = require('./llm_provider');

class AnthropicProvider extends LLMProvider {
  constructor(model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514') {
    super();
    this.model = model;
    const Anthropic = require('@anthropic-ai/sdk');
    this.client = new Anthropic();
  }

  async generate(systemPrompt, userMessage) {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: userMessage
        }
      ],
      system: systemPrompt
    });
    return response.content[0].text;
  }
}

module.exports = AnthropicProvider;
