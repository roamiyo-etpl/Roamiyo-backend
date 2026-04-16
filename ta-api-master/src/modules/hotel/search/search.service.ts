import { Injectable, Logger, BadRequestException, HttpException, InternalServerErrorException } from '@nestjs/common';
import { HotelSearchInitiateDto } from './dtos/hotel-search-initiate.dto';
import { HotelSearchCheckResultsDto } from './dtos/hotel-search-check-results.dto';
import { HotelSearchFiltrationDto } from './dtos/hotel-search-filtration.dto';
import { ProvidersSearchService } from '../providers/providers-search.service';
import { HotelResult, InitiateResultResponse } from './interfaces/initiate-result-response.interface';
import { Generic } from 'src/shared/utilities/flight/generic.utility';
import { DateUtility } from 'src/shared/utilities/flight/date.utility';
import { SupplierCredService } from 'src/modules/generic/supplier-credientials/supplier-cred.service';
import { CachingUtility } from 'src/shared/utilities/common/caching.utility';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SearchService {
    private readonly logger = new Logger(SearchService.name);

    constructor(
        private readonly providersSearchService: ProvidersSearchService,
        private supplierCred: SupplierCredService,
        private cachingUtility: CachingUtility,
    ) { }

    async searchInitiate(apiReqData: HotelSearchInitiateDto, headers: Headers): Promise<InitiateResultResponse> {
        try {
            /* Search request validations */
            // Handle both array and single object for rooms
            let roomsArray = apiReqData.searchCriteria.rooms;
            if (!Array.isArray(roomsArray)) {
                roomsArray = [roomsArray];
            }

            if (!roomsArray.some((room) => room.adults >= 1)) {
                throw new BadRequestException('ERR_ADULT_SHOULD_BE_ONE');
            }

            /* Check active provider details */
            const providersData = await this.supplierCred.getActiveProviders(headers);

            /* setting up only provider config in the response */
            const activeProviders: any[] = providersData.map((data) => ({
                providerId: data.provider_id,
                providerCredentials: typeof data.provider_credentials === 'string' ? JSON.parse(data.provider_credentials) : data.provider_credentials,
            }));

            Object.assign(apiReqData, { activeProviders: activeProviders });
            apiReqData['searchReqId'] = uuidv4();
            const results = await this.providersSearchService.searchInitiate(apiReqData, headers);
            // Apply default sorting by price (ascending) before response
            const sortedResults = this.applySorting(results, { by: apiReqData.sort.by || 'price', order: apiReqData.sort.order || 'asc' });

            // Create complete response structure at provider level
            const searchResponse: InitiateResultResponse = this.createCompleteResponse(sortedResults, apiReqData['searchReqId'], {
                ...apiReqData,
                page: 1,
                limit: apiReqData.searchSetting.pageLimit,
                sort: {
                    by: apiReqData.sort.by,
                    order: apiReqData.sort.order,
                },
            });

            const cacheData = {
                ...searchResponse,
                results: sortedResults,
            };

            // Store search results with searchReqId for filtration access
            await this.cachingUtility.setCachedDataBySearchReqId(apiReqData['searchReqId'], cacheData);
            return searchResponse;
        } catch (error) {
            this.logger.error('Hotel search initiation failed:', error);
            throw new Error(`Hotel search initiation failed: ${error.message}`);
        }
    }

    async searchCheckResults(searchCheckResultsRequest: HotelSearchCheckResultsDto, headers: Headers): Promise<InitiateResultResponse> {
        try {
            const { searchReqId, sort } = searchCheckResultsRequest;

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
            });

            return completeResponse;
        } catch (error) {
            this.logger.error('Hotel search check results failed:', error);
            throw new Error(`Hotel search check results failed: ${error.message}`);
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

            // Get cached search results using searchReqId
            const cachedData = await this.cachingUtility.getCachedDataBySearchReqId(searchReqId);

            // Handle no cached data or expired data
            if (!cachedData || !cachedData.data) {
                return this.createEmptyResponse(searchReqId, pagination, filters, sort, 'completed', 'No search results found or search results expired. Please perform a new search.');
            }

            // Parse cached data
            let searchResponse;
            try {
                searchResponse = JSON.parse(cachedData.data);
            } catch (parseError) {
                return this.createEmptyResponse(searchReqId, pagination, filters, sort, 'expired', 'Your search session has expired. Please perform a new search.');
            }

            // Validate search response structure
            if (!searchResponse || !searchResponse.results || !Array.isArray(searchResponse.results)) {
                return this.createEmptyResponse(searchReqId, pagination, filters, sort, 'expired', 'Your search session has expired or is invalid. Please perform a new search.');
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
                status: 'completed' as const,
                message: `Found ${totalFilteredResults} hotels matching your criteria`,
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
            console.log('~ ProvidersSearchService ~ searchFiltration ~ error:', error);
            if (error instanceof HttpException) {
                throw error;
            } else {
                throw new InternalServerErrorException('ERR_FILTRATION_PROCESSING_FAILED');
            }
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
    private createEmptyResponse(searchReqId: string, pagination: any, filters: any, sort: any, status: 'completed' | 'expired', message: string): InitiateResultResponse {
        return {
            searchReqId,
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
    private createCompleteResponse(results: InitiateResultResponse['results'], searchReqId: string, searchReq: any): InitiateResultResponse {
        // Extract pagination parameters
        const page = parseInt(searchReq.page) || 1;
        const limit = parseInt(searchReq.limit) || 10;
        const totalResults = results.length;
        if (!results || results.length === 0) {
            return {
                searchReqId,
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
        return results.sort((a, b) => {
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
    }
}
