require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const http = require('http');
const url = require('url');

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const CREDENTIALS_PATH = path.resolve(process.env.GOOGLE_CREDENTIALS_PATH || './credentials.json');
const TOKEN_PATH = path.resolve(process.env.GOOGLE_TOKEN_PATH || './token.json');
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
            process.stdout.write(`\rCreating events... ${created}/${events.length}`);
        } catch (err) {
            failures.push({
                event: event,
                error: err.message,
            });
        }
    }

    console.log(''); // newline after progress

    if (failures.length > 0) {
        console.log(`\nFailed to create ${failures.length} event(s):`);
        for (const f of failures) {
            console.log(`  - ${f.event.title} on ${f.event.date}: ${f.error}`);
        }
    }

    console.log(`Created ${created} of ${events.length} calendar events`);

    return { created, failed: failures };
}

module.exports = { authorize, createEvents };
