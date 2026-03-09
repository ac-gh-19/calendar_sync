require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const http = require('http');
const url = require('url');

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const CREDENTIALS_PATH = path.resolve(process.env.GOOGLE_CREDENTIALS_PATH || path.join(__dirname, '../config/credentials.json'));
console.log(CREDENTIALS_PATH);
const TOKEN_PATH = path.resolve(process.env.GOOGLE_TOKEN_PATH || path.join(__dirname, '../config/token.json'));
console.log(TOKEN_PATH);
const TIMEZONE = process.env.DEFAULT_TIMEZONE || 'America/Los_Angeles';

/**
 * Creates an authenticated Google OAuth2 client.
 * On first run, opens a browser for authorization and saves the token.
 * On subsequent runs, loads the saved token.
 * @returns {Promise<google.auth.OAuth2>} Authenticated OAuth2 client
 */
async function authorize() {
    if (!fs.existsSync(CREDENTIALS_PATH)) {
        throw new Error(
            `Google credentials file not found at ${CREDENTIALS_PATH}.\n` +
            'Download it from Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID → Download JSON'
        );
    }

    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;

    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, 'http://localhost:3000/oauth2callback');

    // Try loading saved token
    if (fs.existsSync(TOKEN_PATH)) {
        const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
        oAuth2Client.setCredentials(token);
        console.log('Loaded saved Google auth token');
        return oAuth2Client;
    }

    // No saved token — run interactive OAuth flow
    console.log('No saved token found. Starting OAuth authorization flow...');
    const token = await getNewToken(oAuth2Client);
    oAuth2Client.setCredentials(token);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
    console.log('Token saved to', TOKEN_PATH);
    return oAuth2Client;
}

/**
 * Opens browser for OAuth consent and captures the auth code via local server.
 */
function getNewToken(oAuth2Client) {
    return new Promise((resolve, reject) => {
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
        });

        // Start a temporary local server to receive the OAuth callback
        const server = http.createServer(async (req, res) => {
            const queryParams = url.parse(req.url, true).query;

            if (queryParams.code) {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end('<h1>Authorization successful!</h1><p>You can close this tab and return to the terminal.</p>');
                server.close();

                try {
                    const { tokens } = await oAuth2Client.getToken(queryParams.code);
                    resolve(tokens);
                } catch (err) {
                    reject(new Error(`Failed to exchange auth code for token: ${err.message}`));
                }
            }
        });

        server.listen(3000, () => {
            console.log(`\nOpen this URL in your browser to authorize:\n\n${authUrl}\n`);

            // Try to auto-open the browser
            const { exec } = require('child_process');
            const openCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
            exec(`${openCmd} "${authUrl}"`);
        });

        server.on('error', (err) => {
            reject(new Error(`Failed to start local OAuth server on port 3000: ${err.message}`));
        });
    });
}

/**
 * Creates Google Calendar events from expanded event array.
 * Continues on individual failures and reports all errors at the end.
 * @param {google.auth.OAuth2} auth - Authenticated OAuth2 client
 * @param {Array} events - Array of expanded event objects
 * @returns {Promise<{created: number, failed: Array}>} Results summary
 */
async function createEvents(auth, events) {
    const calendar = google.calendar({ version: 'v3', auth });
    const failures = [];
    let created = 0;

    for (let i = 0; i < events.length; i++) {
        const event = events[i];

        const calendarEvent = {
            summary: event.title,
            location: event.location || undefined,
            description: event.description || undefined,
            start: {
                dateTime: `${event.date}T${event.start_time}:00`,
                timeZone: TIMEZONE,
            },
            end: {
                dateTime: `${event.date}T${event.end_time}:00`,
                timeZone: TIMEZONE,
            },
        };

        try {
            await calendar.events.insert({
                calendarId: 'primary',
                resource: calendarEvent,
            });
            created++;
            process.stdout.write(`\rCreating one-off events... ${created}/${events.length}`);
        } catch (err) {
            failures.push({
                event: event,
                error: err.message,
            });
        }
    }

    if (events.length > 0) console.log('');

    return { created, failed: failures };
}

/**
 * Maps day names to RRULE BYDAY abbreviations.
 */
const RRULE_DAY_MAP = {
    sunday: 'SU', monday: 'MO', tuesday: 'TU', wednesday: 'WE',
    thursday: 'TH', friday: 'FR', saturday: 'SA'
};

/**
 * Creates native Google Calendar recurring events using RRULE.
 * Each recurring pattern becomes a single calendar series with exceptions as EXDATE.
 * @param {google.auth.OAuth2} auth - Authenticated OAuth2 client
 * @param {Array} recurringPatterns - Recurring event patterns from LLM
 * @param {Array} exceptions - Exception dates to exclude
 * @param {string} quarterStart - Start date (YYYY-MM-DD)
 * @param {string} quarterEnd - End date (YYYY-MM-DD)
 * @returns {Promise<{created: number, failed: Array}>} Results summary
 */
async function createRecurringEvents(auth, recurringPatterns, exceptions, quarterStart, quarterEnd) {
    const calendar = google.calendar({ version: 'v3', auth });
    const failures = [];
    let created = 0;

    // Format UNTIL date for RRULE (end of day in UTC: YYYYMMDDTHHMMSSZ)
    const untilDate = quarterEnd.replace(/-/g, '') + 'T235959Z';

    for (const pattern of recurringPatterns) {
        // Build BYDAY string (e.g. "MO,WE,FR")
        const byDay = pattern.days
            .map(d => RRULE_DAY_MAP[d.toLowerCase()])
            .filter(Boolean)
            .join(',');

        const timeRegex = /^\d{2}:\d{2}$/;
        const hasValidTime = pattern.start_time && timeRegex.test(pattern.start_time) &&
            pattern.end_time && timeRegex.test(pattern.end_time);

        if (!byDay || !hasValidTime) {
            const reason = !byDay ? 'No valid days' : 'Invalid/missing times';
            failures.push({ event: pattern, error: reason });
            continue;
        }

        // Build recurrence rules
        const recurrence = [`RRULE:FREQ=WEEKLY;BYDAY=${byDay};UNTIL=${untilDate}`];

        // Add exception dates (EXDATE) for this pattern's days
        const patternDayNums = pattern.days.map(d => {
            const map = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
            return map[d.toLowerCase()];
        });

        for (const exc of exceptions) {
            const excDate = new Date(exc.date + 'T00:00:00');
            if (patternDayNums.includes(excDate.getDay())) {
                // EXDATE needs to match the start dateTime exactly
                const excFormatted = exc.date.replace(/-/g, '');
                recurrence.push(`EXDATE;TZID=${TIMEZONE}:${excFormatted}T${pattern.start_time.replace(':', '')}00`);
            }
        }

        // Find the first occurrence date (first matching day on or after quarterStart)
        const startDate = findFirstOccurrence(quarterStart, patternDayNums);
        if (!startDate) {
            failures.push({ event: pattern, error: 'Could not find first occurrence' });
            continue;
        }

        const calendarEvent = {
            summary: pattern.title,
            location: pattern.location || undefined,
            description: pattern.description || undefined,
            start: {
                dateTime: `${startDate}T${pattern.start_time}:00`,
                timeZone: TIMEZONE,
            },
            end: {
                dateTime: `${startDate}T${pattern.end_time}:00`,
                timeZone: TIMEZONE,
            },
            recurrence: recurrence,
        };

        try {
            await calendar.events.insert({
                calendarId: 'primary',
                resource: calendarEvent,
            });
            created++;
            const days = pattern.days.join(', ');
            console.log(`  Created recurring: ${pattern.title} (${days}) — ${created}/${recurringPatterns.length}`);
        } catch (err) {
            failures.push({
                event: pattern,
                error: err.message,
            });
        }
    }

    return { created, failed: failures };
}

/**
 * Finds the first date on or after startDate that falls on one of the target day numbers.
 */
function findFirstOccurrence(startDateStr, targetDayNums) {
    const cursor = new Date(startDateStr + 'T00:00:00');
    for (let i = 0; i < 7; i++) {
        if (targetDayNums.includes(cursor.getDay())) {
            return cursor.toISOString().split('T')[0];
        }
        cursor.setDate(cursor.getDate() + 1);
    }
    return null;
}

module.exports = { authorize, createEvents, createRecurringEvents };
