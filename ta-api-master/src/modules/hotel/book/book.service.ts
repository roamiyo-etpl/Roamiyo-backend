import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ProviderBookService } from '../providers/provider-book.service';
import { HotelBookInitiateResponse } from './interfaces/book-initiate-response.interface';
import { HotelBookInitiateDto, PassengerDto } from './dtos/hotel-book-initiate.dto';
import { HotelBookConfirmationDto } from './dtos/hotel-book-confirmation.dto';
import { HotelBookConfirmationResponse } from './interfaces/book-confirmation-response.interface';
import { HotelRoomService } from '../room/room.service';
import { PaxGroup } from 'src/shared/entities/bookings.entity';
import { Generic } from 'src/shared/utilities/flight/generic.utility';
import { BookRepository } from './book.repository';
import { v4 as uuid } from 'uuid';
import { HotelPrice } from '../search/interfaces/initiate-result-response.interface';
import { SupplierCredService } from 'src/modules/generic/supplier-credientials/supplier-cred.service';
import { BookingDetailResponse } from './interfaces/booking-detail-response.interface';

@Injectable()
export class HotelBookService {
    private readonly logger = new Logger(HotelBookService.name);
    constructor(
        private readonly providerBookService: ProviderBookService,
        private readonly hotelRoomService: HotelRoomService,
        private readonly bookRepository: BookRepository,
        private supplierCred: SupplierCredService,
    ) { }

    async initiate(bookDto: HotelBookInitiateDto, headers: Headers): Promise<HotelBookInitiateResponse> {
        const { hotelId, searchReqId, supplierCode, rateKey, passengers, contactDetails } = bookDto;

        console.log(bookDto,'hdhd');

        // Prepare room validation payload
        const roomValidationPayload = {
            hotelId,
            searchReqId,
            supplierCode,
            roomBookingInfo: [
                {
                    rateKey
                }
            ],
        };
        try {
            const roomQuote = await this.hotelRoomService.getHotelRoomQuote(roomValidationPayload, headers);
            // console.log(roomQuote, 'revalidateRoom');

            if (roomQuote.status !== 'AVAILABLE') {
                throw new BadRequestException({
                    success: false,
                    searchReqId: searchReqId,
                    message: roomQuote.status,
                });
            }

            // Run PAN / Passport validation before proceeding
            const validationResult = this.validatePassengerDocuments(passengers, roomQuote.validationInfo);

            if (!validationResult.valid) {
                throw new BadRequestException({
                    success: false,
                    searchReqId: searchReqId,
                    message: validationResult.errors,
                });
            }

            /* Generate mwr_log_id UUID */
            const mwrLogId = Generic.generateRandomString(10);
            const userId = uuid();
            const currency = String(headers['currency-preference'] ?? 'INR');

            const transformedPaxes = this.transformPaxesData(
                passengers, 
                contactDetails.email, 
                contactDetails.mobileNo, 
                contactDetails.dialCode
            );
        //  console.log(transformedPaxes, "transformedPaxes");

            /* Initiate booking  */
            const booking = await this.bookRepository.insertBooking({ booking: bookDto, transformedPaxes, userId, mwrLogId, hotel: roomQuote, searchReqId });

            /* Store booking log with original booking request in data field */
            const bookingLog = await this.bookRepository.storeBookingLog({ bookingRefId: booking.booking_reference_id, userId, mwrLogId });

            // Store original booking request in booking log for later use
            await this.bookRepository.updateBookingLogData({ bookingLogId: bookingLog.id, data: { originalBookRequest: bookDto, roomQuoteResponse: roomQuote } });

            return {
                success: true,
                searchReqId: searchReqId,
                message: 'Book initiate successful',
                bookingRefId: booking.booking_reference_id,
                price: roomQuote.prices,
                // price: {} as unknown as HotelPrice
            };
        } catch (error) {
            this.logger.error('Hotel Book failed:', error);
            // return {
            //     success: false,
            //     searchReqId: searchReqId,
            //     message: error.response.errors || 'Booking initiated failed',

            // };
            throw error;
        }
    }

    async bookConfirmation(bookReq: HotelBookConfirmationDto, headers: Headers): Promise<HotelBookConfirmationResponse> {

        const { bookingRefId, searchReqId, paymentLogId } = bookReq;

        try {

            /* Get booking from database */
            const booking = await this.bookRepository.getBookingByBookingId({ bookingRefId: bookingRefId });
            // console.log('Booking found:', booking.booking_reference_id);
            // console.log('Booking found:', booking);


            /* Get booking log from database */
            // console.log('bookReq.bookingLogId', bookReq.bookingLogId);
            const bookingLog = await this.bookRepository.getBookingLogByBookingLogId({ bookingRefId: bookingRefId });
            // console.log('Booking log found:', bookingLog.data.originalBookRequest.passengers);
            // console.log('Booking log found:', bookingLog.id);

            /* Verify booking log */
            await this.bookRepository.verifyBookingLog({ bookingRefId: bookingRefId });
            // Retrieve original booking request from booking log
            const originalBookRequestResponse = bookingLog.data;
            // console.log('originalBookRequestResponse', originalBookRequestResponse);
            if (!originalBookRequestResponse) {
                throw new Error('Original booking request not found in booking log');
            }

            /* Check active provider details */
            const providersData = await this.supplierCred.getActiveProviders(headers);

            /* setting up only provider config in the response */
            const activeProviders: any[] = providersData.map((data) => ({
                providerId: data.provider_id,
                code: data.code,
                assignedId: data.provider_id, // Using provider_id as assignedId for now
                providerCredentials: data.provider_credentials,
            }));

            Object.assign(originalBookRequestResponse, { activeProviders: activeProviders });
            // Object.assign(originalBookRequestResponse, { bookingId: bookReq.searchReqId });
            // Object.assign(originalBookRequestResponse, { searchReqId: bookReq.bookingId });
            // Object.assign(originalBookRequestResponse, { bookingLogId: bookReq.bookingLogId });

            // console.log(booking);
            // return await this.providerBookService.bookConfirmation(originalBookRequestResponse, headers);
            const supplierDetailsResponse = await this.providerBookService.bookConfirmation(originalBookRequestResponse, headers);
            // console.log(supplierDetails,'responseProvider');
            const { success, errorCode, message, ...supplierDetails } = supplierDetailsResponse;
            if (supplierDetailsResponse.success && supplierDetailsResponse.errorCode === 0) {

                const apiResponse = {
                    booking: {
                        request: bookingLog.data.originalBookRequest,
                        response: {
                            success: true,
                            message: 'Book confirmation successful',
                            bookingStatus: supplierDetails.supplierResponse.HotelBookingStatus,
                            bookingRefId: bookingRefId,
                            searchReqId: searchReqId,
                            supplierBookingId: supplierDetails.supplierResponse.BookingId,
                        },
                    },
                    orderDetails: [
                        supplierDetailsResponse.supplierOrderDetails
                    ]
                }

                /* Update booking with supplier details including order details and original request */
                await this.bookRepository.updateBookingWithSupplierDetails({
                    bookingId: booking.booking_id,
                    supplierDetails, // Processed BookResponse with orderDetail, orderDetails, etc.
                    apiResponse: apiResponse, // Original client request            
                    bookingItem: 1, // booking item number
                });
                return {
                    success: true,
                    message: 'Book confirmation successful',
                    bookingStatus: supplierDetails.supplierResponse.HotelBookingStatus,
                    bookingRefId: bookingRefId,
                    searchReqId: searchReqId,
                    supplierBookingId: supplierDetails.supplierResponse.BookingId,
                }
            } else {
                await this.bookRepository.updateBookingWithSupplierFailed({
                    bookingId: booking.booking_id,
                    supplierDetails, // Processed BookResponse with Get booking Details etc.            
                });
                // console.log(supplierDetails, "supplierDetails")
                return {
                    success: false,
                    message: message,
                    bookingStatus: 'failed',
                    bookingRefId: bookingRefId,
                    searchReqId: searchReqId,
                    supplierBookingId: '',
                };

            }

        } catch (error) {
            throw new BadRequestException({
                success: false,
                message: 'Booking confirmation failed',
                bookingStatus: 'failed',
                bookingRefId: bookingRefId,
                searchReqId: searchReqId,
                supplierBookingId: '',
            });

        }

    }


    async getBookingDetails(bookingRefId: string, headers: Record<string, string>): Promise<BookingDetailResponse> {
        try {
            // Fetch booking details (simulating a database or external API call here)
            const bookingData = await this.bookRepository.getBookingAdditionalDetailByBookingRefId({ bookingRefId });

            // console.log(bookingData,"jjjj");
            // If no booking data is found, throw a NotFound error
            if (!bookingData) {
                throw new HttpException(
                    `Booking not found with bookingRefId: ${bookingRefId}`,
                    HttpStatus.NOT_FOUND,
                );
            }

            return bookingData.api_response.orderDetails[0];

        } catch (error) {
            // Catch any errors and rethrow them
            console.error('Error in getBookingDetails service method:', error);
            throw error;
        }

    }

    /**
     * Converts passengers as data base
     * @author Qamar Ali - 27-10-2025
     * @param paxes - paxes details
     * @returns paxes details
     */
    private transformPaxesData(paxes: PassengerDto[], globalEmail: string, globalMobileNo: string, globalDialCode: string): PaxGroup {
        // Initialize the structure for the PaxesInterface
        
        const initialPaxesData: PaxGroup = {
            adult: { count: 0, data: [] },
            child: { count: 0, data: [] },
            infant: { count: 0, data: [] },
        };

        // Loop through each pax to classify them
        paxes.forEach((pax) => {
            // const { type, ...paxData } = pax;
            const { type, ...paxData } = pax;
             // Check if the pax contains email or mobileNo, and assign global values if not present
             // Check and apply global email, mobileNo, and dialCode if missing
                if (!paxData.email && globalEmail) {
                    paxData.email = globalEmail; // Add global email if not present
                }
                if (!paxData.mobileNo && globalMobileNo) {
                    paxData.mobileNo = globalMobileNo; // Add global mobileNo if not present
                }
                if (!paxData.dialCode && globalDialCode) {
                    paxData.dialCode = globalDialCode; // Add global dialCode if not present
                }

                 // If age is not provided, calculate it from the dob
                if (!paxData.age && paxData.dob) {
                    const calculatedAge = this.calculateAgeFromDob(paxData.dob);
                    paxData.age = calculatedAge;
                }

            if (type === 'adult') {
                initialPaxesData.adult.count++;
                initialPaxesData.adult.data?.push(paxData);
                // if (pax.age !== undefined) {
                //     initialPaxesData.adult.ages.push(pax.age);
                // }
            } else if (type === 'child') {
                initialPaxesData.child.count++;
                initialPaxesData.child.data = initialPaxesData.child.data || []; // Ensure it's initialized
                initialPaxesData.child.data?.push(paxData);
                // if (pax.age !== undefined) {
                //     initialPaxesData.child.ages.push(pax.age);
                // }
            } else if (type === 'infant') {
                initialPaxesData.infant.count++;
                initialPaxesData.infant.data = initialPaxesData.infant.data || []; // Ensure it's initialized
                initialPaxesData.infant.data?.push(paxData);
                // if (pax.age !== undefined) {
                //     initialPaxesData.infant.ages.push(pax.age);
                // }
            } else {
                throw new BadRequestException(`Invalid pax type`);
            }
        });

        return initialPaxesData;

        // return paxes.reduce((acc, pax) => {
        //     // Ensure only valid types are processed
        //     if (!['adult', 'child', 'infant'].includes(pax.type)) {
        //         throw new BadRequestException(`Invalid pax type: ${pax.type}`);
        //     }
        //     // Increment the count and push the pax into the correct category
        //     // Ensure that data array is always initialized for each type
        //     if (!acc[pax.type]) {
        //         acc[pax.type] = { count: 0, data: [] };
        //     }
        //     acc[pax.type].count++;
        //     acc[pax.type].data.push(pax);

        //     return acc;
        // }, initialPaxesData);
    }

    /**
     * Validate PAN and Passport requirements
     * @param passengers - array of passengers
     * @param validationInfo - PAN and passport validation rules
     */
    private validatePassengerDocuments(passengers: PassengerDto[], validationInfo: any): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // ---------- PAN Validation ----------
        if (validationInfo.isPanMandatory) {
            const adultPassengers = passengers.filter((p) => p.type === 'adult');
            const panSet = new Set(adultPassengers.map((p) => p.pan).filter(Boolean));

            if (panSet.size < validationInfo.isPanCountRequired) {
                errors.push(`At least ${validationInfo.isPanCountRequired} unique PAN number(s) required for adults. Found ${panSet.size}.`);
            }

            if (adultPassengers.length > 0 && panSet.size === 0) {
                errors.push('Adult passengers must have valid PAN numbers.');
            }
        }

        // ---------- Passport Validation ----------
        if (validationInfo.isPassportMandatory) {
            passengers.forEach((p, i) => {
                if (!p.passportNumber) {
                    errors.push(`Passenger ${p.firstName} ${p.lastName}: Passport number is required.`);
                }
                if (!p.passportIssueDate) {
                    errors.push(`Passenger ${p.firstName} ${p.lastName}: Passport issue date is required.`);
                }
                if (!p.passportExpDate) {
                    errors.push(`Passenger ${p.firstName} ${p.lastName}: Passport expiry date is required.`);
                }

                if (!p.passportIssuingCountry) {
                    errors.push(`Passenger ${p.firstName} ${p.lastName}: Passport expiry date is required.`);
                }
            });
        }

        return { valid: errors.length === 0, errors };
    }


    private calculateAgeFromDob(dob: string): number {
        const dobDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - dobDate.getFullYear();
        const m = today.getMonth() - dobDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
            age--; // Adjust age if the birthday hasn't occurred yet this year
        }
        return age;
    }
}
