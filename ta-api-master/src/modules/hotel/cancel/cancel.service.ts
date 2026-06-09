import { BadRequestException, Injectable } from '@nestjs/common';
import { ProviderCancellationService } from '../providers/provider-cancellation.service';
import { GenericCancelDto } from 'src/modules/cancel/dto/cancel.dto';
import { CancelResponse } from 'src/modules/cancel/interfaces/cancel.interface';
import { HotelCancelRepository } from './cancel.repository';
import { BookingStatus } from 'src/shared/entities/bookings.entity';

@Injectable()
export class HotelCancelService {
    constructor(
        private readonly providerCancellationService: ProviderCancellationService,
        private readonly cancelRepository: HotelCancelRepository,
    ) {}

    async cancelHotel(reqParams: {
        cancelReq: GenericCancelDto;
        headers: Record<string, unknown>;
    }): Promise<CancelResponse> {
        const { cancelReq, headers } = reqParams;

        console.log('════════════════ CANCEL HOTEL START ════════════════');
        console.log('[CANCEL-HOTEL] Incoming cancelReq:', JSON.stringify(cancelReq, null, 2));

        try {
            this.validateCancelRequest(cancelReq);

            const booking = await this.resolveBooking(cancelReq);
            console.log('[CANCEL-HOTEL] Booking found:', JSON.stringify({
                booking_id: booking.booking_id,
                booking_reference_id: booking.booking_reference_id,
                supplier_reference_id: booking.supplier_reference_id,
                supplier_name: booking.supplier_name,
                booking_status: booking.booking_status,
            }, null, 2));

            this.validateBookingCancellable(booking.booking_status);

            const isDuplicate = await this.cancelRepository.hasExistingSuccessfulHotelCancellation(
                cancelReq.booking_id,
            );
            if (isDuplicate) {
                console.log('[CANCEL-HOTEL] Duplicate cancellation blocked');
                throw new BadRequestException('Booking is already cancelled');
            }

            const providerCancelReq = this.toProviderCancelReq(cancelReq, booking.supplier_name);
            console.log('[CANCEL-HOTEL] Provider cancelReq:', JSON.stringify(providerCancelReq, null, 2));

            const result = await this.providerCancellationService.providerCancel({
                cancelReq: providerCancelReq,
                headers,
                booking,
            });

            console.log('[CANCEL-HOTEL] Provider response:', JSON.stringify(result, null, 2));

            if (result.changeRequestId) {
                try {
                    const extended = result as CancelResponse & {
                        hotelChangeRequestStatus?: number;
                        sendChangeRequestResponse?: unknown;
                        getChangeRequestStatusResponse?: unknown;
                    };

                    const dbPayload = {
                        bookingId: cancelReq.bookingId.toString(),
                        booking_id: cancelReq.booking_id,
                        cancellationResponse: {
                            changeRequestId: result.changeRequestId,
                            traceId: result.traceId,
                            status: result.status,
                            hotelChangeRequestStatus: extended.hotelChangeRequestStatus,
                            cancellationCharge: result.cancellationCharge,
                            refundedAmount: result.refundedAmount,
                            remarks: cancelReq.supplierParams?.remarks ?? result.remarks,
                            sendChangeRequestResponse: extended.sendChangeRequestResponse,
                            getChangeRequestStatusResponse: extended.getChangeRequestStatusResponse,
                        },
                        cancellationStatus: result.cancellationStatus === true,
                        requestType: cancelReq.requestType || 'FullCancellation',
                    };

                    console.log('[CANCEL-HOTEL] Saving cancellation record:', JSON.stringify(dbPayload, null, 2));

                    const saved = await this.cancelRepository.createHotelCancellationRecord(dbPayload);
                    result.cancellationId = saved.cancellation_id;

                    console.log('[CANCEL-HOTEL] Saved cancellation_id:', saved.cancellation_id);
                } catch (dbError) {
                    console.error('[CANCEL-HOTEL] DB save failed:', dbError);
                }
            } else {
                console.log('[CANCEL-HOTEL] Skipping DB save — no changeRequestId from TBO');
            }

            console.log('[CANCEL-HOTEL] Final response:', JSON.stringify(result, null, 2));
            console.log('════════════════ CANCEL HOTEL END ════════════════');

            return result;
        } catch (error) {
            console.error('[CANCEL-HOTEL] ERROR:', error);
            throw new BadRequestException({
                message: error.message || 'Hotel cancellation failed',
                error: error.message,
            });
        }
    }

    private validateCancelRequest(cancelReq: GenericCancelDto): void {
        if (!cancelReq.booking_id) {
            throw new BadRequestException('booking_id is required');
        }
        if (!cancelReq.bookingId) {
            throw new BadRequestException('bookingId is required');
        }
    }

    private validateBookingCancellable(bookingStatus: BookingStatus): void {
        const allowed = [BookingStatus.CONFIRMED, BookingStatus.PENDING, BookingStatus.BOOKED];
        if (!allowed.includes(bookingStatus)) {
            throw new BadRequestException(
                `Cancellation not allowed for booking status: ${bookingStatus}`,
            );
        }
    }

    private async resolveBooking(cancelReq: GenericCancelDto) {
        const booking = await this.cancelRepository.findHotelBookingByInternalIdAndTboRef({
            booking_id: cancelReq.booking_id,
            bookingId: cancelReq.bookingId,
        });

        if (!booking) {
            throw new BadRequestException(
                'Hotel booking not found or bookingId does not match supplier reference',
            );
        }

        return booking;
    }

    private toProviderCancelReq(cancelReq: GenericCancelDto, supplierName: string) {
        return {
            bookingId: cancelReq.bookingId,
            requestType: cancelReq.requestType || 'FullCancellation',
            supplierParams: {
                ...(cancelReq.supplierParams || {}),
                providerCode: supplierName,
            },
        };
    }
}
