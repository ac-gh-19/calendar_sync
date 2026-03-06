require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a schedule extraction assistant. Given the text of a course syllabus, extract ALL schedule information into a structured JSON object.

Return ONLY raw JSON — no markdown, no code fences, no preamble, no explanation.

The JSON must follow this exact schema:
{
  "has_ambiguous_dates": boolean,
  "recurring": [
    {
      "title": "string",
      "days": ["monday", "wednesday"],
      "start_time": "HH:MM",
      "end_time": "HH:MM",
      "type": "lecture | office_hours | exam | deadline",
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
      "type": "ex",
      "location": "string | null",
      "needs_clarification": boolean
    }
  ],
  "exceptions": [
    { "date": "YYYY-MM-DD", "reason": "string" }
  ]
}

Rules:
- Your job is PATTERN EXTRACTION, not event generation. Return recurring patterns (e.g. "days": ["tuesday", "thursday"]), NOT individual event objects for each date.
- Set "has_ambiguous_dates" to true if the syllabus uses relative references like "Week 3 Monday" without specific calendar dates.
- For one-off events where the exact date cannot be determined, set "date" to null and "needs_clarification" to true.
- Use 24-hour time format (HH:MM).
- Lowercase day names.
- Include holidays, breaks, or cancelled class dates in "exceptions".
- If no events of a type exist, use an empty array.`;

/**
 * Parses syllabus text using Claude to extract structured schedule data.
 * @param {string} text - Raw syllabus text
 * @param {string} [quarterStart] - Optional quarter start date (YYYY-MM-DD)
 * @param {string} [quarterEnd] - Optional quarter end date (YYYY-MM-DD)
 * @returns {Promise<Object>} Structured schedule JSON
 */
async function parseSyllabus(text, quarterStart, quarterEnd) {
    let userMessage = `Extract the schedule from this syllabus:\n\n${text}`;

    if (quarterStart && quarterEnd) {
        userMessage += `\n\nThe academic quarter runs from ${quarterStart} to ${quarterEnd}. Use these dates to resolve any relative date references (e.g. "Week 1" starts on ${quarterStart}).`;
    }

    console.log('Sending syllabus to Claude for parsing...');

    const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [
            {
                role: 'user',
                content: userMessage
            }
        ],
        system: SYSTEM_PROMPT
    });

    const rawText = response.content[0].text;

    // Parse JSON response
    let parsed;
    try {
        parsed = JSON.parse(rawText);
    } catch (err) {
        console.error('Claude returned non-JSON response:');
        console.error(rawText.substring(0, 500));
        throw new Error(
            `Failed to parse Claude response as JSON: ${err.message}. ` +
            'The model may have included markdown or preamble. Check the raw output above.'
        );
    }

    // Validate required fields
    if (!Array.isArray(parsed.recurring)) parsed.recurring = [];
    if (!Array.isArray(parsed.one_off)) parsed.one_off = [];
    if (!Array.isArray(parsed.exceptions)) parsed.exceptions = [];
    if (typeof parsed.has_ambiguous_dates !== 'boolean') parsed.has_ambiguous_dates = false;

    const totalEvents = parsed.recurring.length + parsed.one_off.length;
    console.log(`Parsed ${parsed.recurring.length} recurring patterns, ${parsed.one_off.length} one-off events, ${parsed.exceptions.length} exceptions`);

    if (parsed.has_ambiguous_dates) {
        console.log('Ambiguous dates detected — quarter range may be needed for resolution.');
    }

    return parsed;
}

module.exports = { parseSyllabus };
