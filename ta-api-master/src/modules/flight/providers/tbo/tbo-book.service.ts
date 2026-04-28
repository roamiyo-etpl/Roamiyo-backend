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

interface SupplierLogEntry {
  index: number;
  title: string;
  fileSuffix: string;
  supplierRequest: any;
  supplierResponse: any;
  apiRequest?: any;
}

type SupplierLogCollector = (entry: SupplierLogEntry) => void;

@Injectable()
export class TboBookService {
  logDate = Date.now();
  constructor(
    private readonly tboAuthTokenService: TboAuthTokenService,
    private genericRepo: GenericRepo,
    @InjectRepository(RevalidateResponseEntity)
    private revalidateRepo: Repository<RevalidateResponseEntity>,
    private readonly supplierLogUtility: SupplierLogUtility,
  ) {}

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

          const ssr = bookRequest.bookReq?.ssr || {};

          const ssrTotal = Object.values(ssr).reduce(
            (sum: number, pax: any) => {
              if (!pax) return sum;

              const baggageTotal =
                pax.Baggage?.reduce((s, b) => s + (b?.Price || 0), 0) || 0;

              const mealTotal =
                pax.MealDynamic?.reduce((s, m) => s + (m?.Price || 0), 0) || 0;

              const seatTotal =
                pax.SeatDynamic?.reduce((s, s1) => s + (s1?.Price || 0), 0) ||
                0;

              return sum + baggageTotal + mealTotal + seatTotal;
            },
            0,
          );

          console.log("SSR used for pricing:", JSON.stringify(ssr));
          console.log("Final SSR Total:", ssrTotal);
          // till here

          /* Check if Ticketing is successful and Setting order details */
          if (data?.ticketingResult?.Response?.ResponseStatus === 1) {
            order.orderNo = data.ticketingResult.Response?.Response?.BookingId;
            order.supplierBaseAmount = publishedFare + ssrTotal;
            // order.supplierBaseAmount =
            //   data.ticketingResult.Response?.Response?.FlightItinerary?.Fare
            //     ?.PublishedFare || 0;
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
      this.ticketingCall({
        bookRequest,
        pnr,
        bookingId,
        bookTraceId,
        index,
        supplierResult: ticketingResult,
        logCollector,
      });
      // ticketingResult.Response.ResponseStatus = 2;
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
    const fareBreakDown = bookRequest?.FareBreakdown;

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
    const passengerArray = passengers.map((element, index) => {
      const passengerSSR = ssr[index] || {};
      console.log(`Passenger ${index} SSR:`, JSON.stringify(passengerSSR));
      const pexT =
        element?.passengerType === "ADT"
          ? 1
          : element?.passengerType === "CHD"
            ? 2
            : 3;

      // get pex fare from DB fare breakdown
      const fare = fareBreakDown?.find((f) => f?.PassengerType === pexT);
      console.log("👤 Passenger Fare Breakdown:", {
        passengerName: element?.passengerDetail?.firstName,
        passengerType: element?.passengerType,
        baseFare: fare?.BaseFare,
        passengerCount: fare?.PassengerCount,
        dividedFare: fare?.BaseFare / (fare?.PassengerCount || 1),
      });

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
        City: element?.city?.name,
        CountryName: element?.country?.name,
        CountryCode: element?.document?.country,
        Nationality: element?.nationality,
        GSTCompanyAddress: bookReq?.gst?.gstCompanyAddress || "",
        GSTCompanyContactNumber: bookReq?.gst?.gstCompanyContactNumber || "",
        GSTCompanyName: bookReq?.gst?.gstCompanyName || "",
        GSTNumber: bookReq?.gst?.gstNumber || "",
        GSTCompanyEmail: bookReq?.gst?.gstCompanyEmail || "",
        ContactNo: element.mobile.replace("+", "").trim(),
        CellCountryCode: element?.mobileCountryCode,
        Email: element?.email || bookReq?.contact?.email,
        IsLeadPax: index === 0,
        FFAirlineCode: null,
        FFAirline: null,
        FFNumber: null,
        Fare: {
          Currency: fare?.Currency,
          BaseFare: fare?.BaseFare / (fare?.PassengerCount || 1) || 0,
          Tax: fare?.Tax / (fare?.PassengerCount || 1) || 0,
          YQTax: fare?.YQTax / (fare?.PassengerCount || 1) || 0,
          AdditionalTxnFeeOfrd:
            fare?.AdditionalTxnFeeOfrd / (fare?.PassengerCount || 1) || 0,
          AdditionalTxnFeePubL:
            fare?.AdditionalTxnFeePubL / (fare?.PassengerCount || 1) || 0,
          PGCharge: fare?.PGCharge / (fare?.PassengerCount || 1) || 0,
        },
        // ===== SSR INJECTION =====
        ...(passengerSSR?.MealDynamic && {
          MealDynamic: passengerSSR.MealDynamic,
        }),

        ...(passengerSSR?.SeatDynamic && {
          SeatDynamic: passengerSSR.SeatDynamic,
        }),

        ...(passengerSSR?.Baggage && {
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
}
