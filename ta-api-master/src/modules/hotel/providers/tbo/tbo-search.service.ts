import { Injectable, BadRequestException } from '@nestjs/common';
import {
    HotelResult,
    HotelSearchRoomOffer,
    HotelSupplement,
} from '../../search/interfaces/initiate-result-response.interface';
import { TboRepository } from './tbo.repository';
import { Repository } from 'typeorm';
import { Http } from 'src/shared/utilities/flight/http.utility';
import { v4 as uuid } from 'uuid';
import { TboHotelAdditionalDetailsEntity } from 'src/modules/dump/hotel/entities/tbo-hotel-additional-details.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { TboHotelImagesEntity } from 'src/modules/dump/hotel/entities/tbo-hotel-images.entity';
import { Generic } from 'src/shared/utilities/flight/generic.utility';
import { throwHotelApiError } from 'src/shared/utilities/hotel/hotel-error.utility';

/**
 * TBO Hotel Search Service
 * Handles hotel search operations using TBO API
 * Enhanced following chatdmc-traveltekpro pattern
 * @author Prashant - TBO Integration
 */
@Injectable()
export class TboSearchService {
    constructor(
        @InjectRepository(TboHotelAdditionalDetailsEntity)
        private readonly hotelDetailsRepository: Repository<TboHotelAdditionalDetailsEntity>,
        @InjectRepository(TboHotelImagesEntity)
        private readonly hotelImagesRepository: Repository<TboHotelImagesEntity>,
        private readonly tboRepository: TboRepository,
    ) {}

    /**
     * Search hotels using TBO API
     * @param searchRequest - Search request parameters
     * @param providerCredentials - TBO provider credentials
     * @returns Promise<HotelResult[]> - Array of hotel results
     */
    async search(searchRequest: any, providerCredentials: any): Promise<HotelResult[]> {
        const searchReqId = searchRequest?.searchReqId || uuid();
        try {
            // Extract search parameters
            const { searchCriteria, currency, searchMetadata, activeProviders } = searchRequest;
            const { checkIn, checkOut, rooms, location } = searchCriteria;
            const { guestNationality } = searchMetadata;

            // Get hotel data from database based on search type
            let hotelData = await this.getHotelDataByLocation(location);

            if (!hotelData || hotelData.length === 0) {
                return [];
            }

            // Extract hotel codes
            const hotelCodes = hotelData.map((hotel) => hotel.hotelCode).filter((code) => code);

            if (hotelCodes.length === 0) {
                return [];
            }

            // Chunk hotel codes for API calls (TBO limit: 95 hotels per request)
            const chunkSize = 95;
            const hotelChunks: string[][] = [];
            for (let i = 0; i < hotelCodes.length; i += chunkSize) {
                hotelChunks.push(hotelCodes.slice(i, i + chunkSize));
            }

            // Prepare TBO API credentials
            const auth = {
                username: providerCredentials.username,
                password: providerCredentials.password,
            };
           
            const endpoint = `${providerCredentials.hotel_url}/Search`;

            const searchPromises = hotelChunks.map((chunk, index) => {
                const chunkRequest = this.createTboSearchRequest({
                    checkIn,
                    checkOut,
                    guestNationality,
                    paxRooms: rooms,
                    hotelCodes: chunk,
                });

                return this.executeSearchWithRetry(chunkRequest, endpoint, auth, index, 'search');
            });

            // Execute all searches in parallel
            const responses = await Promise.allSettled(searchPromises);

            // Process successful responses
            const successfulResponses = responses
                .filter((r) => r.status === 'fulfilled')
                .map((r) => r.value)
                .filter(Boolean);

            if (successfulResponses.length === 0) {
                return [];
            }

            // Convert TBO responses to our standard format
            const convertedResults = await Promise.all(successfulResponses.map((response) => this.convertTboResponseToHotelResult(response, hotelData, searchReqId, searchCriteria, currency)));

            // Flatten and sort results
            const allResults = convertedResults.flat();
            return allResults.sort((a, b) => a.prices.selling - b.prices.selling);
        } catch (error) {
            console.error('TBO Search Service Error:', error);
            throwHotelApiError(error, 'TBO hotel search failed');
        }
    }

    /**
     * Get hotel data from database based on location
     * @param location - Location criteria
     * @returns Promise<any[]> - Array of hotel data
     */
    private async getHotelDataByLocation(location: any): Promise<any[]> {
        const { geoLocation, hotelId, searchKeyword } = location;

        if (hotelId) {
            // Search by specific hotel ID
            const hotel = await this.tboRepository.findHotelByCode(hotelId.toString());
            return hotel ? [hotel] : [];
        }

        if (geoLocation?.latitude && geoLocation?.longitude) {
            // Search by coordinates
            return await this.tboRepository.findHotelsByCoordinates(
                {
                    lat: geoLocation.latitude,
                    lng: geoLocation.longitude,
                },
                location.radius || 50,
            );
        }

        // Search by city/keyword
        return await this.tboRepository.findHotelsByCity(searchKeyword);
    }

    /**
     * Create TBO API search request
     * @param params - Search parameters
     * @returns TBO search request object
     */
    private createTboSearchRequest(params: any): any {
        const { checkIn, checkOut, guestNationality, paxRooms, hotelCodes } = params;

        return {
            CheckIn: checkIn,
            CheckOut: checkOut,
            Filters: {
                Refundable: false,
                NoOfRooms: 0,
                MealType: 0,
                OrderBy: 0,
                StarRating: 0,
                HotelName: null,
            },
            GuestNationality: guestNationality,
            HotelCodes: hotelCodes.join(','),
            IsDetailedResponse: true,
            PaxRooms: paxRooms.map((room) => ({
                Adults: room.adults,
                Children: room.children,
                ChildrenAges: room.childAges || null,
            })),
            ResponseTime: 23.0,
        };
    }

    /**
     * Execute search with retry logic using existing HTTP utility
     * @param request - Search request
     * @param endpoint - API endpoint
     * @param auth - Authentication credentials
     * @param chunkIndex - Chunk index for logging
     * @param maxRetries - Maximum retry attempts
     * @returns Promise<any> - API response
     */
    private async executeSearchWithRetry(request: any, endpoint: string, auth: any, chunkIndex: number, flow: string, maxRetries: number = 2): Promise<any> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await this.makeAuthenticatedRequest('POST', request, endpoint, auth, flow);
                console.log(`TBO Chunk ${chunkIndex} (attempt ${attempt}): ${response?.HotelResult?.length || 0} hotels`);
                return response;
            } catch (error) {
                console.error(`TBO Chunk ${chunkIndex} attempt ${attempt} failed:`, error.message);
                if (attempt === maxRetries) {
                    throw error;
                }
                // Wait before retry (exponential backoff)
                await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
            }
        }
    }

    /**
     * Make authenticated HTTP request to TBO API using existing HTTP utility
     * @param method - HTTP method
     * @param data - Request data
     * @param endpoint - API endpoint
     * @param auth - Authentication credentials
     * @returns Promise<any> - API response
     */
    private async makeAuthenticatedRequest(method: string, data: any, endpoint: string, auth: { username: string; password: string }, flow: string): Promise<any> {
        try {
            const response = await Http.httpRequestTBOHotel(method, endpoint, data, auth, { flow });

            // console.log('TBO Hotel API Response received successfully');
            return response;
        } catch (error) {
            this.handleRequestError(error, endpoint);
            throw error;
        }
    }

    /**
     * Handle HTTP request errors
     * @param error - Axios error object
     * @param endpoint - API endpoint that failed
     */
    private handleRequestError(error: any, endpoint: string): void {
        if (error.response) {
            // The request was made, but the server responded with an error
            console.error(`TBO API Error Response from ${endpoint}:`);
            console.error('Status:', error.response.status);
            console.error('Status Text:', error.response.statusText);
            console.error('Response Data:', error.response.data);
        } else if (error.request) {
            // The request was made, but no response was received
            console.error(`TBO API No Response from ${endpoint}:`);
            console.error('Request Data:', error.request);
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error(`TBO API Setup Error for ${endpoint}:`);
            console.error('Error Message:', error.message);
        }
    }

    /**
     * Convert TBO API response to our standard HotelResult format
     * @param response - TBO API response
     * @param hotelData - Hotel data from database
     * @param searchReqId - Search request ID
     * @returns Promise<HotelResult[]> - Converted hotel results
     */
    private async convertTboResponseToHotelResult(response: any, hotelData: any[], searchReqId: string, searchCriteria: any, currency: string): Promise<HotelResult[]> {
        if (!response?.HotelResult?.length) {
            return [];
        }

        const hotelDataMap = new Map(hotelData.map((h) => [h.hotelCode, h]));

        const hotelResultPromises = response.HotelResult.map(async (hotel: any) => {
            const baseHotel = hotelDataMap.get(hotel.HotelCode) || {
                hotelCode: hotel.HotelCode,
                hotelName: `Hotel ${hotel.HotelCode}`,
                address: hotel.address,
                city: '',
                state: '',
                country: '',
                countryCode: '',
                latitude: 0,
                longitude: 0,
                hotelRating: 0,
            };

            // Process rooms
            const rooms = Array.isArray(hotel.Rooms) ? hotel.Rooms : [];

            if (rooms.length === 0) {
                return this.createHotelResultFromTboData(hotel, baseHotel, null, [], searchReqId, searchCriteria, currency);
            }

            const cheapestRoom = rooms.reduce((min, room) => (room.TotalFare < min.TotalFare ? room : min));

            return this.createHotelResultFromTboData(
                hotel,
                baseHotel,
                cheapestRoom,
                rooms,
                searchReqId,
                searchCriteria,
                currency,
            );
        });
          // Wait for all promises to resolve
       return await Promise.all(hotelResultPromises);

    }

    /**
     * Create HotelResult from TBO data
     * @param tboHotel - TBO hotel data
     * @param baseHotel - Base hotel data from DB
     * @param room - Room data (can be null)
     * @param searchReqId - Search request ID
     * @param searchCriteria - search Criteria for nights room details values
     * @returns HotelResult - Standardized hotel result
     */
    private normalizeSupplements(supplements: unknown): HotelSupplement[][] {
        if (!Array.isArray(supplements)) {
            return [];
        }

        return supplements.map((roomSupplements) => {
            if (!Array.isArray(roomSupplements)) {
                return [];
            }

            return roomSupplements.map((item) => ({
                index: Number(item?.Index ?? item?.index ?? 0),
                type: String(item?.Type ?? item?.type ?? ''),
                description: String(item?.Description ?? item?.description ?? ''),
                price: Number(item?.Price ?? item?.price ?? 0),
                currency: String(item?.Currency ?? item?.currency ?? ''),
            }));
        });
    }

    private mapTboRoomOffer(room: any, providerCurrency: string, preferredCurrency: string): HotelSearchRoomOffer {
        const totalFare = Number(room.TotalFare) || 0;
        const totalTax = Number(room.TotalTax) || 0;

        return {
            bookingCode: room.BookingCode || '',
            name: Array.isArray(room.Name) ? room.Name : room.Name ? [room.Name] : [],
            totalFare: Generic.currencyConversion(totalFare, providerCurrency, preferredCurrency) || 0,
            totalTax: Generic.currencyConversion(totalTax, providerCurrency, preferredCurrency) || 0,
            mealType: room.MealType || '',
            isRefundable: Boolean(room.IsRefundable),
            supplements: this.normalizeSupplements(room.Supplements),
        };
    }

    private async createHotelResultFromTboData(
        tboHotel: any,
        baseHotel: any,
        room: any,
        allRooms: any[],
        searchReqId: string,
        searchCriteria: any,
        currency: string,
    ): Promise<HotelResult> {
        // console.log(tboHotel,"tboHotel");
        const totalFare = room ? Number(room.TotalFare) || 0 : 0;
        const totalTax = room ? Number(room.TotalTax) || 0 : 0;
        const providerCurrency = tboHotel.Currency || 'USD';
        const preferredCurrency = currency;

         // Extract hotel codes for fetching additional data
        const hotelCode = baseHotel.hotelCode;

          // Fetch additional hotel data in parallel
        const [hotelDetailsMap, imagesMap] = await Promise.all([
        // const [ imagesMap] = await Promise.all([
            this.fetchHotelAdditionalDetails(hotelCode),
            this.fetchHotelImages(hotelCode),
        ]);

        const additionalDetails = hotelDetailsMap.size > 0 ? Array.from(hotelDetailsMap.values())[0] : null;

        // console.log(additionalDetails,"additionalDetails",hotelDetailsMap);
        let images = imagesMap.size > 0 ? Array.from(imagesMap.values())[0] : [];
        const hotelImages: string[] = images.map(img => img.url);


        return {
            hotelId: baseHotel.hotelCode,
            hotelRefId: `${baseHotel.hotelCode}_${searchReqId}`,
            name: baseHotel.hotelName,
            address: baseHotel.address || '',
            city: baseHotel.city || '',
            state: baseHotel.state || '',
            country: baseHotel.country || '',
            countryCode: baseHotel.countryCode || '',
            location: {
                lat: Number(baseHotel.latitude) || 0,
                lon: Number(baseHotel.longitude) || 0,
            },
            rating: {
                stars: baseHotel.starRating || 0,
                reviewScore: null,
            },
            nights: this.calculateNights(searchCriteria.checkIn, searchCriteria.checkOut),
            prices: {
                // selling: totalFare,
                selling: Generic.currencyConversion(totalFare, providerCurrency, preferredCurrency) || 0,
                currency: preferredCurrency,
                taxIncluded: true,
                // taxes: totalTax,
                taxes: Generic.currencyConversion(totalTax, providerCurrency, preferredCurrency) || 0,
                priceHash: `TBO_${baseHotel.hotelCode}_${totalFare}_${totalTax}_${searchReqId}`,
            },
            cancellationPolicy: {
                refundable: room?.IsRefundable, // TBO default
                currency: currency,
                penalties: room.CancelPolicies || [],
            },
            images: hotelImages, // TBO doesn't provide images in search
            amenities: additionalDetails?.amenities ||[], // Will be populated from hotel details if needed
            // amenities: [], // Will be populated from hotel details if needed
            poi: additionalDetails?.interestPoints || [], // Points of interest
            neighborhoods: [], // Neighborhoods
            mealType: room?.MealType || '',
            supplements: this.normalizeSupplements(room?.Supplements),
            rooms: allRooms.map((r) => this.mapTboRoomOffer(r, providerCurrency, preferredCurrency)),
            providerID: 'TBO',
            providerCode: 'TBO',
        };
    }

    /**
     * Calculate number of nights between check-in and check-out
     * @param checkIn - Check-in date
     * @param checkOut - Check-out date
     * @returns number - Number of nights
     */
    private calculateNights(checkIn: string, checkOut: string): number {
        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        const diffTime = checkOutDate.getTime() - checkInDate.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }


      /**
     * Fetches additional hotel details from database
     * @author Qamar Ali - 23-10-2025
     * @param hotelCodes - Array of hotel codes to fetch details for
     * @returns Map of hotel codes to their additional details
     */
    private async fetchHotelAdditionalDetails(hotelCode: string): Promise<Map<string, TboHotelAdditionalDetailsEntity>> {
        try {
            const hotel = await this.hotelDetailsRepository.createQueryBuilder('hotel').where('hotel.hotelCode = :hotelCode', { hotelCode }).getOne();

            const hotelDetailsMap = new Map<string, TboHotelAdditionalDetailsEntity>();
            if (hotel) {
                hotelDetailsMap.set(hotel.hotelCode, hotel);
            }

            return hotelDetailsMap;
        } catch (error) {
            console.error('Error fetching hotel additional details:', error);
            return new Map();
        }
    }


    /**
     * Fetches hotel images from database
     * @author Qamar Ali - 23-10-2025
     * @param hotelCodes - Array of hotel codes to fetch images for
     * @returns Map of hotel codes to their images
     */
    private async fetchHotelImages(hotelCode: string): Promise<Map<string, TboHotelImagesEntity[]>> {
        try {
            const hotelImages = await this.hotelImagesRepository
                .createQueryBuilder('image')
                .where('image.hotelCode = :hotelCode', { hotelCode })  // single code match
                .orderBy('image.visualOrder', 'ASC')
                .addOrderBy('image.order', 'ASC')
                .getMany();

             const imagesMap = new Map<string, TboHotelImagesEntity[]>();

            // Since it's a single hotel code, just set all images here
            imagesMap.set(hotelCode, hotelImages);

            return imagesMap;
        } catch (error) {
            console.error('Error fetching hotel images:', error);
            return new Map();
        }
    }
}
