require('dotenv').config();

const LLMProvider = require('./providers/llm_provider');
const logger = require('./logger');

const SYSTEM_PROMPT = `You are a schedule extraction assistant. Given the text of a course syllabus and the quarter date range, extract ALL schedule information into a structured JSON object.

Return ONLY raw JSON — no markdown, no code fences, no preamble, no explanation.

The JSON must follow this exact schema:
{
  "recurring": [
    {
      "title": "string",
      "days": ["monday", "wednesday"],
      "start_time": "HH:MM",
      "end_time": "HH:MM",
      "type": "lecture | office_hours | exam | deadline | lab",
      "location": "string | null",
      "description": "string | null"
    }
  ],
  "one_off": [
    {
      "title": "string",
      "date": "YYYY-MM-DD | null",
      "start_time": "HH:MM",
      "end_time": "HH:MM",
      "type": "lecture | office_hours | exam | deadline | lab",
      "location": "string | null"
    }
  ],
  "exceptions": [
    { "date": "YYYY-MM-DD", "reason": "string" }
  ]
}

Rules:
- Your job is PATTERN EXTRACTION, not event generation. Return recurring patterns (e.g. "days": ["tuesday", "thursday"]), NOT individual event objects for each date.
- Use the provided quarter start and end dates to resolve any relative date references (e.g. "Week 3 Monday", "the second Tuesday of the quarter").
- For one-off events where the exact date cannot be determined even with the quarter dates, set "date" to null.
- For ANY event where the start or end time is not specified or remains "TBD", set "start_time" and "end_time" to null.
- Use 24-hour time format (HH:MM).
- Lowercase day names.
- Include holidays, breaks, or cancelled class dates in "exceptions".
- If no events of a type exist, use an empty array.`;

/**
 * Parses syllabus text using an LLM to extract structured schedule data.
 * @param {LLMProvider} provider - The LLM provider instance
 * @param {string} text - Raw syllabus text
 * @param {string} quarterStart - Quarter start date (YYYY-MM-DD)
 * @param {string} quarterEnd - Quarter end date (YYYY-MM-DD)
 * @returns {Promise<Object>} Structured schedule JSON
 */
async function parseSyllabus(provider, text, quarterStart, quarterEnd) {
  let userMessage = `Extract the schedule from this syllabus.\n\nThe academic quarter runs from ${quarterStart} to ${quarterEnd}. Use these dates to resolve any relative date references (e.g. "Week 1" starts on ${quarterStart}).\n\nSyllabus text:\n\n${text}`;

  logger.debug('Sending syllabus to LLM for parsing...');

  let rawText = '';
  let parsed;
  let attempts = 0;
  const MAX_ATTEMPTS = 2;

  while (attempts < MAX_ATTEMPTS) {
    try {
      rawText = await provider.generate(SYSTEM_PROMPT, userMessage);
      logger.debug(`LLM Raw Output (first 200 chars): ${rawText.substring(0, 200)}...`);
    } catch (err) {
      logger.error('LLM generation error', err);
      throw new Error(`LLM generation error: ${err.message}`);
    }

    // Parse JSON response
    try {
      parsed = JSON.parse(rawText);
      break; // Success, exit retry loop
    } catch (err) {
      attempts++;
      const modelName = provider.constructor.name || 'LLM';
      logger.error(`${modelName} returned non-JSON response on attempt ${attempts}`, err);

      if (attempts >= MAX_ATTEMPTS) {
        logger.debug(`Raw response causing failure: ${rawText}`);
        throw new Error(
          `Failed to parse ${modelName} response as JSON: ${err.message}. ` +
          'The model may have included markdown or preamble. Check the raw output in debug.log.'
        );
      }

      logger.debug('Sending malformed output back to LLM for correction...');
      userMessage = `Your previous response was not valid JSON. Here is what you returned:\n\n${rawText}\n\nPlease return only valid JSON matching the required schema. The original syllabus text was:\n\n${text}`;
    }
  }

  // Validate required fields
  if (!Array.isArray(parsed.recurring)) parsed.recurring = [];
  if (!Array.isArray(parsed.one_off)) parsed.one_off = [];
  if (!Array.isArray(parsed.exceptions)) parsed.exceptions = [];

  logger.debug(`Parsed ${parsed.recurring.length} recurring patterns, ${parsed.one_off.length} one-off events, ${parsed.exceptions.length} exceptions`);

  return parsed;
}

module.exports = { parseSyllabus };
