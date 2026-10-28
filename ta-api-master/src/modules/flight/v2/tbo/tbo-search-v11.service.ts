import { Injectable, InternalServerErrorException } from "@nestjs/common";
import md5 from "md5";
import { TboAuthTokenService } from "../../providers/tbo/tbo-auth-token.service";
import { Http } from "src/shared/utilities/flight/http.utility";
import { GenericRepo } from "src/shared/utilities/flight/generic-repo.utility";
import { Generic } from "src/shared/utilities/flight/generic.utility";
import { DateUtility } from "src/shared/utilities/flight/date.utility";
import { airlines } from "src/shared/utilities/flight/airline.utility";
import { airports } from "src/shared/utilities/flight/airport.utility";
import { runWithTboInstrumentationAsync } from "src/shared/utilities/flight/tbo-api-instrumentation.utility";
import { SupplierLogUtility } from "src/shared/utilities/flight/supplier-log.utility";
import {
  Segment,
  Fare,
  LocationInfo,
  BaggageInfo,
  GroupHash,
} from "../../search/interfaces/start-routing.interface";
import {
  RouteV2,
  StartRoutingV2Response,
} from "../interfaces/start-routing-v2.interface";
import { AirlineCategory } from "../../../../shared/enums/flight/flight.enum";

/**
 * TBO Air Search V11 (http://apiv11.tektravels.com/extapi/v1/Search).
 * Independent of the V10 TboSearchService: V10 code is not used or changed here.
 *
 * Differences from V10 search:
 * - Endpoint comes from env TBO_V11_SEARCH_URL (auth/token still from provider_master TBO row).
 * - V11 no longer returns FareRules, MiniFareRules, FareInclusions (moved to FareRule / FareUpsell).
 * - Nothing is filtered: no de-duplication, no OB/IB pairing. Every result TBO sends is returned,
 *   with every TBO key passed through as-is (all fare types: Saver, Publish, Corporate, etc.).
 * - Domestic return: Results[0] (OB) -> route, Results[1] (IB) -> inboundRoute.
 */
@Injectable()
export class TboSearchV11Service {
  constructor(
    private readonly tboAuthTokenService: TboAuthTokenService,
    private readonly genericRepo: GenericRepo,
    private readonly supplierLogUtility: SupplierLogUtility,
  ) {}

  /** [@Description: Search flights on TBO V11] **/
  async search(searchRequest): Promise<StartRoutingV2Response> {
    const { searchReqId } = searchRequest;
    return runWithTboInstrumentationAsync({ searchReqId, phase: "search" }, () =>
      this.searchInternal(searchRequest),
    );
  }

  private async searchInternal(searchRequest): Promise<StartRoutingV2Response> {
    const { searchReqId, searchReq } = searchRequest;

    const endpoint = process.env.TBO_V11_SEARCH_URL;
    if (!endpoint) {
      throw new InternalServerErrorException(
        "TBO V11 search URL is not configured (TBO_V11_SEARCH_URL).",
      );
    }

    const authToken = await this.tboAuthTokenService.getAuthToken(searchRequest);
    searchRequest.authToken = authToken;

    let requestBody;
    let searchResult;
    let searchResponse: StartRoutingV2Response | undefined;
    const startTime = Date.now();
    let endTime = startTime;

    try {
      requestBody = this.creatingSearchRequest(searchRequest);
      console.log(`[FLIGHT-SEARCH-V11] reqId=${searchReqId} endpoint: ${endpoint}`);

      searchResult = await Http.httpRequestTBO(
        "POST",
        endpoint,
        JSON.stringify(requestBody),
        "search",
      );
      endTime = Date.now();

      searchResponse = this.convertingResponse(searchRequest, searchResult);

      console.log(
        `[FLIGHT-SEARCH-V11] reqId=${searchReqId} TBO call ${(endTime - startTime) / 1000}s, convert ${(Date.now() - endTime) / 1000}s, OB/combined ${searchResponse.route.length}, IB ${searchResponse.inboundRoute.length}`,
      );

      return searchResponse;
    } catch (error) {
      await this.genericRepo.storeLogs(searchReqId, 1, error, 0);
      console.log(error);
      throw new InternalServerErrorException(
        "There is an issue while fetching data from the providers.",
      );
    } finally {
      /* Full log (our request, TBO request, complete raw TBO response, our response).
         Not awaited so the upload doesn't delay the search response */
      const logsWithRes = {
        ApiRequest: searchReq,
        ApiResponse: searchResponse ?? null,
        ApiResponseTime: `${(Date.now() - startTime) / 1000} seconds`,
        supplierEndpoint: endpoint,
        supplierRequest: requestBody ?? null,
        supplierResponse: searchResult ?? null,
        supplierResponseTime: `${(endTime - startTime) / 1000} seconds`,
      };
      this.supplierLogUtility
        .generateLogFile({
          fileName: searchReqId + "-" + Date.now() + "-TBO-V11",
          logData: logsWithRes,
          folderName: "search-v11",
          logId: null,
          title: "Search-TBO-V11",
          searchReqId: searchReqId,
          bookingReferenceId: null,
        })
        .catch((error) => this.genericRepo.storeLogs(searchReqId, 1, error, 0));
    }
  }

  /** [@Description: Builds the TBO V11 search request (same structure as V10 per TBO docs)] **/
  creatingSearchRequest(searchRequest) {
    const { searchReq, headers } = searchRequest;
    const cabinClass = Generic.convertCabinClassCode(
      "TBO",
      searchReq.travelPreferences[0].cabinClass,
      true,
    );

    const params: Record<string, unknown> = {
      EndUserIp: headers["ip-address"],
      TokenId: searchRequest.authToken,
      AdultCount: Generic.getAdultCount(searchReq),
      ChildCount: Generic.getChildCount(searchReq),
      InfantCount: Generic.getInfantCount(searchReq),
      DirectFlight: false,
      OneStopFlight: false,
      JourneyType: Generic.getTripTypeTbo(
        searchReq.travelPreferences[0].airTripType,
      ),
      PreferredAirlines: this.getPreferredAirlines(searchReq.PreferredAirlines),
      Segments: searchReq.searchAirLegs.map((leg) => ({
        Origin: leg.origin,
        Destination: leg.destination,
        FlightCabinClass: cabinClass,
        /* TBO format: yyyy-MM-ddTHH:mm:ss */
        PreferredDepartureTime: leg.departureDate + "T00:00:00",
        PreferredArrivalTime: leg.departureDate + "T00:00:00",
      })),
      Sources: null,
    };

    /* Only when client sends it (2 Regular, 3 Student, 4 Armed Force, 5 Senior Citizen) */
    if (searchReq.ResultFareType != null) {
      params.ResultFareType = Number(searchReq.ResultFareType);
    }

    return params;
  }

  /** [@Description: Client PreferredAirlines ("AI", "AI,UK" or ["AI","UK"]) to TBO's string[].
   * Missing / null / empty means all airlines (null)] **/
  getPreferredAirlines(preferredAirlines): string[] | null {
    const codes = (
      Array.isArray(preferredAirlines)
        ? preferredAirlines
        : String(preferredAirlines ?? "").split(",")
    )
      .map((code) => String(code ?? "").trim().toUpperCase())
      .filter(Boolean);

    return codes.length ? codes : null;
  }

  /** [@Description: Converts TBO V11 response to our format, keeping every TBO key and every result] **/
  convertingResponse(searchRequest, results): StartRoutingV2Response {
    const { providerCred, searchReq, searchReqId, headers } = searchRequest;
    const preferredCurrency = headers["currency-preference"] || "USD";
    const airlineNames = airlines("");

    const searchResponse = new StartRoutingV2Response();
    searchResponse.searchReqId = searchReqId;
    searchResponse.trackingId = results?.Response?.TraceId;
    searchResponse.mode = "TBO-" + providerCred.mode;
    searchResponse.complete = true;
    searchResponse.isDomestic = results?.IsDomestic;
    searchResponse.route = [];
    searchResponse.inboundRoute = [];

    const resultGroups = results?.Response?.Results;
    if (
      results?.Response?.ResponseStatus &&
      Array.isArray(resultGroups) &&
      resultGroups.some((group) => Array.isArray(group) && group.length)
    ) {
      resultGroups.forEach((group, groupIndex) => {
        const journeyDirection = groupIndex === 0 ? "outbound" : "inbound";
        const routes = (group ?? []).map((flightJourney) =>
          this.convertJourney(
            flightJourney,
            journeyDirection,
            searchReq,
            preferredCurrency,
            airlineNames,
          ),
        );
        if (groupIndex === 0) {
          searchResponse.route.push(...routes);
        } else {
          searchResponse.inboundRoute.push(...routes);
        }
      });
      searchResponse.count =
        searchResponse.route.length + searchResponse.inboundRoute.length;
      searchResponse.error = false;
      searchResponse.message = "OK";
    } else {
      searchResponse.count = 0;
      searchResponse.error = true;
      searchResponse.message =
        results?.Response?.Error?.ErrorMessage || "No flight found.";
    }

    /* TBO passthrough: every top-level key (TraceId, Origin, Destination, ResponseStatus, Error, ...) */
    this.addTboPassthrough(searchResponse, results?.Response, ["Results"]);
    this.addTboPassthrough(searchResponse, results, ["Response"]);

    return searchResponse;
  }

  /** [@Description: Converts one TBO result to a route] **/
  convertJourney(
    flightJourney,
    journeyDirection: "outbound" | "inbound",
    searchReq,
    preferredCurrency,
    airlineNames,
  ): RouteV2 {
    const flightRoute = new RouteV2();
    flightRoute.journeyDirection = journeyDirection;

    flightRoute.fare = [
      this.settingUpPrices(
        searchReq,
        flightJourney?.Fare,
        flightJourney?.FareBreakdown ?? [],
        preferredCurrency,
        flightJourney?.ResultFareType,
      ),
    ];

    const legFare = {
      BaseFare: flightJourney?.Fare?.BaseFare,
      Tax: flightJourney?.Fare?.Tax,
      PublishedFare: flightJourney?.Fare?.PublishedFare,
      ServiceFee: flightJourney?.Fare?.ServiceFee,
      OfferedFare: flightJourney?.Fare?.OfferedFare,
    };
    flightRoute.legs = [{ type: journeyDirection, fare: legFare }];
    flightRoute.outboundFare = journeyDirection === "outbound" ? legFare : null;
    flightRoute.inboundFare = journeyDirection === "inbound" ? legFare : null;

    const flightSegments: any[] = [];
    const departureInfos: LocationInfo[] = [];
    const arrivalInfos: LocationInfo[] = [];
    const flightStops: number[] = [];
    const hashCodes: string[] = [];
    const totalDurations: string[] = [];
    const totalIntervals: string[] = [];
    const airlineCodes: string[] = [];
    const routeAirlineNames: string[] = [];
    let groupHashCode = "";

    (flightJourney?.Segments ?? []).forEach((segmentArray) => {
      let airlineCode = "";
      let hashCode = "";
      let totalDuration = 0;
      let totalInterval = 0;
      const segments: Segment[] = [];

      (segmentArray ?? []).forEach((segment) => {
        airlineCode = segment?.Airline?.AirlineCode;
        totalDuration += segment?.Duration || 0;

        const fSegment = this.settingUpSegments(segment, airlineNames);
        segments.push(fSegment);
        totalInterval += fSegment.intervalMinutes || 0;

        hashCode +=
          fSegment.airlineCode +
          fSegment.flightNumber +
          fSegment.cabinClass +
          fSegment.supplierFareClass;
      });

      airlineCodes.push(airlineCode);
      routeAirlineNames.push(airlineNames?.[airlineCode] || airlineCode);
      hashCodes.push(md5(hashCode));
      groupHashCode += md5(hashCode);
      totalIntervals.push(Generic.convertMinutesToHours(totalInterval));
      totalDurations.push(
        Generic.convertMinutesToHours(totalDuration + totalInterval),
      );
      flightSegments.push(segments);
      flightStops.push(segments.length - 1);

      if (segments.length) {
        const locationInfo = this.settingUpLocationInfo(segments);
        departureInfos.push(locationInfo["departureInfo"]);
        arrivalInfos.push(locationInfo["arrivalInfo"]);
      }
    });

    flightRoute.routeId = "";
    flightRoute.solutionId = [flightJourney?.ResultIndex];
    flightRoute.isRefundable = flightJourney?.IsRefundable;
    flightRoute.airlineCode = airlineCodes;
    flightRoute.airlineName = routeAirlineNames;
    flightRoute.flightStops = flightStops;
    flightRoute.hashCode = hashCodes;
    flightRoute.groupHashCode = md5(groupHashCode);
    flightRoute.fareSourceCode = [""];
    flightRoute.isDuplicateOutbound = false;
    flightRoute.airlineType = flightJourney?.IsLCC
      ? AirlineCategory.LCC
      : AirlineCategory.Non_LCC;
    flightRoute.totalDuration = totalDurations;
    flightRoute.totalInterval = totalIntervals;
    flightRoute.departureInfo = departureInfos;
    flightRoute.arrivalInfo = arrivalInfos;
    flightRoute.flightSegments = flightSegments;

    const groupHash = new GroupHash();
    groupHash.provider = ["TBO"];
    groupHash.hashCode = hashCodes;
    groupHash.groupHashCode = flightRoute.groupHashCode;
    groupHash.totalAmount = flightRoute.fare[0].totalFare;
    groupHash.solutionId = flightRoute.solutionId[0];
    flightRoute.groupHash = [groupHash];

    /* TBO passthrough: every other result-level key (Fare, FareBreakdown, ResultFareType,
       FareClassification, IsLCC, Source, AirlineRemark, LastTicketDate, ...) with TBO names.
       Segments go per segment; ResultIndex goes out as solutionId */
    this.addTboPassthrough(flightRoute, flightJourney, ["Segments", "ResultIndex"]);

    return flightRoute;
  }

  /** [@Description: Sets up the prices (same calculation as V10 search)] **/
  settingUpPrices(
    searchReq,
    passengerFareArr,
    fareBreakDown,
    preferredCurrency,
    FareType,
  ) {
    const fareDetail: Fare = new Fare();
    const adultCount = Generic.getAdultCount(searchReq);
    const childCount = Generic.getChildCount(searchReq);
    const infantCount = Generic.getInfantCount(searchReq);
    const perPax = { 1: {}, 2: {}, 3: {} } as Record<number, any>;

    fareDetail.fareType = FareType || "";

    fareBreakDown.forEach((element) => {
      const passengerCount = element?.PassengerCount || 1; // Avoid division by zero
      const convert = (amount) =>
        amount
          ? Generic.currencyConversion(
              amount / passengerCount,
              element.Currency,
              preferredCurrency,
            )
          : 0;

      if (![1, 2, 3].includes(element?.PassengerType)) return;
      perPax[element.PassengerType] = {
        base:
          Generic.currencyConversion(
            element?.BaseFare / passengerCount,
            element.Currency,
            preferredCurrency,
          ) || 0,
        tax: convert(element?.Tax),
        serviceFee: convert(element?.ServiceFee),
        otherCharges: convert(element?.OtherCharges),
      };
    });

    const adult = perPax[1];
    const child = perPax[2];
    const infant = perPax[3];

    const perPersonAdultFare: number = adult.base || 0;
    const perPersonChildFare: number = childCount > 0 ? child.base || 0 : 0;
    const perPersonInfantFare: number = infantCount > 0 ? infant.base || 0 : 0;
    fareDetail.perPersonAdultFare = perPersonAdultFare;
    fareDetail.adultFare = perPersonAdultFare * adultCount;
    fareDetail.perPersonChildFare = perPersonChildFare;
    fareDetail.childFare = perPersonChildFare * childCount;
    fareDetail.perPersonInfantFare = perPersonInfantFare;
    fareDetail.infantFare = perPersonInfantFare * infantCount;

    const sum = (key) =>
      (adult[key] || 0) * adultCount +
      (child[key] || 0) * childCount +
      (infant[key] || 0) * infantCount;

    fareDetail.baseFare =
      fareDetail.adultFare + fareDetail.childFare + fareDetail.infantFare;
    fareDetail.tax = sum("tax");
    fareDetail.serviceFee = sum("serviceFee");
    fareDetail.otherCharges = sum("otherCharges");

    /* Search page fare (per adult) */
    const searchTax: number =
      (adult.tax || 0) + (adult.serviceFee || 0) + (adult.otherCharges || 0);
    fareDetail.searchBaseFare = perPersonAdultFare;
    fareDetail.searchTax = searchTax;
    fareDetail.searchTotalFare = perPersonAdultFare + searchTax;

    const totalFare =
      fareDetail.baseFare +
      fareDetail.serviceFee +
      fareDetail.tax +
      fareDetail.otherCharges;
    fareDetail.totalFare = totalFare;
    fareDetail.perPersonFare =
      adultCount + childCount + infantCount > 0
        ? Math.ceil(totalFare / (adultCount + childCount + infantCount))
        : 0;

    fareDetail.currency = preferredCurrency;
    fareDetail.fareQuote = Generic.encrypt(JSON.stringify(passengerFareArr));

    /* TBO Fare passthrough: every Fare key (OfferedFare, CommissionEarned, PLBEarned, GST, ...) */
    this.addTboPassthrough(fareDetail, passengerFareArr);

    return fareDetail;
  }

  /** [@Description: Sets up one segment (same mapping as V10 search) + every TBO segment key] **/
  settingUpSegments(segment, airlineNames) {
    const flightSegment: Segment = new Segment();
    flightSegment.intervalMinutes = 0;

    flightSegment.segmentId = segment?.SegmentIndicator;
    flightSegment.airlineCode = segment?.Airline?.AirlineCode;
    flightSegment.airlineName =
      airlineNames?.[segment?.Airline?.AirlineCode] ||
      segment?.Airline?.AirlineName;
    flightSegment.supplierFareClass = segment?.SupplierFareClass;
    flightSegment.SupplierFareClass = segment?.SupplierFareClass;
    flightSegment.cabinClass = Generic.convertCabinClassCode(
      "TBO",
      segment?.CabinClass,
      false,
    );
    flightSegment.flightNumber = segment?.Airline?.FlightNumber;
    flightSegment.noOfSeatAvailable = segment?.NoOfSeatAvailable;
    flightSegment.mealType = segment?.MealType || "";
    flightSegment.distance = segment?.Mile || "";
    flightSegment.craft = segment?.Craft || "";
    flightSegment.inFlightServices = segment?.InFlightServices || "";

    /* Baggages */
    const cabinBaggage: BaggageInfo = new BaggageInfo();
    cabinBaggage.paxType = "";
    cabinBaggage.rule = segment?.CabinBaggage || "";
    cabinBaggage.size = "";
    cabinBaggage.flightNum = segment?.Airline?.FlightNumber;
    flightSegment.cabinBaggages = [cabinBaggage];

    const checkInBaggage: BaggageInfo = new BaggageInfo();
    checkInBaggage.paxType = "";
    checkInBaggage.rule = segment?.Baggage || "";
    checkInBaggage.size = "";
    checkInBaggage.flightNum = segment?.Airline?.FlightNumber;
    flightSegment.checkInBaggages = [checkInBaggage];

    flightSegment.departure = [
      this.settingUpSegmentLocation(segment?.Origin?.Airport, segment?.Origin?.DepTime),
    ];
    flightSegment.arrival = [
      this.settingUpSegmentLocation(
        segment?.Destination?.Airport,
        segment?.Destination?.ArrTime,
      ),
    ];

    flightSegment.segmentDuration = DateUtility.convertMinutesIntoHoursMinutes(
      segment?.Duration,
    );
    flightSegment.segmentInterval = DateUtility.convertMinutesIntoHoursMinutes(
      segment?.GroundTime,
    );
    flightSegment.intervalMinutes = segment?.GroundTime || 0;

    /* TBO passthrough: every segment key TBO sends (unchanged, TBO key names) */
    this.addTboPassthrough(flightSegment, segment);

    return flightSegment;
  }

  /** [@Description: Segment departure / arrival info from TBO Airport + time] **/
  settingUpSegmentLocation(airport, dateTime): LocationInfo {
    const info: LocationInfo = new LocationInfo();
    info.code = airport?.AirportCode;
    info.name = airports[info.code]?.name || airport?.AirportName;
    info.country = airports[info.code]?.country || airport?.CountryName;
    info.countryCode = airports[info.code]?.iso_country || airport?.CountryCode;
    info.city = airports[info.code]?.city || airport?.CityName;
    info.cityCode = airports[info.code]?.city_code || airport?.CityCode;
    info.date = DateUtility.convertDateIntoYMD(dateTime);
    info.time = DateUtility.getTimeFromDateInHMA(dateTime);
    info.terminal = airport?.Terminal || "";
    return info;
  }

  /** [@Description: Journey departure (first segment) and arrival (last segment) info] **/
  settingUpLocationInfo(flightSegment) {
    const first = flightSegment[0].departure[0];
    const last = flightSegment[flightSegment.length - 1].arrival[0];
    const toJourneyInfo = (point): LocationInfo => {
      const info: LocationInfo = new LocationInfo();
      info.code = point.code;
      info.city = airports[info.code]?.city || "";
      info.cityCode = airports[info.code]?.city_code || "";
      info.country = airports[info.code]?.country || "";
      info.countryCode = airports[info.code]?.iso_country || "";
      info.name = airports[info.code]?.name || "";
      info.date = point.date;
      info.time = point.time;
      info.terminal = point?.terminal || "";
      return info;
    };

    const locationInfo = [];
    locationInfo["departureInfo"] = toJourneyInfo(first);
    locationInfo["arrivalInfo"] = toJourneyInfo(last);
    return locationInfo;
  }

  /** [@Description: Copies supplier keys onto our object as-is. Keys we already set are never
   * overwritten, so our response keys stay unchanged. Checks undefined (not `in`): with ES2022
   * class fields, declared-but-unset fields exist on the instance as undefined] **/
  addTboPassthrough(target: object, source: object, skipKeys: string[] = []) {
    if (!source || typeof source !== "object") return;
    Object.entries(source).forEach(([key, value]) => {
      if (!skipKeys.includes(key) && target[key] === undefined) {
        target[key] = value;
      }
    });
  }
}
