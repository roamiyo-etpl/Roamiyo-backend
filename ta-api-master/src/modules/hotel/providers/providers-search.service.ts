import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { HotelResult } from '../search/interfaces/initiate-result-response.interface';

import { HotelbedsSearchService } from './hotelbeds/hotelbeds-search.service';
import { TboSearchService } from './tbo/tbo-search.service';

@Injectable()
export class ProvidersSearchService {
    constructor(
        private hotelbedsSearchService: HotelbedsSearchService,
        private tboSearchService: TboSearchService,
    ) {}

    async searchInitiate(searchReq, headers: Headers): Promise<HotelResult[]> {
        const { activeProviders } = searchReq;
        const searchRequest = [];
        searchRequest['searchReqId'] = searchReq['searchReqId'];

        try {
            const searchResults: Promise<HotelResult[]>[] = [];

            const activeProvidersName = activeProviders.map((data) => data.providerCredentials.provider);

            const language = headers['language']?.toUpperCase() || 'en';
            Object.assign(searchReq, { currency: headers['currency-preference']?.toUpperCase() || 'USD' });
            Object.assign(searchReq, { language: language });

            /* Get Currency Rates */
            searchRequest['language'] = language;
            searchRequest['searchReq'] = searchReq;

            /* For HOB (Hotelbeds) */
            if (activeProvidersName.indexOf('HOB') !== -1) {
                /* Filtering configuration with HOB only */
                const hobCred = activeProviders.filter((item) => {
                    return item.code == 'HOB';
                });

                let hotelbedsSearchResult;
                searchRequest['assignedId'] = hobCred[0]?.assignedId;
                searchRequest['providerCred'] = hobCred[0]?.providerCredentials;

                // hotelbedsSearchResult = new Promise((resolve) => resolve(this.hotelbedsSearchService.search(searchRequest)));

                searchResults.push(hotelbedsSearchResult);
            }

            /* For TBO */
            if (activeProvidersName.indexOf('TBO') !== -1) {
                // console.log('TBO found');
                /* Filtering configuration with TBO only */
                const tboCred = activeProviders.filter((item) => {
                    return item.providerCredentials.provider == 'TBO';
                });

                if (tboCred.length > 0) {
                    const tboSearchResult = this.tboSearchService.search(searchReq, tboCred[0]?.providerCredentials);
                    searchResults.push(tboSearchResult);
                }
            }

            /* Checking for first come response from the Providers */
            let result: HotelResult[];
            try {
                result = await Promise.race(searchResults);
            } catch (error) {
                console.log('supplier search error', error);
                throw new InternalServerErrorException('ERR_ISSUE_IN_FETCHING_DATA_FROM_PROVIDER');
            }
            const results: HotelResult[] = result;

            return results;
        } catch (error) {
            console.log('supplier search error', error);
            throw new InternalServerErrorException('ERR_ISSUE_IN_FETCHING_DATA_FROM_PROVIDER');
        }
    }
}
