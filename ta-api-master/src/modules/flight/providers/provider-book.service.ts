import { Injectable, NotFoundException } from '@nestjs/common';
import { BookResponse } from '../book/interfaces/book.interface';
import { BookDto } from '../book/dtos/book.dto';
import { ConfigurationService } from '../configuration/configuration.service';
import { TboBookService } from './tbo/tbo-book.service';
import { ProviderOrderDetailService } from './provider-order-detail.service';
import { OrderDetailDto } from '../order-details/dtos/order-detail.dto';
import { BookingStatus } from 'src/shared/entities/bookings.entity';

@Injectable()
export class ProviderBookService {
    constructor(
        private configService: ConfigurationService,
        private tboBookService: TboBookService,
        private providerOrderDetailService: ProviderOrderDetailService,
    ) {}

    /** [@Description: This method is used to book the flight]
     * @author: Prashant Joshi at 23-09-2025 **/
    async providerBook(reqParams): Promise<BookResponse> {
        const { bookReq, headers, logId } = reqParams;
        const providerConfig = await this.configService.getConfiguration({ supplierCode: bookReq.providerCode.toUpperCase(), mode: '', module: 'Flight' });

        if (!providerConfig) {
            throw new NotFoundException('Provider code is not valid, Check your provider code and try again.');
        }

        const bookRequest = [];
        let bookResult;

        bookRequest['bookReq'] = bookReq;
        bookRequest['providerCred'] = JSON.parse(providerConfig.provider_credentials);
        bookRequest['headers'] = headers;
        bookRequest['logId'] = logId;
        /* Check for provider code First and transform the request to particular provider */
        switch (bookReq.providerCode.toUpperCase()) {
            case 'TBO':
                bookResult = await this.tboBookService.book(bookRequest);
                break;
        }

        // Call order detail API after successful booking
        if (bookResult && !bookResult.error && bookResult.orderDetail && bookResult.orderDetail.length > 0) {
            try {
                const orderDetailDto = this.buildOrderDetailDto({ bookReq, bookResult });
                const { orderDetails, supplierOrderDetailResponse } = await this.providerOrderDetailService.providerOrderDetail({ orderDetailDto, headers });
                bookResult.orderDetails = orderDetails;
                bookResult.supplierOrderDetailResponse = supplierOrderDetailResponse;
            } catch (error) {
                console.error('Error fetching order details:', error);
                // Continue without order details if fetch fails
            }
        }

        return bookResult;
    }

    /** [@Description: Build OrderDetailDto from booking request and response]
     * @author: Prashant Joshi **/
    private buildOrderDetailDto(reqParams): OrderDetailDto {
        const { bookReq, bookResult } = reqParams;
        const orderDetailDto = new OrderDetailDto();
        orderDetailDto.providerCode = bookReq.providerCode;
        orderDetailDto.searchReqId = bookReq.searchReqId;
        // Extract mode from full mode string (e.g., 'TBO-Test' -> 'test')
        orderDetailDto.mode = bookResult.mode.split('-').pop().toLowerCase();

        // Map booking details from order response
        orderDetailDto.bookingDetails = bookResult.orderDetail.map((order) => ({
            orderStatus: this.mapOrderStatus(order.orderStatus),
            pnr: order.pnr || '',
            orderNo: order.orderNo,
            firstName: bookReq.passengers[0]?.passengerDetail?.firstName || '',
            lastName: bookReq.passengers[0]?.passengerDetail?.lastName || '',
        }));

        // Map search air legs from routes - handles both oneway and roundtrip
        orderDetailDto.searchAirLegs = [];

        // routes is now RouteDetails[][] - each element is an array of flight segments
        bookReq.routes.forEach((route) => {
            // Process each route (leg of the journey)
            if (route && route.length > 0) {
                const firstSegment = route[0];
                const lastSegment = route[route.length - 1];
                orderDetailDto.searchAirLegs.push({
                    origin: firstSegment.departureCode,
                    destination: lastSegment.arrivalCode,
                    departureDate: firstSegment.departureDate,
                });
            }
        });

        return orderDetailDto;
    }

    /** [@Description: Map order status string to numeric value using existing BookingStatus enum]
     * @author: Prashant Joshi at 13-10-2025 **/
    private mapOrderStatus(status: string): number {
        const normalizedStatus = status?.toUpperCase();
        return BookingStatus[normalizedStatus] ?? BookingStatus.PENDING;
    }
}
