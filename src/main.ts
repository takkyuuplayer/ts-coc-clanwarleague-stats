import fs from 'fs'
import util from 'util'
import readline from 'readline'
import { google, sheets_v4 } from 'googleapis'

import { Coc } from './webServices/coc'

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';

// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    // Authorize a client with credentials, then call the Google Sheets API.
    authorize(JSON.parse(content.toString()), listMajors);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials: any, callback: typeof listMajors) {
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getNewToken(oAuth2Client, callback);
        oAuth2Client.setCredentials(JSON.parse(token.toString()));
        callback(oAuth2Client);
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client: any, callback: typeof listMajors) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err: any, token: any) => {
            if (err) return console.error('Error while trying to retrieve access token', err);
            oAuth2Client.setCredentials(token);
            // Store the token to disk for later program executions
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) return console.error(err);
                console.log('Token stored to', TOKEN_PATH);
            });
            callback(oAuth2Client);
        });
    });
}

/**
 * Prints the names and majors of students in a sample spreadsheet:
 * @see https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */
async function listMajors(auth: any) {
    const client = await util.promisify(fs.readFile)('coc.json')
        .then(content => new Coc(JSON.parse(content.toString()).jwt))
    const clanTag = '#29UQ0802V'

    const leaguegroup = await client.fetchCurrentWarLeague(clanTag)
        .then(response => response.data)
        .catch(console.log);
    // const leaguegroup = await util.promisify(fs.readFile)('test/data/coc-currenwar-leaguegroup.json')
    //     .then(content => JSON.parse(content.toString()))

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheet = await sheets.spreadsheets.create({
        requestBody: Coc.createSpreadsheetRequestBody(clanTag, leaguegroup)
    })
    // const spreadsheet = await sheets.spreadsheets.get({
    //     spreadsheetId: '1P7LOxalE1oA7Qw8GbG6oC5AcryIFXgPDMkaQOVzsC7I',
    // })

    // Initialize sheets
    await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: spreadsheet.data.spreadsheetId,
        requestBody: Coc.initializeSummarySheetRequestBody(leaguegroup),
    })
    await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: spreadsheet.data.spreadsheetId,
        requestBody: Coc.initializeClanSheetRequestBody(leaguegroup),
    })

    // Update War Results
    const members = leaguegroup.clans.reduce((prev: { [playerTag: string]: number }, c: any) => {
        c.members.forEach((m: any, idx: number) => {
            prev[m.tag] = idx + 2
        })
        return prev
    }, {})
    let eachWarResultRequests: Array<sheets_v4.Schema$ValueRange> = []
    for (let idx = 0; idx < leaguegroup.rounds.length; idx++) {
        const round = leaguegroup.rounds[idx]
        if (round.warTags[0] === '#0') {
            break;
        }
        const warResults = await Promise.all(round.warTags.map((warTag: string) => {
            return client.fetchWar(warTag).then(response => response.data);
        }))
        warResults.forEach((warResult: any) => {
            eachWarResultRequests.push(...Coc.updateWarResultDataRequest(members, idx + 1, warResult));
        })
    }
    await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: spreadsheet.data.spreadsheetId,
        requestBody: {
            valueInputOption: "USER_ENTERED",
            data: eachWarResultRequests,
        }
    })

    // Resize Columns
    await sheets.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheet.data.spreadsheetId,
        requestBody: Coc.resizeColumnRequestBody(spreadsheet),
    })

    console.log(spreadsheet.data.spreadsheetUrl)
}