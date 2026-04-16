import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { TboHotelAdditionalDetailsEntity } from 'src/modules/dump/hotel/entities/tbo-hotel-additional-details.entity';
import { HotelImageSizes } from 'src/modules/dump/hotel/interfaces/hotel-detail.interface';
import { AddBookingType, BookingAdditionalDetail } from 'src/shared/entities/booking-additional-details.entity';
import { BookingLog, PaymentStatus } from 'src/shared/entities/booking-logs.entity';
import { Booking, BookingFrom, BookingStatus, FailureReason } from 'src/shared/entities/bookings.entity';
import { Generic } from 'src/shared/utilities/flight/generic.utility';
import { DataSource, Repository } from 'typeorm';
import { NightlyRate } from './interfaces/booking-detail-response.interface';

@Injectable()
export class BookRepository extends Repository<Booking> {
    constructor(private readonly dataSource: DataSource) {
        super(Booking, dataSource.createEntityManager());
    }

    /**[@Description: This method is used to check Duplicate the booking]
        * Prevents multiple bookings with same details when status is PENDING or INPROGRESS
        * @author: Qamar Ali at 29-10-2025 
   */
    async checkDuplicateBooking(reqParams): Promise<Booking | null> {
        // const { booking, userId } = reqParams;
        const { booking, transformedPaxes, userId, mwrLogId, hotel } = reqParams;

        // Search for existing bookings with same criteria
        const existingBooking = await this.createQueryBuilder('booking')
            .where('booking.user_id = :userId', { userId: '2bdca29c-c8d7-4150-99f0-98ff7581d393' })
            .andWhere('DATE(booking.checkin) = DATE(:checkin)', { checkin: new Date(booking.checkIn) })
            .andWhere('DATE(booking.checkout) = DATE(:checkout)', { checkout: new Date(booking.checkOut) })
            .andWhere('booking.booking_status IN (:...statuses)', {
                statuses: [BookingStatus.PENDING, BookingStatus.INPROGRESS],
            })
            // Check passenger count matches
            .andWhere('booking.paxes @> :paxesData', { paxesData: JSON.stringify(transformedPaxes) })
            .orderBy('booking.created_at', 'DESC')
            .getOne();

        return existingBooking;
    }

    /** [@Description: This method is used to initiate the booking]
     * @author: Qamar Ali at 29-10-2025 **/
    async insertBooking(reqParams): Promise<Booking> {
        const { booking, transformedPaxes, userId, mwrLogId, hotel, searchReqId } = reqParams;
        // console.log(hotel, "hotel");

        // // Check for duplicate booking first
        // const duplicateBooking = await this.checkDuplicateBooking(reqParams);

        // if (duplicateBooking) {
        //     // If a duplicate exists, throw an exception or return an appropriate response
        //     throw new BadRequestException('Duplicate booking found. A booking with the same details already exists.');
        // }

        const numberOfNights = this.calculateNights(booking.checkIn, booking.checkOut);
        const prices = this.parsePriceHash(hotel.prices.priceHash);

        const bookingEntity = new Booking();

        // Map basic fields
        bookingEntity.supplier_name = booking.supplierCode;
        bookingEntity.booking_date = new Date();
        bookingEntity.booking_status = BookingStatus.INPROGRESS; // INPROGRESS
        bookingEntity.search_id = searchReqId;

        // Map contact details

        bookingEntity.contact_details = {
            title: booking.contactDetails.title,
            firstName: booking.contactDetails.firstName,
            middleName: booking.contactDetails.middleName || '',
            lastName: booking.contactDetails.lastName,
            gender: booking.contactDetails.gender,
            email: booking.contactDetails.email,
            dialCode: booking.contactDetails.dialCode || '',
            mobileNo: booking.contactDetails.mobileNo || '',
            addressLine1: booking.contactDetails.addressLine1 || '',
            addressLine2: booking.contactDetails.addressLine2 || '',
            city: booking.contactDetails.city || '',
            state: booking.contactDetails.state || '',
            country: booking.contactDetails.country || '',
            postalCode: booking.contactDetails.postalCode || '',
        };

        //price

        // bookingEntity.cash_amount = supplierRoomDetails.NetAmount;
        bookingEntity.reference_id = prices.hotelCode;
        bookingEntity.net_price = prices.price;
        bookingEntity.tax = prices.tax;
        // bookingEntity.public_price = supplierRoomDetails.NetAmount;
        bookingEntity.currency_code = hotel.cancellationPolicy.currency;
        bookingEntity.is_refundable = hotel.cancellationPolicy.refundable;

        // Set check-in/checkout
        bookingEntity.checkin = booking.checkIn;
        bookingEntity.checkout = booking.checkOut;
        bookingEntity.number_of_nights = numberOfNights;

        bookingEntity.paxes = transformedPaxes;

        bookingEntity.user_id = userId;
        bookingEntity.legacy_booking_id = 0;
        bookingEntity.module_type = 2;
        bookingEntity.mwr_log_id = mwrLogId;
        bookingEntity.booking_reference_id = `TA-${Generic.generateRandomString()}`;

        return this.save(bookingEntity);
    }

    /** [@Description: This method is used to get the booking by booking id]
    * @author: Qamar Ali at 29-10-2025 **/
    async getBookingByBookingId(reqParams): Promise<Booking> {
        // console.log(reqParams);
        const { bookingRefId } = reqParams;
        const booking = await this.findOne({ where: { booking_reference_id: bookingRefId } });
        if (!booking) {
            throw new Error('Booking not found');
        }
        return booking;
    }

    /** [@Description: This method is used to store the booking log]
     * @author: Qamar Ali at 29-10-2025 **/
    async storeBookingLog(reqParams): Promise<BookingLog> {
        const { bookingRefId, userId, mwrLogId } = reqParams;

        /* create booking log */
        const bookingLog = new BookingLog();
        bookingLog.log_id = mwrLogId;
        bookingLog.booking_reference_id = bookingRefId;
        bookingLog.user_id = userId;
        bookingLog.data = {};
        bookingLog.is_verified = false;
        bookingLog.payment_status = PaymentStatus.PENDING;
        bookingLog.transaction_id = null;
        bookingLog.created_at = new Date();
        bookingLog.updated_at = new Date();
        return this.dataSource.getRepository(BookingLog).save(bookingLog);
    }

    /** [@Description: This method is used to get the booking log by booking log id]
     * @author: Qamar Ali at 13-10-2025 **/
    async getBookingLogByBookingLogId(reqParams): Promise<BookingLog> {
        const { bookingRefId } = reqParams;
        // Validate bookingLogId
        if (!bookingRefId) {
            throw new Error('Booking log ID is required');
        }

        const bookingLog = await this.dataSource.getRepository(BookingLog).findOne({ where: { booking_reference_id: bookingRefId, is_verified: false } });
        if (!bookingLog) {
            throw new Error(`Booking log not found with ID: ${bookingRefId}`);
        }
        return bookingLog;
    }

    /** [@Description: This method is used to get the booking log by booking log id]
     * @author: Qamar Ali at 06-11-2025 **/
    async getBookingAdditionalDetailByBookingRefId(reqParams): Promise<BookingAdditionalDetail> {
        const { bookingRefId } = reqParams;

        // Validate bookingRefId
        if (!bookingRefId) {
            throw new HttpException(
                'Booking Ref ID is required',
                HttpStatus.BAD_REQUEST, // 400 Bad Request
            );
        }

        try {
            const bookingAdditionalDetails = await this.dataSource.getRepository(BookingAdditionalDetail).findOne({ where: { booking_reference_id: bookingRefId } });

            // If no booking is found, throw a 404 Not Found error
            if (!bookingAdditionalDetails) {
                throw new HttpException(
                    `Booking Details not found with ID: ${bookingRefId}`,
                    HttpStatus.NOT_FOUND, // 404 Not Found
                );
            }
            // console.log(bookingAdditionalDetails, 'data');

            return bookingAdditionalDetails;
        } catch (error) {
            console.error('Error in getBookingAdditionalDetailByBookingRefId service method:', error);
            throw error;
        }

    }

    /** [@Description: This method is used to create the booking additional detail]
        * Create booking additional details entry
        * Stores supplier and API request/response data separately for audit trail
        * @author: Prashant Joshi at 13-10-2025 **/
    async createBookingAdditionalDetail(reqParams): Promise<BookingAdditionalDetail> {
        const { bookingId, bookingRefId, supplierDetails, apiResponse, searchReqId, bookingItem = 1 } = reqParams;
        const additionalDetail = new BookingAdditionalDetail();

        // console.log(supplierDetails,"supplierResponse");
        const supplierResponse = {
            bookSupplierResponse: [
                {
                    request: supplierDetails.supplierRequest,
                    response: supplierDetails.supplierResponse,
                }
            ],
            orderDetailsSupplierResponse: [
                supplierDetails.supplierOrderDetails
            ]
        };

        // Required fields
        additionalDetail.booking_id = bookingId;
        additionalDetail.booking_reference_id = bookingRefId;
        additionalDetail.booking_item = bookingItem;

        // Set booking type
        additionalDetail.add_booking_type = AddBookingType.DEFAULT_BOOKING;

        // 1. Supplier Response: Store ONLY raw supplier response (from TBO, Amadeus, etc.)
        //    This is the actual response received from the provider's API

        const convertApiResponseOrderDetails = await this.convertBookingResponse(apiResponse.orderDetails[0], searchReqId);

        const { orderDetails, ...rest } = apiResponse; // remove orderDetails safely

        const bookingDetails = await this.getBookingByBookingId({ bookingRefId });

        const finalOrderDetails = {
            bookingId,
            status: String(bookingDetails.booking_status),
            bookingReferenceId: bookingRefId,
            paxes: bookingDetails.paxes,
            contactDetails: bookingDetails.contact_details,
            ...convertApiResponseOrderDetails
        }

        const updateApiResponseObject = {
            ...rest,
            orderDetails: [finalOrderDetails],
        };


        additionalDetail.supplier_response = supplierResponse;
        additionalDetail.api_response = updateApiResponseObject;
        additionalDetail.room_info = convertApiResponseOrderDetails.roomInfo;


        // Set timestamps
        additionalDetail.created_at = new Date();
        additionalDetail.updated_at = new Date();

        // Save and return
        return this.dataSource.getRepository(BookingAdditionalDetail).save(additionalDetail);
    }

    /** [@Description: This method is used to update the booking log data]
    * @author: Qamar Ali at 29-10-2025 **/
    async updateBookingLogData(reqParams): Promise<BookingLog> {
        const { bookingLogId, data } = reqParams;
        const bookingLog = await this.dataSource.getRepository(BookingLog).findOne({ where: { id: bookingLogId } });
        if (!bookingLog) {
            throw new Error('Booking log not found');
        }
        bookingLog.data = data;
        return this.dataSource.getRepository(BookingLog).save(bookingLog);
    }


    /** [@Description: This method is used to verify the booking log]
     * @author: Qamar Ali at 29-10-2025 **/
    async verifyBookingLog(reqParams): Promise<BookingLog> {
        const { bookingRefId } = reqParams;
        // Validate bookingLogId
        if (!bookingRefId) {
            throw new Error('Booking log ID is required');
        }

        const bookingLog = await this.dataSource.getRepository(BookingLog).findOne({ where: { booking_reference_id: bookingRefId } });
        if (!bookingLog) {
            throw new Error(`Booking log not found with ID: ${bookingRefId}`);
        }
        bookingLog.is_verified = true;
        bookingLog.payment_status = PaymentStatus.CAPTURED;
        bookingLog.updated_at = new Date();
        return this.dataSource.getRepository(BookingLog).save(bookingLog);
    }


    /** [@Description: This method is used to update the booking with supplier response and order details
         * Maps all available fields from supplier and order detail API responses
         * Also creates booking additional details with must-have data]
         * @author: Qamar Ali at 30-10-2025 **/
    async updateBookingWithSupplierDetails(reqParams): Promise<Booking> {
        const { bookingId, supplierDetails, apiResponse, bookingItem = 1 } = reqParams;
        const booking = await this.findOne({ where: { booking_id: bookingId } });
        if (!booking) {
            throw new Error('Booking not found');
        }
        //  console.log(reqParams,'supplierDetails');


        booking.supplier_reference_id = supplierDetails.supplierResponse.BookingId;

        // Update booking status based on order status
        if (supplierDetails.supplierResponse.HotelBookingStatus === 'Confirmed') {
            booking.booking_status = BookingStatus.CONFIRMED;
        } else {
            booking.booking_status = BookingStatus.PENDING;
        }

        // Set module type for hotel (assuming 2 is Hotel module ID)
        booking.module_type = 2; // Hotel module

        // Set booking from web/mobile
        booking.booking_from = BookingFrom.WEB; // You can pass this from request if needed



        // Update timestamp
        booking.updated_at = new Date();

        // Save booking first
        const savedBooking = await this.save(booking);

        // Create booking additional details with must-have data
        if (apiResponse && supplierDetails) {
            try {
                // Store separate data for supplier and API responses
                await this.createBookingAdditionalDetail({
                    bookingId,
                    bookingRefId: savedBooking.booking_reference_id,
                    supplierDetails, // supplier response book and book details (from TBO/provider API)
                    apiResponse, // Client's booking request
                    searchReqId: booking.search_id,
                    bookingItem,
                });
            } catch (error) {
                console.error('Error creating booking additional details:', error);
                // Don't throw error here - booking is already saved
                // Log it for monitoring but don't break the booking flow
            }
        }

        return savedBooking;
    }

    /** [@Description: This method is used to update the booking with supplier response and order details
    * Maps all available fields from supplier and order detail API responses
    * Also creates booking additional details with must-have data]
    * @author: Qamar Ali at 31-10-2025 **/
    async updateBookingWithSupplierFailed(reqParams): Promise<Booking> {
        const { bookingId, supplierDetails } = reqParams;
        const booking = await this.findOne({ where: { booking_id: bookingId } });
        if (!booking) {
            throw new Error('Booking not found');
        }

        //for booking failed supplier side
        booking.failure_reason = FailureReason.SUPPLIER_API;

        // Set module type for hotel (assuming 2 is Hotel module ID)
        booking.module_type = 2; // Hotel module

        // Set booking from web/mobile
        booking.booking_from = BookingFrom.WEB; // You can pass this from request if needed

        // Update timestamp
        booking.updated_at = new Date();
        // Save booking first
        const savedBooking = await this.save(booking);
        return savedBooking;
    }



    /** [@Description: This is used to calculate nights]
     * @author: Qamar Ali at 29-10-2025 **/
    private calculateNights(checkIn: string, checkOut: string): number {
        const checkInDate = new Date(checkIn).getTime();
        const checkOutDate = new Date(checkOut).getTime();
        return Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    }


    /** [@Description: This is used to calculate nights]
     * @author: Qamar Ali at 29-10-2025 **/
    private parsePriceHash(inputStr) {
        // Split the string by underscores
        let splitStr = inputStr.split('_');

        return {
            supplierCode: splitStr[0],
            hotelCode: splitStr[1],
            price: parseFloat(splitStr[2]),
            tax: parseFloat(splitStr[3]),
            searchReqId: splitStr[4]
        };
    }


    /** [@Description: This method is used to get country name]
    * @author: Qamar Ali at 06-11-2025 **/
    async getHotelDetails(reqParams): Promise<TboHotelAdditionalDetailsEntity> {
        const hotelCode = reqParams;
        // Validate countryCode

        // Find country by ISO2 code
        const hotelDetails = await this.dataSource.getRepository(TboHotelAdditionalDetailsEntity).findOne({
            where: { hotelCode: hotelCode },
        });

        return hotelDetails ? hotelDetails : {} as unknown as TboHotelAdditionalDetailsEntity;
    }


    /**
     * Convert Tbo response in hotel standard response
     * @param apiResponse - Check-in date
     * @returns convert response
    */
    private async convertBookingResponse(apiResponse, searchReqId) {

        // const images = await this.hotelImagesRepository.find({
        //         where: { hotelCode },
        //     });


        // ✅ Properly map DB hotelImages records into hotelImages objects

        // const hotelImages: HotelImageSizes[] = images.length > 0
        //     ? images.map(img => ({
        //         thumbnail: '',
        //         small: '',
        //         bigger: '',  // map DB column to interface property
        //         standard: img.url || '',         // map DB column to interface property
        //         xl: '',       // numeric order
        //         xxl: '',       // numeric order
        //         original: '', // convert to string if needed
        //     }))
        //     : [];



        const hotelDetails = await this.getHotelDetails(apiResponse.TBOHotelCode);
        const hotelImage = hotelDetails.heroImage || '';
        const hotelDescription = hotelDetails.description || '';
        const hotelPhone = hotelDetails.hotelPhones;
        const hotelCountry = hotelDetails.country;

        const hotelImages = hotelImage ? [{
            thumbnail: '',          // Empty - no thumbnail variant available
            small: '',              // Empty - no small variant available
            standard: hotelImage,    // Use heroImage as standard size
            bigger: '',             // Empty - no bigger variant available
            xl: '',                 // Empty - no xl variant available
            xxl: '',                // Empty - no xxl variant available
            original: hotelImage,
        }] : [];

        // Basic booking info
        const booking = {
            supplierBookingId: apiResponse.BookingId,
            // status: apiResponse.HotelBookingStatus || "Unknown",
            remarks: apiResponse.RateConditions || "",
            bookingDate: apiResponse.BookingDate,
            checkIn: apiResponse.CheckInDate,
            checkOut: apiResponse.CheckOutDate,
            numberOfNights: this.calculateNights(apiResponse.CheckInDate, apiResponse.CheckOutDate),
            hotel: {
                hotelId: apiResponse.TBOHotelCode || "",
                name: apiResponse.HotelName,
                // rating: apiResponse.StarRating,
                rating: {
                    stars: apiResponse.StarRating,
                    reviewScore: '',
                },
                address: `${apiResponse.AddressLine1 || ""} ${apiResponse.AddressLine2 || ""}`.trim(),
                phones: hotelPhone,
                location: {
                    geoLocation: {
                        latitude: apiResponse.Latitude,
                        longitude: apiResponse.Longitude,
                    },
                    city: apiResponse.City,
                    state: apiResponse.State || '',
                    country: hotelCountry,
                    countryCode: apiResponse.CountryCode,
                },
                description: hotelDescription,
                images: hotelImages,
            },
            prices: {
                // selling: Generic.currencyConversion(NetAmount, providerCurrency, preferredCurrency) || 0,
                selling: Generic.currencyConversion(apiResponse.NetAmount, 'INR', 'INR') || 0,
                // currency: preferredCurrency,
                currency: 'INR',
                taxIncluded: true,
                // taxes: totalTax,
                // taxes: Generic.currencyConversion(NetTax, providerCurrency, preferredCurrency) || 0,
                taxes: Generic.currencyConversion(apiResponse.NetTax, 'INR', 'INR') || 0,
                // priceHash: `TBO_${apiResponse.TBOHotelCode}_${NetAmount}_${NetTax}_${searchReqId}`,
                priceHash: `TBO_${apiResponse.TBOHotelCode}_${apiResponse.NetAmount}_${apiResponse.NetTax}_${searchReqId}`,

            },
            roomInfo: [] as any[],
            isRefundable: (() => {
                const bookingDate = new Date(apiResponse.BookingDate);
                const policies = apiResponse.Rooms[0].CancelPolicies || [];

                // Find if there's a free cancellation window (charge = 0)
                const refundablePolicy = policies.find((policy) => {
                    const from = new Date(policy.FromDate);
                    const to = new Date(policy.ToDate);
                    return (
                        bookingDate >= from &&
                        bookingDate <= to &&
                        Number(policy.CancellationCharge) === 0
                    );
                });

                return !!refundablePolicy; // true if found, else false
            })(),
            termsCancellationPolicy: apiResponse.Rooms[0].CancellationPolicy || null,
        };

        // Loop through rooms
        if (apiResponse.Rooms && Array.isArray(apiResponse.Rooms)) {
            apiResponse.Rooms.forEach(room => {
                const roomObj = {
                    roomName: room.RoomTypeName,
                    ratePlanCode: room.RatePlanCode,
                    roomCode: room.RoomTypeCode || '',
                    boardCode: '',
                    boardInfo: '',
                    rooms: 1,
                    adults: room.AdultCount,
                    children: room.ChildCount || 0,
                    childAges: room.ChildAge || [],
                    nightlyRates: this.transformDayRatesToNightly(room.DayRates || []),
                    inclusion: room.Inclusion || "",
                    roomDescription: room.RoomDescription,
                    cancellationPolicy: {
                        refundable: (() => {
                            const bookingDate = new Date(apiResponse.BookingDate);
                            const policies = room.CancelPolicies || [];

                            // Find if there's a free cancellation window (charge = 0)
                            const refundablePolicy = policies.find((policy) => {
                                const from = new Date(policy.FromDate);
                                const to = new Date(policy.ToDate);
                                return (
                                    bookingDate >= from &&
                                    bookingDate <= to &&
                                    Number(policy.CancellationCharge) === 0
                                );
                            });

                            return !!refundablePolicy; // true if found, else false
                        })(),
                        currency: room.CancelPolicies[0].Currency || '',
                        penalties: room.CancelPolicies || [],
                    },
                    supplements: room.Supplements || [],
                    amenity: room.Amenities,
                }

                booking.roomInfo.push(roomObj);
            });
        }

        return booking;
    }




    // Function to transform DayRates into NightlyRates with a fallback for missing data
    private transformDayRatesToNightly(dayRates: any[] | null | undefined): NightlyRate[] {
        // If DayRates is null, undefined, or an empty array, return an empty array
        if (!dayRates || dayRates.length === 0) {
            return [];
        }

        // Otherwise, transform the data
        return dayRates.map(rate => ({
            price: rate.Amount.toFixed(2), // Convert the price to string with two decimal places
            dateYmd: rate.Date.split('T')[0] // Extract the date part (YYYY-MM-DD)
        }));
    }

}
