import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { BookResponse } from "../book/interfaces/book.interface";
import { BookDto } from "../book/dtos/book.dto";
import { ConfigurationService } from "../configuration/configuration.service";
import { TboBookService } from "./tbo/tbo-book.service";
import { ProviderOrderDetailService } from "./provider-order-detail.service";
import { OrderDetailDto } from "../order-details/dtos/order-detail.dto";
import { BookingStatus } from "src/shared/entities/bookings.entity";
import { flightBookingDebug } from "src/shared/utilities/flight/flight-booking-logger.utility";

@Injectable()
export class ProviderBookService {
  private readonly logger = new Logger(ProviderBookService.name);

  constructor(
    private configService: ConfigurationService,
    private tboBookService: TboBookService,
    private providerOrderDetailService: ProviderOrderDetailService,
  ) {}

  /** [@Description: This method is used to book the flight]
   * @author: Prashant Joshi at 23-09-2025 **/
  async providerBook(reqParams): Promise<BookResponse> {
    const { bookReq, headers, logId } = reqParams;
    flightBookingDebug('Provider book start', {
      searchReqId: bookReq.searchReqId,
      provider: bookReq.providerCode,
    });

    const providerConfig = await this.configService.getConfiguration({
      supplierCode: bookReq.providerCode.toUpperCase(),
      mode: "",
      module: "Flight",
    });

    if (!providerConfig) {
      throw new NotFoundException(
        "Provider code is not valid, Check your provider code and try again.",
      );
    }

    const bookRequest = [];
    let bookResult;

    bookRequest["bookReq"] = bookReq;
    bookRequest["providerCred"] = JSON.parse(
      providerConfig.provider_credentials,
    );
    bookRequest["headers"] = headers;
    bookRequest["logId"] = logId;

    switch (bookReq.providerCode.toUpperCase()) {
      case "TBO":
        bookResult = await this.tboBookService.book(bookRequest);
        break;
    }

    flightBookingDebug('Provider book finished', {
      error: bookResult?.error,
    });

    return bookResult;
  }

  /** Fetch order details after book — intended for async post-confirm enrichment. */
  async fetchOrderDetails(reqParams: {
    bookReq: BookDto;
    bookResult: BookResponse;
    headers: Headers;
  }): Promise<{
    orderDetails: unknown;
    supplierOrderDetailResponse: unknown;
  } | null> {
    const { bookReq, bookResult, headers } = reqParams;
    if (
      !bookResult ||
      bookResult.error ||
      !bookResult.orderDetail ||
      bookResult.orderDetail.length === 0
    ) {
      return null;
    }

    const orderDetailDto = this.buildOrderDetailDto({
      bookReq,
      bookResult,
    });
    const { orderDetails, supplierOrderDetailResponse } =
      await this.providerOrderDetailService.providerOrderDetail({
        orderDetailDto,
        headers,
      });

    return { orderDetails, supplierOrderDetailResponse };
  }

  /** [@Description: Build OrderDetailDto from booking request and response]
   * @author: Prashant Joshi **/
  private buildOrderDetailDto(reqParams): OrderDetailDto {
    const { bookReq, bookResult } = reqParams;
    const orderDetailDto = new OrderDetailDto();
    orderDetailDto.providerCode = bookReq.providerCode;
    orderDetailDto.searchReqId = bookReq.searchReqId;
    orderDetailDto.mode = bookResult.mode.split("-").pop().toLowerCase();

    orderDetailDto.bookingDetails = bookResult.orderDetail.map((order) => ({
      orderStatus: this.mapOrderStatus(order.orderStatus),
      pnr: order.pnr || "",
      orderNo: order.orderNo,
      firstName: bookReq.passengers[0]?.passengerDetail?.firstName || "",
      lastName: bookReq.passengers[0]?.passengerDetail?.lastName || "",
    }));

    orderDetailDto.searchAirLegs = [];

    bookReq.routes.forEach((route) => {
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

  private mapOrderStatus(status: string): number {
    const normalizedStatus = status?.toUpperCase();
    return BookingStatus[normalizedStatus] ?? BookingStatus.PENDING;
  }
}
