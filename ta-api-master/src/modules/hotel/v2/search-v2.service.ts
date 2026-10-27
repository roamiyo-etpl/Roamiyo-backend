import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Cacheable } from 'cacheable';
import { SearchService } from '../search/search.service';
import { HotelSearchInitiateDto } from '../search/dtos/hotel-search-initiate.dto';
import { HotelSearchCheckResultsDto } from '../search/dtos/hotel-search-check-results.dto';
import { HotelSearchFiltrationDto } from '../search/dtos/hotel-search-filtration.dto';
import { HotelResult, InitiateResultResponse } from '../search/interfaces/initiate-result-response.interface';
import { TboRepository } from '../providers/tbo/tbo.repository';
import { HotelSearchInitiateV2Dto } from './dtos/hotel-search-initiate-v2.dto';

/**
 * v2 search: checks the city / hotel payload, then runs the same search pipeline as v1
 * (TBO search, star mix ranking, sorting, facets, cache) through HotelV2Module's own SearchService.
 *
 * Hotel search with geoLocation: the selected hotel(s) plus all hotels in the radius are searched,
 * and the selected hotel(s) are pinned on top of every page / sort / filter result of that searchReqId.
 */
@Injectable()
export class SearchV2Service {
    /* Default radius (km) around the selected hotel when the payload has no radius */
    private static readonly HOTEL_SEARCH_DEFAULT_RADIUS_KM = 10;
    /* Pins live as long as a search session can be used */
    private static readonly PINNED_TTL = '2h';
    /* Used to read the complete sorted / filtered list from SearchService before pinning and paginating */
    private static readonly ALL_RESULTS_LIMIT = 100000;

    constructor(
        private readonly searchService: SearchService,
        private readonly tboRepository: TboRepository,
        @Inject('CACHE_INSTANCE') private readonly cache: Cacheable,
    ) {}

    async searchInitiate(apiReqData: HotelSearchInitiateV2Dto, headers: Headers): Promise<InitiateResultResponse> {
        const { searchCriteria } = apiReqData;
        const location = searchCriteria.location;

        const hotelCodes = [
            ...new Set(
                String(searchCriteria.HotelCodes ?? '')
                    .split(',')
                    .map((code) => code.trim())
                    .filter(Boolean),
            ),
        ];

        const latitude = Number(location?.geoLocation?.latitude);
        const longitude = Number(location?.geoLocation?.longitude);
        const hasGeo = Number.isFinite(latitude) && Number.isFinite(longitude) && !(latitude === 0 && longitude === 0);
        if (hasGeo) {
            location.geoLocation = { latitude, longitude };
        }

        let pinnedCodes: string[] = [];

        if (hotelCodes.length > 0 && hasGeo) {
            // Hotel search: selected hotel(s) on top, plus every hotel in the radius around it (same as city search)
            const radius = Number(location.radius) > 0 ? Number(location.radius) : SearchV2Service.HOTEL_SEARCH_DEFAULT_RADIUS_KM;
            const nearbyHotels = await this.tboRepository.findHotelsByCoordinates({ lat: latitude, lng: longitude }, radius);
            const allCodes = [...new Set([...hotelCodes, ...nearbyHotels.map((hotel) => hotel.hotelCode).filter(Boolean)])];

            searchCriteria.HotelCodes = allCodes.join(',');
            pinnedCodes = hotelCodes;
            console.log(`[HOTEL-SEARCH-V2] hotel search: ${hotelCodes.length} selected + ${allCodes.length - hotelCodes.length} nearby hotel(s) within ${radius}km`);
        } else if (hotelCodes.length > 0) {
            // Hotel search without geoLocation: only the selected hotel(s)
            searchCriteria.HotelCodes = hotelCodes.join(',');
            console.log(`[HOTEL-SEARCH-V2] hotel search for ${hotelCodes.length} hotel code(s) only (no geoLocation sent)`);
        } else if (hasGeo) {
            // City search: radius search around the selected city's geoLocation
            delete searchCriteria.HotelCodes;
            console.log(`[HOTEL-SEARCH-V2] city search at ${latitude},${longitude} radius ${location.radius ?? 'default'}km`);
        } else {
            throw new BadRequestException({
                success: false,
                message: 'Send searchCriteria.location.geoLocation for a city search, or searchCriteria.HotelCodes for a hotel search',
            });
        }

        const response = await this.searchService.searchInitiate(apiReqData as unknown as HotelSearchInitiateDto, headers);

        if (pinnedCodes.length === 0 || !response?.searchReqId) {
            return response;
        }

        await this.cache.set(this.pinnedKey(response.searchReqId), pinnedCodes, SearchV2Service.PINNED_TTL);
        if (!response.results?.length) {
            return response;
        }

        const allResults = await this.getAllResults(response.searchReqId, apiReqData.searchSetting.apiEnvironment, {}, apiReqData.sort, headers);
        return this.withPinnedPage(response, allResults, pinnedCodes, 1, apiReqData.searchSetting.pageLimit);
    }

    async searchCheckResults(checkResultsRequest: HotelSearchCheckResultsDto, headers: Headers): Promise<InitiateResultResponse> {
        const response = await this.searchService.searchCheckResults(checkResultsRequest, headers);
        const pinnedCodes = await this.getPinnedCodes(checkResultsRequest.searchReqId);

        if (pinnedCodes.length === 0 || !response?.results?.length) {
            return response;
        }

        const allResults = await this.getAllResults(checkResultsRequest.searchReqId, checkResultsRequest.searchSetting.apiEnvironment, {}, checkResultsRequest.sort, headers);
        return this.withPinnedPage(response, allResults, pinnedCodes, 1, checkResultsRequest.searchSetting.pageLimit);
    }

    async searchFiltration(filtrationRequest: HotelSearchFiltrationDto, headers: Headers): Promise<InitiateResultResponse> {
        const pinnedCodes = await this.getPinnedCodes(filtrationRequest.searchReqId);
        if (pinnedCodes.length === 0) {
            return this.searchService.searchFiltration(filtrationRequest, headers);
        }

        // Filter + sort everything as usual, then pin and paginate here
        const fullResponse = await this.searchService.searchFiltration(
            { ...filtrationRequest, pagination: { page: 1, limit: SearchV2Service.ALL_RESULTS_LIMIT } } as HotelSearchFiltrationDto,
            headers,
        );
        if (!fullResponse?.results?.length) {
            return this.searchService.searchFiltration(filtrationRequest, headers);
        }

        return this.withPinnedPage(fullResponse, fullResponse.results, pinnedCodes, filtrationRequest.pagination?.page || 1, filtrationRequest.pagination?.limit || 20);
    }

    /**
     * Complete filtered + sorted (+ star mix) result list of a search, read through SearchService.searchFiltration
     */
    private async getAllResults(searchReqId: string, apiEnvironment: any, filters: any, sort: any, headers: Headers): Promise<HotelResult[]> {
        const fullResponse = await this.searchService.searchFiltration(
            {
                searchReqId,
                apiEnvironment,
                filters,
                sort: { by: sort?.by, order: sort?.order },
                pagination: { page: 1, limit: SearchV2Service.ALL_RESULTS_LIMIT },
            } as HotelSearchFiltrationDto,
            headers,
        );
        return fullResponse?.results ?? [];
    }

    /**
     * Moves the pinned hotels to the front of the list and returns the requested page of it.
     * Totals do not change: pinned hotels are already part of the list (or filtered out like any other hotel).
     */
    private withPinnedPage(baseResponse: InitiateResultResponse, allResults: HotelResult[], pinnedCodes: string[], requestedPage: number, limit: number): InitiateResultResponse {
        const pinned = pinnedCodes.map((code) => allResults.find((hotel) => String(hotel.hotelId) === code)).filter((hotel): hotel is HotelResult => Boolean(hotel));
        const ordered = [...pinned, ...allResults.filter((hotel) => !pinned.includes(hotel))];

        const pageLimit = Number(limit) > 0 ? Number(limit) : 10;
        const totalPages = Math.ceil(ordered.length / pageLimit) || 1;
        const page = Math.max(1, Math.min(Number(requestedPage) || 1, totalPages));
        const startIndex = (page - 1) * pageLimit;

        return {
            ...baseResponse,
            pagination: {
                ...baseResponse.pagination,
                page,
                limit: pageLimit,
                totalPages,
                totalFilteredResults: ordered.length,
            },
            results: ordered.slice(startIndex, startIndex + pageLimit),
        };
    }

    private async getPinnedCodes(searchReqId: string): Promise<string[]> {
        const pinned = await this.cache.get<string[]>(this.pinnedKey(searchReqId));
        return Array.isArray(pinned) ? pinned : [];
    }

    private pinnedKey(searchReqId: string): string {
        return `HOTEL_V2_PINNED-${searchReqId}`;
    }
}
