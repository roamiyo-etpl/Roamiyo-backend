import { Injectable, BadRequestException } from '@nestjs/common';
import { ProviderCancellationService } from '../providers/provider-cancellation.service';
import { GenericCancelDto } from 'src/modules/cancel/dto/cancel.dto';
import { CancelResponse } from 'src/modules/cancel/interfaces/cancel.interface';
import { CancelRepository } from './cancel.repository';

@Injectable()
export class CancelService {
    constructor(
        private readonly providerCancellationService: ProviderCancellationService,
        private readonly cancelRepository: CancelRepository,
    ) {}

    /**
     * Cancel flight booking
     * @param reqParams - Request parameters including DTO and headers
     * @returns Promise<CancelFlightResponse>
     */
    async cancelFlight(reqParams): Promise<CancelResponse> {
        const { cancelReq, headers } = reqParams;

        try {
            // Validate request
            this.validateCancelRequest(cancelReq);

            // Fetch booking details to validate status and get provider code
            const booking = await this.cancelRepository.findOne({
                where: { supplier_reference_id: cancelReq.bookingId.toString() },
            });

            if (!booking) {
                throw new BadRequestException('Booking not found');
            }

            // Get provider code from booking details instead of request
            cancelReq.supplierParams = {
                ...(cancelReq.supplierParams || {}),
                providerCode: booking.supplier_name,
            };

            // Pass booking details to provider service
            const result = await this.providerCancellationService.providerCancel({
                cancelReq,
                headers,
                booking, // Pass booking details
            });

            // Save cancellation details to database
            if (result.success) {
                try {
                    await this.cancelRepository.createCancellationRecord({
                        bookingId: cancelReq.bookingId.toString(),
                        cancellationResponse: result,
                        cancellationStatus: result.cancellationStatus === true,
                        requestType: cancelReq.requestType, 
                        cancellationType: cancelReq.cancellationType,
                        ticketIds: cancelReq.ticketIds || undefined,
                    });
                } catch (dbError) {
                    // Log error but don't fail the cancellation response
                    // The cancellation was successful from provider, even if DB update failed
                    console.error('Error saving cancellation record:', dbError);
                }
            }

            return result;
        } catch (error) {
            throw new BadRequestException({
                message: error.message || 'Cancellation failed',
                error: error.message,
            });
        }
    }

    /**
     * Get cancellation charges 
     */
    async getCancellationCharges(reqParams) {
        const { cancelReq } = reqParams;
        if (!cancelReq?.bookingId) {
            throw new BadRequestException('bookingId is required');
        }

        // Fetch booking details to get provider code
        const booking = await this.cancelRepository.findOne({
            where: { supplier_reference_id: cancelReq.bookingId.toString() },
        });

        if (!booking) {
            throw new BadRequestException('Booking not found');
        }

        // Get provider code from booking details
        cancelReq.supplierParams = {
            ...(cancelReq.supplierParams || {}),
            providerCode: booking.supplier_name,
        };

        return this.providerCancellationService.providerCancellationCharges({ cancelReq, headers: reqParams.headers, booking });
    }

    /**
     * Validate cancellation request
     * @param cancelReq - Cancellation request DTO
     */
    private validateCancelRequest(cancelReq: GenericCancelDto): void {
        if (!cancelReq.bookingId) {
            throw new BadRequestException('Booking ID is required');
        }

        if (!cancelReq.requestType) {
            throw new BadRequestException('Request type is required');
        }

        // For partial cancellation, validate sectors or ticket IDs
        if ((cancelReq.requestType || '').toString().toLowerCase() === 'partialcancellation') {
            const sp = cancelReq.supplierParams || {};
            if (!sp.sectors && !sp.ticketIds) {
                throw new BadRequestException('Sectors or ticket IDs are required for partial cancellation');
            }
        }
    }
}

