import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { BookResponse, Order } from "../../book/interfaces/book.interface";
import { BookDto } from "../../book/dtos/book.dto";
import { TboAuthTokenService } from "./tbo-auth-token.service";
import {
  AirlineCategory,
  Currencies,
  TripType,
} from "src/shared/enums/flight/flight.enum";
import { BookingStatus } from "src/shared/enums/flight/booking.enum";
import { s3BucketService } from "src/shared/utilities/flight/s3bucket.utility";
import { GenericRepo } from "src/shared/utilities/flight/generic-repo.utility";
import { Http } from "src/shared/utilities/flight/http.utility";
import { Generic } from "src/shared/utilities/flight/generic.utility";
import moment from "moment";
import { RevalidateResponseEntity } from "src/shared/entities/revalidate-response.entity";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { OrderDetailResponse } from "../../order-details/interfaces/order-detail.interface";
import { SupplierLogUtility } from "src/shared/utilities/flight/supplier-log.utility";
import { normalizeBundledSsrPerPassengers } from "src/shared/utilities/flight/ssr-passenger-normalize.utility";
import { resolveTboEndUserIp } from "src/shared/utilities/flight/tbo-request-context.utility";

interface SupplierLogEntry {
  index: number;
  title: string;
  fileSuffix: string;
  supplierRequest: any;
  supplierResponse: any;
  apiRequest?: any;
}

type SupplierLogCollector = (entry: SupplierLogEntry) => void;

/** Per-passenger SSR selections merged with TBO SSR response (Tek Travels Universal Air API). */
type SsrPassengerSelections = {
  Baggage?: any[];
  MealDynamic?: any[];
  SeatDynamic?: any[];
};

@Injectable()
export class TboBookService {
  logDate = Date.now();
  constructor(
    private readonly tboAuthTokenService: TboAuthTokenService,
    private genericRepo: GenericRepo,
    @InjectRepository(RevalidateResponseEntity)
    private revalidateRepo: Repository<RevalidateResponseEntity>,
    private readonly supplierLogUtility: SupplierLogUtility,
  ) { }

  private resolveEndUserIp(bookRequest: any): string {
    return resolveTboEndUserIp(bookRequest?.headers);
  }

  /**
   * TBO returns Baggage / MealDynamic as either `options[]` or `options[][]` (per passenger / leg).
   */
  private getSsrCatalogArray(catalogRoot: any, paxIndex: number): any[] {
    if (catalogRoot == null) return [];
    if (!Array.isArray(catalogRoot)) return [];
    const slot = catalogRoot[paxIndex] ?? catalogRoot[0];
    if (!Array.isArray(slot)) return [];
    if (slot.length > 0 && Array.isArray(slot[0])) {
      return (slot as any[][]).flat();
    }
    return slot;
  }

  /** SSR SeatDynamic → SegmentSeat → RowSeats → Seats (TBO structure). */
  private flattenTboSeatInventory(seatDynamic: any): any[] {
    if (!Array.isArray(seatDynamic)) return [];
    const out: any[] = [];
    for (const segmentWrap of seatDynamic) {
      const segmentSeats = segmentWrap?.SegmentSeat;
      if (!Array.isArray(segmentSeats)) continue;
      for (const seg of segmentSeats) {
        const rowSeats = seg?.RowSeats;
        if (!Array.isArray(rowSeats)) continue;
        for (const row of rowSeats) {
          const seats = row?.Seats;
          if (!Array.isArray(seats)) continue;
          for (const s of seats) {
            if (s && typeof s === "object") out.push(s);
          }
        }
      }
    }
    return out;
  }

  /**
   * Client may send `Passengers` (SSR shape) or only `passengers` + `ssr` from DB (numeric keys).
   */
  private buildUserSsrPassengersList(bookReq: any): SsrPassengerSelections[] {
    const withCaps = bookReq?.Passengers;

    // CASE 1:
    // Client directly sends Passengers SSR array
    if (Array.isArray(withCaps) && withCaps.length > 0) {

      const totalPassengers = Array.isArray(bookReq?.passengers)
        ? bookReq.passengers.length
        : 0;

      // =========================================
      // CASE:
      // 1 SSR object but multiple actual passengers
      // =========================================
      if (withCaps.length === 1 && totalPassengers > 1) {

        const firstPax = withCaps[0];

        return Array.from(
          { length: totalPassengers },
          (_, index) => {

            const seat =
              firstPax?.SeatDynamic?.[index];

            const meal =
              firstPax?.MealDynamic?.[index];

            const baggage =
              firstPax?.Baggage?.[index];

            return {

              ...(seat && {
                SeatDynamic: [{ ...seat }],
              }),

              ...(meal && {
                MealDynamic: [{ ...meal }],
              }),

              ...(baggage && {
                Baggage: [{ ...baggage }],
              }),

            };
          },
        );
      }

      return withCaps;
    }

    // =========================================
    // CASE 2:
    // SSR already stored in bookReq.ssr
    // =========================================

    const riders = bookReq?.passengers;
    const n = Array.isArray(riders) ? riders.length : 0;
    const ssrMap = bookReq?.ssr;
    if (n > 0 && ssrMap && typeof ssrMap === "object") {
      return Array.from({ length: n }, (_, i) => ({
        ...(ssrMap[i] ?? ssrMap[String(i)] ?? {}),
      }));
    }

    // =========================================
    // CASE 3:
    // fallback
    // =========================================
    if (ssrMap && typeof ssrMap === "object" && Object.keys(ssrMap).length > 0) {
      return Object.keys(ssrMap)
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => ({ ...(ssrMap[k] || {}) }));
    }
    return [];
  }

  private mergeSsrByPassengerIndex(
    prior: Record<string, any> | undefined,
    mapped: Record<number, any>,
  ): Record<string, any> {
    const out: Record<string, any> = { ...(prior || {}) };
    for (const [k, v] of Object.entries(mapped)) {
      const prev = out[k] && typeof out[k] === "object" ? out[k] : {};
      out[k] = { ...prev, ...(v && typeof v === "object" ? v : {}) };
    }
    return out;
  }

  private pickBaggageFromCatalog(
    selected: any,
    catalog: any[],
  ): any | undefined {
    if (!selected || !Array.isArray(catalog) || catalog.length === 0)
      return undefined;
    if (selected.Code) {
      const byCode = catalog.find((b) => b.Code === selected.Code);
      if (byCode) return byCode;
    }
    if (selected.Weight != null) {
      const w = Number(selected.Weight);
      return catalog.find(
        (b) =>
          b.Weight === selected.Weight ||
          Number(b.Weight) === w ||
          String(b.Weight) === String(selected.Weight),
      );
    }
    return undefined;
  }

  private pickMealFromCatalog(
    selected: any,
    catalog: any[],
  ): any | undefined {
    if (!selected?.Code || !Array.isArray(catalog)) return undefined;
    return catalog.find((m) => m.Code === selected.Code);
  }

  private seatFlightOdKey(s: any): string {
    return `${s?.Code ?? ""}|${String(s?.FlightNumber ?? "").trim()}|${s?.Origin ?? ""}|${s?.Destination ?? ""}`;
  }

  private seatMatchesFlightAndOd(catalogSeat: any, selected: any): boolean {
    if (selected?.FlightNumber != null && String(selected.FlightNumber).trim() !== "") {
      if (
        String(catalogSeat?.FlightNumber ?? "").trim() !==
        String(selected.FlightNumber).trim()
      ) {
        return false;
      }
    }
    if (selected?.Origin && catalogSeat?.Origin !== selected.Origin) return false;
    if (selected?.Destination && catalogSeat?.Destination !== selected.Destination)
      return false;
    return true;
  }

  private pickSeatFromCatalog(
    selected: any,
    catalog: any[],
  ): any | undefined {
    if (!Array.isArray(catalog) || catalog.length === 0) return undefined;
    if (selected?.Code) {
      const byCode = catalog.filter((s) => s.Code === selected.Code);
      if (byCode.length === 1) return byCode[0];
      if (byCode.length > 1) {
        const od = byCode.find((s) => this.seatMatchesFlightAndOd(s, selected));
        if (od) return od;
        return byCode[0];
      }
    }
    if (selected.SeatNo != null) {
      const rowMatch = (s: any) => {
        if (String(s.SeatNo) !== String(selected.SeatNo)) return false;
        if (selected.RowNo == null || selected.RowNo === "") return true;
        return String(s.RowNo) === String(selected.RowNo);
      };
      const rowCandidates = catalog.filter(
        (s) => rowMatch(s) && this.seatMatchesFlightAndOd(s, selected),
      );
      if (rowCandidates.length === 1) return rowCandidates[0];
      if (rowCandidates.length > 1 && selected.Code) {
        const byCode = rowCandidates.find((s) => s.Code === selected.Code);
        if (byCode) return byCode;
        return rowCandidates[0];
      }
      if (rowCandidates.length > 0) return rowCandidates[0];
      return catalog.find(rowMatch);
    }
    return undefined;
  }

  /**
   * When SSR catalog mapping drops seats (SSR failure, shape mismatch, or strict
   * catalog diff), still attach client `SeatDynamic` so LCC Ticket satisfies
   * carriers like 6E that require seat data on the request.
   */
  private mergeUserSeatPassthrough(
    userSSR: SsrPassengerSelections[],
    mapped: Record<number, any>,
  ): Record<number, any> {
    const out: Record<number, any> = { ...mapped };
    userSSR.forEach((pax, index) => {
      if (!pax?.SeatDynamic?.length) return;
      const cur =
        out[index] && typeof out[index] === "object" ? { ...out[index] } : {};
      const mappedSeats = Array.isArray(cur.SeatDynamic) ? cur.SeatDynamic : [];
      if (mappedSeats.length >= pax.SeatDynamic.length) return;

      if (mappedSeats.length === 0) {
        cur.SeatDynamic = pax.SeatDynamic.map((s) => ({ ...s }));
      } else {
        const keys = new Set(mappedSeats.map((s) => this.seatFlightOdKey(s)));
        const extras = pax.SeatDynamic.filter(
          (s) => !keys.has(this.seatFlightOdKey(s)),
        );
        if (extras.length) {
          cur.SeatDynamic = [
            ...mappedSeats,
            ...extras.map((s) => ({ ...s })),
          ];
        }
      }
      out[index] = cur;
    });
    return out;
  }

  private canonicalAirlineFlightKey(airline: any, flightNum: any): string | null {
    const ac = String(airline ?? "").trim().toUpperCase();
    let fn = String(flightNum ?? "").trim().toUpperCase();
    if (!ac || !fn) return null;
    fn = fn.replace(/^[A-Z0-9]{2,3}\s*-\s*/i, "").replace(/\s+/g, "");
    const digits = fn.replace(/\D/g, "");
    if (digits.length >= 2) return `${ac}|${digits}`;
    return `${ac}|${fn}`;
  }

  private extractAllowedFlightKeysFromFareQuote(fareQuoteParsed: any): Set<string> {
    const keys = new Set<string>();
    const addSeg = (seg: any) => {
      const k = this.canonicalAirlineFlightKey(
        seg?.Airline?.AirlineCode,
        seg?.Airline?.FlightNumber,
      );
      if (k) keys.add(k);
    };
    const results = fareQuoteParsed?.Response?.Results;
    if (!results) return keys;
    const journeys = Array.isArray(results) ? results : [results];
    for (const journey of journeys) {
      const segs = journey?.Segments;
      if (!Array.isArray(segs)) continue;
      for (const segmentArray of segs) {
        if (
          segmentArray &&
          typeof segmentArray === "object" &&
          segmentArray.Airline
        ) {
          addSeg(segmentArray);
          continue;
        }
        if (!Array.isArray(segmentArray)) continue;
        for (const seg of segmentArray) addSeg(seg);
      }
    }
    return keys;
  }

  private filterSsrByAllowedFlights(
    userSSR: SsrPassengerSelections[],
    allowed: Set<string>,
  ): SsrPassengerSelections[] {
    if (!allowed.size) return userSSR;
    const keep = (item: any): boolean => {
      const k = this.canonicalAirlineFlightKey(
        item?.AirlineCode ?? item?.airline,
        item?.FlightNumber ?? item?.flightNum,
      );
      if (k == null) return true;
      return allowed.has(k);
    };
    return userSSR.map((pax) => {
      const out: SsrPassengerSelections = { ...pax };
      if (pax.SeatDynamic?.length) out.SeatDynamic = pax.SeatDynamic.filter(keep);
      if (pax.MealDynamic?.length)
        out.MealDynamic = pax.MealDynamic.filter(keep);
      if (pax.Baggage?.length) out.Baggage = pax.Baggage.filter(keep);
      return out;
    });
  }

  /** If mapping left no seats/meals, copy from `Passengers` for flights on this fare. */
  private injectClientSsrWhenMissing(bookReq: any, fareQuoteParsed: any): void {
    const allowed = this.extractAllowedFlightKeysFromFareQuote(fareQuoteParsed);
    const allowFn = (item: any): boolean => {
      const k = this.canonicalAirlineFlightKey(
        item?.AirlineCode ?? item?.airline,
        item?.FlightNumber ?? item?.flightNum,
      );
      if (!allowed.size) return true;
      if (k == null) return true;
      return allowed.has(k);
    };
    const caps = bookReq?.Passengers;
    if (!Array.isArray(caps) || caps.length === 0) return;
    bookReq.ssr =
      bookReq.ssr && typeof bookReq.ssr === "object" ? { ...bookReq.ssr } : {};
    caps.forEach((pax, i) => {
      const key = String(i);
      const prev =
        bookReq.ssr[key] && typeof bookReq.ssr[key] === "object"
          ? bookReq.ssr[key]
          : {};
      let cur = { ...prev };
      if (pax?.SeatDynamic?.length) {
        const filtered = pax.SeatDynamic.filter(allowFn);
        const have = Array.isArray(cur.SeatDynamic) ? cur.SeatDynamic.length : 0;
        if (filtered.length > 0 && have === 0) {
          cur = {
            ...cur,
            SeatDynamic: filtered.map((s: any) => ({ ...s })),
          };
        }
      }
      if (pax?.MealDynamic?.length) {
        const filtered = pax.MealDynamic.filter(allowFn);
        const have = Array.isArray(cur.MealDynamic)
          ? cur.MealDynamic.length
          : 0;
        if (filtered.length > 0 && have === 0) {
          cur = {
            ...cur,
            MealDynamic: filtered.map((m: any) => ({ ...m })),
          };
        }
      }
      if (Object.keys(cur).length > 0) {
        bookReq.ssr[key] = { ...prev, ...cur };
      }
    });
  }

  /** [@Description: This method is used to book the flights]
   * @author: Prashant Joshi at 13-10-2025 **/
  async book(bookRequest): Promise<BookResponse | void> {
    const { bookReq }: { bookReq: BookDto } = bookRequest;
    console.log("===== TBO BOOK START =====");
    console.log("SSR AT TBO ENTRY:", JSON.stringify(bookReq.ssr));
    console.log("TripType:", bookReq.airTripType);
    console.log("SolutionId:", bookReq.solutionId);
    const bookResponse = new BookResponse();

    Object.assign(bookRequest, {
      tokenReqData: bookReq,
      searchReqId: bookReq.searchReqId,
    });
    const collectedLogs: SupplierLogEntry[] = [];
    const addLogEntry: SupplierLogCollector = (entry) => {
      collectedLogs.push({
        // apiRequest: bookRequest.bookReq,
        apiRequest: {
          ...bookRequest.bookReq,
          ssr: bookRequest.bookReq?.ssr || {},
        },
        ...entry,
      });
    };
    const flushLogs = async (response: BookResponse) => {
      for (const {
        index,
        title,
        fileSuffix,
        supplierRequest,
        supplierResponse,
        apiRequest,
      } of collectedLogs) {
        const logs = {
          ApiRequest: apiRequest ?? bookRequest.bookReq,
          ApiResponse: response,
          supplierRequest,
          supplierResponse,
        };

        await this.supplierLogUtility.generateLogFile({
          fileName: `${bookRequest.searchReqId}-${index}-${this.logDate}${fileSuffix}`,
          logData: logs,
          folderName: "book",
          logId: bookRequest.logId,
          title,
          searchReqId: bookReq.searchReqId,
          bookingReferenceId: null,
        });
      }
    };
    const finalizeAndReturn = async (response: BookResponse) => {
      await flushLogs(response);
      return response;
    };

    try {
      const handleAuthenticationFailure = (...messages: any[]) => {
        const supplierMessage =
          messages.filter(Boolean).join(" ") || "Authentication failed";
        const bookResponse: BookResponse = {
          error: true,
          message: "There is no flight available.",
          supplierMessage,
          searchReqId: bookReq.searchReqId,
          orderDetail: [],
          orderDetails: new OrderDetailResponse(),
          mode: "TBO-" + bookRequest.providerCred.mode,
        };

        addLogEntry({
          index: 0,
          title: "Book-TBO",
          fileSuffix: "book-TBO",
          supplierRequest: null,
          supplierResponse: { supplierMessage },
          apiRequest: bookRequest.bookReq,
        });

        return bookResponse;
      };

      /* get authentication token*/
      const authToken =
        await this.tboAuthTokenService.getAuthToken(bookRequest);

      /* In case there is an issue in authentication from the provider */
      if (authToken === "" || bookRequest?.redisData?.data?.length === 0) {
        const failureResponse = handleAuthenticationFailure(
          "Authentication failed",
        );
        return finalizeAndReturn(failureResponse);
      }
      console.log("TBO AUTH TOKEN RECEIVED:", !!authToken);

      let result;

      console.log("Checking trip type...");
      if (
        bookReq.airTripType.toLowerCase() === TripType.ROUNDTRIP &&
        bookReq.solutionId?.includes("|||")
      ) {
        console.log("ROUND TRIP");
        result = await this.createMultipleBook({
          bookRequest,
          handleAuthenticationFailure,
          logCollector: addLogEntry,
        });
      } else {
        console.log("ONE WAY");
        result = await this.createSingleBook({
          bookRequest,
          index: 0,
          handleAuthenticationFailure,
          logCollector: addLogEntry,
        });
      }

      let oneOrderSuccess = false;
      let message = "";
      let supplierMessage = "";

      bookResponse.orderDetail = [];
      // Store raw supplier responses for audit trail
      const rawSupplierResponses: Array<{ request: any; response: any }> = [];

      if (Array.isArray(result)) {
        for (const data of result) {
          const order = new Order();

          // Store raw supplier response
          rawSupplierResponses.push({
            request: data?.requestBodyTicketing,
            response: data?.ticketingResult,
          });

          // new code
          const publishedFare =
            data.ticketingResult.Response?.Response?.FlightItinerary?.Fare
              ?.PublishedFare || 0;

          // const ssr = bookRequest.bookReq?.ssr || {};

          // const ssrTotal = Object.values(ssr).reduce(
          //   (sum: number, pax: any) => {
          //     if (!pax) return sum;

          //     const baggageTotal =
          //       pax.Baggage?.reduce((s, b) => s + (b?.Price || 0), 0) || 0;

          //     const mealTotal =
          //       pax.MealDynamic?.reduce((s, m) => s + (m?.Price || 0), 0) || 0;

          //     const seatTotal =
          //       pax.SeatDynamic?.reduce((s, s1) => s + (s1?.Price || 0), 0) ||
          //       0;

          //     return sum + baggageTotal + mealTotal + seatTotal;
          //   },
          //   0,
          // );

          // console.log("SSR used for pricing:", JSON.stringify(ssr));
          // console.log("Final SSR Total:", ssrTotal);
          // till here

          /* Check if Ticketing is successful and Setting order details */
          if (data?.ticketingResult?.Response?.ResponseStatus === 1) {
            order.orderNo = data.ticketingResult.Response?.Response?.BookingId;
            // order.supplierBaseAmount = publishedFare + ssrTotal;
            order.supplierBaseAmount =
              data.ticketingResult.Response?.Response?.FlightItinerary?.Fare
                ?.PublishedFare || 0;
            // order.supplierBaseAmount = data.ticketingResult.Response?.Response?.FlightItinerary?.Fare?.BaseFare || 0;
            // order.orderAmount = bookReq?.paymentDetails?.totalFare;
            // order.currency = bookReq?.paymentDetails?.currencyCode;
            order.orderStatus = BookingStatus.CONFIRMED;
            order.pnr = data.ticketingResult?.Response?.Response.PNR || "";
            oneOrderSuccess = true;
          } else {
            order.orderStatus = BookingStatus.FAILED;
            message = data.ticketingResult?.Errors?.[0]?.UserMessage;
            supplierMessage =
              data.ticketingResult?.Response?.Error?.ErrorMessage;
          }
          bookResponse.orderDetail.push(order);
        }
      }

      // Store raw supplier response in BookResponse
      bookResponse.rawSupplierResponse = rawSupplierResponses;

      if (oneOrderSuccess) {
        bookResponse.error = false;
        bookResponse.message = "Booking successful.";
        bookResponse.searchReqId = bookReq.searchReqId;
        bookResponse.mode = "TBO-" + bookRequest.providerCred.mode;
      } else {
        Object.assign(bookResponse, {
          error: true,
          message: message || "This flight is not available.",
          searchReqId: bookReq.searchReqId,
          supplierMessage: supplierMessage,
          mode: "TBO-" + bookRequest.providerCred.mode,
        });
      }

      return finalizeAndReturn(bookResponse);
    } catch (error) {
      console.log("BOOKING ERROR", error);
      /* error logging */
      const errorLog = {};
      Object.assign(errorLog, { error: error.stack });
      const logs = { ApiRequest: bookRequest.bookReq, TypeError: errorLog };
      // await this.s3Service.generateS3LogFile(bookReq.searchReqId + '-' + this.logDate + '-TBO-BookingError', logs, 'book');

      this.genericRepo.storeLogs(bookReq.searchReqId, 1, error, 0);
      const failureResponse = new BookResponse();
      Object.assign(failureResponse, {
        error: true,
        message: "ERR_ISSUE_IN_FETCHING_DATA_FROM_PROVIDER",
        searchReqId: bookReq.searchReqId,
        supplierMessage: error?.message,
        mode: "TBO-" + bookRequest.providerCred.mode,
        orderDetail: [],
      });
      await flushLogs(failureResponse);
      throw new InternalServerErrorException(
        `ERR_ISSUE_IN_FETCHING_DATA_FROM_PROVIDER`,
      );
    }
  }

  /** [@Description: This method is used to create the single book]
   * @author: Prashant Joshi at 13-10-2025 **/
  async createSingleBook(
    reqParams,
  ): Promise<{ ticketingResult: any; requestBodyTicketing?: any }[]> {
    const {
      bookRequest,
      index = 0,
      handleAuthenticationFailure,
      logCollector,
    }: {
      bookRequest: any;
      index?: number;
      handleAuthenticationFailure: (...args: any[]) => any;
      logCollector?: SupplierLogCollector;
    } = reqParams;
    const { providerCred } = bookRequest;
    const { bookReq }: { bookReq: BookDto } = bookRequest;
    const bookResponse = new BookResponse();
    const order = new Order();

    console.log("===== CREATE SINGLE BOOK =====");
    console.log("SolutionId:", bookReq.solutionId);

    // Get solutionId from the correct location
    const solutionId = bookReq.solutionId;

    console.log("Looking for revalidate with solution_id:", solutionId);
    console.log("Provider:", providerCred.provider);

    const revalidateResponse = await this.revalidateRepo.findOne({
      where: {
        solution_id: solutionId,
        provider_code: providerCred.provider,
      },
    });

    if (!revalidateResponse) {
      console.error(
        "Revalidate response not found for solution_id:",
        solutionId,
      );
      return handleAuthenticationFailure(
        "Revalidate response not found for solution_id:",
        solutionId,
        null,
      );
    }

    console.log("Revalidate response found:", !!revalidateResponse);
    const res = JSON.parse(revalidateResponse.response);

    const authToken = await this.tboAuthTokenService.getAuthToken(bookRequest);
    const ssrPayload = {
      EndUserIp: this.resolveEndUserIp(bookRequest),
      TokenId: authToken,
      TraceId: res.Response.TraceId,
      ResultIndex: res.Response.Results.ResultIndex,
    };
    // const ssrEndpoint = `${providerCred.url}BookingEngineService_Air/AirService.svc/rest/SSR`;
    // console.log("🔥 CALLING SSR API WITH:", ssrPayload, "url:", ssrEndpoint);
    const ssrResponse = await Http.httpRequestTBO(
      "POST",
      // `https://tboapi.travelboutiqueonline.com/AirAPI_V10/AirService.svc/rest/SSR`,
      `http://api.tektravels.com/BookingEngineService_Air/AirService.svc/rest/SSR`,
      JSON.stringify(ssrPayload),
    );

    console.log("🔥 SSR RESPONSE:", JSON.stringify(ssrResponse));

    const fareFlightKeys = this.extractAllowedFlightKeysFromFareQuote(res);
    const userSSRRaw = normalizeBundledSsrPerPassengers(
      bookReq.passengers ?? [],
      this.buildUserSsrPassengersList(bookReq),
    );
    const userSSR =
      fareFlightKeys.size > 0
        ? this.filterSsrByAllowedFlights(userSSRRaw, fareFlightKeys)
        : userSSRRaw;
    const mappedSSR = this.mapSSR(userSSR, ssrResponse);
    const mappedWithSeatFallback = this.mergeUserSeatPassthrough(
      userSSR,
      mappedSSR,
    );
    const priorSsr =
      bookReq.ssr && typeof bookReq.ssr === "object" ? bookReq.ssr : {};
    bookReq.ssr = this.mergeSsrByPassengerIndex(priorSsr, mappedWithSeatFallback);
    this.injectClientSsrWhenMissing(bookReq, res);

    console.log("🔥 FINAL MAPPED SSR:", JSON.stringify(bookReq.ssr));

    const fareBreakDown = res.Response.Results?.FareBreakdown;
    const isLCC = res.Response.Results.IsLCC;

    // Use ResultIndex from revalidate response (this is the updated/confirmed solutionId from TBO)
    const revalidateResultIndex = res.Response.Results?.ResultIndex;
    // console.log('Original solutionId:', solutionId);
    // console.log('Revalidate ResultIndex:', revalidateResultIndex);

    // Update bookReq with revalidate ResultIndex for booking API
    if (revalidateResultIndex) {
      bookReq.solutionId = revalidateResultIndex;
    }

    Object.assign(bookRequest, {
      tokenReqData: bookReq,
      searchReqId: bookReq.searchReqId,
      trackingId: bookReq.trackingId,
      fareBreakDown,
      airlineType: isLCC ? "LCC" : "Non-LCC",
    });
    let pnr: string = "";
    let bookingId: string = "";
    let bookTraceId: string = "";

    /* Check if booking is Non LCC create initiate the book API call */
    if (!isLCC) {
      const requestBody = await this.createBookRequest({
        bookRequest,
        pnr,
        bookingId,
        bookTraceId,
        index,
      });
      // dev
      const endpoint = `${providerCred.url}BookingEngineService_Air/AirService.svc/rest/Book`;

      console.log(
        "SSR BEFORE BOOK API:",
        JSON.stringify(bookRequest.bookReq?.ssr),
      );
      console.log("Calling TBO BOOK API...");

      // prod url
      // const endpoint = `${providerCred.book_url}/rest/Book`;
      let bookResult;
      try {
        bookResult = await Http.httpRequestTBO(
          "POST",
          endpoint,
          JSON.stringify(requestBody),
        );
      } catch (error) {
        logCollector?.({
          index,
          title: "Book-TBO",
          fileSuffix: "book-TBO",
          supplierRequest: requestBody,
          supplierResponse: {
            error: error?.message ?? "Unknown error",
            details: error,
          },
          apiRequest: bookRequest.bookReq,
        });
        throw error;
      }
      console.log("TBO BOOK STATUS:", bookResult?.Response?.ResponseStatus);
      console.log("requestBody BOOK \n", JSON.stringify(requestBody), "\n");
      console.log("BOOKING RESULT \n", JSON.stringify(bookResult), "\n");
      logCollector?.({
        index,
        title: "Book-TBO",
        fileSuffix: "book-TBO",
        supplierRequest: requestBody,
        supplierResponse: bookResult,
        apiRequest: bookRequest.bookReq,
      });
      /* Check if booking is successful */
      if (bookResult.Response.ResponseStatus !== 1) {
        const message =
          bookResult?.Errors?.[0]?.UserMessage ||
          "This flight is not available.";
        order.orderStatus = BookingStatus.FAILED;
        Object.assign(bookResponse, {
          error: true,
          message: message,
          orderDetail: order,
          searchReqId: bookReq.searchReqId,
          supplierMessage: bookResult.Response.Error?.ErrorMessage,
          mode: "TBO-" + bookRequest.providerCred.mode,
        });

        return [{ ticketingResult: bookResponse }] as any;
      }

      /* Updating PNR variable */
      pnr = bookResult.Response.Response.PNR || "";
      bookingId = bookResult.Response.Response.BookingId || "";
      bookTraceId = bookResult.Response.TraceId || "";
    }
    /* Ticketing API for the LCC book */
    return await this.ticketingCall({
      bookRequest,
      pnr,
      bookingId,
      bookTraceId,
      index,
      supplierResult: null,
      logCollector,
    });
  }

  /** [@Description: This method is used to create the ticketing call]
   * @author: Prashant Joshi at 13-10-2025 **/
  async ticketingCall(reqParams) {
    const {
      bookRequest,
      pnr,
      bookingId,
      bookTraceId,
      index,
      supplierResult = null,
      logCollector,
    }: {
      bookRequest: any;
      pnr: string;
      bookingId: string;
      bookTraceId: string;
      index: number;
      supplierResult?: any;
      logCollector?: SupplierLogCollector;
    } = reqParams;
    const { providerCred } = bookRequest;
    console.log("===== TICKETING START =====");
    const startTime = Date.now();
    /* Ticketing API for the LCC book */
    const requestBodyTicketing = await this.createBookRequest({
      bookRequest,
      pnr,
      bookingId,
      bookTraceId,
      index,
      supplierResult,
    });

    // dev
    const endpointTicketing = `${providerCred.url}BookingEngineService_Air/AirService.svc/rest/Ticket`;

    console.log("Calling TBO TICKETING API...");

    // prod url
    // const endpointTicketing = `${providerCred.book_url}/rest/Ticket`;
    let ticketingResult;
    try {
      ticketingResult = await Http.httpRequestTBO(
        "POST",
        endpointTicketing,
        JSON.stringify(requestBodyTicketing),
      );
    } catch (error) {
      logCollector?.({
        index,
        title: "Ticketing-TBO",
        fileSuffix: "ticketing-TBO",
        supplierRequest: requestBodyTicketing,
        supplierResponse: {
          error: error?.message ?? "Unknown error",
          details: error,
        },
        apiRequest: bookRequest.bookReq,
      });
      throw error;
    }

    console.log("TICKETING STATUS:", ticketingResult?.Response?.ResponseStatus);
    console.log("PNR:", ticketingResult?.Response?.Response?.PNR);

    const endTime = Date.now();
    const responseTimeMs = endTime - startTime;

    console.log(
      "SSR IN FINAL TICKET REQUEST:",
      JSON.stringify(bookRequest.bookReq?.ssr),
    );

    console.log(
      "requestBodyTicketing \n",
      JSON.stringify(requestBodyTicketing),
      "\n",
    );

    console.log(
      "FINAL TBO REQUEST:",
      JSON.stringify(requestBodyTicketing, null, 2),
    );
    console.log("TICKITING RESULT \n", JSON.stringify(ticketingResult), "\n");

    logCollector?.({
      index,
      title: "Ticketing-TBO",
      fileSuffix: "ticketing-TBO",
      supplierRequest: requestBodyTicketing,
      supplierResponse: ticketingResult,
      apiRequest: bookRequest.bookReq,
    });
    //if price and time updated then cancel booking
    if (
      ticketingResult?.Response?.Response?.IsPriceChanged ||
      ticketingResult?.Response?.Response?.IsTimeChanged
    ) {
      return await this.ticketingCall({
        bookRequest,
        pnr,
        bookingId,
        bookTraceId,
        index,
        supplierResult: ticketingResult,
        logCollector,
      });
    }
    return [{ ticketingResult, requestBodyTicketing }] as any;
  }

  /** [@Description: This method is used to create the multiple book]
   * @author: Prashant Joshi at 13-10-2025 **/
  async createMultipleBook(reqParams) {
    const {
      bookRequest,
      handleAuthenticationFailure,
      logCollector,
    }: {
      bookRequest: any;
      handleAuthenticationFailure: (...args: any[]) => any;
      logCollector?: SupplierLogCollector;
    } = reqParams;
    const { bookReq }: { bookReq: BookDto } = bookRequest;

    // Split the solutionId based on "|||"
    const solutionIds = bookReq.solutionId.split(" ||| ");

    const bookingResults: any[] = [];

    for (const [i, solutionId] of solutionIds.entries()) {
      const trimmedSolutionId = solutionId.trim();

      const selectedSegment = bookReq.routes[i];
      const airlineType = bookReq.airlineType;

      // Prepare updated book request for the current solution ID
      const updatedBookRequest = {
        ...bookRequest,
        bookReq: {
          ...bookReq,
          solutionId: trimmedSolutionId,
          selectedSegment,
          airlineType,
        },
      };

      // Call the createSingleBook function
      const result = await this.createSingleBook({
        bookRequest: updatedBookRequest,
        index: i,
        handleAuthenticationFailure,
        logCollector,
      });
      if (Array.isArray(result)) {
        //if first booking is failed then return error, not attempt second booking
        if (
          i === 0 &&
          (result[0]?.ticketingResult?.error ||
            result[0]?.ticketingResult?.Response?.ResponseStatus != 1)
        ) {
          return result;
        }
        bookingResults.push(...result);
      }
    }
    return bookingResults;
  }

  /** [@Description: This method is used to create the book request]
   * @author: Prashant Joshi at 13-10-2025 **/
  async createBookRequest(reqParams) {
    const {
      bookRequest,
      pnr,
      bookingId,
      bookTraceId,
      index: idx = 0,
      supplierResult = null,
    } = reqParams;
    const fareBreakDown =
      bookRequest?.fareBreakDown ?? bookRequest?.FareBreakdown;

    const { bookReq, headers } = bookRequest;

    const passengers = bookReq.passengers;

    // ===== SSR START =====
    const ssr = bookReq.ssr || {};
    console.log("SSR inside createBookRequest:", JSON.stringify(ssr));

    // calculate SSR total (optional debug)
    const ssrTotal = Object.values(ssr).reduce((sum: number, pax: any) => {
      if (!pax) return sum;

      const baggageTotal =
        pax.Baggage?.reduce((s, b) => s + (b?.Price || 0), 0) || 0;

      const mealTotal =
        pax.MealDynamic?.reduce((s, m) => s + (m?.Price || 0), 0) || 0;

      const seatTotal =
        pax.SeatDynamic?.reduce((s, s1) => s + (s1?.Price || 0), 0) || 0;

      return sum + baggageTotal + mealTotal + seatTotal;
    }, 0);

    console.log("SSR Total:", ssrTotal);

    /* Create passenger array */
    // const passengerArray = passengers.map((element, index) => {
    const passengerArray = passengers.map((element, passengerIndex) => {
      // const passengerSSR = ssr[index] || {};
      const passengerSSR =
        ssr[passengerIndex] ?? ssr[String(passengerIndex)] ?? {};
      console.log(
        `Passenger ${passengerIndex} SSR:`,
        JSON.stringify(passengerSSR),
      );
      const pexT =
        element?.passengerType === "ADT"
          ? 1
          : element?.passengerType === "CHD"
            ? 2
            : 3;

      // get pex fare from DB fare breakdown
      const fare = fareBreakDown?.find((f) => f?.PassengerType === pexT);
      const paxCount = fare?.PassengerCount || 1;
      console.log("👤 Passenger Fare Breakdown:", {
        passengerName: element?.passengerDetail?.firstName,
        passengerType: element?.passengerType,
        baseFare: fare?.BaseFare,
        passengerCount: fare?.PassengerCount,
        dividedFare: (fare?.BaseFare ?? 0) / paxCount,
      });

      const addTxnPub =
        fare?.AdditionalTxnFeePub ?? fare?.AdditionalTxnFeePubL ?? 0;

      return {
        Title: element?.passengerDetail?.title || "Mr",
        FirstName: element?.passengerDetail?.firstName.trim(),
        LastName: element?.passengerDetail?.lastName.trim(),
        PaxType: pexT,
        PassengerInformation: "NN",
        DateOfBirth: moment(element?.dateOfBirth, "YYYY-MM-DD").format(
          "YYYY-MM-DDTHH:mm:ss",
        ),
        Gender: element.gender == "M" ? 1 : 2,
        PassportNo: element?.document?.documentNumber,
        PassportExpiry: element?.document?.expiryDate,
        PassportIssueDate: element?.document?.issueDate,
        PassportIssueCountryCode: element?.document?.country,
        AddressLine1: `${element?.city?.name || ""}, ${element?.country?.name || ""}, ${bookReq?.contact?.postalCode}`,
        AddressLine2: "",
        City: element?.city?.name || 'Mumbai',
        CountryName: element?.country?.name || 'India',
        CountryCode: element?.document?.country || 'IN',
        Nationality: element?.nationality,
        GSTCompanyAddress: bookReq?.gst?.gstCompanyAddress || "",
        GSTCompanyContactNumber: bookReq?.gst?.gstCompanyContactNumber || "",
        GSTCompanyName: bookReq?.gst?.gstCompanyName || "",
        GSTNumber: bookReq?.gst?.gstNumber || "",
        GSTCompanyEmail: bookReq?.gst?.gstCompanyEmail || "",
        ContactNo: element.mobile.replace("+", "").trim(),
        CellCountryCode: element?.mobileCountryCode,
        Email: element?.email || bookReq?.contact?.email,
        IsLeadPax: passengerIndex === 0,
        FFAirlineCode: null,
        FFAirline: null,
        FFNumber: null,
        Fare: {
          Currency: fare?.Currency,
          BaseFare: (fare?.BaseFare ?? 0) / paxCount,
          Tax: (fare?.Tax ?? 0) / paxCount,
          TransactionFee: (fare?.TransactionFee ?? 0) / paxCount,
          YQTax: (fare?.YQTax ?? 0) / paxCount,
          AdditionalTxnFeeOfrd:
            (fare?.AdditionalTxnFeeOfrd ?? 0) / paxCount,
          AdditionalTxnFeePub: addTxnPub / paxCount,
          AdditionalTxnFeePubL: (fare?.AdditionalTxnFeePubL ?? 0) / paxCount,
          AirTransFee: (fare?.AirTransFee ?? 0) / paxCount,
          PGCharge: (fare?.PGCharge ?? 0) / paxCount,
        },
        // ===== SSR INJECTION =====

        ...(Array.isArray(passengerSSR?.MealDynamic) &&
          passengerSSR.MealDynamic.length > 0 && {
          MealDynamic: passengerSSR.MealDynamic.map((m: any) => ({
            ...m,
            Nationality: m?.Nationality ?? element?.nationality,
          })),
        }),

        ...(Array.isArray(passengerSSR?.SeatDynamic) &&
          passengerSSR.SeatDynamic.length > 0 && {
          SeatDynamic: passengerSSR.SeatDynamic,
        }),

        ...(Array.isArray(passengerSSR?.Baggage) &&
          passengerSSR.Baggage.length > 0 && {
          Baggage: passengerSSR.Baggage,
        }),
      };
    });
    console.log(
      "🚀 FINAL PASSENGER PAYLOAD:",
      JSON.stringify(passengerArray, null, 2),
    );

    const authToken = await this.tboAuthTokenService.getAuthToken(bookRequest);
    let obj: any = {};

    if (pnr) {
      obj = {
        TokenId: authToken,
        TraceId: bookTraceId,
        PNR: pnr,
        BookingId: bookingId,
        EndUserIp: headers["ip-address"],
      };
    } else {
      obj = {
        TokenId: authToken,
        TraceId: bookReq?.trackingId,
        ResultIndex: bookReq?.solutionId,
        EndUserIp: headers["ip-address"],
        Passengers: passengerArray,
      };
      console.log("Ticketing API Request - ResultIndex:", bookReq?.solutionId);
    }

    if (supplierResult?.Response?.Response?.IsPriceChanged) {
      obj.IsPriceChangeAccepted = true;
    }

    if (supplierResult?.Response?.Response?.IsTimeChanged) {
      obj.IsPriceChangeAccepted = true;
    }

    return obj;
  }

  /**
   * Maps user-selected SSR to full TBO catalog objects (required on LCC Ticket per Tek Travels docs).
   */
  mapSSR(
    userSSR: SsrPassengerSelections[],
    ssrApiResponse: any,
  ): Record<number, any> {
    const result: Record<number, any> = {};
    const resp = ssrApiResponse?.Response;
    if (!resp || Number(resp.ResponseStatus) !== 1) {
      return result;
    }

    const flatSeats = this.flattenTboSeatInventory(resp.SeatDynamic);

    userSSR.forEach((pax, index) => {
      const bagCat = this.getSsrCatalogArray(resp.Baggage, index);
      const mealCat = this.getSsrCatalogArray(resp.MealDynamic, index);
      const row: any = {};

      if (pax.Baggage?.length) {
        const mapped = pax.Baggage.map((sel) =>
          this.pickBaggageFromCatalog(sel, bagCat),
        ).filter(Boolean);
        if (mapped.length) row.Baggage = mapped;
      }

      if (pax.MealDynamic?.length) {
        const mapped = pax.MealDynamic.map((sel) =>
          this.pickMealFromCatalog(sel, mealCat),
        ).filter(Boolean);
        if (mapped.length) row.MealDynamic = mapped;
      }

      if (pax.SeatDynamic?.length) {
        const mapped = pax.SeatDynamic.map((sel) =>
          this.pickSeatFromCatalog(sel, flatSeats),
        ).filter(Boolean);
        if (mapped.length) row.SeatDynamic = mapped;
      }

      if (Object.keys(row).length > 0) {
        result[index] = row;
      }
    });

    return result;
  }
}
