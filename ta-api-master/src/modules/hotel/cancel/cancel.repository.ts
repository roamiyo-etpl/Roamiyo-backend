import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Booking, BookingStatus } from 'src/shared/entities/bookings.entity';
import {
    Cancellation,
    CancellationRequestType,
    CancellationStatusEnum,
} from 'src/shared/entities/cancellations.entity';
import { supplierReferenceIncludes } from 'src/shared/utilities/flight/supplier-reference.utility';
import {
    HotelChangeRequestStatus,
    getHotelChangeRequestStatusLabel,
    isHotelCancellationInFlight,
    isHotelCancellationSuccessful,
} from './dtos/hotel-cancel.dto';

const HOTEL_MODULE_TYPE = 2;

@Injectable()
export class HotelCancelRepository extends Repository<Booking> {
    constructor(private readonly dataSource: DataSource) {
        super(Booking, dataSource.createEntityManager());
    }

    async findHotelBookingByInternalIdAndTboRef(params: {
        booking_id: string;
        bookingId: string | number;
    }): Promise<Booking | null> {
        const booking = await this.findOne({
            where: { booking_id: params.booking_id.trim() },
        });

        if (!booking) {
            return null;
        }

        if (booking.module_type !== HOTEL_MODULE_TYPE) {
            return null;
        }

        if (!supplierReferenceIncludes(booking.supplier_reference_id, params.bookingId)) {
            return null;
        }

        return booking;
    }

    /**
     * Prevent duplicate cancellation when booking is already cancelled
     * or a prior hotel cancel reached Processed (3).
     */
    async hasExistingSuccessfulHotelCancellation(booking_id: string): Promise<boolean> {
        const booking = await this.findOne({ where: { booking_id } });
        if (booking?.booking_status === BookingStatus.CANCELLED) {
            return true;
        }

        const cancellations = await this.dataSource.getRepository(Cancellation).find({
            where: { booking_id },
            order: { created_at: 'DESC' },
        });

        return cancellations.some((row) => {
            const hotelStatus = row.additional_data?.hotelChangeRequestStatus;
            return (
                hotelStatus === HotelChangeRequestStatus.Processed ||
                row.additional_data?.cancellationStatus === true
            );
        });
    }

    async findInFlightHotelCancellation(booking_id: string): Promise<Cancellation | null> {
        const cancellations = await this.dataSource.getRepository(Cancellation).find({
            where: { booking_id },
            order: { created_at: 'DESC' },
        });

        return (
            cancellations.find((row) =>
                isHotelCancellationInFlight(row.additional_data?.hotelChangeRequestStatus ?? -1),
            ) ?? null
        );
    }

    async findHotelCancellationByChangeRequestId(params: {
        booking_id: string;
        changeRequestId: number;
    }): Promise<Cancellation | null> {
        const cancellations = await this.dataSource.getRepository(Cancellation).find({
            where: { booking_id: params.booking_id },
            order: { created_at: 'DESC' },
        });

        return (
            cancellations.find(
                (row) => Number(row.change_request_id) === Number(params.changeRequestId),
            ) ?? null
        );
    }

    async updateHotelCancellationRecord(params: {
        cancellation_id: string;
        bookingId: string;
        booking_id: string;
        cancellationResponse: {
            changeRequestId?: number;
            traceId?: string;
            status?: string;
            hotelChangeRequestStatus?: number;
            cancellationCharge?: number;
            refundedAmount?: number;
            remarks?: string;
            getChangeRequestStatusResponse?: unknown;
        };
        cancellationStatus: boolean;
    }): Promise<Cancellation> {
        const { cancellation_id, bookingId, booking_id, cancellationResponse, cancellationStatus } =
            params;

        const cancellationRepo = this.dataSource.getRepository(Cancellation);
        const cancellation = await cancellationRepo.findOne({
            where: { cancellation_id },
        });

        if (!cancellation) {
            throw new Error(`Cancellation record not found: ${cancellation_id}`);
        }

        const booking = await this.findHotelBookingByInternalIdAndTboRef({
            booking_id,
            bookingId,
        });

        if (!booking) {
            throw new Error(`Hotel booking not found with reference ID: ${bookingId}`);
        }

        cancellation.trace_id = cancellationResponse.traceId ?? cancellation.trace_id;
        cancellation.status = this.mapHotelChangeRequestStatusToDb(
            cancellationResponse.hotelChangeRequestStatus,
        );
        cancellation.cancellation_charge =
            cancellationResponse.cancellationCharge ?? cancellation.cancellation_charge;
        cancellation.refunded_amount =
            cancellationResponse.refundedAmount ?? cancellation.refunded_amount;
        cancellation.remarks = cancellationResponse.remarks ?? cancellation.remarks;
        cancellation.additional_data = {
            ...cancellation.additional_data,
            module: 'hotel',
            hotelChangeRequestStatus:
                cancellationResponse.hotelChangeRequestStatus ??
                cancellation.additional_data?.hotelChangeRequestStatus ??
                null,
            hotelChangeRequestStatusText:
                cancellationResponse.status ??
                cancellation.additional_data?.hotelChangeRequestStatusText ??
                null,
            cancellationStatus,
            getChangeRequestStatusResponse:
                cancellationResponse.getChangeRequestStatusResponse ??
                cancellation.additional_data?.getChangeRequestStatusResponse ??
                null,
        };

        if (
            cancellationStatus &&
            isHotelCancellationSuccessful(
                cancellationResponse.hotelChangeRequestStatus ?? -1,
            )
        ) {
            booking.booking_status = BookingStatus.CANCELLED;
            booking.updated_at = new Date();
            await this.save(booking);
        }

        return cancellationRepo.save(cancellation);
    }

    async createHotelCancellationRecord(params: {
        bookingId: string;
        booking_id: string;
        cancellationResponse: {
            changeRequestId?: number;
            traceId?: string;
            status?: string;
            hotelChangeRequestStatus?: number;
            cancellationCharge?: number;
            refundedAmount?: number;
            remarks?: string;
            sendChangeRequestResponse?: unknown;
            getChangeRequestStatusResponse?: unknown;
        };
        cancellationStatus: boolean;
        requestType?: string;
    }): Promise<Cancellation> {
        const { bookingId, booking_id, cancellationResponse, cancellationStatus, requestType } =
            params;

        const booking = await this.findHotelBookingByInternalIdAndTboRef({
            booking_id,
            bookingId,
        });

        if (!booking) {
            throw new Error(`Hotel booking not found with reference ID: ${bookingId}`);
        }

        const cancellation = new Cancellation();
        cancellation.booking_id = booking.booking_id;
        cancellation.booking_reference_id = booking.booking_reference_id;
        cancellation.supplier_reference_id = bookingId;
        cancellation.cancel_date = new Date();
        cancellation.change_request_id = cancellationResponse.changeRequestId ?? null;
        cancellation.trace_id = cancellationResponse.traceId ?? null;
        cancellation.status = this.mapHotelChangeRequestStatusToDb(
            cancellationResponse.hotelChangeRequestStatus,
        );
        cancellation.cancellation_charge = cancellationResponse.cancellationCharge ?? null;
        cancellation.refunded_amount = cancellationResponse.refundedAmount ?? null;
        cancellation.remarks = cancellationResponse.remarks ?? null;
        cancellation.request_type = this.mapRequestType(requestType);
        cancellation.additional_data = {
            module: 'hotel',
            hotelChangeRequestStatus: cancellationResponse.hotelChangeRequestStatus ?? null,
            hotelChangeRequestStatusText: cancellationResponse.status ?? null,
            cancellationStatus,
            sendChangeRequestResponse: cancellationResponse.sendChangeRequestResponse ?? null,
            getChangeRequestStatusResponse:
                cancellationResponse.getChangeRequestStatusResponse ?? null,
        };

        if (
            cancellationStatus &&
            isHotelCancellationSuccessful(
                cancellationResponse.hotelChangeRequestStatus ?? -1,
            )
        ) {
            booking.booking_status = BookingStatus.CANCELLED;
            booking.updated_at = new Date();
            await this.save(booking);
        }

        return this.dataSource.getRepository(Cancellation).save(cancellation);
    }

    private mapRequestType(requestType?: string): CancellationRequestType | null {
        if (!requestType) {
            return CancellationRequestType.FullCancellation;
        }

        const map: Record<string, CancellationRequestType> = {
            FullCancellation: CancellationRequestType.FullCancellation,
            HotelCancel: CancellationRequestType.FullCancellation,
            '4': CancellationRequestType.FullCancellation,
        };

        return map[requestType] ?? CancellationRequestType.FullCancellation;
    }

    /**
     * Maps TBO hotel ChangeRequestStatus (0–4) to shared cancellations.status enum.
     * Raw hotel status is always preserved in additional_data.hotelChangeRequestStatus.
     */
    private mapHotelChangeRequestStatusToDb(
        hotelStatus?: number,
    ): CancellationStatusEnum | null {
        if (hotelStatus === undefined || hotelStatus === null) {
            return null;
        }

        const map: Record<HotelChangeRequestStatus, CancellationStatusEnum> = {
            [HotelChangeRequestStatus.NotSet]: CancellationStatusEnum.NotSet,
            [HotelChangeRequestStatus.Pending]: CancellationStatusEnum.Pending,
            [HotelChangeRequestStatus.InProgress]: CancellationStatusEnum.Assigned,
            [HotelChangeRequestStatus.Processed]: CancellationStatusEnum.Completed,
            [HotelChangeRequestStatus.Rejected]: CancellationStatusEnum.Rejected,
        };

        return map[hotelStatus as HotelChangeRequestStatus] ?? null;
    }

    getHotelStatusLabel(status: number): string {
        return getHotelChangeRequestStatusLabel(status);
    }
}
