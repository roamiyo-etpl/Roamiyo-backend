import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { ConfigurationService } from '../configuration/configuration.service';
import { StartRoutingV2Dto } from './dtos/start-routing-v2.dto';
import { StartRoutingV2Response } from './interfaces/start-routing-v2.interface';
import { TboSearchV11Service } from './tbo/tbo-search-v11.service';
import { istTime, seconds } from './utils/timing.util';
import { ProviderMaster } from 'src/shared/entities/provider-master.entity';

/** TBO provider_master row kept in memory this long, so V11 search skips the DB lookup each time.
 * A change to the row (credentials, active flag) applies within this time. Token is not cached here */
const PROVIDER_CACHE_TTL_MS = 60 * 1000;

/**
 * Flight search v2 (/flight/v2/search/...) on TBO Air V11.
 * Credentials and auth token come from the same provider_master TBO row as v1;
 * only the search endpoint differs (env TBO_V11_SEARCH_URL). v1 search is not used or changed.
 */
@Injectable()
export class SearchV2Service {
    constructor(
        private readonly configService: ConfigurationService,
        private readonly tboSearchV11Service: TboSearchV11Service,
    ) {}

    private tboProviderCache: { row: ProviderMaster; expiresAt: number } | null = null;

    /** [@Description: Active TBO flight provider row, from memory for PROVIDER_CACHE_TTL_MS] **/
    private async getTboProvider(): Promise<ProviderMaster | undefined> {
        if (this.tboProviderCache && this.tboProviderCache.expiresAt > Date.now()) {
            return this.tboProviderCache.row;
        }
        const activeProviders = await this.configService.getActiveProviderList({ module: 'Flight' });
        const row = activeProviders.find((item) => item.code == 'TBO');
        this.tboProviderCache = row ? { row, expiresAt: Date.now() + PROVIDER_CACHE_TTL_MS } : null;
        return row;
    }

    /** [@Description: Start flight search on TBO V11. Single supplier, so the response is complete] **/
    async startRouting(searchReq: StartRoutingV2Dto, headers: Headers): Promise<StartRoutingV2Response> {
        const requestReceivedAt = Date.now();
        const tboProvider = await this.getTboProvider();
        const providerLoadedAt = Date.now();
        if (!tboProvider) {
            throw new ServiceUnavailableException('No active provider found.');
        }

        const searchRequest = [];
        searchRequest['searchReq'] = searchReq;
        searchRequest['searchReqId'] = uuid();
        searchRequest['headers'] = headers;
        searchRequest['providerCred'] = JSON.parse(tboProvider.provider_credentials);

        const tag = `[FLIGHT-SEARCH-V11][TIMING] reqId=${searchRequest['searchReqId']}`;
        console.log(`${tag} request received at ${istTime(requestReceivedAt)} | provider config loaded in ${seconds(providerLoadedAt - requestReceivedAt)}`);
        const response = await this.tboSearchV11Service.search(searchRequest);
        const doneAt = Date.now();
        console.log(`${tag} response ready to send at ${istTime(doneAt)} | total in our API ${seconds(doneAt - requestReceivedAt)} (received ${istTime(requestReceivedAt)})`);

        return response;
    }
}
