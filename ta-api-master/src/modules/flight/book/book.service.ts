import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { BookReconcileDto } from "./dtos/reconcile.dto";
import {
  BookReconcileResponse,
  ReconcileApiResponseData,
  RefundablePerPnr,
} from "./interfaces/reconcile.interface";
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
import { PaymentStatus } from "src/shared/entities/booking-logs.entity";
import { v4 as uuid } from "uuid";
import { Generic } from "src/shared/utilities/flight/generic.utility";
import { DuplicateBookingException } from "./exceptions/duplicate-booking.exception";
import { RevalidateService } from "../revalidate/revalidate.service";
import { Fare } from "../search/interfaces/start-routing.interface";
import {
  normalizeBundledSsrPerPassengers,
  ssrBucketsToNumericRecord,
} from "src/shared/utilities/flight/ssr-passenger-normalize.utility";
import {
  isIndigoAirlineCodeList,
  resolveIsAllowBookingWithoutSeat,
} from "src/shared/utilities/flight/tbo-indigo-seat.utility";
import { flightBookingDebug } from "src/shared/utilities/flight/flight-booking-logger.utility";
import {
  getTboCallSummary,
  runWithTboInstrumentationAsync,
} from "src/shared/utilities/flight/tbo-api-instrumentation.utility";
const BOOKING_STATUS_LABEL: Record<number, string> = {
  [BookingStatus.PENDING]: "PENDING",
  [BookingStatus.CONFIRMED]: "CONFIRMED",
  [BookingStatus.BOOKED]: "BOOKED",
  [BookingStatus.CANCELLED]: "CANCELLED",
  [BookingStatus.FAILED]: "FAILED",
  [BookingStatus.DATES_NOT_AVAILABLE]: "DATES_NOT_AVAILABLE",
  [BookingStatus.DEPOSIT]: "DEPOSIT",
  [BookingStatus.INPROGRESS]: "IN_PROGRESS",
};

const RECONCILE_MESSAGES: Record<string, string> = {
  IN_PROGRESS:
    "Booking is in progress. Payment or confirmation may not be completed yet.",
  PENDING: "Booking is pending supplier confirmation.",
  CONFIRMED: "Booking completed successfully.",
  BOOKED: "Booking completed successfully.",
  FAILED: "Booking failed.",
  CANCELLED: "Booking has been cancelled.",
  DATES_NOT_AVAILABLE: "Selected dates are not available.",
  DEPOSIT: "Booking is on deposit status.",
};

const COMPLETED_BOOKING_STATUSES = [
  BookingStatus.CONFIRMED,
  BookingStatus.BOOKED,
];

/** Backend marks INPROGRESS → FAILED after this many minutes (see order-detail.repository). */
const IN_PROGRESS_AUTO_FAIL_MINUTES = 120;

/** PENDING has no auto-fail; supplier recheck cron runs every 10 min — allow ~4–5 cycles. */
const PENDING_POLL_MAX_MINUTES = 45;

/** Minutes payment app should keep polling for terminal / fallback states (0 = stop). */
const RECOMMENDED_POLL_UNTIL_MINUTES: Record<string, number> = {
  FAILED: 0,
  CANCELLED: 0,
  DATES_NOT_AVAILABLE: 0,
  DEPOSIT: 45,
  UNKNOWN: 45,
};

@Injectable()
export class BookService {
  private readonly logger = new Logger(BookService.name);

  constructor(
    private readonly providerBookService: ProviderBookService,
    private readonly bookRepository: BookRepository,
    private readonly revalidateService: RevalidateService,
  ) { }

  /** [@Description: This method is used to initiate the booking]
   * @author: Prashant Joshi at 13-10-2025 **/
  async bookingInitiate(reqParams): Promise<BookInitiateResponse> {
    const { bookReq, headers } = reqParams;
    return runWithTboInstrumentationAsync(
      { searchReqId: bookReq?.searchReqId, phase: 'initiate' },
      () => this.bookingInitiateInternal({ bookReq, headers }),
    );
  }

  private async bookingInitiateInternal(reqParams): Promise<BookInitiateResponse> {
    const { bookReq, headers } = reqParams;
    const userId = uuid();
    try {
      normalizeBookRequestGst(bookReq);

      let fare: Fare[] = [];
      const adultCount = bookReq.passengers.filter(
        (p) => p.passengerType === "ADT",
      ).length;
      const childrenCount = bookReq.passengers.filter(
        (p) => p.passengerType === "CHD",
      ).length;
      const infantCount = bookReq.passengers.filter(
        (p) => p.passengerType === "INF",
      ).length;

      flightBookingDebug('Book initiate passenger summary', {
        totalPassengers: bookReq.passengers.length,
        adults: adultCount,
        children: childrenCount,
        infants: infantCount,
      });

      bookReq.paxes = [
        {
          adult: adultCount,
          children: childrenCount,
          infant: infantCount,
        },
      ];

      flightBookingDebug('Book initiate start', {
        searchReqId: bookReq.searchReqId,
        solutionId: bookReq.solutionId,
        tripType: bookReq.airTripType,
      });

      const revalidateResult = await this.revalidateService.revalidate(
        bookReq,
        headers,
      );
      flightBookingDebug('Revalidate result', {
        success: !revalidateResult?.error,
      });
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
      const tboFare = fare?.[0]?.searchTotalFare ?? 0;
      const payableAmount = tboFare + ssrTotal;

      fare = fare.map((f) => ({
        ...f,
      }));

      flightBookingDebug('Book initiate fare', {
        searchTotalFare: fare?.[0]?.searchTotalFare,
        payableAmount,
      });

      const mwrLogId = Generic.generateRandomString(10);

      flightBookingDebug('Saving booking in DB');
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
        flightBookingDebug('Storing formatted SSR', {
          passengerKeys: Object.keys(formattedSSR).length,
        });

        await this.bookRepository.update(
          { booking_id: booking.booking_id },
          { ssr_response: formattedSSR },
        );

        // console.log("SSR stored in BOOKING table:", booking.booking_id);
      }

      const isBookableIfSeatNotAvailable =
        revalidateResult.isBookableIfSeatNotAvailable;
      const resolvedAllowWithoutSeat = resolveIsAllowBookingWithoutSeat({
        isIndigo: isIndigoAirlineCodeList(revalidateResult.route?.airlineCode),
        isBookableIfSeatNotAvailable,
      });
      if (typeof resolvedAllowWithoutSeat === "boolean") {
        bookReq.isAllowBookingWithoutSeat = resolvedAllowWithoutSeat;
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
        data: {
          originalBookRequest: bookReq,
          tboIndigoSeat: {
            isBookableIfSeatNotAvailable,
            isAllowBookingWithoutSeat: resolvedAllowWithoutSeat,
          },
        },
      });
      const summary = getTboCallSummary();
      if (summary) {
        flightBookingDebug('Book initiate TBO call summary', summary);
      }
      flightBookingDebug('Book initiate success', { bookingId: booking.booking_id });

      return {
        error: false,
        message: "Booking initiated successfully",
        booking_log_id: bookingLog.log_id,
        search_req_id: bookReq.searchReqId,
        booking_id: booking.booking_id,
        fare: fare as unknown as Fare,
        payableAmount: payableAmount, // ✅ for Razorpay
        ssrTotal: ssrTotal,
        isBookableIfSeatNotAvailable,
        isAllowBookingWithoutSeat: resolvedAllowWithoutSeat,
      };
    } catch (error) {
      flightBookingDebug('Book initiate failed', error?.message);
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
    return runWithTboInstrumentationAsync(
      { searchReqId: bookReq?.searchReqId, phase: 'confirm' },
      () => this.bookingConfirmationInternal({ bookReq, headers }),
    );
  }

  private async bookingConfirmationInternal(reqParams): Promise<BookResponse> {
    const { bookReq, headers } = reqParams;
    let booking: Booking = new Booking();
    try {
      flightBookingDebug('Book confirmation start', {
        bookingId: bookReq.bookingId,
        bookingLogId: bookReq.bookingLogId,
      });

      const [bookingResult, bookingLog] = await Promise.all([
        this.bookRepository.getBookingByBookingId({
          bookingId: bookReq.bookingId,
        }),
        this.bookRepository.getBookingLogByBookingLogId({
          bookingLogId: bookReq.bookingLogId,
        }),
      ]);
      booking = bookingResult;

      const originalBookRequest: BookDto = bookingLog.data?.originalBookRequest;
      //   console.log("originalBookRequest", originalBookRequest);
      if (!originalBookRequest) {
        throw new Error("Original booking request not found in booking log");
      }

      normalizeBookRequestGst(originalBookRequest);

      flightBookingDebug('Calling provider book API');

      const ssrData = booking?.ssr_response;

      const updatedBookRequest = {
        ...originalBookRequest,
        ssr: ssrData,
      };

      const supplierDetails = await this.providerBookService.providerBook({
        bookReq: updatedBookRequest,
        headers,
        logId: bookReq.bookingLogId,
      });

      flightBookingDebug('Provider book response', {
        error: supplierDetails?.error,
        orderCount: supplierDetails?.orderDetail?.length ?? 0,
      });

      if (!supplierDetails.error) {
        void this.fetchOrderDetailsInBackground({
          bookReq: updatedBookRequest,
          supplierDetails,
          bookingId: booking.booking_id,
          headers,
        });
      }

      const isRefundablePerPnr = this.computeIsRefundablePerPnr(
        supplierDetails.orderDetails,
      );

      const response = new BookResponse();
      Object.assign(response, {
        error: supplierDetails.error,
        message: supplierDetails.message,
        mode: supplierDetails.mode,
        searchReqId: supplierDetails.searchReqId,
        supplierMessage: supplierDetails.supplierMessage,
        orderDetail: supplierDetails.orderDetail ?? [],
        rawSupplierResponse: supplierDetails.rawSupplierResponse ?? [],
        supplierOrderDetailResponse:
          supplierDetails.supplierOrderDetailResponse ?? [],
        is_refundable: isRefundablePerPnr,
        // orderDetails: supplierDetails.orderDetails ?? null,
      });

      flightBookingDebug('Updating booking with supplier response');

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
        await this.bookRepository.BookingStatusFailed({ bookingId: booking.booking_id });
        await this.bookRepository.updateBookingLogPaymentStatus({
          bookingLogId: bookReq.bookingLogId,
          paymentStatus: PaymentStatus.FAILED,
          isVerified: false,
        });
      } else {
        const legs = supplierDetails?.orderDetail ?? [];
        const allLegsConfirmed =
          legs.length > 0 &&
          legs.every(
            (leg) => leg?.orderStatus === "CONFIRMED" && !!leg?.pnr,
          );

        if (allLegsConfirmed) {
          await this.bookRepository.BookingStatusConfirmed({
            bookingId: booking.booking_id,
          });
        }

        await this.bookRepository.updateBookingLogPaymentStatus({
          bookingLogId: bookReq.bookingLogId,
          paymentStatus: PaymentStatus.CAPTURED,
          isVerified: true,
        });
      }
      const summary = getTboCallSummary();
      if (summary) {
        flightBookingDebug('Book confirmation TBO call summary', summary);
      }
      flightBookingDebug('Book confirmation end');
      return response;
    } catch (error) {
      console.error("Booking confirmation error:", error);

      // ─── BUG #3 GUARD ───────────────────────────────────────────────
      // A post-success exception (DB blip, missing booking_log, restart, etc.)
      // must NEVER corrupt a booking whose ticket is already issued at the supplier.
      // Truth-of-ticket check: per leg we require PNR + orderNo + orderStatus=CONFIRMED
      // AND a non-empty TicketId in the raw TBO response. If proven, do not write FAILED.
      if (booking?.booking_id) {
        let alreadyTicketed = false;
        try {
          const fresh = await this.bookRepository.getBookingForReconcile(
            booking.booking_id,
          );
          const stored =
            fresh?.bookingAdditionalDetails?.api_response?.booking?.response;
          alreadyTicketed =
            !!fresh?.supplier_reference_id &&
            this.allLegsFullyTicketedFromStored(stored);
        } catch (lookupErr) {
          console.error(
            "[Confirm catch] Booking re-read failed; defaulting to safe behaviour (no FAILED write):",
            lookupErr,
          );
          alreadyTicketed = true;
        }

        if (!alreadyTicketed) {
          await this.bookRepository.BookingStatusFailed({
            bookingId: booking.booking_id,
          });
        } else {
          console.warn(
            `[Confirm catch] Skipping BookingStatusFailed for ${booking.booking_id} — supplier already issued ticket (PNR + orderNo + TicketId verified).`,
          );
        }
      }

      if (bookReq?.bookingLogId) {
        let alreadyCaptured = false;
        try {
          const log = await this.bookRepository.getBookingLogByLogId(
            bookReq.bookingLogId,
          );
          alreadyCaptured =
            !!log &&
            (log.is_verified === true ||
              log.payment_status === PaymentStatus.CAPTURED);
        } catch (logErr) {
          console.error(
            "[Confirm catch] Log lookup failed; defaulting to safe behaviour (no FAILED write):",
            logErr,
          );
          alreadyCaptured = true;
        }

        if (!alreadyCaptured) {
          await this.bookRepository.updateBookingLogPaymentStatus({
            bookingLogId: bookReq.bookingLogId,
            paymentStatus: PaymentStatus.FAILED,
            isVerified: false,
          });
        } else {
          console.warn(
            `[Confirm catch] Skipping payment FAILED write for log ${bookReq.bookingLogId} — already CAPTURED.`,
          );
        }
      }
      // Re-throw with more context
      throw new BadRequestException({
        message: "Booking confirmation failed",
        error: error.message,
        details: error,
      });
    }
  }

  async bookingReconcile(bookReq: BookReconcileDto): Promise<BookReconcileResponse> {
    const booking = await this.bookRepository.getBookingForReconcile(
      bookReq.bookingId,
    );
    if (!booking) {
      throw new BadRequestException("Booking not found");
    }

    const bookingLog = await this.bookRepository.getBookingLogByLogId(
      bookReq.bookingLogId,
    );
    if (!bookingLog) {
      throw new BadRequestException("Booking log not found");
    }

    if (bookingLog.booking_reference_id !== booking.booking_reference_id) {
      throw new BadRequestException(
        "booking_id and booking_log_id do not belong to the same booking",
      );
    }

    const storedBookResponse =
      booking.bookingAdditionalDetails?.api_response?.booking?.response;

    // ─── BUG #4 ────────────────────────────────────────────────────────
    // Source of truth for "is the ticket really issued?" is the supplier
    // response, not the bookings.booking_status column. We require per leg:
    // PNR + orderNo + orderStatus=CONFIRMED AND a non-empty TicketId in the
    // raw TBO response. If proven, treat as CONFIRMED regardless of column,
    // and self-heal the column back to 1 so future reads stay correct.
    const allLegsTicketed =
      this.allLegsFullyTicketedFromStored(storedBookResponse);

    let effectiveStatus: BookingStatus = booking.booking_status;
    if (
      allLegsTicketed &&
      booking.booking_status !== BookingStatus.CONFIRMED
    ) {
      const previousLabel =
        BOOKING_STATUS_LABEL[booking.booking_status] ??
        String(booking.booking_status);
      effectiveStatus = BookingStatus.CONFIRMED;
      try {
        await this.bookRepository.BookingStatusConfirmed({
          bookingId: booking.booking_id,
        });
        booking.booking_status = BookingStatus.CONFIRMED;
        console.warn(
          `[Reconcile self-heal] booking ${booking.booking_id}: column was ${previousLabel}, supplier proves CONFIRMED → corrected.`,
        );
      } catch (healErr) {
        console.error(
          `[Reconcile self-heal] booking ${booking.booking_id}: column was ${previousLabel}, supplier proves CONFIRMED, but DB update failed. Reporting CONFIRMED in response only:`,
          healErr,
        );
      }
    }

    const statusLabel =
      BOOKING_STATUS_LABEL[effectiveStatus] ?? "UNKNOWN";
    const message =
      RECONCILE_MESSAGES[statusLabel] ??
      `Booking status is ${statusLabel}.`;

    const isBookingComplete = this.isReconcileBookingComplete(
      effectiveStatus,
      storedBookResponse,
    );
    const hasStoredBookData = this.hasReconcileStoredBookData(
      effectiveStatus,
      storedBookResponse,
    );

    const isRefundablePerPnr = this.computeIsRefundablePerPnr(
      booking.bookingAdditionalDetails?.api_response?.orderDetails,
    );

    const response: BookReconcileResponse = {
      error: effectiveStatus === BookingStatus.FAILED,
      message,
      status: statusLabel,
      bookingStatus: effectiveStatus,
      paymentStatus: bookingLog.payment_status,
      isPaymentVerified: bookingLog.is_verified,
      isBookingComplete,
      recommendedPollUntilMinutes: this.getRecommendedPollUntilMinutes(
        statusLabel,
        isBookingComplete,
        booking.created_at,
      ),
      bookingId: booking.booking_id,
      bookingReferenceId: booking.booking_reference_id,
      supplierReferenceId: booking.supplier_reference_id ?? null,
      is_refundable: isRefundablePerPnr,
      apiResponse: hasStoredBookData
        ? this.buildReconcileApiResponse(
            booking.bookingAdditionalDetails?.api_response,
          )
        : null,
    };

    return response;
  }

  /**
   * Strict per-leg "ticket is really issued" check used by Bug #3 and Bug #4.
   * A leg is considered fully ticketed only when ALL hold:
   *   - orderStatus is CONFIRMED (or BOOKED)
   *   - leg.pnr is present
   *   - leg.orderNo is present
   *   - the matching raw TBO response has every Passenger.Ticket.TicketId set
   * Returns true only if every leg passes — partial bookings return false.
   */
  private allLegsFullyTicketedFromStored(storedBookResponse: any): boolean {
    if (!storedBookResponse) return false;
    const legs = storedBookResponse?.orderDetail;
    const raw = storedBookResponse?.rawSupplierResponse;
    if (!Array.isArray(legs) || legs.length === 0) return false;
    if (!Array.isArray(raw) || raw.length === 0) return false;
    return legs.every((leg: any) =>
      this.isLegFullyTicketedFromStored(leg, raw),
    );
  }

  private isLegFullyTicketedFromStored(
    leg: any,
    rawSupplierResponse: any[],
  ): boolean {
    if (!leg) return false;

    const orderStatus = String(leg?.orderStatus ?? "").toUpperCase();
    if (orderStatus !== "CONFIRMED" && orderStatus !== "BOOKED") {
      return false;
    }

    const pnr = leg?.pnr ? String(leg.pnr).trim() : "";
    const orderNo =
      leg?.orderNo != null && leg.orderNo !== "" ? String(leg.orderNo).trim() : "";
    if (!pnr || !orderNo) return false;

    const matchingRaw = rawSupplierResponse.find((r: any) => {
      const innerResponse = r?.response?.Response?.Response;
      const rPnr = innerResponse?.PNR;
      const rBookingId = innerResponse?.BookingId;
      return (
        (rPnr && String(rPnr).trim() === pnr) ||
        (rBookingId != null && String(rBookingId) === orderNo)
      );
    });
    if (!matchingRaw) return false;

    const passengers =
      matchingRaw?.response?.Response?.Response?.FlightItinerary?.Passenger;
    if (!Array.isArray(passengers) || passengers.length === 0) return false;

    return passengers.every(
      (p: any) =>
        p?.Ticket?.TicketId != null && String(p.Ticket.TicketId).length > 0,
    );
  }

  /**
   * Remaining minutes to keep polling reconcile from this response (0 = stop).
   * IN_PROGRESS: until backend auto-fail window (~2h from booking created_at).
   * PENDING / incomplete CONFIRMED: up to PENDING_POLL_MAX_MINUTES (supplier cron every 10 min).
   */
  private getRecommendedPollUntilMinutes(
    statusLabel: string,
    isBookingComplete: boolean,
    bookingCreatedAt?: Date,
  ): number {
    if (isBookingComplete) {
      return 0;
    }
    if (["FAILED", "CANCELLED", "DATES_NOT_AVAILABLE"].includes(statusLabel)) {
      return 0;
    }
    if (statusLabel === "IN_PROGRESS" && bookingCreatedAt) {
      return this.getInProgressRemainingPollMinutes(bookingCreatedAt);
    }
    if (
      statusLabel === "PENDING" ||
      statusLabel === "CONFIRMED" ||
      statusLabel === "BOOKED"
    ) {
      return PENDING_POLL_MAX_MINUTES;
    }
    return RECOMMENDED_POLL_UNTIL_MINUTES[statusLabel] ?? PENDING_POLL_MAX_MINUTES;
  }

  private getInProgressRemainingPollMinutes(createdAt: Date): number {
    const elapsedMs = Date.now() - new Date(createdAt).getTime();
    const remainingMs =
      IN_PROGRESS_AUTO_FAIL_MINUTES * 60 * 1000 - elapsedMs;
    return Math.max(0, Math.ceil(remainingMs / 60000));
  }

  /** Include leg-level data when confirmation saved TBO response (incl. partial domestic RT). */
  private hasReconcileStoredBookData(
    bookingStatus: BookingStatus,
    storedBookResponse?: Record<string, unknown>,
  ): boolean {
    if (bookingStatus === BookingStatus.INPROGRESS) {
      return false;
    }
    const orderDetail = storedBookResponse?.orderDetail;
    return Array.isArray(orderDetail) && orderDetail.length > 0;
  }

  private isReconcileBookingComplete(
    bookingStatus: BookingStatus,
    storedBookResponse?: Record<string, unknown>,
  ): boolean {
    if (!COMPLETED_BOOKING_STATUSES.includes(bookingStatus)) {
      return false;
    }
    const orderDetail = storedBookResponse?.orderDetail;
    if (!Array.isArray(orderDetail) || orderDetail.length === 0) {
      return false;
    }
    return orderDetail.every((order) => {
      const legStatus = String(order?.orderStatus ?? "").toUpperCase();
      return legStatus === "CONFIRMED" || legStatus === "BOOKED";
    });
  }

  private fetchOrderDetailsInBackground(reqParams: {
    bookReq: BookDto;
    supplierDetails: BookResponse;
    bookingId: string;
    headers: Headers;
  }): void {
    const { bookReq, supplierDetails, bookingId, headers } = reqParams;
    void this.providerBookService
      .fetchOrderDetails({ bookReq, bookResult: supplierDetails, headers })
      .then(async (detail) => {
        if (!detail) return;
        await this.bookRepository.patchBookingOrderDetails({
          bookingId,
          orderDetails: detail.orderDetails,
          supplierOrderDetailResponse: detail.supplierOrderDetailResponse,
        });
        flightBookingDebug('Async order details patched', { bookingId });
      })
      .catch((err) =>
        this.logger.error(
          `Async order detail fetch failed for ${bookingId}: ${err?.message ?? err}`,
        ),
      );
  }

  /**
   * Per-PNR refundability — domestic round trip can have one PNR refundable
   * and the other non-refundable. Returns one entry per supplier order.
   */
  private computeIsRefundablePerPnr(orderDetails: unknown): RefundablePerPnr[] {
    if (!orderDetails) return [];
    const orders = Array.isArray(orderDetails) ? orderDetails : [orderDetails];
    return orders
      .filter((o: any) => o && !o.error)
      .map((o: any) => ({
        pnr: o?.pnr ?? null,
        bookingId: o?.bookingId != null ? o.bookingId.toString() : null,
        is_refundable: o?.routes?.isRefundable === true,
      }));
  }

  private buildReconcileApiResponse(storedApiResponse?: {
    booking?: { response?: Record<string, unknown> };
    orderDetails?: unknown;
  }): ReconcileApiResponseData | null {
    const bookResponse = storedApiResponse?.booking?.response;
    if (!bookResponse) {
      return null;
    }

    const storedOrderDetails = storedApiResponse?.orderDetails;
    const isRefundablePerPnr = this.computeIsRefundablePerPnr(storedOrderDetails);

    return {
      mode: bookResponse.mode as string | undefined,
      searchReqId: bookResponse.searchReqId as string | undefined,
      orderDetail: (bookResponse.orderDetail as unknown[]) ?? [],
      rawSupplierResponse:
        (bookResponse.rawSupplierResponse as unknown[]) ?? [],
      supplierOrderDetailResponse:
        (bookResponse.supplierOrderDetailResponse as unknown[]) ?? [],
      orderDetails: storedOrderDetails,
      is_refundable: isRefundablePerPnr,
    };
  }
}
