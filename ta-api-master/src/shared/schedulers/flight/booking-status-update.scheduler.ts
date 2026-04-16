import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrderDetailService } from 'src/modules/flight/order-details/order-detail.service';

@Injectable()
export class BookingStatusUpdateScheduler {
    constructor(private readonly orderDetailService: OrderDetailService) {
        // this.updateBookingStatus();
        // this.updateInProgressToFailed();
    }

    /**
     * Cron job to update booking status:
     * - Then every 10 minutes thereafter.
     */
    @Cron('0 */10 * * * *', { name: 'UpdateBookingStatus' })
    async updateBookingStatus() {
        console.log('Update booking status scheduler started');
        try {
            await this.orderDetailService.updateBookingStatus();
        } catch (error) {
            console.error('Error in update booking status scheduler', error);
        }
    }

    @Cron('0 */30 * * * *', { name: 'UpdateInProgressToFailed' })
    async updateInProgressToFailed() {
        console.log('Update in progress to failed scheduler started');
        try {
            await this.orderDetailService.updateInProgressToFailed();
        } catch (error) {
            console.error('Error in update in progress to failed scheduler', error);
        }
    }
}
