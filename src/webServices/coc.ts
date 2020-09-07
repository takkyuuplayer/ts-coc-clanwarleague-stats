import axios, { AxiosInstance, AxiosPromise } from "axios";
import qs from "querystring";
import { sheets_v4 } from "googleapis";
import { GaxiosResponse } from "gaxios";

const MAX_TH_LEVEL = 13;

const SUMMARY_SHEET_NAME = "Summary";
const SUMMARY_SHEET_HEADER = ["Clan Name", "Clan Tag", "Members"];

const CLAN_SHEET_HEADER = ["Player Name", "Player Tag", "TH", "Stars", "Count"];

export class Coc {
  private client: AxiosInstance;

  constructor(jwt: string) {
    this.client = axios.create({
      baseURL: `https://api.clashofclans.com/v1`,
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    });
  }

  public fetchCurrentWarLeague(clanTag: string): AxiosPromise {
    const url = `clans/${qs.escape(clanTag)}/currentwar/leaguegroup`;
    return this.client.get(url);
  }

  public fetchWar(warTag: string): AxiosPromise {
    return this.client.get(`clanwarleagues/wars/${qs.escape(warTag)}`);
  }

  public static createSpreadsheetRequestBody(
    myClanTag: string,
    leaguegroup: any
  ): sheets_v4.Schema$Spreadsheet {
    const myClan = leaguegroup.clans.find(
      (clan: any) => clan.tag === myClanTag
    );
    return {
      properties: {
        title: `${myClan.name} (${myClan.tag}) / ${leaguegroup.season}`,
      },
      sheets: [
        {
          properties: {
            title: SUMMARY_SHEET_NAME,
            gridProperties: {
              frozenRowCount: 1,
              frozenColumnCount: SUMMARY_SHEET_HEADER.length,
            },
          },
        },
        ...leaguegroup.clans.map((clan: any) => ({
          properties: {
            title: clan.name,
            gridProperties: {
              frozenRowCount: 1,
              frozenColumnCount: CLAN_SHEET_HEADER.length,
            },
          },
        })),
      ],
    };
  }

  public static initializeSummarySheetRequestBody(
    leaguegroup: any
  ): sheets_v4.Schema$BatchUpdateValuesRequest {
    const column = String.fromCharCode(
      "A".charCodeAt(0) + MAX_TH_LEVEL + SUMMARY_SHEET_HEADER.length - 1
    );
    const townhallLevels = Array.from(Array(MAX_TH_LEVEL)).map(
      (_, idx) => MAX_TH_LEVEL - idx
    );
    return {
      valueInputOption: "USER_ENTERED",
      data: [
        {
          range: `${SUMMARY_SHEET_NAME}!A1:${column}${
            leaguegroup.clans.length + 1
          }`,
          values: [
            [
              ...SUMMARY_SHEET_HEADER,
              ...townhallLevels.map((level) => `TH${level}`),
            ],
            ...leaguegroup.clans.map((clan: any) => {
              return [
                clan.name,
                clan.tag,
                clan.members.length,
                ...townhallLevels.map((level) => {
                  const len = clan.members.filter(
                    (member: any) => member.townHallLevel == level
                  ).length;
                  return len === 0 ? undefined : len;
                }),
              ];
            }),
          ],
        },
      ],
    };
  }

  public static initializeClanSheetRequestBody(
    leaguegroup: any
  ): sheets_v4.Schema$BatchUpdateValuesRequest {
    const opponentsCount = leaguegroup.clans.length - 1;
    const rounds = Array.from(Array(opponentsCount)).map(
      (_, idx) => `R${idx + 1}`
    );
    const columnStart = String.fromCharCode(
      "A".charCodeAt(0) + CLAN_SHEET_HEADER.length
    );
    const columnEnd = String.fromCharCode(
      columnStart.charCodeAt(0) + opponentsCount - 1
    );
    return {
      valueInputOption: "USER_ENTERED",
      data: [
        ...leaguegroup.clans.map((clan: any) => {
          return {
            range: `${clan.name}!A1:${columnEnd}${clan.members.length + 1}`,
            values: [
              [...CLAN_SHEET_HEADER, ...rounds],
              ...clan.members.map((m: any, idx: number) => {
                const row = idx + 2;
                return [
                  m.name,
                  m.tag,
                  m.townHallLevel,
                  `=SUM(${columnStart}${row}:${columnEnd}${row})`,
                  `=COUNTA(${columnStart}${row}:${columnEnd}${row})`,
                  ...rounds.map(() => undefined),
                ];
              }),
            ],
          };
        }),
      ],
    };
  }

  public static updateWarResultDataRequest(
    members: { [playerTag: string]: number },
    round: number,
    warResult: any
  ): Array<sheets_v4.Schema$ValueRange> {
    const column = String.fromCharCode("F".charCodeAt(0) + round - 1);
    return [
      ...warResult.clan.members.map((m: any) => {
        const cell = `${column}${members[m.tag]}`;
        const range = `${warResult.clan.name}!${cell}:${cell}`;
        return {
          range,
          values: [[m.attacks ? m.attacks[0].stars : "?"]],
        };
      }),
      ...warResult.opponent.members.map((m: any) => {
        const cell = `${column}${members[m.tag]}`;
        const range = `${warResult.opponent.name}!${cell}:${cell}`;
        return {
          range,
          values: [[m.attacks ? m.attacks[0].stars : "?"]],
        };
      }),
    ];
  }

  public static resizeColumnRequestBody(
    spreadsheet: GaxiosResponse<sheets_v4.Schema$Spreadsheet>
  ) {
    return {
      requests: [
        ...spreadsheet.data.sheets!.map((sheet) => ({
          autoResizeDimensions: {
            dimensions: {
              sheetId: sheet.properties!.sheetId,
              dimension: "COLUMNS",
              startIndex: 0,
              endIndex: 26,
            },
          },
        })),
      ],
    };
  }
}
