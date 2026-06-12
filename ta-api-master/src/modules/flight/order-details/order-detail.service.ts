import { BadRequestException, Injectable } from '@nestjs/common';
import { ProviderOrderDetailService } from '../providers/provider-order-detail.service';
import { OrderDetailResponse } from './interfaces/order-detail.interface';
import { OrderDetailDto } from './dtos/order-detail.dto';
import { OrderDetailRepository } from './order-detail.repository';
import { Booking, BookingStatus } from 'src/shared/entities/bookings.entity';

@Injectable()
export class OrderDetailService {
    constructor(
        private readonly providerOrderDetailService: ProviderOrderDetailService,
        private readonly orderDetailRepository: OrderDetailRepository,
    ) {}

    /** [@Description: This method is used to get the order details]
     * @author: Prashant Joshi at 23-09-2025 **/
    async getOrderDetails(orderReq: OrderDetailDto, headers: Headers): Promise<{ orderDetails: OrderDetailResponse[]; supplierOrderDetailResponse: any[] }> {
        let { orderDetails, supplierOrderDetailResponse } = await this.providerOrderDetailService.providerOrderDetail({ orderReq, headers });
        return {
            orderDetails: orderDetails,
            supplierOrderDetailResponse: supplierOrderDetailResponse,
        };
    }

    /** [@Description: This method is used to update the booking status]
     * @author: Prashant Joshi at 31-10-2025 **/
    async updateBookingStatus(): Promise<void> {
        // Get all pending bookings
        const pendingBookings = await this.orderDetailRepository.getAllPendingBookings();
        console.log(pendingBookings);

        for (const booking of pendingBookings) {
            // Mail if booking pending for more than 2 hours
            if (booking.created_at < new Date(Date.now() - 2 * 60 * 60 * 1000)) {
                // TODO: send pending mail logic
            }

            const orderDetailsData = booking.bookingAdditionalDetails?.api_response?.orderDetails || [];
            if (!orderDetailsData.length) continue;

            //  Domestic roundtrip if more than one order array
            const isDomesticRoundTrip = orderDetailsData.length > 1;

            //  If domestic roundtrip and any order failed → keep booking pending
            if (isDomesticRoundTrip) {
                const anyFailed = orderDetailsData.some((order) => order.orderStatus === 'FAILED');
                if (anyFailed) {
                    await this.orderDetailRepository.updateBookingStatus(booking.booking_id, BookingStatus.PENDING);
                    continue;
                }
            }

            // TBO GetBookingDetails requires ticket passenger name, not contact person
            const { firstName, lastName } = this.getTicketPassengerName(booking);

            // Prepare bookingDetails array for provider request (each order has its own pnr/orderNo)
            const bookingDetailsArray = orderDetailsData.map((order) => ({
                pnr: order.pnr,
                orderNo: order.orderNo,
                // firstName: booking.contact_details.firstName,
//                 lastName: booking.contact_details.lastName,
                firstName,
                lastName,
            }));

            // Call provider API
            const { orderDetails } = await this.providerOrderDetailService.providerOrderDetail({
                orderDetailDto: this.createOrderDetailRequest(booking, bookingDetailsArray),
                headers: { 'ip-address': '127.0.0.1' },
            });

            // Cron is a refresh job: only upgrade PENDING → CONFIRMED.
            // NEVER write FAILED here — a read failure is not a booking failure.
            if (!Array.isArray(orderDetails) || orderDetails.length === 0) {
                continue;
            }

            const anyReadFailed = orderDetails.some(
                (o: any) => o?.error === true || String(o?.bookingStatus).toUpperCase() === 'FAILED',
            );
            if (anyReadFailed) {
                console.warn(`[Cron] Skipping booking ${booking.booking_id}: TBO read failed for one or more legs.`);
                continue;
            }

            const allLegsConfirmed = orderDetails.every(
                (o: any) => String(o?.bookingStatus).toUpperCase() === 'CONFIRMED',
            );

            if (allLegsConfirmed) {
                await this.orderDetailRepository.updateBookingStatus(booking.booking_id, BookingStatus.CONFIRMED);
            }
        }

        return;
    }

    createOrderDetailRequest(booking, bookingDetails: any[]) {
        const storedMode = booking.bookingAdditionalDetails?.api_response?.booking?.response?.mode;
        const mode = storedMode ? storedMode.split('-').pop().toLowerCase() : 'Test';

        return {
            providerCode: booking.supplier_name,
            mode,
            bookingDetails, // each has pnr, orderNo, names
            searchReqId: booking.search_id,
        };
    }

    /** Lead passenger on ticket — TBO rejects GetBookingDetails when contact name differs from pax name. */
    private getTicketPassengerName(booking: Booking): { firstName: string; lastName: string } {
        const fromPaxes = booking.paxes?.[0]?.adult?.data?.[0];
        if (fromPaxes?.firstName && fromPaxes?.lastName) {
            return { firstName: fromPaxes.firstName, lastName: fromPaxes.lastName };
        }

        const bookRequest = booking.bookingAdditionalDetails?.api_response?.booking?.request;
        const passengerDetail = bookRequest?.passengers?.[0]?.passengerDetail;
        if (passengerDetail?.firstName && passengerDetail?.lastName) {
            return { firstName: passengerDetail.firstName, lastName: passengerDetail.lastName };
        }

        console.warn(
            `[OrderDetail] Falling back to contact_details for booking ${booking.booking_id} — passenger name not found in paxes or api_response`,
        );
        return {
            firstName: booking.contact_details?.firstName ?? '',
            lastName: booking.contact_details?.lastName ?? '',
        };
    }

    async updateInProgressToFailed(): Promise<void> {
        const inProgressBookings = await this.orderDetailRepository.getInProgressBookings();
        console.log(inProgressBookings.length);
        for (const booking of inProgressBookings) {
            await this.orderDetailRepository.updateInProgressToFailed(booking.booking_id);
        }
        return;
    }
}
