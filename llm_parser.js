require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();

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
 * Parses syllabus text using Claude to extract structured schedule data.
 * @param {string} text - Raw syllabus text
 * @param {string} quarterStart - Quarter start date (YYYY-MM-DD)
 * @param {string} quarterEnd - Quarter end date (YYYY-MM-DD)
 * @returns {Promise<Object>} Structured schedule JSON
 */
async function parseSyllabus(text, quarterStart, quarterEnd) {
    let userMessage = `Extract the schedule from this syllabus.\n\nThe academic quarter runs from ${quarterStart} to ${quarterEnd}. Use these dates to resolve any relative date references (e.g. "Week 1" starts on ${quarterStart}).\n\nSyllabus text:\n\n${text}`;

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

    console.log(`Parsed ${parsed.recurring.length} recurring patterns, ${parsed.one_off.length} one-off events, ${parsed.exceptions.length} exceptions`);

    return parsed;
}

module.exports = { parseSyllabus };
