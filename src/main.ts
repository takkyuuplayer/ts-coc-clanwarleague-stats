import fs from 'fs'
import util from 'util'
import readline from 'readline'
import { google, sheets_v4 } from 'googleapis'

import { Coc } from './webServices/coc'
import { receiveMessageOnPort } from 'worker_threads';
import { content } from 'googleapis/build/src/apis/content'
import { fork } from 'cluster'

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';

const MAX_TH_LEVEL = 13;

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
    const clan = leaguegroup.clans.find((c: any) => c.tag === clanTag)

    const sheets = google.sheets({ version: 'v4', auth });
    // const spreadsheet = await sheets.spreadsheets.create({
    //     requestBody: {
    //         properties: {
    //             title: `${clan.name} (${clan.tag}) / ${leaguegroup.season}`,
    //         },
    //         sheets: [
    //             {
    //                 properties: {
    //                     title: "Summary",
    //                 },
    //             },
    //             ...leaguegroup.clans.map((c: any) => ({ properties: { title: c.name } }))
    //         ]
    //     }
    // })
    const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: '1Ah-LAZLH-IS1Xazs2wYhgLxTGW94Olu7Loq53gU9ACU'
    })
    console.log(spreadsheet)

    // // Update Summary Sheets
    // await sheets.spreadsheets.values.batchUpdate({
    //     spreadsheetId: spreadsheet.data.spreadsheetId,
    //     requestBody: {
    //         valueInputOption: "USER_ENTERED",
    //         data: [
    //             {
    //                 range: "Summary!A1:P9",
    //                 values: [
    //                     [
    //                         "Clan Name",
    //                         "Clan Tag",
    //                         "Members",
    //                         ...Array.from(Array(MAX_TH_LEVEL)).map((_, idx) => `TH${MAX_TH_LEVEL - idx}`)
    //                     ],
    //                     ...leaguegroup.clans.map((c: any) => {
    //                         return [
    //                             c.name,
    //                             c.tag,
    //                             c.members.length,
    //                             ...Array.from(Array(MAX_TH_LEVEL)).map((_, idx) => {
    //                                 const len = c.members.filter((m: any) => m.townHallLevel == (MAX_TH_LEVEL - idx)).length
    //                                 return len === 0 ? undefined : len;
    //                             })
    //                         ]
    //                     })
    //                 ]
    //             }
    //         ],
    //     },
    // })

    // // Initialize Each Clan Sheets
    // const opponentsCount = leaguegroup.clans.length - 1;
    // await sheets.spreadsheets.values.batchUpdate({
    //     spreadsheetId: spreadsheet.data.spreadsheetId,
    //     requestBody: {
    //         valueInputOption: "USER_ENTERED",
    //         data: [
    //             ...leaguegroup.clans.map((c: any) => {
    //                 return {
    //                     range: `${c.name}!A1:L${c.members.length + 1}`,
    //                     values: [
    //                         [
    //                             "Player Name",
    //                             "Player Tag",
    //                             "TH",
    //                             "Stars",
    //                             "Count",
    //                             ...Array.from(Array(opponentsCount)).map((_, idx) => `R${idx + 1}`)
    //                         ],
    //                         ...c.members.map((m: any, idx: number) => {
    //                             return [
    //                                 m.name,
    //                                 m.tag,
    //                                 m.townHallLevel,
    //                                 `=SUM(F${idx + 2}:L${idx + 2})`,
    //                                 `=COUNTA(F${idx + 2}:L${idx + 2})`,
    //                                 ...Array.from(Array(opponentsCount)).map((_, idx) => undefined)
    //                             ]
    //                         })
    //                     ]
    //                 }
    //             })
    //         ],
    //     },
    // })

    // const members = leaguegroup.clans.reduce((prev: { [playerTag: string]: number }, c: any) => {
    //     c.members.forEach((m: any, idx: number) => {
    //         prev[m.tag] = idx + 2
    //     })
    //     return prev
    // }, {})
    // // console.log(members)

    // let eachWarResultRequests: Array<sheets_v4.Schema$ValueRange> = []
    // for (let idx = 0; idx < leaguegroup.rounds.length; idx++) {
    //     const round = leaguegroup.rounds[idx]
    //     if (round.warTags[0] === '#0') {
    //         break;
    //     }

    //     const warResults = await Promise.all(round.warTags.map((warTag: string) => {
    //         return client.fetchWar(warTag).then(response => response.data);
    //     }))
    //     const column = String.fromCharCode('F'.charCodeAt(0) + idx)
    //     warResults.forEach((warResult: any) => {
    //         eachWarResultRequests.push(...warResult.clan.members.map((m: any) => {
    //             const cell = `${column}${members[m.tag]}`
    //             const range = `${warResult.clan.name}!${cell}:${cell}`
    //             return {
    //                 range,
    //                 values: [[m.attacks ? m.attacks[0].stars : "?"]]
    //             }
    //         }))
    //         eachWarResultRequests.push(...warResult.opponent.members.map((m: any) => {
    //             const cell = `${column}${members[m.tag]}`
    //             const range = `${warResult.opponent.name}!${cell}:${cell}`
    //             return {
    //                 range,
    //                 values: [[m.attacks ? m.attacks[0].stars : "?"]]
    //             }
    //         }))
    //     })
    // }
    // await sheets.spreadsheets.values.batchUpdate({
    //     spreadsheetId: spreadsheet.data.spreadsheetId,
    //     requestBody: {
    //         valueInputOption: "USER_ENTERED",
    //         data: eachWarResultRequests,
    //     }
    // })

    // Freeze, Resize sheets.
    await sheets.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheet.data.spreadsheetId,
        requestBody: {
            requests: [
                ...spreadsheet.data.sheets!.map((sheet) => ({
                    autoResizeDimensions: {
                        dimensions: {
                            sheetId: sheet.properties!.sheetId,
                            dimension: "COLUMNS",
                            startIndex: 0,
                            endIndex: 26,
                        }
                    }
                })),
                ...spreadsheet.data.sheets!.map((sheet) => ({
                    updateSheetProperties: {
                        properties: {
                            sheetId: sheet.properties!.sheetId,
                            gridProperties: {
                                frozenRowCount: 1,
                            }
                        },
                        fields: 'gridProperties.frozenRowCount'
                    }
                })),
                ...spreadsheet.data.sheets!
                    .filter(sheet => sheet.properties?.title !== 'Summary')
                    .map((sheet) => ({
                        updateSheetProperties: {
                            properties: {
                                sheetId: sheet.properties!.sheetId,
                                gridProperties: {
                                    frozenColumnCount: 5,
                                },
                            },
                            fields: 'gridProperties.frozenColumnCount'
                        }
                    })),
                ...spreadsheet.data.sheets!
                    .filter(sheet => sheet.properties?.title === 'Summary')
                    .map((sheet) => ({
                        updateSheetProperties: {
                            properties: {
                                sheetId: sheet.properties!.sheetId,
                                gridProperties: {
                                    frozenColumnCount: 3,
                                },
                            },
                            fields: 'gridProperties.frozenColumnCount'
                        }
                    })),
            ]
        }
    })

    // Add Each Clan Sheets
    // const addSheetRequests: Array<sheets_v4.Schema$Request> = leaguegroup.clans.filter((c: any) => {
    //     return spreadsheet.data.sheets?.find(sheet => sheet.properties?.title === c.name) === undefined
    // }).map((c: any) => {
    //     return {
    //         addSheet: {
    //             properties: {
    //                 title: `${c.name}`
    //             }
    //         }
    //     }
    // })
    // if (addSheetRequests.length) {
    //     const addedSheets = await sheets.spreadsheets.batchUpdate({
    //         spreadsheetId: spreadsheet.data.spreadsheetId,
    //         requestBody: {
    //             requests: addSheetRequests
    //         }
    //     })
    //     console.log(addedSheets)
    // }
}