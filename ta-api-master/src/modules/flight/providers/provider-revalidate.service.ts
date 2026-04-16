import { Injectable, NotFoundException } from '@nestjs/common';
import { RevalidateDto } from '../revalidate/dtos/revalidate.dto';
import { RevalidateResponse } from '../revalidate/interfaces/revalidate.interface';
import { ConfigurationService } from '../configuration/configuration.service';

import { TboRevalidateService } from './tbo/tbo-revalidate.service';

@Injectable()
export class ProviderRevalidateService {
    constructor(
        private configService: ConfigurationService,
        private tboRevalidateService: TboRevalidateService,
    ) {}

    /** [@Description: This method is used to revalidate the flight]
     * @author: Prashant Joshi at 23-09-2025 **/
    async providerRevalidate(revalidateReq: RevalidateDto, headers: Headers): Promise<RevalidateResponse> {
        const providerConfig = await this.configService.getConfiguration({ supplierCode: revalidateReq.providerCode.toUpperCase(), mode: '', module: 'Flight' });

        if (!providerConfig) {
            throw new NotFoundException('Provider code is not valid, Check your provider code and try again.');
        }
        const revalidateRequest = [];
        let revalidateResult;

        revalidateRequest['revalidateReq'] = revalidateReq;
        revalidateRequest['providerCred'] = JSON.parse(providerConfig.provider_credentials);
        revalidateRequest['headers'] = headers;

        /* Checking If multi revalidation needed than only using */
        if (revalidateReq.isMultiReValid && revalidateReq.isMultiReValid == true) {
            revalidateResult = this.multiRevalidation(revalidateRequest);
        } else {
            revalidateResult = this.singleRevalidation(revalidateRequest);
        }
        return revalidateResult;
    }

    /** [@Description: This method is used to revalidate the flight]
     * @author: Prashant Joshi at 23-09-2025 **/
    singleRevalidation(revalidateRequest) {
        const { revalidateReq } = revalidateRequest;
        let revalidateResult;

        /* Check for provider code First and transform the request to particular provider */
        switch (revalidateReq.providerCode.toUpperCase()) {
            case 'TBO':
                revalidateResult = this.tboRevalidateService.revalidate(revalidateRequest);
                break;
        }

        return revalidateResult;
    }

    /** [@Description: This method is used to revalidate the flight]
     * @author: Prashant Joshi at 23-09-2025 **/
    async multiRevalidation(revalidateRequest) {
        const { revalidateReq } = revalidateRequest;

        const groupHash = revalidateReq.groupHash ? revalidateReq.groupHash : [];
        let revalidateResult;

        /* Check if groupHash has multiple search */
        if (groupHash.length > 1) {
            for (const element of groupHash) {
                /* Updating the provider Code and Solution ID for the revalidation */
                revalidateReq.providerCode = element.provider;
                revalidateReq.solutionId = element.solutionId;

                /* Update provider credentials as well */
                const providerConfig = await this.configService.getConfiguration({ supplierCode: revalidateReq.providerCode.toUpperCase(), mode: '', module: 'Flight' });

                /* validation to check we get data or not */
                if (!providerConfig) {
                    throw new NotFoundException('Provider code is not valid, Check your provider code and try again.');
                }

                revalidateRequest['providerCred'] = JSON.parse(providerConfig.provider_credentials);

                /* performing revalidation */
                revalidateResult = await this.singleRevalidation(revalidateRequest);

                /* Checking if we received success in revalidation break the loop */
                if (revalidateResult.isValid) {
                    break;
                }
            }
        } else {
            revalidateResult = await this.singleRevalidation(revalidateRequest);
        }
        return revalidateResult;
    }
}
