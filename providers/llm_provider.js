class LLMProvider {
  /**
   * Generates a response from the LLM based on system and user prompts.
   * @param {string} systemPrompt - The system prompt/instructions.
   * @param {string} userMessage - The user prompt/content.
   * @returns {Promise<string>} The parsed JSON or generated text from the model.
   */
  async generate(systemPrompt, userMessage) {
    throw new Error('generate() must be implemented by subclass');
  }
}

module.exports = LLMProvider;
