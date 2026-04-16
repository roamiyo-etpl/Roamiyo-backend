import { ConflictException } from '@nestjs/common';

/**
 * Custom exception for duplicate booking detection
 * Thrown when a user attempts to create a booking with same details
 * while a previous booking is still PENDING or INPROGRESS
 */
export class DuplicateBookingException extends ConflictException {
    constructor(existingBookingId: string, bookingStatus: string) {
        super({
            statusCode: 409,
            error: 'Duplicate Booking',
            message:
                `A booking with same details already exists (Booking ID: ${existingBookingId}). ` +
                `Status: ${bookingStatus}. ` +
                `Please wait for the current booking to complete or cancel it before creating a new one.`,
            existingBookingId,
            bookingStatus,
        });
    }
}
