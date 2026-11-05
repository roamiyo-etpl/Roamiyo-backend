import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { ConfigurationService } from '../configuration/configuration.service';
import { FareRuleV2Dto } from './dtos/fare-rule-v2.dto';
import { FareRuleV2Response } from './interfaces/fare-rule-v2.interface';
import { TboFareRuleV11Service } from './tbo/tbo-fare-rule-v11.service';
import { istTime, seconds } from './utils/timing.util';

/** TBO allows at most 10 ResultIndexes per fare rule / upsell flow */
const MAX_SOLUTION_IDS = 10;

/**
 * Flight fare rule v2 (/v2/fare-rule) on TBO Air V11.
 * Credentials and auth token come from the same provider_master TBO row as v1;
 * only the endpoint differs (env TBO_V11_FARERULE_URL). v1 revalidate is not used or changed.
 */
@Injectable()
export class FareRuleV2Service {
    constructor(
        private readonly configService: ConfigurationService,
        private readonly tboFareRuleV11Service: TboFareRuleV11Service,
    ) {}

    /** [@Description: Fare rules (incl. mini fare rules) for the selected result(s)] **/
    async fareRule(fareRuleReq: FareRuleV2Dto, headers: Headers): Promise<FareRuleV2Response> {
        const requestReceivedAt = Date.now();
        const solutionIds = this.getSolutionIds(fareRuleReq.solutionId);
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

        const searchReqId = fareRuleReq.searchReqId || uuid();
        const fareRuleRequest = {
            searchReqId,
            headers,
            providerCred: JSON.parse(tboProvider.provider_credentials),
            trackingId: fareRuleReq.trackingId,
            solutionIds,
            apiRequest: fareRuleReq,
            tokenReqData: { searchReqId },
        };

        const tag = `[FLIGHT-FARERULE-V11][TIMING] reqId=${searchReqId}`;
        console.log(`${tag} request received at ${istTime(requestReceivedAt)} | solutionIds ${solutionIds.length}`);
        const response = await this.tboFareRuleV11Service.fareRule(fareRuleRequest);
        const doneAt = Date.now();
        console.log(`${tag} response ready to send at ${istTime(doneAt)} | total in our API ${seconds(doneAt - requestReceivedAt)} (received ${istTime(requestReceivedAt)})`);

        return response;
    }

    /** [@Description: "OB ||| IB" (revalidate format), ["OB", "IB"] or "OB" -> unique list, order kept] **/
    getSolutionIds(solutionId: string | string[]): string[] {
        const list = Array.isArray(solutionId) ? solutionId : String(solutionId ?? '').split(' ||| ');
        return [...new Set(list.map((id) => String(id ?? '').trim()).filter(Boolean))];
    }
}
