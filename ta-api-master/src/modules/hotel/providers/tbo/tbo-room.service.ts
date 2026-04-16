import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { HotelRoomResponse } from '../../room/interfaces/room-list-response.interface';
import { HotelRoomQuoteResponse, ValidationInfo } from '../../room/interfaces/room-quote-response.interface';
import { TboRepository } from './tbo.repository';
import { Http } from 'src/shared/utilities/flight/http.utility';
import { v4 as uuid } from 'uuid';
import { TboHotelImagesEntity } from 'src/modules/dump/hotel/entities/tbo-hotel-images.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TboHotelAdditionalDetailsEntity } from 'src/modules/dump/hotel/entities/tbo-hotel-additional-details.entity';
import { Generic } from 'src/shared/utilities/flight/generic.utility';
import { HotelPrice } from '../../search/interfaces/initiate-result-response.interface';

/**
 * TBO Hotel Room Service
 * Handles hotel room operations using TBO API
 * @author Prashant - TBO Room Integration
 */
@Injectable()
export class TboRoomService {
    constructor(
        @InjectRepository(TboHotelImagesEntity)
        private readonly hotelImagesRepository: Repository<TboHotelImagesEntity>,
        @InjectRepository(TboHotelAdditionalDetailsEntity)
        private readonly hotelDetailsRepository: Repository<TboHotelAdditionalDetailsEntity>,
        private readonly tboRepository: TboRepository,
    ) { }

    /**
     * Search hotel rooms using TBO API
     * @param roomRequest - Room search request parameters
     * @param providerCredentials - TBO provider credentials
     * @returns Promise<HotelRoomResponse> - Room search results
     */
    async searchRooms(roomRequest: any, providerCredentials: any): Promise<HotelRoomResponse> {
        const searchReqId = roomRequest.searchReqId || uuid();
        // console.log('TBO Room Search Request:', roomRequest);

        try {
            const { hotelId, currency, supplierCode, checkIn, checkOut, rooms, searchMetadata } = roomRequest;

            // console.log(currency, " check currency")
            // Validate hotel ID
            if (!hotelId) {
                throw new BadRequestException('Hotel ID is required');
            }

            // Get hotel data from database
            const hotelData = await this.tboRepository.findHotelDetailsByHotelCode(hotelId);
            if (!hotelData) {
                throw new BadRequestException('Hotel not found');
            }

            // Prepare TBO API credentials
            const auth = {
                username: providerCredentials.username,
                password: providerCredentials.password,
            };
            const endpoint = `${providerCredentials.hotel_url}/Search`;
            // console.log(endpoint)

            // Create room search request
            const tboRequest = this.createTboRoomSearchRequest({
                hotelId,
                checkIn,
                checkOut,
                rooms,
                searchMetadata,
            });

            // console.log('TBO Room API Request:', tboRequest);

            // Execute room search
            const response = await this.executeRoomSearchWithRetry(tboRequest, endpoint, auth);

            // console.log(response, 'data');
            // Convert TBO response to our standard format
            const roomResponse = this.convertTboRoomResponseToStandard(response, hotelData, searchReqId, rooms, currency);

            return roomResponse;
        } catch (error) {
            console.error('TBO Room Search Service Error:', error);
            throw new InternalServerErrorException('ERR_TBO_ROOM_SEARCH_FAILED');
        }
    }

    /**
     * Get room quote using TBO API
     * @param quoteRequest - Room quote request parameters
     * @param providerCredentials - TBO provider credentials
     * @returns Promise<HotelRoomQuoteResponse> - Room quote result
     */
    async searchRoomQuote(quoteRequest: any, providerCredentials: any): Promise<HotelRoomQuoteResponse> {
        // console.log('TBO Room Quote Request:', quoteRequest);

        try {
            const { roomBookingInfo, currency, searchReqId, supplierCode } = quoteRequest;

            const rateKey = roomBookingInfo[0].rateKey;
            // Validate rate key
            if (!rateKey) {
                throw new BadRequestException('Rate key is required');
            }

            // Prepare TBO API credentials
            const auth = {
                username: providerCredentials.username,
                password: providerCredentials.password,
            };
            const endpoint = `${providerCredentials.hotel_url}/PreBook`;

            // Create quote request
            const tboRequest = {
                BookingCode: rateKey,
            };

            // console.log('TBO Room Quote API Request:', tboRequest, auth);

            // Execute quote request
            const response = await this.executeQuoteWithRetry(tboRequest, endpoint, auth);

            // console.log(response);
            // Convert TBO response to our standard format
            const quoteResponse = this.convertTboQuoteResponseToStandard(response, rateKey, currency, searchReqId, supplierCode);

            return quoteResponse;
        } catch (error) {
            console.error('TBO Room Quote Service Error:', error);
            throw new InternalServerErrorException('ERR_TBO_ROOM_QUOTE_FAILED');
        }
    }

    /**
     * Create TBO API room search request
     * @param params - Search parameters
     * @returns TBO room search request object
     */
    private createTboRoomSearchRequest(params: any): any {
        const { hotelId, checkIn, checkOut, rooms, searchMetadata } = params;
        // console.log(searchMetadata.guestNationality,'guestNationality');

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
            GuestNationality: searchMetadata.guestNationality || 'IN', // Default to India
            HotelCodes: hotelId,
            IsDetailedResponse: true,
            PaxRooms: rooms.map((room) => ({
                Adults: room.adults,
                Children: room.children,
                ChildrenAges: room.childAges || null,
            })),
            ResponseTime: 23.0,
        };
    }

    /**
     * Execute room search with retry logic
     * @param request - Search request
     * @param endpoint - API endpoint
     * @param auth - Authentication credentials
     * @param maxRetries - Maximum retry attempts
     * @returns Promise<any> - API response
     */
    private async executeRoomSearchWithRetry(request: any, endpoint: string, auth: any, maxRetries: number = 2): Promise<any> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await Http.httpRequestTBOHotel('POST', endpoint, request, auth);
                console.log(`TBO Room Search (attempt ${attempt}): ${response?.HotelResult?.length || 0} hotels`);
                return response;
            } catch (error) {
                console.error(`TBO Room Search attempt ${attempt} failed:`, error.message);
                if (attempt === maxRetries) {
                    throw error;
                }
                // Wait before retry (exponential backoff)
                await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
            }
        }
    }

    /**
     * Execute quote request with retry logic
     * @param request - Quote request
     * @param endpoint - API endpoint
     * @param auth - Authentication credentials
     * @param maxRetries - Maximum retry attempts
     * @returns Promise<any> - API response
     */
    private async executeQuoteWithRetry(request: any, endpoint: string, auth: any, maxRetries: number = 2): Promise<any> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await Http.httpRequestTBOHotel('POST', endpoint, request, auth);
                console.log(`TBO Room Quote (attempt ${attempt}): Success`);
                return response;
            } catch (error) {
                console.error(`TBO Room Quote attempt ${attempt} failed:`, error.message);
                if (attempt === maxRetries) {
                    throw error;
                }
                // Wait before retry (exponential backoff)
                await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
            }
        }
    }

    /**
     * Convert TBO API response to our standard HotelRoomResponse format
     * @param response - TBO API response
     * @param hotelData - Hotel data from database
     * @param searchReqId - Search request ID
     * @returns HotelRoomResponse - Standardized room response
     */
    private async convertTboRoomResponseToStandard(response: any, hotelData: any, searchReqId: string, searchReqRoom: any, currency: string): Promise<HotelRoomResponse> {
        if (!response?.HotelResult?.length) {
            return {
                searchReqId,
                message: 'No rooms available',
                roomData: {
                    hotelName: hotelData.hotelName || 'Unknown Hotel',
                    latitude: hotelData.latitude?.toString() || '0',
                    longitude: hotelData.longitude?.toString() || '0',
                    address: hotelData.address || '',
                    city: hotelData.city || '',
                    country: hotelData.country || '',
                    countryCode: hotelData.countryCode || '',
                    roomCount: 0,
                    roomList: [],
                },
                success: false,
            };
        }

        // console.log(response);

        // Calculate totals
        const totalRooms = searchReqRoom.length;
        const totalAdults = searchReqRoom.reduce((sum, room) => sum + room.adults, 0);
        const totalChildren = searchReqRoom.reduce((sum, room) => sum + room.children, 0);

        // Flatten all child ages into a single array
        const allChildAges = searchReqRoom.flatMap(room => room.childAges);

        const hotelCode = hotelData.hotelCode;

        // Fetch additional hotel data in parallel
        const [hotelDetailsMap, imagesMap] = await Promise.all([
            // const [ imagesMap] = await Promise.all([
            this.fetchHotelAdditionalDetails(hotelCode),
            this.fetchHotelImages(hotelCode),
        ]);

        const additionalDetails = hotelDetailsMap.size > 0 ? Array.from(hotelDetailsMap.values())[0] : null;

        let images = imagesMap.size > 0 ? Array.from(imagesMap.values())[0] : [];
        const hotelImages: string[] = images.map((img) => img.url);

        const hotelResult = response.HotelResult[0];
        const rooms = Array.isArray(hotelResult.Rooms) ? hotelResult.Rooms : [];
        const providerCurrency = hotelResult.Currency || 'USD';
        const preferredCurrency = currency;

        const roomList = rooms.map((room, index) => {
            const roomName = Array.isArray(room.Name) ? room.Name.join(', ') : room.Name || `Room ${index + 1}`;
            // const roomName = Array.isArray(room.Name) ? `${room.Name[0]} * ${room.Name.length}` : `Room ${index + 1}`;
            // console.log(room, 'room');

            return {
                options: [
                    {
                        roomName,
                        price: {
                            // selling: Number(room.TotalFare) || 0,
                            selling: Generic.currencyConversion(Number(room.TotalFare), providerCurrency, preferredCurrency) || 0,
                            currency: preferredCurrency,
                            taxIncluded: true,
                            // taxes: Number(room.TotalTax) || 0,
                            taxes: Generic.currencyConversion(Number(room.TotalTax), providerCurrency, preferredCurrency) || 0,
                            // priceHash: `${hotelData.hotelCode}_${room.TotalFare}_${searchReqId}`,
                            priceHash: `TBO_${hotelData.hotelCode}_${Number(room.TotalFare)}_${(room.TotalTax)}_${searchReqId}`,
                        },
                        hotelId: hotelData.hotelCode,
                        // hotelId: hotelResult,
                        roomBookingInfo: [
                            {
                                rateKey: room.BookingCode || '',
                                rooms: totalRooms,
                                adults: totalAdults, // Default
                                children: totalChildren || 0,
                                childAges: allChildAges || [],
                            },
                        ],
                        // rooms: 2,
                        rooms: totalRooms,
                        adults: totalAdults, // Default
                        children: totalChildren || 0,
                        childAges: allChildAges || [],
                        rateType: 'STANDARD',
                        roomCode: room.BookingCode || '',
                        supplierId: 'TBO',
                        supplierCode: 'TBO',
                        boardCode: room.MealType || '',
                        cancellationPolicy: {
                            refundable: room.IsRefundable || false,
                            currency: hotelResult.Currency || 'USD',
                            penalties: room.CancelPolicies || [],
                        },
                        paymentType: 'PREPAID',
                        boardInfo: room.Inclusion || '',
                        roomDetails: {
                            roomCategory: roomName,
                            roomView: '',
                            beds: {
                                suggestedBedType: '',
                                suggestedBedTypeWithoutNumber: '',
                                bedsArr: [],
                            },
                            bathroomType: '',
                            roomArea: {},
                            roomDescription: room.Inclusion || '',
                            propertyType: '',
                            roomFacilities: additionalDetails?.amenities || [],
                            roomImages: hotelImages || [],
                        },
                    },
                ],
                roomName,
                prices: {
                    // selling: Number(room.TotalFare) || 0,
                    selling: Generic.currencyConversion(Number(room.TotalFare), providerCurrency, preferredCurrency) || 0,
                    currency: preferredCurrency,
                    taxIncluded: true,
                    // taxes: Number(room.TotalTax) || 0,
                    taxes: Generic.currencyConversion(Number(room.TotalTax), providerCurrency, preferredCurrency) || 0,
                    // priceHash: `${hotelData.hotelCode}_${room.TotalFare}_${searchReqId}`,
                    priceHash: `TBO_${hotelData.hotelCode}_${Generic.currencyConversion(Number(room.TotalFare), providerCurrency, preferredCurrency)}_${searchReqId}`,
                },
                hotelId: hotelData.hotelCode,
                rateType: 'STANDARD',
                roomBookingInfo: [
                    {
                        rateKey: room.BookingCode || '',
                        rooms: totalRooms,
                        adults: totalAdults, // Default
                        children: totalChildren || 0,
                        childAges: allChildAges || [],
                    },
                ],
                // rooms: 1,
                rooms: totalRooms,
                adults: totalAdults, // Default
                children: totalChildren || 0,
                childAges: allChildAges || [],
                roomCode: room.BookingCode || '',
                supplierId: 'TBO',
                supplierCode: 'TBO',
                supplierRoomName: roomName,
                boardCode: room.MealType || '',
                cancellationPolicy: {
                    refundable: room.IsRefundable || false,
                    currency: hotelResult.Currency || 'USD',
                    penalties: room.CancelPolicies,
                },
                paymentType: 'PREPAID',
                boardInfo: room.Inclusion || '',
            };
        });

        return {
            searchReqId,
            message: 'Rooms fetched successfully',
            roomData: {
                hotelName: hotelData.hotelName || 'Unknown Hotel',
                latitude: hotelData.latitude?.toString() || '0',
                longitude: hotelData.longitude?.toString() || '0',
                address: hotelData.address || '',
                city: hotelData.city || '',
                country: hotelData.country || '',
                countryCode: hotelData.countryCode || '',
                roomCount: roomList.length,
                roomList,
            },
            success: true,
        };
    }

    /**
     * Convert TBO quote response to our standard HotelRoomQuoteResponse format
     * @param response - TBO API response
     * @param rateKey - Rate key used for quote
     * @returns HotelRoomQuoteResponse - Standardized quote response
     */
    private convertTboQuoteResponseToStandard(
        response: any,
        rateKey: string,
        currency: string,
        searchReqId: string,
        supplierCode: string,
    ): HotelRoomQuoteResponse {

        const preferredCurrency = currency;
        const isSuccessful = response?.Status?.Code === 200;

        // Default structure to ensure safe property access
        const hotel = response?.HotelResult?.[0] || {};
        // console.log(hotel?.Rooms?.[0] )
        const rooms = hotel?.Rooms?.[0] || {};
        const providerCurrency = hotel?.Currency || 'USD';

        // Determine converted price safely
        console.log(response);


        // Build common response fields
        const baseResponse: HotelRoomQuoteResponse = {
            rateKey: rateKey,
            searchReqId: searchReqId,
            status: isSuccessful ? 'AVAILABLE' : response?.Status?.Description || 'NOT AVAILABLE',
            ...(isSuccessful ? {
            prices: {
                // selling: Number(room.TotalFare) || 0,
                selling: Generic.currencyConversion(Number(rooms.NetAmount), providerCurrency, preferredCurrency) || 0,
                currency: preferredCurrency,
                taxIncluded: true,
                // taxes: Number(room.TotalTax) || 0,
                taxes: Generic.currencyConversion(Number(rooms.TotalTax), providerCurrency, preferredCurrency) || 0,
                // priceHash: `${hotelData.hotelCode}_${room.TotalFare}_${searchReqId}`,
                priceHash: `${supplierCode}_${hotel.HotelCode}_${Number(rooms.NetAmount)}_${(rooms.NetTax)}_${searchReqId}`,
            },
            // price:Generic.currencyConversion(Number(rooms.NetAmount), providerCurrency, preferredCurrency) || 0,
            cancellationPolicy: {
                refundable: !!rooms?.IsRefundable || false,
                currency: preferredCurrency ||'',
                penalties: rooms?.CancelPolicies || [],
            },
            validationInfo: {
                isPanMandatory: response.ValidationInfo.PanMandatory,
                isPassportMandatory: response.ValidationInfo.PassportMandatory,
                isPanCountRequired: response.ValidationInfo.PanCountRequired,
                isSamePaxNameAllowed: response.ValidationInfo.SamePaxNameAllowed,
                isSpaceAllowed: response.ValidationInfo.SpaceAllowed,
                isSpecialCharAllowed: response.ValidationInfo.SpecialCharAllowed,
                isPaxNameMinLength: response.ValidationInfo.PaxNameMinLength,
                isPaxNameMaxLength: response.ValidationInfo.PaxNameMaxLength,
            },
             } : {}),
             remarks: hotel?.RateConditions || '',
        };

        // If revalidation mode is active, include full revalidate object
        // if (revalidate === 'revalidate') {
        //     return {
        //         ...baseResponse,
        //         revalidate: response,
        //     };
        // }

        return baseResponse;
    }

    /**
     * Fetches hotel images from database
     * @author Qamar Ali - 27-10-2025
     * @param hotelCodes - Array of hotel codes to fetch images for
     * @returns Map of hotel codes to their images
     */
    private async fetchHotelImages(hotelCode: string): Promise<Map<string, TboHotelImagesEntity[]>> {
        try {
            const hotelImages = await this.hotelImagesRepository
                .createQueryBuilder('image')
                .where('image.hotelCode = :hotelCode', { hotelCode }) // single code match
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

    /**
     * Fetches additional hotel details from database
     * @author Qamar Ali - 27-10-2025
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
}
