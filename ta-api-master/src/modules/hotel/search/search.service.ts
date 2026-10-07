import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HotelSearchInitiateDto } from './dtos/hotel-search-initiate.dto';
import { HotelSearchCheckResultsDto } from './dtos/hotel-search-check-results.dto';
import { HotelSearchFiltrationDto } from './dtos/hotel-search-filtration.dto';
import { ProvidersSearchService } from '../providers/providers-search.service';
import { HotelResult, InitiateResultResponse } from './interfaces/initiate-result-response.interface';
import { Generic } from 'src/shared/utilities/flight/generic.utility';
import { DateUtility } from 'src/shared/utilities/flight/date.utility';
import { SupplierCredService } from 'src/modules/generic/supplier-credientials/supplier-cred.service';
import { CachingUtility } from 'src/shared/utilities/common/caching.utility';
import { HotelProviderUtility } from 'src/shared/utilities/hotel/hotel-provider.utility';
import { throwHotelApiError } from 'src/shared/utilities/hotel/hotel-error.utility';
import { HOTEL_STAR_MIX_PATTERN } from 'src/shared/constants/hotel-ranking.constant';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SearchService {
    private readonly logger = new Logger(SearchService.name);

    /* Early-response search: after this long (from request received) the background search stops waiting for TBO */
    private static readonly SEARCH_HARD_LIMIT_MS = 30000;
    private static readonly SEARCH_IN_PROGRESS_MESSAGE = 'Search in progress, more hotels are loading';

    constructor(
        private readonly providersSearchService: ProvidersSearchService,
        private supplierCred: SupplierCredService,
        private cachingUtility: CachingUtility,
    ) { }

    async searchInitiate(apiReqData: HotelSearchInitiateDto, headers: Headers): Promise<InitiateResultResponse> {
        const requestReceivedAt = Date.now();
        try {
            /* Search request validations */
            // Handle both array and single object for rooms
            let roomsArray = apiReqData.searchCriteria.rooms;
            if (!Array.isArray(roomsArray)) {
                roomsArray = [roomsArray];
            }

            if (!roomsArray.some((room) => room.adults >= 1)) {
                throw new BadRequestException({
                    success: false,
                    message: 'At least one adult is required in the room occupancy',
                });
            }

            /* Check active provider details */
            const providersData = await this.supplierCred.getActiveProviders(headers);

            const activeProviders = HotelProviderUtility.mapActiveProviders(providersData, true);
            const responseMode = HotelProviderUtility.resolveResponseMode(activeProviders);

            Object.assign(apiReqData, { activeProviders: activeProviders });
            apiReqData['searchReqId'] = uuidv4();

            console.log(`[HOTEL-SEARCH] reqId=${apiReqData['searchReqId']} request received at ${new Date(requestReceivedAt).toISOString()}`);
            console.log(`[HOTEL-SEARCH] reqId=${apiReqData['searchReqId']} calling TBO Hotel Search API...`);
            const tboCallStartedAt = Date.now();

            // ResponseTime (seconds) = how long the client waits; TBO itself always gets the full time
            const responseTimeMs = Number(apiReqData.ResponseTime) > 0 ? Number(apiReqData.ResponseTime) * 1000 : 0;
            if (responseTimeMs) {
                return await this.searchWithEarlyResponse(apiReqData, headers, responseMode, responseTimeMs, requestReceivedAt);
            }

            const results = await this.providersSearchService.searchInitiate(apiReqData, headers);
            console.log(`[HOTEL-SEARCH] reqId=${apiReqData['searchReqId']} TBO Hotel Search responded in ${((Date.now() - tboCallStartedAt) / 1000).toFixed(3)}s`);

            const searchResponse = await this.cacheSearchResults(apiReqData, results, responseMode, 'completed');

            console.log(`[HOTEL-SEARCH] reqId=${apiReqData['searchReqId']} total time before sending response to client: ${((Date.now() - requestReceivedAt) / 1000).toFixed(3)}s`);

            return searchResponse;
        } catch (error) {
            this.logger.error('Hotel search initiation failed:', error);
            throwHotelApiError(error, 'Hotel search initiation failed');
        }
    }

    /**
     * Sorts results, builds the search response and stores it in cache under searchReqId (used by filtration / check-results)
     */
    private async cacheSearchResults(
        apiReqData: HotelSearchInitiateDto,
        results: HotelResult[],
        responseMode: string,
        status: 'inProgress' | 'completed' | 'failed',
        message?: string,
    ): Promise<InitiateResultResponse> {
        const processingStartedAt = Date.now();
        // Apply requested sort (default price asc), then mix star ratings per HOTEL_STAR_MIX_PATTERN
        const sortedResults = this.applySorting(results, { by: apiReqData.sort.by || 'price', order: apiReqData.sort.order || 'asc' });

        // Create complete response structure at provider level
        let searchResponse: InitiateResultResponse = this.createCompleteResponse(sortedResults, apiReqData['searchReqId'], {
            ...apiReqData,
            page: 1,
            limit: apiReqData.searchSetting.pageLimit,
            sort: {
                by: apiReqData.sort.by,
                order: apiReqData.sort.order,
            },
        }, responseMode);
        if (status !== 'completed') {
            searchResponse = { ...searchResponse, status, message: message ?? searchResponse.message };
        }
        console.log(`[HOTEL-SEARCH] reqId=${apiReqData['searchReqId']} sorting + response processing took ${((Date.now() - processingStartedAt) / 1000).toFixed(3)}s`);

        const cacheData = {
            ...searchResponse,
            results: sortedResults,
        };

        // Store search results with searchReqId for filtration access
        const cacheSaveStartedAt = Date.now();
        await this.cachingUtility.setCachedDataBySearchReqId(apiReqData['searchReqId'], cacheData);
        console.log(`[HOTEL-SEARCH] reqId=${apiReqData['searchReqId']} cache save (${status}, ${sortedResults.length} hotels) completed in ${((Date.now() - cacheSaveStartedAt) / 1000).toFixed(3)}s`);

        return searchResponse;
    }

    /**
     * Responds to the client after ResponseTime with the hotels ready so far (status inProgress),
     * while TBO keeps running in the background. Every chunk that finishes later updates the cache;
     * the last update is saved as completed. Client polls filtration until status is completed.
     * If TBO finishes before ResponseTime, the full result is returned as completed (same as normal search).
     */
    private async searchWithEarlyResponse(
        apiReqData: HotelSearchInitiateDto,
        headers: Headers,
        responseMode: string,
        responseTimeMs: number,
        requestReceivedAt: number,
    ): Promise<InitiateResultResponse> {
        const searchReqId = apiReqData['searchReqId'];
        const tboCallStartedAt = Date.now();
        let latestResults: HotelResult[] = [];
        let respondedEarly = false;
        let finalized = false;

        // Cache writes run one after another so an older partial list never overwrites a newer one
        let saveQueue: Promise<unknown> = Promise.resolve();
        const queueSave = (results: HotelResult[], status: 'inProgress' | 'completed' | 'failed', message?: string) => {
            const job = saveQueue.then(async () => {
                if (finalized) return undefined;
                if (status !== 'inProgress') finalized = true;
                return this.cacheSearchResults(apiReqData, results, responseMode, status, message);
            });
            saveQueue = job.catch((error) => this.logger.error(`[HOTEL-SEARCH] reqId=${searchReqId} cache save failed`, error));
            return job;
        };

        const fullSearch = this.providersSearchService.searchInitiate(apiReqData, headers, (partialResults) => {
            latestResults = partialResults;
            if (respondedEarly) {
                queueSave(partialResults, 'inProgress', SearchService.SEARCH_IN_PROGRESS_MESSAGE);
            }
        });

        let responseTimer: NodeJS.Timeout | undefined;
        const firstOutcome = await Promise.race([
            fullSearch.then((results) => ({ done: true as const, results })),
            new Promise<{ done: false }>((resolve) => {
                responseTimer = setTimeout(() => resolve({ done: false }), responseTimeMs);
            }),
        ]);
        clearTimeout(responseTimer);

        if (firstOutcome.done) {
            console.log(`[HOTEL-SEARCH] reqId=${searchReqId} TBO Hotel Search responded in ${((Date.now() - tboCallStartedAt) / 1000).toFixed(3)}s (within ResponseTime ${responseTimeMs / 1000}s)`);
            const searchResponse = await this.cacheSearchResults(apiReqData, firstOutcome.results, responseMode, 'completed');
            console.log(`[HOTEL-SEARCH] reqId=${searchReqId} total time before sending response to client: ${((Date.now() - requestReceivedAt) / 1000).toFixed(3)}s`);
            return searchResponse;
        }

        // ResponseTime reached: respond with what is ready, keep TBO running in the background
        respondedEarly = true;
        console.log(`[HOTEL-SEARCH] reqId=${searchReqId} ResponseTime ${responseTimeMs / 1000}s reached, responding with ${latestResults.length} hotels (inProgress)`);
        // Nothing is finalized before the early response, so this save always returns a response
        const earlyResponse = (await queueSave(latestResults, 'inProgress', SearchService.SEARCH_IN_PROGRESS_MESSAGE)) as InitiateResultResponse;

        const hardLimitMs = Math.max(0, SearchService.SEARCH_HARD_LIMIT_MS - (Date.now() - requestReceivedAt));
        let hardLimitTimer: NodeJS.Timeout | undefined;
        Promise.race([
            fullSearch.then((results) => ({ results, hitHardLimit: false })),
            new Promise<{ results: HotelResult[]; hitHardLimit: boolean }>((resolve) => {
                hardLimitTimer = setTimeout(() => resolve({ results: latestResults, hitHardLimit: true }), hardLimitMs);
            }),
        ])
            .then(({ results, hitHardLimit }) => {
                clearTimeout(hardLimitTimer);
                console.log(
                    `[HOTEL-SEARCH] reqId=${searchReqId} background search ${hitHardLimit ? `stopped at hard limit ${SearchService.SEARCH_HARD_LIMIT_MS / 1000}s` : 'finished'} after ${((Date.now() - tboCallStartedAt) / 1000).toFixed(3)}s, ${results.length} hotels (completed)`,
                );
                return queueSave(results, 'completed');
            })
            .catch((error) => {
                clearTimeout(hardLimitTimer);
                this.logger.error(`[HOTEL-SEARCH] reqId=${searchReqId} background search failed`, error);
                return latestResults.length > 0
                    ? queueSave(latestResults, 'completed')
                    : queueSave([], 'failed', 'Hotel search failed. Please perform a new search.');
            });

        console.log(`[HOTEL-SEARCH] reqId=${searchReqId} total time before sending response to client: ${((Date.now() - requestReceivedAt) / 1000).toFixed(3)}s`);
        return earlyResponse;
    }

    async searchCheckResults(searchCheckResultsRequest: HotelSearchCheckResultsDto, headers: Headers): Promise<InitiateResultResponse> {
        try {
            const { searchReqId, sort } = searchCheckResultsRequest;
            const providersData = await this.supplierCred.getActiveProviders(headers);
            const fallbackMode = HotelProviderUtility.resolveResponseMode(HotelProviderUtility.mapActiveProviders(providersData));

            // Get cached search results using searchReqId
            const cachedData = await this.cachingUtility.getCachedDataBySearchReqId(searchReqId);

            // Handle no cached data or expired data
            if (!cachedData || !cachedData.data) {
                return this.createEmptyResponse(
                    searchReqId,
                    { page: 1, limit: searchCheckResultsRequest.searchSetting.pageLimit },
                    {},
                    sort,
                    'completed',
                    'No search results found or search results expired. Please perform a new search.',
                    fallbackMode,
                );
            }

            // Create complete response structure at provider level
            let searchResponse;
            try {
                searchResponse = JSON.parse(cachedData.data);
            } catch (parseError) {
                return this.createEmptyResponse(
                    searchReqId,
                    { page: 1, limit: searchCheckResultsRequest.searchSetting.pageLimit },
                    {},
                    sort,
                    'expired',
                    'Your search session has expired. Please perform a new search.',
                    fallbackMode,
                );
            }

            // Validate search response structure
            if (!searchResponse || !searchResponse.results || !Array.isArray(searchResponse.results)) {
                return this.createEmptyResponse(
                    searchReqId,
                    { page: 1, limit: searchCheckResultsRequest.searchSetting.pageLimit },
                    {},
                    sort,
                    'expired',
                    'Your search session has expired or is invalid. Please perform a new search.',
                    searchResponse?.mode || fallbackMode,
                );
            }

            // Apply sorting to cached results
            const sortedResults = this.applySorting(searchResponse.results, sort);

            // Create complete response with pagination (same as initiate)
            const completeResponse = this.createCompleteResponse(sortedResults, searchReqId, {
                ...searchCheckResultsRequest,
                page: 1,
                limit: searchCheckResultsRequest.searchSetting.pageLimit,
                sort: {
                    by: sort.by,
                    order: sort.order,
                },
            }, searchResponse.mode || fallbackMode);

            // Search may still be running in the background (early response); report the cached status
            if (searchResponse.status && searchResponse.status !== 'completed') {
                return { ...completeResponse, status: searchResponse.status, message: searchResponse.message };
            }

            return completeResponse;
        } catch (error) {
            this.logger.error('Hotel search check results failed:', error);
            throwHotelApiError(error, 'Hotel search check results failed');
        }
    }

    /**
     * Handles hotel search filtration with sorting and pagination
     * @author Pravin Suthar - 25-09-2025
     * @param filtrationRequest - Filtration request with filters, sort, and pagination
     * @returns Filtered and sorted search results
     */
    async searchFiltration(filtrationRequest: HotelSearchFiltrationDto, headers: Headers): Promise<InitiateResultResponse> {
        try {
            const { searchReqId, sort, pagination } = filtrationRequest;
            let { filters } = filtrationRequest;
            const providersData = await this.supplierCred.getActiveProviders(headers);
            const fallbackMode = HotelProviderUtility.resolveResponseMode(HotelProviderUtility.mapActiveProviders(providersData));

            // Get cached search results using searchReqId
            const cachedData = await this.cachingUtility.getCachedDataBySearchReqId(searchReqId);

            // Handle no cached data or expired data
            if (!cachedData || !cachedData.data) {
                return this.createEmptyResponse(searchReqId, pagination, filters, sort, 'completed', 'No search results found or search results expired. Please perform a new search.', fallbackMode);
            }

            // Parse cached data
            let searchResponse;
            try {
                searchResponse = JSON.parse(cachedData.data);
            } catch (parseError) {
                return this.createEmptyResponse(searchReqId, pagination, filters, sort, 'expired', 'Your search session has expired. Please perform a new search.', fallbackMode);
            }

            // Validate search response structure
            if (!searchResponse || !searchResponse.results || !Array.isArray(searchResponse.results)) {
                return this.createEmptyResponse(searchReqId, pagination, filters, sort, 'expired', 'Your search session has expired or is invalid. Please perform a new search.', searchResponse?.mode || fallbackMode);
            }

            // Get ALL results from cache (not paginated)
            let allResults = [...searchResponse.results];

            // Validate filters object
            if (!filters || typeof filters !== 'object') {
                filters = {} as any;
            }


            // Apply filters to ALL results first
            let filteredResults = this.applyFilters(allResults, filters);


            // console.log(filteredResults, "filteredResults");

            // Apply sorting to ALL filtered results
            filteredResults = this.applySorting(filteredResults, sort);

            // Smart pagination: Use requested page, but validate against available pages
            const requestedPage = pagination.page || 1;
            const limit = pagination.limit || 20;
            const totalFilteredResults = filteredResults.length;
            const totalPages = Math.ceil(totalFilteredResults / limit) || 1;

            // Ensure page is within valid range (1 to totalPages)
            const page = Math.max(1, Math.min(requestedPage, totalPages));

            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedResults = filteredResults.slice(startIndex, endIndex);

            // Create complete response with paginated results
            const completeResponse: InitiateResultResponse = {
                searchReqId,
                mode: searchResponse.mode || fallbackMode,
                // Search may still be running in the background (early response); report the cached status
                status: searchResponse.status || 'completed',
                message: searchResponse.status === 'failed' ? searchResponse.message : `Found ${totalFilteredResults} hotels matching your criteria`,
                timestamp: DateUtility.toISOString(),
                totalResults: allResults.length,
                location: { lat: searchResponse.location.lat, lon: searchResponse.location.lon },
                radiusKm: searchResponse.radiusKm,
                facets: searchResponse.facets,
                pagination: {
                    page: page,
                    limit: limit,
                    totalPages: totalPages,
                    totalFilteredResults: totalFilteredResults,
                },
                results: paginatedResults,
                appliedFilters: {
                    filteredResults: filteredResults.length,
                    priceRange: filters.priceRange as [number, number],
                    starRating: filters.starRating,
                    amenities: filters.amenities,
                    mealTypes: filters.mealTypes,
                    neighborhoods: filters.neighborhoods,
                    poi: filters.poi,
                    cancellation: filters.cancellation,
                    hotelNames: filters.hotelNames,
                },
                appliedSort: {
                    by: sort.by,
                    direction: sort.order,
                },
            };

            return completeResponse;
        } catch (error) {
            this.logger.error('Hotel search filtration failed:', error);
            throwHotelApiError(error, 'Hotel search filtration failed');
        }
    }

    /**
     * Creates an empty response for expired or missing cache data
     * @author Pravin Suthar - 01-10-2025
     * @param searchReqId - Search request ID
     * @param pagination - Pagination parameters
     * @param filters - Filter parameters
     * @param sort - Sort parameters
     * @param status - Response status
     * @param message - Response message
     * @returns Empty InitiateResultResponse object
     */
    private createEmptyResponse(searchReqId: string, pagination: any, filters: any, sort: any, status: 'completed' | 'expired', message: string, mode: string): InitiateResultResponse {
        return {
            searchReqId,
            mode,
            status,
            message,
            timestamp: DateUtility.toISOString(),
            totalResults: 0,
            location: { lat: 0, lon: 0 },
            radiusKm: 0,
            facets: {
                ratings: {},
                price: { min: 0, max: 0, buckets: {} },
                amenities: {},
                poi: {},
                neighborhoods: {},
                mealTypes: {},
                hotelNames: [],
            },
            pagination: {
                page: pagination.page,
                limit: pagination.limit,
                totalPages: 0,
                totalFilteredResults: 0,
            },
            results: [],
            appliedFilters: {
                filteredResults: 0,
                priceRange: filters.priceRange as any,
                starRating: filters.starRating,
                amenities: filters.amenities,
                mealTypes: filters.mealTypes,
                neighborhoods: filters.neighborhoods,
                poi: filters.poi,
                cancellation: filters.cancellation,
                hotelNames: filters.hotelNames,
            },
            appliedSort: {
                by: sort.by,
                direction: sort.order,
            },
        } as InitiateResultResponse;
    }

    /**
     * Creates complete response structure from results array
     * @author Pravin Suthar - 30-09-2025
     * @param results - Array of hotel results from supplier
     * @param searchReqId - Search request ID
     * @param searchReq - Original search request
     * @returns Complete InitiateResultResponse object
     */
    private createCompleteResponse(results: InitiateResultResponse['results'], searchReqId: string, searchReq: any, mode: string): InitiateResultResponse {
        // Extract pagination parameters
        const page = parseInt(searchReq.page) || 1;
        const limit = parseInt(searchReq.limit) || 10;
        const totalResults = results.length;
        if (!results || results.length === 0) {
            return {
                searchReqId,
                mode,
                status: 'completed' as const,
                message: 'No hotels found',
                timestamp: DateUtility.toISOString(),
                totalResults: 0,
                location: { lat: 0, lon: 0 },
                radiusKm: 5,
                facets: {
                    ratings: {},
                    price: { min: 0, max: 0, buckets: {} },
                    amenities: {},
                    poi: {},
                    neighborhoods: {},
                    mealTypes: {},
                    hotelNames: [],
                },
                pagination: { page, limit, totalPages: 0, totalFilteredResults: 0 },
                results: [],
                appliedFilters: {
                    filteredResults: 0,
                    priceRange: [0, 0] as [number, number],
                    starRating: [],
                    amenities: [],
                    mealTypes: [],
                    neighborhoods: [],
                    poi: [],
                    cancellation: [],
                    hotelNames: [],
                },
                appliedSort: { by: searchReq?.sort?.by || ('price' as any), direction: searchReq?.sort?.order || ('asc' as any) },
            };
        }

        // Generate facets from ALL results (for filtering)
        const facets = this.generateFacets(results);

        // Calculate pagination
        const pagination = Generic.calculatePagination(totalResults, page, limit);

        // Get paginated results
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedResults = results.slice(startIndex, endIndex);

        // Get location from first result
        const location = results[0]?.location;

        // Calculate price range from ALL results
        const priceRange = Generic.calculatePriceRange(results, 'selling');

        return {
            searchReqId,
            mode,
            status: 'completed' as const,
            message: 'Search completed successfully',
            timestamp: DateUtility.toISOString(),
            totalResults,
            location,
            radiusKm: 5,
            facets,
            pagination,
            results: paginatedResults, // Only return paginated results
            appliedFilters: {
                filteredResults: paginatedResults.length,
                priceRange,
                starRating: [],
                amenities: [],
                mealTypes: [],
                neighborhoods: [],
                poi: [],
                cancellation: [],
                hotelNames: [],
            },
            appliedSort: {
                by: searchReq?.sort?.by || 'price',
                direction: searchReq?.sort?.order || 'asc',
            },
        };
    }

    /**
     * Generates facets from hotel results
     * @author Pravin Suthar - 30-09-2025
     * @param results - Array of hotel results
     * @returns Facets object with counts
     */
    private generateFacets(results: HotelResult[]): any {
        const ratings: Record<string, number> = {};
        const amenities: Record<string, number> = {};
        const neighborhoods: Record<string, number> = {};
        const mealTypes: Record<string, number> = {};
        const poi: Record<string, number> = {};
        const hotelNames: string[] = [];

        let minPrice = Infinity;
        let maxPrice = -Infinity;

        results.forEach((hotel, index) => {
            // Star ratings
            if (hotel.rating?.stars) {
                const stars = hotel.rating.stars.toString();
                ratings[stars] = (ratings[stars] || 0) + 1;
            }

            // Price range
            if (hotel.prices?.selling) {
                minPrice = Math.min(minPrice, hotel.prices.selling);
                maxPrice = Math.max(maxPrice, hotel.prices.selling);
            }

            // Amenities - each amenity count represents how many hotels have that amenity
            if (hotel.amenities && Array.isArray(hotel.amenities)) {
                const hotelAmenitiesSet = new Set<string>();
                hotel.amenities.forEach((amenity: any) => {
                    const amenityName = amenity?.name || amenity;
                    if (amenityName && typeof amenityName === 'string') {
                        hotelAmenitiesSet.add(amenityName.trim());
                    }
                });

                // Add each unique amenity from this hotel to the facet count
                hotelAmenitiesSet.forEach((amenityName) => {
                    amenities[amenityName] = (amenities[amenityName] || 0) + 1;
                });
            }

            // POI - trim to prevent whitespace issues
            if (hotel.poi && Array.isArray(hotel.poi)) {
                hotel.poi.forEach((poiItem: any) => {
                    // console.log(poiItem,"poiItem")
                    // const poiName = (poiItem.poiName || poiItem.name)?.trim();
                    const poiName = (poiItem || poiItem)?.trim();
                    if (poiName) {
                        poi[poiName] = (poi[poiName] || 0) + 1;
                    }
                    // console.log(poi[poiName]);
                });
            }

            // Neighborhoods - filter out undefined/null values and trim
            if (hotel.neighborhoods && Array.isArray(hotel.neighborhoods)) {
                hotel.neighborhoods.forEach((neighborhood: string) => {
                    const trimmedNeighborhood = neighborhood?.trim();
                    if (trimmedNeighborhood && trimmedNeighborhood !== 'undefined' && trimmedNeighborhood !== 'null') {
                        neighborhoods[trimmedNeighborhood] = (neighborhoods[trimmedNeighborhood] || 0) + 1;
                    }
                });
            }

            // Meal Types - single value per hotel (cheapest room's meal type)
            if (hotel.mealType && typeof hotel.mealType === 'string') {
                const trimmedMealType = hotel.mealType.trim();
                if (trimmedMealType && trimmedMealType !== 'undefined' && trimmedMealType !== 'null' && trimmedMealType !== '') {
                    mealTypes[trimmedMealType] = (mealTypes[trimmedMealType] || 0) + 1;
                }
            } else {
            }

            // Hotel names
            if (hotel.name) {
                hotelNames.push(hotel.name);
            }
        });

        // Get currency from first hotel or default to USD
        const currency = results[0]?.prices?.currency || 'USD';
        const currencySymbol = Generic.getCurrencySymbol(currency);

        // Generate price buckets
        const priceBuckets = Generic.generatePriceBuckets(results, currencySymbol, 'selling');

        return {
            ratings,
            price: {
                min: minPrice === Infinity ? 0 : minPrice,
                max: maxPrice === -Infinity ? 0 : maxPrice,
                currency: currency,
                currencySymbol: currencySymbol,
                buckets: priceBuckets,
            },
            amenities,
            poi,
            neighborhoods,
            mealTypes,
            hotelNames,
        };
    }

    /**
     * Applies all filters to the results array
     * @author Pravin Suthar - 25-09-2025
     * @param results - Array of hotel results
     * @param filters - Filter criteria
     * @returns Filtered results array
     */
    // private applyFilters(results: HotelResult[], filters: any): HotelResult[] {
    //     // Safety checks
    //     // console.log("filter", filters,"results", results[0]);
    //     if (!Array.isArray(results)) {
    //         return [];
    //     }

    //     if (!filters || typeof filters !== 'object') {
    //         return results;
    //     }

    //     // ✅ a. If hotelNames filter is provided → apply only that filter
    //     if (filters.hotelNames && filters.hotelNames.length > 0) {
    //         const names = Array.isArray(filters.hotelNames)
    //         ? filters.hotelNames
    //         : [filters.hotelNames];

    //         return results.filter((hotel) => {
    //             const hotelName = hotel?.name?.trim().toLowerCase() || '';
    //             return names.some((name: string) =>
    //                 hotelName.includes(name.trim().toLowerCase())
    //         );
    //     });
    // }
    // console.log(filters,'filters');


    //     // ✅ b. Otherwise apply all other filters normally (AND logic)
    //     const filteredResults = results.filter((hotel, index) => {
    //         let passed = true;



    //         // Price range filter - supports both numeric range and bucket labels
    //         // if (filters.priceRange && Array.isArray(filters.priceRange)) {
    //         //     const hotelPrice = hotel?.prices?.selling || 0;

    //         //     if (filters.priceRange[0] == '0' && filters.priceRange[1] == '0') {
    //         //         return true;
    //         //     }

    //         //     // Check if it's bucket labels (strings) or numeric range
    //         //     if (typeof filters.priceRange[0] === 'string') {
    //         //         // Bucket labels - check if hotel price falls in ANY of the selected buckets
    //         //         const priceRanges = filters.priceRange.map((bucket: string) => Generic.bucketToRange(bucket));
    //         //         const isInAnyBucket = priceRanges.some(([min, max]) => hotelPrice >= min && hotelPrice <= max);
    //         //         if (!isInAnyBucket) {
    //         //             return false;
    //         //         }
    //         //     } else if (filters.priceRange.length === 2) {
    //         //         // Numeric range
    //         //         const [minPrice, maxPrice] = filters.priceRange as [number, number];
    //         //         if (hotelPrice < minPrice || hotelPrice > maxPrice) {
    //         //             return false;
    //         //         }
    //         //     }
    //         // }


    //         // ✅ 1. Price range filter - supports both numeric range and bucket labels
    //         if (filters.priceRange && Array.isArray(filters.priceRange)) {
    //             const hotelPrice = hotel?.prices?.selling || 0;

    //             if (filters.priceRange[0] == '0' && filters.priceRange[1] == '0') {
    //                 return true;
    //             }

    //             // Check if it's bucket labels (strings) or numeric range
    //             if (typeof filters.priceRange[0] === 'string') {
    //                 const priceRanges = filters.priceRange.map((bucket: string) =>
    //                     Generic.bucketToRange(bucket)
    //                 );
    //                 const isInAnyBucket = priceRanges.some(([min, max]) => hotelPrice >= min && hotelPrice <= max);
    //                 if (!isInAnyBucket) {
    //                     return false;
    //                 }
    //             } else if (filters.priceRange.length === 2) {
    //                 const [minPrice, maxPrice] = filters.priceRange as [number, number];
    //                 if (hotelPrice < minPrice || hotelPrice > maxPrice) {
    //                     return false;
    //                 }
    //             }
    //         }

    //          console.log(filters,'filter price');

    //         // Star rating filter
    //         // if (filters.starRating && Array.isArray(filters.starRating) && filters.starRating.length > 0) {
    //         //     const hotelStars = Number(hotel?.rating?.stars || 0);
    //         //     if (!filters.starRating.includes(hotelStars)) {
    //         //         return false;
    //         //     }
    //         // }

    //         // ✅ 2. Star rating filter (first filter to apply)
    //         if (filters.starRating && Array.isArray(filters.starRating) && filters.starRating.length > 0) {
    //             const hotelStars = Number(hotel?.rating?.stars || 0);
    //             if (!filters.starRating.includes(hotelStars)) {
    //                 return false; // ❌ skip this hotel if not matching star rating
    //             }
    //         }

    //         console.log(filters,'filter stars'); 
    //         // Amenities filter - case-insensitive, trimmed
    //         // if (filters.amenities && Array.isArray(filters.amenities) && filters.amenities.length > 0) {
    //         //     const hotelAmenities = hotel?.amenities?.map((a: any) => a?.name?.trim().toLowerCase()) || [];
    //         //     const hasRequiredAmenities = filters.amenities.every((amenity: string) => hotelAmenities.some((hotelAmenity) => hotelAmenity?.includes(amenity.trim().toLowerCase())));
    //         //     if (!hasRequiredAmenities) {
    //         //         return false;
    //         //     }
    //         // }

    //          // ✅ 3. Amenities filter
    //         if (filters.amenities && Array.isArray(filters.amenities) && filters.amenities.length > 0) {
    //             const hotelAmenities = hotel?.amenities?.map((a: any) => a?.name?.trim().toLowerCase?.() || a?.trim().toLowerCase()) || [];
    //             const hasRequiredAmenities = filters.amenities.every((amenity: string) =>
    //                 hotelAmenities.some((hotelAmenity) =>
    //                     hotelAmenity?.includes(amenity.trim().toLowerCase())
    //                 )
    //             );
    //             if (!hasRequiredAmenities) {
    //                 return false;
    //             }
    //         }

    //         // Meal types filter - single meal type per hotel (cheapest room)
    //         // if (filters.mealTypes && Array.isArray(filters.mealTypes) && filters.mealTypes.length > 0) {
    //         //     const hotelMealType = hotel?.mealType?.trim().toLowerCase() || '';
    //         //     if (!hotelMealType) {
    //         //         return false;
    //         //     }
    //         //     const hasRequiredMealType = filters.mealTypes.some((mealType: string) => hotelMealType.includes(mealType.trim().toLowerCase()));
    //         //     if (!hasRequiredMealType) {
    //         //         return false;
    //         //     }
    //         // }


    //         // ✅ 4. Meal types filter
    //         if (filters.mealTypes && Array.isArray(filters.mealTypes) && filters.mealTypes.length > 0) {
    //             const hotelMealType = hotel?.mealType?.trim().toLowerCase() || '';
    //             if (!hotelMealType) {
    //                 return false;
    //             }
    //             const hasRequiredMealType = filters.mealTypes.some((mealType: string) =>
    //                 hotelMealType.includes(mealType.trim().toLowerCase())
    //             );
    //             if (!hasRequiredMealType) {
    //                 return false;
    //             }
    //         }

    //         // Neighborhoods filter - trimmed and case-insensitive
    //         // if (filters.neighborhoods && Array.isArray(filters.neighborhoods) && filters.neighborhoods.length > 0) {
    //         //     const hotelNeighborhoods = hotel?.neighborhoods?.map((n: string) => n?.trim().toLowerCase()) || [];
    //         //     const hasRequiredNeighborhood = filters.neighborhoods.some((neighborhood: string) =>
    //         //         hotelNeighborhoods.some((hotelNeighborhood) => hotelNeighborhood?.includes(neighborhood.trim().toLowerCase())),
    //         //     );
    //         //     if (!hasRequiredNeighborhood) {
    //         //         return false;
    //         //     }
    //         // }


    //           // ✅ 5. Neighborhoods filter
    //         if (filters.neighborhoods && Array.isArray(filters.neighborhoods) && filters.neighborhoods.length > 0) {
    //             const hotelNeighborhoods = hotel?.neighborhoods?.map((n: string) => n?.trim().toLowerCase()) || [];
    //             const hasRequiredNeighborhood = filters.neighborhoods.some((neighborhood: string) =>
    //                 hotelNeighborhoods.some((hotelNeighborhood) =>
    //                     hotelNeighborhood?.includes(neighborhood.trim().toLowerCase())
    //                 )
    //             );
    //             if (!hasRequiredNeighborhood) {
    //                 return false;
    //             }
    //         }

    //         // POI filter - trimmed and case-insensitive
    //         // if (filters.poi && Array.isArray(filters.poi) && filters.poi.length > 0) {
    //         //     const hotelPOI = hotel?.poi?.map((p: any) => (p?.poiName || p?.name)?.trim().toLowerCase()) || [];
    //         //     const hasRequiredPOI = filters.poi.some((poi: string) => hotelPOI.some((hotelPoi) => hotelPoi?.includes(poi.trim().toLowerCase())));
    //         //     if (!hasRequiredPOI) {
    //         //         return false;
    //         //     }
    //         // }


    //          // ✅ 6. POI filter
    //         if (filters.poi && Array.isArray(filters.poi) && filters.poi.length > 0) {
    //             const hotelPOI = hotel?.poi?.map((p: any) => (p?.poiName || p?.name || p)?.trim().toLowerCase()) || [];
    //             const hasRequiredPOI = filters.poi.some((poi: string) =>
    //                 hotelPOI.some((hotelPoi) =>
    //                     hotelPoi?.includes(poi.trim().toLowerCase())
    //                 )
    //             );
    //             if (!hasRequiredPOI) {
    //                 return false;
    //             }
    //         }

    //         // Cancellation filter
    //         // if (filters.cancellation && Array.isArray(filters.cancellation) && filters.cancellation.length > 0) {
    //         //     const isRefundable = hotel?.cancellationPolicy?.refundable || false;
    //         //     const cancellationType = isRefundable ? 'refundable' : 'non-refundable';
    //         //     if (!filters.cancellation.includes(cancellationType)) {
    //         //         return false;
    //         //     }
    //         // }


    //          // ✅ 7. Cancellation filter
    //         if (filters.cancellation) {
    //             const isRefundable = hotel?.cancellationPolicy?.refundable || false;
    //             const cancellationType = isRefundable ? 'refundable' : 'non-refundable';
    //             const cancellationFilter = Array.isArray(filters.cancellation)
    //                 ? filters.cancellation
    //                 : [filters.cancellation];
    //             if (!cancellationFilter.includes(cancellationType)) {
    //                 return false;
    //             }
    //         }

    //         // Hotel names filter - trimmed and case-insensitive
    //         // if (filters.hotelNames && Array.isArray(filters.hotelNames) && filters.hotelNames.length > 0) {
    //         //     const hotelName = hotel?.name?.trim().toLowerCase() || '';
    //         //     const hasRequiredName = filters.hotelNames.some((name: string) => hotelName.includes(name.trim().toLowerCase()));
    //         //     if (!hasRequiredName) {
    //         //         return false;
    //         //     }
    //         // }


    //         // // ✅ 8. Hotel name filter
    //         // if (filters.hotelNames) {
    //         //     const names = Array.isArray(filters.hotelNames)
    //         //         ? filters.hotelNames
    //         //         : [filters.hotelNames];
    //         //     const hotelName = hotel?.name?.trim().toLowerCase() || '';
    //         //     const hasRequiredName = names.some((name: string) =>
    //         //         hotelName.includes(name.trim().toLowerCase())
    //         //     );
    //         //     if (!hasRequiredName) {
    //         //         return false;
    //         //     }
    //         // }

    //         return passed;
    //     });

    //     return filteredResults;


    // }

    private applyFilters(results: HotelResult[], filters: any): HotelResult[] {
        if (!Array.isArray(results)) {
            return [];
        }

        if (!filters || typeof filters !== 'object') {
            return results;
        }

        // ✅ If hotelNames filter is provided → apply only that filter
        if (filters.hotelNames && filters.hotelNames.length > 0) {
            const names = Array.isArray(filters.hotelNames)
                ? filters.hotelNames
                : [filters.hotelNames];

            results = results.filter((hotel) => {
                const hotelName = hotel?.name?.trim().toLowerCase() || '';
                return names.some((name: string) =>
                    hotelName.includes(name.trim().toLowerCase())
                );
            });
        }

        // ✅ Now apply all other filters (AND logic) to the remaining results
        return results.filter((hotel) => {
            // Price range filter
            if (filters.priceRange && Array.isArray(filters.priceRange) && filters.priceRange.length > 0) {
                const hotelPrice = hotel?.prices?.selling || 0;
                if (filters.priceRange[0] == '0' && filters.priceRange[1] == '0') {
                    return true;
                }

                if (typeof filters.priceRange[0] === 'string') {
                    const priceRanges = filters.priceRange.map((bucket: string) =>
                        Generic.bucketToRange(bucket)
                    );
                    const isInAnyBucket = priceRanges.some(([min, max]) => hotelPrice >= min && hotelPrice <= max);
                    if (!isInAnyBucket) {
                        return false;
                    }
                } else if (filters.priceRange.length === 2) {
                    const [minPrice, maxPrice] = filters.priceRange as [number, number];
                    if (hotelPrice < minPrice || hotelPrice > maxPrice) {
                        return false;
                    }
                }
            }

            // ✅ 1. Star rating filter
            if (filters.starRating && Array.isArray(filters.starRating) && filters.starRating.length > 0) {
                const hotelStars = Number(hotel?.rating?.stars || 0);
                if (!filters.starRating.includes(hotelStars)) {
                    return false;
                }
            }

            // ✅ 2. Amenities filter
            if (filters.amenities && Array.isArray(filters.amenities) && filters.amenities.length > 0) {
                const hotelAmenities = hotel?.amenities?.map((a: any) => a?.name?.trim().toLowerCase?.() || a?.trim().toLowerCase()) || [];
                const hasRequiredAmenities = filters.amenities.every((amenity: string) =>
                    hotelAmenities.some((hotelAmenity) =>
                        hotelAmenity?.includes(amenity.trim().toLowerCase())
                    )
                );
                if (!hasRequiredAmenities) {
                    return false;
                }
            }

            // ✅ 3. Meal types filter
            if (filters.mealTypes && Array.isArray(filters.mealTypes) && filters.mealTypes.length > 0) {
                const hotelMealType = hotel?.mealType?.trim().toLowerCase() || '';
                if (!hotelMealType) {
                    return false;
                }
                const hasRequiredMealType = filters.mealTypes.some((mealType: string) =>
                    hotelMealType.includes(mealType.trim().toLowerCase())
                );
                if (!hasRequiredMealType) {
                    return false;
                }
            }

            // ✅ 4. Neighborhoods filter
            if (filters.neighborhoods && Array.isArray(filters.neighborhoods) && filters.neighborhoods.length > 0) {
                const hotelNeighborhoods = hotel?.neighborhoods?.map((n: string) => n?.trim().toLowerCase()) || [];
                const hasRequiredNeighborhood = filters.neighborhoods.some((neighborhood: string) =>
                    hotelNeighborhoods.some((hotelNeighborhood) =>
                        hotelNeighborhood?.includes(neighborhood.trim().toLowerCase())
                    )
                );
                if (!hasRequiredNeighborhood) {
                    return false;
                }
            }

            // ✅ 5. POI filter
            if (filters.poi && Array.isArray(filters.poi) && filters.poi.length > 0) {
                const hotelPOI = hotel?.poi?.map((p: any) => (p?.poiName || p?.name || p)?.trim().toLowerCase()) || [];
                const hasRequiredPOI = filters.poi.some((poi: string) =>
                    hotelPOI.some((hotelPoi) =>
                        hotelPoi?.includes(poi.trim().toLowerCase())
                    )
                );
                if (!hasRequiredPOI) {
                    return false;
                }
            }

            // ✅ 6. Cancellation filter
            if (filters.cancellation && filters.cancellation.length > 0) {
                const isRefundable = hotel?.cancellationPolicy?.refundable || false;
                const cancellationType = isRefundable ? 'refundable' : 'non-refundable';

                // Directly check if the cancellation type is in the provided filters
                if (!filters.cancellation.includes(cancellationType)) {
                    return false;
                }
            }

            return true; // All filters passed
        });
    }



    /**
     * Applies sorting to the results array
     * @author Pravin Suthar - 02-09-2025
     * @param results - Array of hotel results
     * @param sort - Sort criteria
     * @returns Sorted results array
     */
    private applySorting(results: HotelResult[], sort: any): HotelResult[] {
        const sorted = results.sort((a, b) => {
            let comparison = 0;

            switch (sort.by) {
                case 'price':
                    const priceA = a.prices?.selling || 0;
                    const priceB = b.prices?.selling || 0;
                    comparison = priceA - priceB;
                    break;

                case 'rating':
                    const ratingA = a.rating?.stars || 0;
                    const ratingB = b.rating?.stars || 0;
                    comparison = ratingA - ratingB; // Lower rating first by default (asc)
                    break;

                case 'name':
                    const nameA = a.name || '';
                    const nameB = b.name || '';
                    comparison = nameA.localeCompare(nameB);
                    break;

                case 'distance':
                    const distanceA = Generic.calculateDistance(sort.userLocation?.lat || 0, sort.userLocation?.lon || 0, a.location?.lat || 0, a.location?.lon || 0);
                    const distanceB = Generic.calculateDistance(sort.userLocation?.lat || 0, sort.userLocation?.lon || 0, b.location?.lat || 0, b.location?.lon || 0);
                    comparison = distanceA - distanceB;
                    break;

                default:
                    comparison = 0;
            }

            // Apply sort order
            return sort.order === 'desc' ? -comparison : comparison;
        });

        return sort.by === 'rating' ? sorted : this.applyStarMix(sorted);
    }

    /**
     * Interleaves already-sorted results by star rating following HOTEL_STAR_MIX_PATTERN
     * @param results - Hotel results, already sorted by the requested sort
     * @returns Results reordered into the star mix; ratings outside the pattern are appended at the end
     */
    private applyStarMix(results: HotelResult[]): HotelResult[] {
        const patternStars = [...new Set(HOTEL_STAR_MIX_PATTERN)];
        const buckets = new Map<number, HotelResult[]>(patternStars.map((star) => [star, []]));
        const others: HotelResult[] = [];

        for (const hotel of results) {
            const bucket = buckets.get(Math.floor(hotel.rating?.stars || 0));
            if (bucket) bucket.push(hotel);
            else others.push(hotel);
        }

        const mixed: HotelResult[] = [];
        const mixedTotal = results.length - others.length;
        for (let slot = 0; mixed.length < mixedTotal; slot++) {
            const wanted = HOTEL_STAR_MIX_PATTERN[slot % HOTEL_STAR_MIX_PATTERN.length];
            // Use the wanted rating, or the nearest one still available (ties go to the higher star)
            const star = patternStars
                .filter((s) => buckets.get(s)!.length > 0)
                .sort((a, b) => Math.abs(a - wanted) - Math.abs(b - wanted) || b - a)[0];
            mixed.push(buckets.get(star)!.shift()!);
        }

        return [...mixed, ...others];
    }
}
