import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { ConfigurationService } from '../configuration/configuration.service';
import { StartRoutingV2Dto } from './dtos/start-routing-v2.dto';
import { StartRoutingV2Response } from './interfaces/start-routing-v2.interface';
import { TboSearchV11Service } from './tbo/tbo-search-v11.service';
import { istTime, seconds } from './utils/timing.util';

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

    /** [@Description: Start flight search on TBO V11. Single supplier, so the response is complete] **/
    async startRouting(searchReq: StartRoutingV2Dto, headers: Headers): Promise<StartRoutingV2Response> {
        const requestReceivedAt = Date.now();
        const activeProviders = await this.configService.getActiveProviderList({ module: 'Flight' });
        const providerLoadedAt = Date.now();
        const tboProvider = activeProviders.find((item) => item.code == 'TBO');
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
