import { Injectable } from '@nestjs/common';
import { BookingAdditionalDetail } from 'src/shared/entities/booking-additional-details.entity';
import { Booking, BookingStatus } from 'src/shared/entities/bookings.entity';
import { DataSource, LessThanOrEqual, Repository } from 'typeorm';

@Injectable()
export class OrderDetailRepository extends Repository<Booking> {
    constructor(private readonly dataSource: DataSource) {
        super(Booking, dataSource.createEntityManager());
    }

    async getAllPendingBookings(): Promise<Booking[]> {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        return this.find({ where: { booking_status: BookingStatus.PENDING }, relations: ['bookingAdditionalDetails'] });
    }

    async updateBookingStatus(bookingId: string, bookingStatus: number): Promise<void> {
        await this.update(bookingId, { booking_status: bookingStatus, updated_at: new Date() });
    }

    async getInProgressBookings(): Promise<Booking[]> {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

        return this.find({
            where: {
                booking_status: BookingStatus.INPROGRESS,
                created_at: LessThanOrEqual(twoHoursAgo),
            },
            relations: ['bookingAdditionalDetails'],
        });
    }

    async updateInProgressToFailed(bookingId: string): Promise<void> {
        await this.update(bookingId, { booking_status: BookingStatus.FAILED, updated_at: new Date() });
    }
}
