import axios, { AxiosAdapter, AxiosInstance, AxiosPromise } from 'axios'
import qs from 'querystring'

export class Coc {
    private client: AxiosInstance

    constructor(jwt: string) {
        this.client = axios.create({
            baseURL: `https://api.clashofclans.com/v1`,
            headers: {
                'Authorization': `Bearer ${jwt}`
            }
        })
    }

    public fetchCurrentWarLeague(clanTag: string): AxiosPromise {
        const url = `clans/${qs.escape(clanTag)}/currentwar/leaguegroup`
        return this.client.get(url);
    }

    public fetchWar(warTag: string): AxiosPromise {
        return this.client.get(`clanwarleagues/wars/${qs.escape(warTag)}`);
    }
}