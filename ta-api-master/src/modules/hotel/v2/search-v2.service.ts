import { BadRequestException, Injectable } from '@nestjs/common';
import { SearchService } from '../search/search.service';
import { HotelSearchInitiateDto } from '../search/dtos/hotel-search-initiate.dto';
import { InitiateResultResponse } from '../search/interfaces/initiate-result-response.interface';
import { HotelSearchInitiateV2Dto } from './dtos/hotel-search-initiate-v2.dto';

/**
 * v2 search initiate: checks the city / hotel payload, then runs the same search pipeline as v1
 * (TBO search, star mix ranking, sorting, facets, cache) through HotelV2Module's own SearchService.
 */
@Injectable()
export class SearchV2Service {
    constructor(private readonly searchService: SearchService) {}

    async searchInitiate(apiReqData: HotelSearchInitiateV2Dto, headers: Headers): Promise<InitiateResultResponse> {
        const { searchCriteria } = apiReqData;
        const location = searchCriteria.location;

        const hotelCodes = String(searchCriteria.HotelCodes ?? '')
            .split(',')
            .map((code) => code.trim())
            .filter(Boolean);

        if (hotelCodes.length > 0) {
            // Hotel search: only these hotels are sent to TBO, geoLocation is not used
            searchCriteria.HotelCodes = [...new Set(hotelCodes)].join(',');
            console.log(`[HOTEL-SEARCH-V2] hotel search for ${hotelCodes.length} hotel code(s)`);
        } else {
            // City search: radius search around the selected city's geoLocation
            const latitude = Number(location?.geoLocation?.latitude);
            const longitude = Number(location?.geoLocation?.longitude);
            const hasGeo = Number.isFinite(latitude) && Number.isFinite(longitude) && !(latitude === 0 && longitude === 0);

            if (!hasGeo) {
                throw new BadRequestException({
                    success: false,
                    message: 'Send searchCriteria.location.geoLocation for a city search, or searchCriteria.HotelCodes for a hotel search',
                });
            }

            location.geoLocation = { latitude, longitude };
            delete searchCriteria.HotelCodes;
            console.log(`[HOTEL-SEARCH-V2] city search at ${latitude},${longitude} radius ${location.radius ?? 'default'}km`);
        }

        return this.searchService.searchInitiate(apiReqData as unknown as HotelSearchInitiateDto, headers);
    }
}
