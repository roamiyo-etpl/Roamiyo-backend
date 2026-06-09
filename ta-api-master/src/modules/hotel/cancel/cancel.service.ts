import { BadRequestException, Injectable } from '@nestjs/common';
import { ProviderCancellationService } from '../providers/provider-cancellation.service';
import { GenericCancelDto } from 'src/modules/cancel/dto/cancel.dto';
import { CancelResponse } from 'src/modules/cancel/interfaces/cancel.interface';
import { HotelCancelRepository } from './cancel.repository';
import { BookingStatus } from 'src/shared/entities/bookings.entity';
import { HotelCancelStatusDto } from './dtos/hotel-cancel-status.dto';

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
            const inFlight = await this.cancelRepository.findInFlightHotelCancellation(
                cancelReq.booking_id,
            );

            let result: CancelResponse;

            if (inFlight?.change_request_id) {
                console.log(
                    '[CANCEL-HOTEL] In-flight cancel found — polling status only, changeRequestId:',
                    inFlight.change_request_id,
                );
                result = await this.providerCancellationService.providerPollCancelStatus({
                    cancelReq: providerCancelReq,
                    headers,
                    booking,
                    changeRequestId: Number(inFlight.change_request_id),
                });
                result.cancellationId = inFlight.cancellation_id;
            } else {
                console.log('[CANCEL-HOTEL] Provider cancelReq:', JSON.stringify(providerCancelReq, null, 2));
                result = await this.providerCancellationService.providerCancel({
                    cancelReq: providerCancelReq,
                    headers,
                    booking,
                });
            }

            console.log('[CANCEL-HOTEL] Provider response:', JSON.stringify(result, null, 2));

            await this.persistCancellationResult({
                cancelReq,
                result,
                existingCancellationId: inFlight?.cancellation_id,
            });

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

    async getHotelCancelStatus(reqParams: {
        statusReq: HotelCancelStatusDto;
        headers: Record<string, unknown>;
    }): Promise<CancelResponse> {
        const { statusReq, headers } = reqParams;

        console.log('════════════════ HOTEL CANCEL STATUS START ════════════════');
        console.log('[CANCEL-HOTEL-STATUS] statusReq:', JSON.stringify(statusReq, null, 2));

        if (!statusReq.booking_id || !statusReq.bookingId || !statusReq.changeRequestId) {
            throw new BadRequestException('booking_id, bookingId, and changeRequestId are required');
        }

        const booking = await this.cancelRepository.findHotelBookingByInternalIdAndTboRef({
            booking_id: statusReq.booking_id,
            bookingId: statusReq.bookingId,
        });

        if (!booking) {
            throw new BadRequestException(
                'Hotel booking not found or bookingId does not match supplier reference',
            );
        }

        const existing =
            statusReq.cancellationId
                ? { cancellation_id: statusReq.cancellationId }
                : await this.cancelRepository.findHotelCancellationByChangeRequestId({
                      booking_id: statusReq.booking_id,
                      changeRequestId: statusReq.changeRequestId,
                  });

        const providerCancelReq = {
            bookingId: statusReq.bookingId,
            supplierParams: { providerCode: booking.supplier_name },
        };

        const result = await this.providerCancellationService.providerPollCancelStatus({
            cancelReq: providerCancelReq,
            headers,
            booking,
            changeRequestId: statusReq.changeRequestId,
        });

        if (existing?.cancellation_id) {
            result.cancellationId = existing.cancellation_id;
            try {
                const extended = result as CancelResponse & {
                    getChangeRequestStatusResponse?: unknown;
                };

                await this.cancelRepository.updateHotelCancellationRecord({
                    cancellation_id: existing.cancellation_id,
                    bookingId: statusReq.bookingId.toString(),
                    booking_id: statusReq.booking_id,
                    cancellationResponse: {
                        changeRequestId: result.changeRequestId,
                        traceId: result.traceId,
                        status: result.status,
                        hotelChangeRequestStatus: result.hotelChangeRequestStatus,
                        cancellationCharge: result.cancellationCharge,
                        refundedAmount: result.refundedAmount,
                        remarks: result.remarks,
                        getChangeRequestStatusResponse: extended.getChangeRequestStatusResponse,
                    },
                    cancellationStatus: result.cancellationStatus === true,
                });
            } catch (dbError) {
                console.error('[CANCEL-HOTEL-STATUS] DB update failed:', dbError);
            }
        }

        console.log('[CANCEL-HOTEL-STATUS] Final response:', JSON.stringify(result, null, 2));
        console.log('════════════════ HOTEL CANCEL STATUS END ════════════════');

        return result;
    }

    private async persistCancellationResult(params: {
        cancelReq: GenericCancelDto;
        result: CancelResponse;
        existingCancellationId?: string;
    }): Promise<void> {
        const { cancelReq, result, existingCancellationId } = params;

        if (!result.changeRequestId) {
            console.log('[CANCEL-HOTEL] Skipping DB save — no changeRequestId from TBO');
            return;
        }

        const extended = result as CancelResponse & {
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
                hotelChangeRequestStatus: result.hotelChangeRequestStatus,
                cancellationCharge: result.cancellationCharge,
                refundedAmount: result.refundedAmount,
                remarks: cancelReq.supplierParams?.remarks ?? result.remarks,
                sendChangeRequestResponse: extended.sendChangeRequestResponse,
                getChangeRequestStatusResponse: extended.getChangeRequestStatusResponse,
            },
            cancellationStatus: result.cancellationStatus === true,
            requestType: cancelReq.requestType || 'FullCancellation',
        };

        try {
            if (existingCancellationId) {
                console.log('[CANCEL-HOTEL] Updating in-flight cancellation:', existingCancellationId);
                await this.cancelRepository.updateHotelCancellationRecord({
                    cancellation_id: existingCancellationId,
                    bookingId: dbPayload.bookingId,
                    booking_id: dbPayload.booking_id,
                    cancellationResponse: dbPayload.cancellationResponse,
                    cancellationStatus: dbPayload.cancellationStatus,
                });
                result.cancellationId = existingCancellationId;
            } else {
                console.log('[CANCEL-HOTEL] Saving cancellation record:', JSON.stringify(dbPayload, null, 2));
                const saved = await this.cancelRepository.createHotelCancellationRecord(dbPayload);
                result.cancellationId = saved.cancellation_id;
                console.log('[CANCEL-HOTEL] Saved cancellation_id:', saved.cancellation_id);
            }
        } catch (dbError) {
            console.error('[CANCEL-HOTEL] DB save failed:', dbError);
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
