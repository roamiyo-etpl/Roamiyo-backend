import { Inject, Injectable } from '@nestjs/common';
import moment from 'moment';

import { Cacheable } from 'cacheable';
import { CacheResponse } from 'src/shared/interfaces/cache-response.interface';

@Injectable()
export class CachingUtility {
    constructor(@Inject('CACHE_INSTANCE') private readonly client: Cacheable) {}

    async getCachedData(searchRequest, providersName: string, type = null): Promise<CacheResponse> {
        let redisData;
        try {
            /* Generate Search Hash Key */
            let hashKey = this.createHotelKey(searchRequest, providersName);

            redisData = await this.client.get(hashKey);
            if (!redisData) {
                return { data: [], isSearchNeeded: true };
            }

            const redisJSON = JSON.parse(redisData);
            if (!redisJSON) {
                return { data: [], isSearchNeeded: true };
            }

            const fiveMinutesAgo = moment().subtract(5, 'minutes').format('YYYY-MM-DD HH:mm:ss');
            const hourAgo = moment().subtract(120, 'minutes').format('YYYY-MM-DD HH:mm:ss');

            /* Redis Object to be added in the cache */
            const redisObj = {
                providerName: providersName,
                status: 'IN_PROGRESS',
                timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
                response: redisJSON.response,
            };

            /* Data is less than 5 minutes old */
            if (moment(redisJSON.timestamp, 'YYYY-MM-DD HH:mm:ss') > moment(fiveMinutesAgo)) {
                return { data: redisJSON.response, isSearchNeeded: false };
            } else if (moment(redisJSON.timestamp, 'YYYY-MM-DD HH:mm:ss') > moment(hourAgo)) {
                /* Data is not older than 2 hours */
                await this.client.set(hashKey, JSON.stringify(redisObj));
                return { data: redisJSON.response, isSearchNeeded: true };
            } else {
                /* Data is older than 2 hours */
                await this.client.set(hashKey, JSON.stringify(redisObj));
                return { data: [], isSearchNeeded: true };
            }
        } catch (error) {
            return { data: [], isSearchNeeded: true, errorMsg: error, errorData: redisData };
        }
    }

    /**
     * Fetches polling data for check routing API operations
     * @author Pravin Suthar - 24-09-2025
     * @param hashKey - Unique cache key for polling data
     * @returns CacheResponse with polling data or empty array
     */
    async getPollingData(hashKey: string): Promise<CacheResponse> {
        let redisData;
        try {
            redisData = await this.client.get(hashKey);

            if (!redisData) {
                return { data: [] };
            }

            const redisJSON = JSON.parse(redisData);

            if (redisJSON) {
                return { data: redisJSON };
            }

            return { data: [] };
        } catch (error) {
            return { data: [], errorMsg: error, errorData: redisData };
        }
    }

    /**
     * Stores search results or revalidation data in Redis cache
     * @author Pravin Suthar - 24-09-2025
     * @param requestData - Original search request data
     * @param providersName - Provider identifier
     * @param data - Response data to cache
     * @param type - Cache type ('search' or 'revalidate')
     * @returns CacheResponse with success status and hash key
     */
    async setCachedData(requestData, providersName: string, data: string, type: string): Promise<CacheResponse> {
        try {
            /* Generate Search Hash Key */
            let hashKey = '';
            if (type == 'search') {
                hashKey = this.createHotelKey(requestData, providersName);
            } else if (type == 'revalidate') {
                hashKey = this.createHotelRevalidateKey(data, providersName);
            } else {
                return { success: false, errorMsg: 'No redis type set in the request.', errorData: data };
            }

            /* Set data into redis */
            const redisObj = {
                requestData: requestData,
                providerName: providersName,
                status: 'COMPLETE',
                timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
                response: data,
            };

            const valueToStore = JSON.stringify(redisObj);
            await this.client.set(hashKey, valueToStore);

            return { success: true, hashKey: hashKey };
        } catch (error) {
            return { success: false, errorMsg: error, errorData: data };
        }
    }

    /**
     * Generates unique hash key for hotel search cache entries
     * @author Pravin Suthar - 24-09-2025
     * @param searchReq - Search request with criteria and metadata
     * @param providersName - Provider identifier
     * @returns Unique hash key string for cache storage
     */
    createHotelKey(searchReq, providersName: string) {
        const { rooms, checkIn, checkOut, location } = searchReq.searchCriteria;

        const adults = rooms.reduce((acc, room) => acc + room.adults, 0);
        const children = rooms.reduce((acc, room) => acc + room.children, 0);
        const searchType = searchReq?.searchMetadata?.searchType;

        let hashKey = `HOTEL_LIST__${searchType}__DATES-${checkIn}_${checkOut}__PAX-${adults}_${children}__ROOM-${rooms.length || 0}`;

        if (searchType == 'city') {
            hashKey += `__LAT-LNG-${location.geoLocation.latitude}_${location.geoLocation.longitude}`;
        }

        hashKey += `__PROV-${providersName}`;
        return hashKey;
    }

    /**
     * Creates hash key for hotel revalidation cache entries
     * @author Pravin Suthar - 24-09-2025
     * @param providerRes - Provider response with request ID and booking code
     * @param providersName - Provider identifier
     * @returns Unique revalidation hash key string
     */
    createHotelRevalidateKey(providerRes, providersName: string) {
        return `REVALIDATE__REQID-${providerRes.searchReqId}__SOLID-${providerRes?.data?.bookingCode}__PROV-${providersName}`;
    }

    /**
     * Stores search results with search request ID for filtration access
     * @author Pravin Suthar - 25-09-2025
     * @param searchReqId - Unique search request identifier
     * @param searchResponse - Complete search response data
     * @returns CacheResponse with success status
     */
    async setCachedDataBySearchReqId(searchReqId: string, searchResponse: any): Promise<CacheResponse> {
        try {
            const hashKey = `SEARCH_REQ_ID-${searchReqId}`;

            const redisObj = {
                searchReqId: searchReqId,
                status: 'COMPLETE',
                timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
                response: JSON.stringify(searchResponse),
            };

            const valueToStore = JSON.stringify(redisObj);
            await this.client.set(hashKey, valueToStore);

            // Set expiration to 1 hour (3600 seconds)
            await (this.client as any).expire(hashKey, 3600);

            return { success: true, hashKey: hashKey };
        } catch (error) {
            return { success: false, errorMsg: error };
        }
    }

    /**
     * Retrieves cached search data by search request ID
     * @author Pravin Suthar - 25-09-2025
     * @param searchReqId - Unique search request identifier
     * @returns CacheResponse with cached search data
     */
    async getCachedDataBySearchReqId(searchReqId: string): Promise<CacheResponse> {
        try {
            const hashKey = `SEARCH_REQ_ID-${searchReqId}`;
            const redisData = await this.client.get(hashKey);

            if (!redisData) {
                return { data: [], isSearchNeeded: true, errorMsg: 'No cached data found for searchReqId' };
            }

            const redisJSON = JSON.parse(redisData as string);

            if (!redisJSON || !redisJSON.response) {
                return { data: [], isSearchNeeded: true, errorMsg: 'Invalid cache data format' };
            }

            // The response is already a JSON string, so we return it as-is
            return {
                data: redisJSON.response,
                isSearchNeeded: false,
                hashKey: hashKey,
            };
        } catch (error) {
            return {
                data: [],
                isSearchNeeded: true,
                errorMsg: error,
            };
        }
    }

    /**
     * Lists all cache keys matching a pattern (for debugging)
     * @author Pravin Suthar - 25-09-2025
     * @param pattern - Pattern to match (e.g., "SEARCH_REQ_ID-*")
     * @returns Array of matching keys
     */
    async listCacheKeys(pattern: string = '*'): Promise<string[]> {
        try {
            const keys = await (this.client as any).keys(pattern);
            console.log(`🔍 ~ listCacheKeys ~ Found ${keys.length} keys matching pattern: ${pattern}`);
            return keys || [];
        } catch (error) {
            console.error('~ listCacheKeys ~ error:', error);
            return [];
        }
    }
}
