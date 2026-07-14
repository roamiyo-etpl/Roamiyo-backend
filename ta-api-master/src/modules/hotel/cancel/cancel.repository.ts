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
            creditNoteNo?: string;
            creditNoteCreatedOn?: string;
            creditNoteGstin?: string;
            totalPrice?: number;
            sendChangeRequestResponse?: unknown;
            getChangeRequestStatusResponse?: unknown;
        };
        cancellationStatus: boolean;
        requestType?: string;
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

        this.applyHotelCancellationFields(cancellation, {
            cancellationResponse,
            cancellationStatus,
            requestType: params.requestType,
            keepExisting: true,
        });

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
            creditNoteNo?: string;
            creditNoteCreatedOn?: string;
            creditNoteGstin?: string;
            totalPrice?: number;
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
        cancellation.ticket_ids = null;
        cancellation.cancellation_type = null;

        this.applyHotelCancellationFields(cancellation, {
            cancellationResponse,
            cancellationStatus,
            requestType,
            keepExisting: false,
        });

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

    private applyHotelCancellationFields(
        cancellation: Cancellation,
        params: {
            cancellationResponse: {
                changeRequestId?: number;
                traceId?: string;
                status?: string;
                hotelChangeRequestStatus?: number;
                cancellationCharge?: number;
                refundedAmount?: number;
                remarks?: string;
                creditNoteNo?: string;
                creditNoteCreatedOn?: string;
                creditNoteGstin?: string;
                totalPrice?: number;
                sendChangeRequestResponse?: unknown;
                getChangeRequestStatusResponse?: unknown;
            };
            cancellationStatus: boolean;
            requestType?: string;
            keepExisting: boolean;
        },
    ): void {
        const { cancellationResponse, cancellationStatus, requestType, keepExisting } = params;
        const creditFields = this.resolveCreditNoteFields(cancellationResponse);

        if (!keepExisting || cancellationResponse.changeRequestId != null) {
            cancellation.change_request_id =
                cancellationResponse.changeRequestId ?? cancellation.change_request_id ?? null;
        }
        cancellation.trace_id = cancellationResponse.traceId ?? cancellation.trace_id ?? null;
        cancellation.status = this.mapHotelChangeRequestStatusToDb(
            cancellationResponse.hotelChangeRequestStatus,
        );
        cancellation.cancellation_charge =
            cancellationResponse.cancellationCharge ?? cancellation.cancellation_charge ?? null;
        cancellation.refunded_amount =
            cancellationResponse.refundedAmount ?? cancellation.refunded_amount ?? null;
        cancellation.remarks = cancellationResponse.remarks ?? cancellation.remarks ?? null;
        if (requestType || !keepExisting) {
            cancellation.request_type = this.mapRequestType(requestType);
        }
        cancellation.credit_note_no =
            creditFields.creditNoteNo ?? cancellation.credit_note_no ?? null;
        cancellation.credit_note_created_on =
            creditFields.creditNoteCreatedOn ?? cancellation.credit_note_created_on ?? null;

        cancellation.additional_data = {
            ...(keepExisting ? cancellation.additional_data ?? {} : {}),
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
            creditNoteNo: creditFields.creditNoteNo ?? cancellation.additional_data?.creditNoteNo ?? null,
            creditNoteCreatedOn:
                creditFields.creditNoteCreatedOnIso ??
                cancellation.additional_data?.creditNoteCreatedOn ??
                null,
            creditNoteGstin:
                creditFields.creditNoteGstin ?? cancellation.additional_data?.creditNoteGstin ?? null,
            totalPrice: creditFields.totalPrice ?? cancellation.additional_data?.totalPrice ?? null,
            sendChangeRequestResponse:
                cancellationResponse.sendChangeRequestResponse ??
                cancellation.additional_data?.sendChangeRequestResponse ??
                null,
            getChangeRequestStatusResponse:
                cancellationResponse.getChangeRequestStatusResponse ??
                cancellation.additional_data?.getChangeRequestStatusResponse ??
                null,
        };
    }

    private resolveCreditNoteFields(cancellationResponse: {
        creditNoteNo?: string;
        creditNoteCreatedOn?: string;
        creditNoteGstin?: string;
        totalPrice?: number;
        sendChangeRequestResponse?: unknown;
        getChangeRequestStatusResponse?: unknown;
    }): {
        creditNoteNo?: string;
        creditNoteCreatedOn?: Date;
        creditNoteCreatedOnIso?: string;
        creditNoteGstin?: string;
        totalPrice?: number;
    } {
        const fromStatus = this.readTboCreditFields(
            cancellationResponse.getChangeRequestStatusResponse,
        );
        const fromSend = this.readTboCreditFields(cancellationResponse.sendChangeRequestResponse);

        const creditNoteNo =
            cancellationResponse.creditNoteNo ||
            fromStatus.creditNoteNo ||
            fromSend.creditNoteNo;
        const creditNoteCreatedOnIso =
            cancellationResponse.creditNoteCreatedOn ||
            fromStatus.creditNoteCreatedOn ||
            fromSend.creditNoteCreatedOn;
        const creditNoteGstin =
            cancellationResponse.creditNoteGstin ||
            fromStatus.creditNoteGstin ||
            fromSend.creditNoteGstin;
        const totalPrice =
            cancellationResponse.totalPrice ?? fromStatus.totalPrice ?? fromSend.totalPrice;

        return {
            creditNoteNo: creditNoteNo || undefined,
            creditNoteCreatedOn: creditNoteCreatedOnIso
                ? new Date(creditNoteCreatedOnIso)
                : undefined,
            creditNoteCreatedOnIso: creditNoteCreatedOnIso || undefined,
            creditNoteGstin: creditNoteGstin || undefined,
            totalPrice: totalPrice != null ? Number(totalPrice) : undefined,
        };
    }

    private readTboCreditFields(raw: unknown): {
        creditNoteNo?: string;
        creditNoteCreatedOn?: string;
        creditNoteGstin?: string;
        totalPrice?: number;
    } {
        if (!raw || typeof raw !== 'object') {
            return {};
        }

        const data = raw as Record<string, unknown>;
        return {
            creditNoteNo: typeof data.CreditNoteNo === 'string' ? data.CreditNoteNo : undefined,
            creditNoteCreatedOn:
                typeof data.CreditNoteCreatedOn === 'string' ? data.CreditNoteCreatedOn : undefined,
            creditNoteGstin:
                typeof data.CreditNoteGSTIN === 'string' ? data.CreditNoteGSTIN : undefined,
            totalPrice:
                data.TotalPrice != null && !Number.isNaN(Number(data.TotalPrice))
                    ? Number(data.TotalPrice)
                    : undefined,
        };
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
