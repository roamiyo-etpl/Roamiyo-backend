import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ProviderBookService } from '../providers/provider-book.service';
import { HotelBookInitiateResponse } from './interfaces/book-initiate-response.interface';
import { HotelBookInitiateDto, PassengerDto } from './dtos/hotel-book-initiate.dto';
import { HotelBookConfirmationDto } from './dtos/hotel-book-confirmation.dto';
import { HotelBookConfirmationResponse } from './interfaces/book-confirmation-response.interface';
import { HotelRoomService } from '../room/room.service';
import { PaxGroup, paxesData } from 'src/shared/entities/bookings.entity';
import { Generic } from 'src/shared/utilities/flight/generic.utility';
import { BookRepository } from './book.repository';
import { v4 as uuid } from 'uuid';
import { HotelPrice } from '../search/interfaces/initiate-result-response.interface';
import { SupplierCredService } from 'src/modules/generic/supplier-credientials/supplier-cred.service';
import { HotelProviderUtility } from 'src/shared/utilities/hotel/hotel-provider.utility';
import { BookingDetailResponse } from './interfaces/booking-detail-response.interface';
import { PaymentStatus } from 'src/shared/entities/booking-logs.entity';
import { extractHotelErrorMessage, throwHotelApiError } from 'src/shared/utilities/hotel/hotel-error.utility';

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
        const { hotelId, searchReqId, supplierCode, rateKey, contactDetails } = bookDto;

        // Map client documentType/documentNumber → pan / passportNumber when provided
        const passengers = this.mapPassengerDocuments(bookDto.passengers);
        bookDto.passengers = passengers;

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
            const responseMode = roomQuote.mode;
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
                mode: responseMode,
                message: 'Book initiate successful',
                bookingRefId: booking.booking_reference_id,
                price: roomQuote.prices,
                // price: {} as unknown as HotelPrice
            };
        } catch (error: any) {
            this.logger.error("Hotel Book failed");
        
            console.error("FULL ERROR:", JSON.stringify(error, null, 2));
        
            console.error("error.response:",
                JSON.stringify(error?.response, null, 2));
        
            console.error("error.message:", error?.message);
        
            console.error("error.stack:", error?.stack);
        
            throwHotelApiError(error, 'Hotel book initiate failed');
        }
    }

    async bookConfirmation(bookReq: HotelBookConfirmationDto, headers: Headers): Promise<HotelBookConfirmationResponse> {

        const { bookingRefId, searchReqId, paymentLogId } = bookReq;
        this.logger.log(`[bookConfirmation] start | bookingRefId=${bookingRefId} searchReqId=${searchReqId} paymentLogId=${paymentLogId}`);

        let initiateBookingLog: Awaited<ReturnType<BookRepository['getBookingLogByBookingLogId']>> | null = null;

        try {

            /* Get booking from database */
            const booking = await this.bookRepository.getBookingByBookingId({ bookingRefId: bookingRefId });

            /* Get initiate booking log (room quote row) */
            initiateBookingLog = await this.bookRepository.getBookingLogByBookingLogId({ bookingRefId: bookingRefId });

            const originalBookRequestResponse = initiateBookingLog.data;
            if (!originalBookRequestResponse) {
                throw new Error('Original booking request not found in booking log');
            }

            /* Check active provider details */
            const providersData = await this.supplierCred.getActiveProviders(headers);

            const activeProviders = HotelProviderUtility.mapActiveProviders(providersData);
            const responseMode = HotelProviderUtility.resolveResponseMode(activeProviders);

            Object.assign(originalBookRequestResponse, { activeProviders: activeProviders });

            this.logger.log(`[bookConfirmation] calling supplier | bookingRefId=${bookingRefId}`);
            const supplierDetailsResponse = await this.providerBookService.bookConfirmation(originalBookRequestResponse, headers);
            const { success, errorCode, message, mode: supplierMode, ...supplierDetails } = supplierDetailsResponse;
            const bookingMode = supplierMode || responseMode;

            const confirmationSucceeded =
                supplierDetailsResponse.success && supplierDetailsResponse.errorCode === 0;

            await this.persistConfirmationBookingLog({
                initiateBookingLog,
                bookReq,
                bookingMode,
                supplierDetails,
                supplierDetailsResponse: {
                    success: confirmationSucceeded,
                    errorCode,
                    message,
                    bookingStatus: confirmationSucceeded
                        ? supplierDetails.supplierResponse?.HotelBookingStatus
                        : 'failed',
                    supplierBookingId: confirmationSucceeded
                        ? String(supplierDetails.supplierResponse?.BookingId ?? '')
                        : '',
                },
            });

            if (confirmationSucceeded) {

                const apiResponse = {
                    booking: {
                        request: initiateBookingLog.data.originalBookRequest,
                        response: {
                            success: true,
                            message: 'Book confirmation successful',
                            bookingStatus: supplierDetails.supplierResponse.HotelBookingStatus,
                            bookingRefId: bookingRefId,
                            searchReqId: searchReqId,
                            mode: bookingMode,
                            supplierBookingId: supplierDetails.supplierResponse.BookingId,
                        },
                    },
                    orderDetails: [
                        supplierDetailsResponse.supplierOrderDetails
                    ]
                }

                await this.bookRepository.updateBookingWithSupplierDetails({
                    bookingId: booking.booking_id,
                    supplierDetails,
                    apiResponse: apiResponse,
                    bookingItem: 1,
                });
                this.logger.log(
                    `[bookConfirmation] success | bookingRefId=${bookingRefId} supplierBookingId=${supplierDetails.supplierResponse.BookingId} status=${supplierDetails.supplierResponse.HotelBookingStatus}`,
                );
                return {
                    success: true,
                    message: 'Book confirmation successful',
                    bookingStatus: supplierDetails.supplierResponse.HotelBookingStatus,
                    bookingRefId: bookingRefId,
                    searchReqId: searchReqId,
                    mode: bookingMode,
                    supplierBookingId: supplierDetails.supplierResponse.BookingId,
                }
            } else {
                await this.bookRepository.updateBookingWithSupplierFailed({
                    bookingId: booking.booking_id,
                    supplierDetails,
                });
                this.logger.warn(
                    `[bookConfirmation] supplier failed | bookingRefId=${bookingRefId} errorCode=${errorCode} message=${message}`,
                );
                return {
                    success: false,
                    message: message,
                    bookingStatus: 'failed',
                    bookingRefId: bookingRefId,
                    searchReqId: searchReqId,
                    mode: bookingMode,
                    supplierBookingId: '',
                };

            }

        } catch (error: any) {
            this.logger.error(
                `[bookConfirmation] error | bookingRefId=${bookingRefId} searchReqId=${searchReqId} | ${error?.message || error}`,
            );

            const failureMessage =
                extractHotelErrorMessage(error, 'Booking confirmation failed');

            if (initiateBookingLog) {
                try {
                    await this.persistConfirmationBookingLog({
                        initiateBookingLog,
                        bookReq,
                        bookingMode: '',
                        supplierDetails: {},
                        supplierDetailsResponse: {
                            success: false,
                            errorCode: null,
                            message: failureMessage,
                            bookingStatus: 'failed',
                            supplierBookingId: '',
                        },
                    });
                } catch (logError: any) {
                    this.logger.error(
                        `[bookConfirmation] failed to persist confirmation booking log | bookingRefId=${bookingRefId} | ${logError?.message || logError}`,
                    );
                }
            }

            throw new BadRequestException({
                success: false,
                message: failureMessage,
                bookingStatus: 'failed',
                bookingRefId: bookingRefId,
                searchReqId: searchReqId,
                mode: '',
                supplierBookingId: '',
            });

        }

    }

    /** Persists a dedicated booking_log row for hotel/book/confirmation (separate from room quote log). */
    private async persistConfirmationBookingLog(params: {
        initiateBookingLog: Awaited<ReturnType<BookRepository['getBookingLogByBookingLogId']>>;
        bookReq: HotelBookConfirmationDto;
        bookingMode: string;
        supplierDetails: Record<string, any>;
        supplierDetailsResponse: {
            success: boolean;
            errorCode: number | null;
            message: string;
            bookingStatus: string;
            supplierBookingId: string;
        };
    }): Promise<void> {
        const { initiateBookingLog, bookReq, bookingMode, supplierDetails, supplierDetailsResponse } = params;
        const { bookingRefId, searchReqId, paymentLogId } = bookReq;

        await this.bookRepository.storeConfirmationBookingLog({
            bookingRefId,
            userId: initiateBookingLog.user_id,
            logId: initiateBookingLog.log_id,
            transactionId: paymentLogId,
            isVerified: supplierDetailsResponse.success,
            paymentStatus: supplierDetailsResponse.success
                ? PaymentStatus.CAPTURED
                : PaymentStatus.FAILED,
            data: {
                api: 'hotel/book/confirmation',
                request: bookReq,
                response: {
                    success: supplierDetailsResponse.success,
                    errorCode: supplierDetailsResponse.errorCode,
                    message: supplierDetailsResponse.message,
                    bookingStatus: supplierDetailsResponse.bookingStatus,
                    bookingRefId,
                    searchReqId,
                    mode: bookingMode,
                    supplierBookingId: supplierDetailsResponse.supplierBookingId,
                },
                supplierRequest: supplierDetails.supplierRequest ?? null,
                supplierResponse: supplierDetails.supplierResponse ?? null,
                supplierOrderDetails: supplierDetails.supplierOrderDetails ?? null,
            },
        });
    }


    async getBookingDetails(bookingRefId: string, headers: Record<string, string>): Promise<BookingDetailResponse> {
        this.logger.log(`[getBookingDetails] start | bookingRefId=${bookingRefId}`);
        try {
            const providersData = await this.supplierCred.getActiveProviders(headers as unknown as Headers);
            const fallbackMode = HotelProviderUtility.resolveResponseMode(HotelProviderUtility.mapActiveProviders(providersData));

            const bookingData = await this.bookRepository.getBookingAdditionalDetailByBookingRefId({ bookingRefId });

            if (!bookingData) {
                this.logger.warn(`[getBookingDetails] not found | bookingRefId=${bookingRefId}`);
                throw new HttpException(
                    `Booking not found with bookingRefId: ${bookingRefId}`,
                    HttpStatus.NOT_FOUND,
                );
            }

            this.logger.log(`[getBookingDetails] success | bookingRefId=${bookingRefId}`);
            return {
                ...bookingData.api_response.orderDetails[0],
                mode: bookingData.api_response?.booking?.response?.mode || fallbackMode,
            };

        } catch (error: any) {
            this.logger.error(`[getBookingDetails] error | bookingRefId=${bookingRefId} | ${error?.message || error}`);
            throwHotelApiError(error, 'Hotel booking details failed');
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

            const mappedPax = paxData as paxesData;

            if (type === 'adult') {
                initialPaxesData.adult.count++;
                initialPaxesData.adult.data = initialPaxesData.adult.data || [];
                initialPaxesData.adult.data.push(mappedPax);
            } else if (type === 'child') {
                initialPaxesData.child.count++;
                initialPaxesData.child.data = initialPaxesData.child.data || [];
                initialPaxesData.child.data.push(mappedPax);
            } else if (type === 'infant') {
                initialPaxesData.infant.count++;
                initialPaxesData.infant.data = initialPaxesData.infant.data || [];
                initialPaxesData.infant.data.push(mappedPax);
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
     * Maps client documentType/documentNumber onto pan or passportNumber when provided.
     * Leaves existing pan/passportNumber unchanged when document fields are absent.
     */
    private mapPassengerDocuments(passengers: PassengerDto[]): PassengerDto[] {
        return passengers.map((pax) => {
            const documentType = pax.documentType?.trim()?.toLowerCase();
            const documentNumber = pax.documentNumber?.trim();

            if (!documentType || !documentNumber) {
                return pax;
            }

            if (documentType === 'pan') {
                pax.pan = documentNumber;
            } else if (documentType === 'passport') {
                pax.passportNumber = documentNumber;
            }

            return pax;
        });
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
