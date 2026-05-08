import { BadRequestException, Injectable } from "@nestjs/common";
import { ProviderBookService } from "../providers/provider-book.service";
import {
  BookInitiateResponse,
  BookResponse,
} from "./interfaces/book.interface";
import {
  BookConfirmationDto,
  BookDto,
  normalizeBookRequestGst,
} from "./dtos/book.dto";
import { BookRepository } from "./book.repository";
import { Booking, BookingStatus } from "src/shared/entities/bookings.entity";
import { v4 as uuid } from "uuid";
import { Generic } from "src/shared/utilities/flight/generic.utility";
import { DuplicateBookingException } from "./exceptions/duplicate-booking.exception";
import { RevalidateService } from "../revalidate/revalidate.service";
import { Fare } from "../search/interfaces/start-routing.interface";
import {
  normalizeBundledSsrPerPassengers,
  ssrBucketsToNumericRecord,
} from "src/shared/utilities/flight/ssr-passenger-normalize.utility";

@Injectable()
export class BookService {
  constructor(
    private readonly providerBookService: ProviderBookService,
    private readonly bookRepository: BookRepository,
    private readonly revalidateService: RevalidateService,
  ) {}

  /** [@Description: This method is used to initiate the booking]
   * @author: Prashant Joshi at 13-10-2025 **/
  async bookingInitiate(reqParams): Promise<BookInitiateResponse> {
    const { bookReq, headers } = reqParams;
    const userId = uuid();
    try {
      normalizeBookRequestGst(bookReq);

      let fare: Fare[] = [];
      // Calculate the total count for each passenger type
      const adultCount = bookReq.passengers.filter(
        (p) => p.passengerType === "ADT",
      ).length;
      const childrenCount = bookReq.passengers.filter(
        (p) => p.passengerType === "CHD",
      ).length;
      const infantCount = bookReq.passengers.filter(
        (p) => p.passengerType === "INF",
      ).length;

      console.log("👥 Passenger Summary:", {
        totalPassengers: bookReq.passengers.length,
        adults: adultCount,
        children: childrenCount,
        infants: infantCount,
      });

      // Build paxes array with the correct counts
      bookReq.paxes = [
        {
          adult: adultCount,
          children: childrenCount,
          infant: infantCount,
        },
      ];

      console.log("===== BOOK INITIATE START =====");
      console.log("searchReqId:", bookReq.searchReqId);
      console.log("solutionId:", bookReq.solutionId);
      console.log("tripType:", bookReq.airTripType);

      /* Call revalidate service to revalidate the booking */
      const revalidateResult = await this.revalidateService.revalidate(
        bookReq,
        headers,
      );
      console.log(
        "REVALIDATE RESPONSE:",
        revalidateResult?.error ? "FAILED" : "SUCCESS",
      );
      if (revalidateResult.error) {
        return {
          error: true,
          message: "Revalidation failed",
          booking_log_id: "",
          search_req_id: bookReq.searchReqId,
          booking_id: "",
          fare: [] as unknown as Fare,
        };
      }

      let mealFare = 0;
      let seatFare = 0;
      let baggageFare = 0;

      const ancillPaxForTotals =
        bookReq.Passengers?.length > 0
          ? bookReq.Passengers
          : bookReq.ssr && typeof bookReq.ssr === "object"
            ? Object.keys(bookReq.ssr)
                .sort((a, b) => Number(a) - Number(b))
                .map((k) => bookReq.ssr[k])
            : [];

      ancillPaxForTotals.forEach((pax: any) => {
        pax?.MealDynamic?.forEach((meal: any) => {
          mealFare += meal.Price || 0;
        });
        pax?.SeatDynamic?.forEach((seat: any) => {
          seatFare += seat.Price || 0;
        });
        pax?.Baggage?.forEach((bag: any) => {
          baggageFare += bag.Price || 0;
        });
      });

      const ssrTotal = mealFare + seatFare + baggageFare;

      fare = revalidateResult.route?.fare as unknown as Fare[];
      console.log("💰 FINAL FARE ARRAY:", JSON.stringify(fare, null, 2));
      const tboFare = fare?.[0]?.searchTotalFare ?? 0;
      const payableAmount = tboFare + ssrTotal;

      fare = fare.map((f) => ({
        ...f,
      }));
      console.log(
        "💰 RAW FARE FROM REVALIDATE:",
        JSON.stringify(revalidateResult.route?.fare, null, 2),
      );

      console.log(
        "💰 FINAL TOTAL FARE (searchTotalFare):",
        fare?.[0]?.searchTotalFare,
      );

      const mwrLogId = Generic.generateRandomString(10);

      console.log("Saving booking in DB...");
      const booking = await this.bookRepository.insertBooking({
        booking: bookReq,
        userId,
        mwrLogId,
      });

      // NEW SSR HANDLING (Passenger → Standard SSR format)

      let formattedSSR: any = {};

      const paxCount = bookReq.passengers?.length ?? 0;
      if (bookReq.Passengers && Array.isArray(bookReq.Passengers)) {
        const buckets = bookReq.Passengers.map((p) => ({ ...(p ?? {}) }));
        formattedSSR = ssrBucketsToNumericRecord(
          normalizeBundledSsrPerPassengers(bookReq.passengers ?? [], buckets),
        );
      } else if (
        bookReq.ssr &&
        typeof bookReq.ssr === "object" &&
        Object.keys(bookReq.ssr).length > 0
      ) {
        const buckets = Array.from({ length: paxCount }, (_, i) => ({
          ...(bookReq.ssr[i] ?? bookReq.ssr[String(i)] ?? {}),
        }));
        formattedSSR = ssrBucketsToNumericRecord(
          normalizeBundledSsrPerPassengers(bookReq.passengers ?? [], buckets),
        );
      }

      // STORE ONLY IF SSR EXISTS
      if (Object.keys(formattedSSR).length > 0) {
        console.log("Formatted SSR::::::::::::", JSON.stringify(formattedSSR));

        await this.bookRepository.update(
          { booking_id: booking.booking_id },
          { ssr_response: formattedSSR },
        );

        // console.log("SSR stored in BOOKING table:", booking.booking_id);
      }

      /* Store booking log with original booking request in data field */
      const bookingLog = await this.bookRepository.storeBookingLog({
        bookingRefId: booking.booking_reference_id,
        userId,
        mwrLogId,
      });

      // Store original booking request in booking log for later use
      await this.bookRepository.updateBookingLogData({
        bookingLogId: bookingLog.id,
        // data: { originalBookRequest: bookReq, ssr: bookReq.ssr || {} },
        data: { originalBookRequest: bookReq },
      });
      console.log("===== BOOK INITIATE SUCCESS =====");

      return {
        error: false,
        message: "Booking initiated successfully",
        booking_log_id: bookingLog.log_id,
        search_req_id: bookReq.searchReqId,
        booking_id: booking.booking_id,
        fare: fare as unknown as Fare,
        payableAmount: payableAmount, // ✅ for Razorpay
        ssrTotal: ssrTotal,
      };
    } catch (error) {
      console.log(error);
      return {
        error: true,
        message: "Booking initiated failed",
        booking_log_id: "",
        search_req_id: bookReq.searchReqId,
        booking_id: "",
        fare: [] as unknown as Fare,
      };
    }
    // return this.providerBookService.providerBook(bookReq, headers);
  }

  /** [@Description: This method is used to confirm the booking]
   * @author: Prashant Joshi at 13-10-2025 **/
  async bookingConfirmation(reqParams): Promise<BookResponse> {
    const { bookReq, headers } = reqParams;
    let booking: Booking = new Booking();
    try {
      console.log("===== BOOK CONFIRMATION START =====");
      console.log("bookingId:", bookReq.bookingId);
      console.log("bookingLogId:", bookReq.bookingLogId);

      /* Get booking from database */
      booking = await this.bookRepository.getBookingByBookingId({
        bookingId: bookReq.bookingId,
      });
      //   console.log("Booking found:", booking.booking_id);

      /* Get booking log from database */
      console.log("Booking fetched:", booking?.booking_id);
      const bookingLog = await this.bookRepository.getBookingLogByBookingLogId({
        bookingLogId: bookReq.bookingLogId,
      });
      //   console.log("Booking log found:", bookingLog.id);
      /* Verify booking log */
      await this.bookRepository.verifyBookingLog({
        bookingLogId: bookReq.bookingLogId,
      });
      // Retrieve original booking request from booking log
      const originalBookRequest: BookDto = bookingLog.data?.originalBookRequest;
      //   console.log("originalBookRequest", originalBookRequest);
      if (!originalBookRequest) {
        throw new Error("Original booking request not found in booking log");
      }

      normalizeBookRequestGst(originalBookRequest);

      console.log("Calling PROVIDER BOOK API (TBO)...");

      // ===== FETCH SSR FROM DB =====
      const ssrData = booking?.ssr_response;
      console.log(
        "SSR fetched from DB:::::::::::::::",
        JSON.stringify(ssrData),
      );

      // ===== ADD SSR INTO REQUEST =====
      const updatedBookRequest = {
        ...originalBookRequest,
        ssr: ssrData,
      };

      const supplierDetails = await this.providerBookService.providerBook({
        bookReq: updatedBookRequest,
        headers,
        logId: bookReq.bookingLogId,
      });

      /* Call provider API to confirm booking */
      // const supplierDetails = await this.providerBookService.providerBook({
      //   bookReq: originalBookRequest,
      //   headers,
      //   logId: bookReq.bookingLogId,
      // });
      //   console.log("supplierDetails", supplierDetails);

      console.log(
        "TBO BOOK RESPONSE:",
        supplierDetails?.error ? "FAILED" : "SUCCESS",
      );
      console.log("OrderDetails:", supplierDetails?.orderDetail);

      const response = new BookResponse();
      Object.assign(response, {
        error: supplierDetails.error,
        message: supplierDetails.message,
        mode: supplierDetails.mode,
        searchReqId: supplierDetails.searchReqId,
        supplierMessage: supplierDetails.supplierMessage,
        orderDetail: supplierDetails.orderDetail ?? [],
        // orderDetails: supplierDetails.orderDetails ?? null,
      });

      console.log("Updating booking with supplier response...");

      /* Update booking with supplier details including order details and original request */
      await this.bookRepository.updateBookingWithSupplierDetails({
        bookingId: booking.booking_id,
        supplierDetails, // Processed BookResponse with orderDetail, orderDetails, etc.
        bookingData: { request: originalBookRequest, response }, // Original client request
        supplierResponse: {
          bookSupplierResponse: supplierDetails.rawSupplierResponse,
          orderDetailsSupplierResponse:
            supplierDetails.supplierOrderDetailResponse,
        }, // Raw supplier response from TBO
        bookingItem: 1, // booking item number
      });

      // delete supplierDetails.rawSupplierResponse;
      // delete supplierDetails.orderDetails;
      if (response.error) {
        await this.bookRepository.BookingStatusFailed(booking.booking_id);
      }
      console.log("===== BOOK CONFIRMATION END =====");
      return response;
    } catch (error) {
      console.error("Booking confirmation error:", error);
      if (booking) {
        await this.bookRepository.BookingStatusFailed(booking.booking_id);
      }
      // Re-throw with more context
      throw new BadRequestException({
        message: "Booking confirmation failed",
        error: error.message,
        details: error,
      });
    }
  }
}
