import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Booking, BookingStatus } from 'src/shared/entities/bookings.entity';
import { Cancellation, CancellationStatusEnum, CancellationRequestType, CancellationTypeEnum } from 'src/shared/entities/cancellations.entity';

@Injectable()
export class CancelRepository extends Repository<Booking> {
    constructor(private readonly dataSource: DataSource) {
        super(Booking, dataSource.createEntityManager());
    }

    /**
     * Create a new cancellation record
     * @param params - Parameters including bookingId and cancellation details
     * @param params.cancellationStatus - Boolean flag indicating if cancellation was successful 
     * @param params.cancellationResponse.status - Detailed cancellation status from supplier 
     */
    async createCancellationRecord(params: {
        bookingId: string;
        cancellationResponse: any;
        cancellationStatus: boolean; 
        requestType?: string;
        cancellationType?: string;
        ticketIds?: number[];
    }): Promise<Cancellation> {
        const { bookingId, cancellationResponse, cancellationStatus, requestType, cancellationType, ticketIds } = params;

        // Find the booking
        const booking = await this.findOne({
            where: { supplier_reference_id: bookingId },
        });

        if (!booking) {
            throw new Error(`Booking not found with reference ID: ${bookingId}`);
        }

        // Create new cancellation record
        const cancellation = new Cancellation();
        cancellation.booking_id = booking.booking_id;
        cancellation.booking_reference_id = booking.booking_reference_id;
        cancellation.supplier_reference_id = bookingId;
        cancellation.cancel_date = new Date();
        cancellation.change_request_id = cancellationResponse.changeRequestId || null;
        cancellation.trace_id = cancellationResponse.traceId || null;
        cancellation.status = this.mapCancellationStatus(cancellationResponse.status);
        cancellation.cancellation_charge = cancellationResponse.cancellationCharge || null;
        cancellation.refunded_amount = cancellationResponse.refundedAmount || null;
        cancellation.remarks = cancellationResponse.remarks || null;
        cancellation.request_type = this.mapRequestType(requestType);
        cancellation.cancellation_type = this.mapCancellationType(cancellationType);
        cancellation.credit_note_no = cancellationResponse.creditNoteNo || null;
        cancellation.credit_note_created_on = cancellationResponse.creditNoteCreatedOn ? new Date(cancellationResponse.creditNoteCreatedOn) : null;
        cancellation.ticket_ids = ticketIds && ticketIds.length > 0 ? ticketIds : null;

        // Update booking status to CANCELLED only for full cancellations
        if (cancellationStatus && requestType === 'FullCancellation') {
            booking.booking_status = BookingStatus.CANCELLED;
            await this.save(booking);
        }

        // Save cancellation record
        return this.dataSource.getRepository(Cancellation).save(cancellation);
    }

    /**
     * Get all cancellations for a booking
     * @param params - Parameters including bookingId
     */
    async getCancellationsByBookingId(params: {
        bookingId: string;
    }): Promise<Cancellation[]> {
        const { bookingId } = params;
        return this.dataSource.getRepository(Cancellation).find({
            where: { booking_id: bookingId },
            order: { created_at: 'DESC' },
        });
    }

    /**
     * Update booking with cancellation details (legacy method for backward compatibility)
     * @deprecated Use createCancellationRecord instead
     */
    async updateCancellationDetails(params: {
        bookingId: string;
        cancellationResponse: any;
        cancellationStatus: boolean;
        requestType?: string;
        cancellationType?: string;
    }): Promise<void> {
        await this.createCancellationRecord(params);
    }

    private mapRequestType(requestType?: string): CancellationRequestType | null {
        if (!requestType) return null;
        
        const map: Record<string, CancellationRequestType> = {
            'FullCancellation': CancellationRequestType.FullCancellation,
            'PartialCancellation': CancellationRequestType.PartialCancellation,
            'Reissuance': CancellationRequestType.Reissuance,
            '1': CancellationRequestType.FullCancellation,
            '2': CancellationRequestType.PartialCancellation,
            '3': CancellationRequestType.Reissuance,
        };
        
        return map[requestType] || null;
    }

    
    private mapCancellationType(cancellationType?: string): CancellationTypeEnum | null {
        if (!cancellationType) return null;
        
        const map: Record<string, CancellationTypeEnum> = {
            'NotSet': CancellationTypeEnum.NotSet,
            'NoShow': CancellationTypeEnum.NoShow,
            'FlightCancelled': CancellationTypeEnum.FlightCancelled,
            'Others': CancellationTypeEnum.Others,
            '0': CancellationTypeEnum.NotSet,
            '1': CancellationTypeEnum.NoShow,
            '2': CancellationTypeEnum.FlightCancelled,
            '3': CancellationTypeEnum.Others,
        };
        
        return map[cancellationType] || null;
    }

    private mapCancellationStatus(status?: string | number): CancellationStatusEnum | null {
        if (status === undefined || status === null) return null;
        if (typeof status === 'number') {
            // Guard for valid enum range 0..7
            return status in CancellationStatusEnum ? (status as CancellationStatusEnum) : null;
        }

        const normalized = (status || '').toString().trim();
        const map: Record<string, CancellationStatusEnum> = {
            'Unassigned': CancellationStatusEnum.Unassigned,
            'Assigned': CancellationStatusEnum.Assigned,
            'Acknowledged': CancellationStatusEnum.Acknowledged,
            'Completed': CancellationStatusEnum.Completed,
            'Rejected': CancellationStatusEnum.Rejected,
            'Closed': CancellationStatusEnum.Closed,
            'Pending': CancellationStatusEnum.Pending,
            'Other': CancellationStatusEnum.Other,
            '0': CancellationStatusEnum.Unassigned,
            '1': CancellationStatusEnum.Assigned,
            '2': CancellationStatusEnum.Acknowledged,
            '3': CancellationStatusEnum.Completed,
            '4': CancellationStatusEnum.Rejected,
            '5': CancellationStatusEnum.Closed,
            '6': CancellationStatusEnum.Pending,
            '7': CancellationStatusEnum.Other,
        };

        return map[normalized] ?? null;
    }
}

