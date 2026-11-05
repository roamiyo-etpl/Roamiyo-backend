import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { ConfigurationService } from '../configuration/configuration.service';
import { FareUpsellV2Dto } from './dtos/fare-upsell-v2.dto';
import { FareUpsellV2Response } from './interfaces/fare-upsell-v2.interface';
import { TboFareUpsellV11Service } from './tbo/tbo-fare-upsell-v11.service';
import { istTime, seconds } from './utils/timing.util';

/** TBO FareUpsell accepts at most 10 ResultIndexes per request */
const MAX_SOLUTION_IDS = 10;

/**
 * Flight fare upsell v2 (/v2/fare-upsell) on TBO Air V11.
 * Called after search, before revalidate: the chosen option's solutionId goes to revalidate onwards.
 * Credentials and auth token come from the same provider_master TBO row as v1;
 * only the endpoint differs (env TBO_V11_FAREUPSELL_URL).
 */
@Injectable()
export class FareUpsellV2Service {
    constructor(
        private readonly configService: ConfigurationService,
        private readonly tboFareUpsellV11Service: TboFareUpsellV11Service,
    ) {}

    /** [@Description: Fare options (fare family, inclusions, services) for the selected result(s)] **/
    async fareUpsell(fareUpsellReq: FareUpsellV2Dto, headers: Headers): Promise<FareUpsellV2Response> {
        const requestReceivedAt = Date.now();
        const solutionIds = this.getSolutionIds(fareUpsellReq.solutionId);
        if (!solutionIds.length) {
            throw new BadRequestException('solutionId is required.');
        }
        if (solutionIds.length > MAX_SOLUTION_IDS) {
            throw new BadRequestException(`At most ${MAX_SOLUTION_IDS} solutionIds are allowed.`);
        }

        const activeProviders = await this.configService.getActiveProviderList({ module: 'Flight' });
        const tboProvider = activeProviders.find((item) => item.code == 'TBO');
        if (!tboProvider) {
            throw new ServiceUnavailableException('No active provider found.');
        }

        const searchReqId = fareUpsellReq.searchReqId || uuid();
        const fareUpsellRequest = {
            searchReqId,
            headers,
            providerCred: JSON.parse(tboProvider.provider_credentials),
            trackingId: fareUpsellReq.trackingId,
            solutionIds,
            apiRequest: fareUpsellReq,
            tokenReqData: { searchReqId },
        };

        const tag = `[FLIGHT-FAREUPSELL-V11][TIMING] reqId=${searchReqId}`;
        console.log(`${tag} request received at ${istTime(requestReceivedAt)} | solutionIds ${solutionIds.length}`);
        const response = await this.tboFareUpsellV11Service.fareUpsell(fareUpsellRequest);
        const doneAt = Date.now();
        console.log(`${tag} response ready to send at ${istTime(doneAt)} | total in our API ${seconds(doneAt - requestReceivedAt)} (received ${istTime(requestReceivedAt)})`);

        return response;
    }

    /** [@Description: "A ||| B" (revalidate format), ["A", "B"] or "A" -> unique list, order kept] **/
    getSolutionIds(solutionId: string | string[]): string[] {
        const list = Array.isArray(solutionId) ? solutionId : String(solutionId ?? '').split(' ||| ');
        return [...new Set(list.map((id) => String(id ?? '').trim()).filter(Boolean))];
    }
}
