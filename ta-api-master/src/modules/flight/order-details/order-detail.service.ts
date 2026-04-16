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

            // Prepare bookingDetails array for provider request (each order has its own pnr/orderNo)
            const bookingDetailsArray = orderDetailsData.map((order) => ({
                pnr: order.pnr,
                orderNo: order.orderNo,
                firstName: booking.contact_details.firstName,
                lastName: booking.contact_details.lastName,
            }));

            // Call provider API
            const { orderDetails } = await this.providerOrderDetailService.providerOrderDetail({
                orderDetailDto: this.createOrderDetailRequest(booking, bookingDetailsArray),
                headers: { 'ip-address': '127.0.0.1' },
            });

            // Determine final booking status
            const bookingStatus = orderDetails?.[0]?.bookingStatus || 'PENDING';

            await this.orderDetailRepository.updateBookingStatus(booking.booking_id, BookingStatus[bookingStatus.toUpperCase() as keyof typeof BookingStatus]);
        }

        return;
    }

    createOrderDetailRequest(booking, bookingDetails: any[]) {
        return {
            providerCode: booking.supplier_name,
            mode: 'Test',
            bookingDetails, // each has pnr, orderNo, names
            searchReqId: booking.search_id,
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
