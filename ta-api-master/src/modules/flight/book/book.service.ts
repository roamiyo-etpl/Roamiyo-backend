import { BadRequestException, Injectable } from '@nestjs/common';
import { ProviderBookService } from '../providers/provider-book.service';
import { BookInitiateResponse, BookResponse } from './interfaces/book.interface';
import { BookConfirmationDto, BookDto } from './dtos/book.dto';
import { BookRepository } from './book.repository';
import { Booking, BookingStatus } from 'src/shared/entities/bookings.entity';
import { v4 as uuid } from 'uuid';
import { Generic } from 'src/shared/utilities/flight/generic.utility';
import { DuplicateBookingException } from './exceptions/duplicate-booking.exception';
import { RevalidateService } from '../revalidate/revalidate.service';
import { Fare } from '../search/interfaces/start-routing.interface';

@Injectable()
export class BookService {
    constructor(
        private readonly providerBookService: ProviderBookService,
        private readonly bookRepository: BookRepository,
        private readonly revalidateService: RevalidateService,
    ) {}

    /** [@Description: This method is used to initiate the booking]
     * @author: Prashant Joshi at 13-10-2025 **/
    async bookingInitiate(reqParams): Promise<BookInitiateResponse> {
        const { bookReq, headers } = reqParams;
        const userId = uuid();
        try {
            let fare: Fare[] = [];
            // Calculate the total count for each passenger type
            const adultCount = bookReq.passengers.filter((p) => p.passengerType === 'ADT').length;
            const childrenCount = bookReq.passengers.filter((p) => p.passengerType === 'CHD').length;
            const infantCount = bookReq.passengers.filter((p) => p.passengerType === 'INF').length;

            // Build paxes array with the correct counts
            bookReq.paxes = [
                {
                    adult: adultCount,
                    children: childrenCount,
                    infant: infantCount,
                },
            ];
            /* Call revalidate service to revalidate the booking */
            const revalidateResult = await this.revalidateService.revalidate(bookReq, headers);
            if (revalidateResult.error) {
                return {
                    error: true,
                    message: 'Revalidation failed',
                    booking_log_id: '',
                    search_req_id: bookReq.searchReqId,
                    booking_id: '',
                    fare: [] as unknown as Fare,
                };
            }
            fare = revalidateResult.route?.fare as unknown as Fare[];

            const mwrLogId = Generic.generateRandomString(10);

            const booking = await this.bookRepository.insertBooking({ booking: bookReq, userId, mwrLogId });

            /* Store booking log with original booking request in data field */
            const bookingLog = await this.bookRepository.storeBookingLog({ bookingRefId: booking.booking_reference_id, userId, mwrLogId });

            // Store original booking request in booking log for later use
            await this.bookRepository.updateBookingLogData({ bookingLogId: bookingLog.id, data: { originalBookRequest: bookReq } });

            return {
                error: false,
                message: 'Booking initiated successfully',
                booking_log_id: bookingLog.log_id,
                search_req_id: bookReq.searchReqId,
                booking_id: booking.booking_id,
                fare: fare as unknown as Fare,
            };
        } catch (error) {
            console.log(error);
            return {
                error: true,
                message: 'Booking initiated failed',
                booking_log_id: '',
                search_req_id: bookReq.searchReqId,
                booking_id: '',
                fare: [] as unknown as Fare,
            };
        }
        // return this.providerBookService.providerBook(bookReq, headers);
    }

    /** [@Description: This method is used to confirm the booking]
     * @author: Prashant Joshi at 13-10-2025 **/
    async bookingConfirmation(reqParams): Promise<BookResponse> {
        const { bookReq, headers } = reqParams;
        let booking: Booking = new Booking();
        try {
            /* Get booking from database */
            booking = await this.bookRepository.getBookingByBookingId({ bookingId: bookReq.bookingId });
            console.log('Booking found:', booking.booking_id);

            /* Get booking log from database */
            console.log('bookReq.bookingLogId', bookReq.bookingLogId);
            const bookingLog = await this.bookRepository.getBookingLogByBookingLogId({ bookingLogId: bookReq.bookingLogId });
            console.log('Booking log found:', bookingLog.id);
            /* Verify booking log */
            await this.bookRepository.verifyBookingLog({ bookingLogId: bookReq.bookingLogId });
            // Retrieve original booking request from booking log
            const originalBookRequest: BookDto = bookingLog.data?.originalBookRequest;
            console.log('originalBookRequest', originalBookRequest);
            if (!originalBookRequest) {
                throw new Error('Original booking request not found in booking log');
            }

            /* Call provider API to confirm booking */
            const supplierDetails = await this.providerBookService.providerBook({ bookReq: originalBookRequest, headers, logId: bookReq.bookingLogId });
            console.log('supplierDetails', supplierDetails);

            const response = new BookResponse();
            Object.assign(response, {
                error: supplierDetails.error,
                message: supplierDetails.message,
                mode: supplierDetails.mode,
                searchReqId: supplierDetails.searchReqId,
                supplierMessage: supplierDetails.supplierMessage,
                orderDetail: supplierDetails.orderDetail ?? [],
                // orderDetails: supplierDetails.orderDetails ?? null,
            });

            /* Update booking with supplier details including order details and original request */
            await this.bookRepository.updateBookingWithSupplierDetails({
                bookingId: booking.booking_id,
                supplierDetails, // Processed BookResponse with orderDetail, orderDetails, etc.
                bookingData: { request: originalBookRequest, response }, // Original client request
                supplierResponse: { bookSupplierResponse: supplierDetails.rawSupplierResponse, orderDetailsSupplierResponse: supplierDetails.supplierOrderDetailResponse }, // Raw supplier response from TBO
                bookingItem: 1, // booking item number
            });

            // delete supplierDetails.rawSupplierResponse;
            // delete supplierDetails.orderDetails;
            if (response.error) {
                await this.bookRepository.BookingStatusFailed(booking.booking_id);
            }
            return response;
        } catch (error) {
            console.error('Booking confirmation error:', error);
            if (booking) {
                await this.bookRepository.BookingStatusFailed(booking.booking_id);
            }
            // Re-throw with more context
            throw new BadRequestException({
                message: 'Booking confirmation failed',
                error: error.message,
                details: error,
            });
        }
    }
}
