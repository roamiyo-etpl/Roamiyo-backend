import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { TboAuthTokenService } from "./tbo-auth-token.service";
import { Http } from "src/shared/utilities/flight/http.utility";
import { GenericRepo } from "src/shared/utilities/flight/generic-repo.utility";
import { Generic } from "src/shared/utilities/flight/generic.utility";
import { DateUtility } from "src/shared/utilities/flight/date.utility";
import { airlines } from "src/shared/utilities/flight/airline.utility";
import {
  airports,
  airportsDefault,
} from "src/shared/utilities/flight/airport.utility";
import {
  StartRoutingResponse,
  Route,
  Segment,
  Fare,
  LocationInfo,
  BaggageInfo,
  GroupHash,
} from "../../search/interfaces/start-routing.interface";
import {
  AirlineCategory,
  TripType,
} from "../../../../shared/enums/flight/flight.enum";
import md5 from "md5";
import { isArray } from "lodash";

@Injectable()
export class TboSearchService {
  constructor(
    private readonly tboAuthTokenService: TboAuthTokenService,
    private readonly genericRepo: GenericRepo,
  ) {}

  /** [@Description: This method is used to search the flights]
   * @author: Prashant Joshi at 13-10-2025 **/
  async search(searchRequest): Promise<StartRoutingResponse> {
    // console.log("searchRequest:::::::::", searchRequest);
    const { providerCred, searchReqId, searchReq } = searchRequest;
    const authToken =
      await this.tboAuthTokenService.getAuthToken(searchRequest);
    searchRequest.authToken = authToken;

    try {
      console.log("Azure URL:", process.env.AZURE_BLOB_SAS_LINK);
      const requestBody = this.creatingSearchRequest(searchRequest);
      // dev endpoint
      const endpoint = `${providerCred.url}BookingEngineService_Air/AirService.svc/rest/Search`;

      // prod endpoint
      // const endpoint = `${providerCred.url}/rest/Search`;
      console.log("endpoint:::::::::",endpoint);
      const startTime = Date.now();
      const searchResult = await Http.httpRequestTBO(
        "POST",
        endpoint,
        JSON.stringify(requestBody),
      );
      const endTime = Date.now();
      /* Logging the data */
      const logs = {
        ApiRequest: searchReq,
        supplierRequest: requestBody,
        supplierResponse: searchResult,
      };

      // console.log("searchResult::::::::::",searchResult);
      // Generic.generateLogFile(searchReqId + "-TBO", logs, "search");

      if (process.env.ENABLE_LOCAL_LOGS === "true") {
        Generic.generateLogFile(searchReqId + "-TBO", logs, "search");
      }

      /* Convert the response to our standard format */
      const searchResponse = await this.convertingResponse(
        searchRequest,
        searchResult,
      );
      const convertResponseTime = Date.now();

      /* Updating the log file response */
      const logsWithRes = {
        ApiRequest: searchReq,
        ApiResponse: searchResponse,
        ApiResponseTime: `${(convertResponseTime - startTime) / 1000} seconds`,
        supplierRequest: requestBody,
        supplierResponse: searchResult,
        supplierResponseTime: `${(endTime - startTime) / 1000} seconds`,
      };
      console.log(
        "logsWithRes.supplierResponseTime",
        logsWithRes.supplierResponseTime,
      );
      console.log("ConvertTime", logsWithRes.ApiResponseTime);
      // Generic.generateLogFile(searchReqId + "-TBO", logsWithRes, "search");
      if (process.env.ENABLE_LOCAL_LOGS === "true") {
        Generic.generateLogFile(searchReqId + "-TBO", logsWithRes, "search");
      }

      return searchResponse;
    } catch (error) {
      await this.genericRepo.storeLogs(searchReqId, 1, error, 0);
      console.log(error);
      throw new InternalServerErrorException(
        "There is an issue while fetching data from the providers.",
      );
    }
  }

  /** [@Description: This method is used to create the search request]
   * @author: Prashant Joshi at 13-10-2025 **/
  creatingSearchRequest(searchRequest) {
    const { searchReq, headers } = searchRequest;

    /* Creating Request Params */
    const adultCount = Generic.getAdultCount(searchReq);
    const childCount = Generic.getChildCount(searchReq);
    const infantCount = Generic.getInfantCount(searchReq);

    /* Creating search Air Legs dynamic */
    const searchAirLegs: any[] = [];
    searchReq.searchAirLegs.forEach((element) => {
      if (searchReq.travelPreferences[0]?.airTripType === TripType.ONEWAY) {
        searchAirLegs.push({
          Origin: element.origin,
          Destination: element.destination,
          FlightCabinClass: Generic.convertCabinClassCode(
            "TBO",
            searchReq.travelPreferences[0].cabinClass,
            true,
          ),
          PreferredDepartureTime: element.departureDate + "T00: 00: 00",
          PreferredArrivalTime: element.departureDate + "T00: 00: 00",
        });
      }
      if (searchReq.travelPreferences[0]?.airTripType === TripType.ROUNDTRIP) {
        searchAirLegs.push({
          Origin: element.origin,
          Destination: element.destination,
          FlightCabinClass: Generic.convertCabinClassCode(
            "TBO",
            searchReq.travelPreferences[0].cabinClass,
            true,
          ),
          PreferredDepartureTime: element.departureDate + "T00: 00: 00",
          PreferredArrivalTime: element.departureDate + "T00: 00: 00",
        });
      }
      if (searchReq.travelPreferences[0]?.airTripType === TripType.MULTI_CITY) {
        searchAirLegs.push({
          Origin: element.origin,
          Destination: element.destination,
          FlightCabinClass: Generic.convertCabinClassCode(
            "TBO",
            searchReq.travelPreferences[0].cabinClass,
            true,
          ),
          PreferredDepartureTime: element.departureDate + "T00: 00: 00",
          PreferredArrivalTime: element.departureDate + "T00: 00: 00",
        });
      }
    });

    const params = {
      EndUserIp: headers["ip-address"],
      // EndUserIp: '20.244.28.12',
      TokenId: searchRequest.authToken,
      AdultCount: adultCount,
      ChildCount: childCount,
      InfantCount: infantCount,
      DirectFlight: false,
      OneStopFlight: false,
      ResultFareType: searchReq.ResultFareType,
      JourneyType: Generic.getTripTypeTbo(
        searchReq.travelPreferences[0].airTripType,
      ),
      PreferredAirlines: null,
      Segments: searchAirLegs,
      Sources: null,
    };

    return params;
  }

  /** [@Description: This method is used to convert the response]
   * @author: Prashant Joshi at 13-10-2025 **/
  async convertingResponse(
    searchRequest,
    results,
  ): Promise<StartRoutingResponse> {
    const { providerCred, searchReq, searchReqId, headers } = searchRequest;
    const preferredCurrency = headers["currency-preference"] || "USD";

    const searchResponse: StartRoutingResponse = new StartRoutingResponse();

    if (
      results?.Response?.ResponseStatus &&
      results?.Response?.Results?.length > 0
    ) {
      let [flightJourneys] = results?.Response?.Results;
      const origin = results?.Response?.Origin;
      const destination = results?.Response?.Destination;

      const originCountry = airports[origin]?.country;
      const destinationCountry = airports[destination]?.country;

      const isMultiCity =
        searchReq.travelPreferences[0].airTripType == TripType.MULTI_CITY;
      const isRoundtrip =
        searchReq.travelPreferences[0].airTripType == TripType.ROUNDTRIP;

      if (isMultiCity) {
        console.log("Multi-city scenario detected");
      }
      if (originCountry == destinationCountry && isRoundtrip) {
        flightJourneys = flightJourneys.map((flight) => {
          const resultInd = flight.ResultIndex.split("[")[0];

          const findInBound = results.Response.Results[1]?.find(
            (inBoundFlight) => {
              const inBoundInd = inBoundFlight?.ResultIndex?.split("[")[0];

              const searchInBound = "O" + inBoundInd.slice(1);

              return searchInBound == resultInd;
            },
          );

          // console.log("==== ROUNDTRIP DEBUG START ====");

          // console.log("Outbound ResultIndex:", flight.ResultIndex);

          // console.log("Outbound Fare:", JSON.stringify(flight.Fare));

          // console.log("Inbound Found:", !!findInBound);

          if (findInBound) {
            // console.log("Inbound ResultIndex:", findInBound.ResultIndex);

            // console.log("Inbound Fare:", JSON.stringify(findInBound.Fare));

            // console.log("---- AFTER MERGE ----");

            // console.log(
            //   "Merged BaseFare:",

            //   flight.Fare.BaseFare + (findInBound?.Fare?.BaseFare ?? 0),
            // );

            // console.log(
            //   "Merged PublishedFare:",

            //   flight.Fare.PublishedFare +
            //     (findInBound?.Fare?.PublishedFare ?? 0),
            // );

            const returnValue = {
              ...flight,

              ResultIndex: [flight.ResultIndex, findInBound?.ResultIndex],

              Fare: {
                ...flight.Fare[0],

                BaseFare:
                  flight.Fare.BaseFare + (findInBound?.Fare?.BaseFare ?? 0),

                Tax: flight.Fare.Tax + (findInBound?.Fare?.Tax ?? 0),

                PublishedFare:
                  flight.Fare.PublishedFare +
                  (findInBound?.Fare?.PublishedFare ?? 0),

                ServiceFee:
                  flight.Fare.ServiceFee + (findInBound?.Fare?.ServiceFee ?? 0),
              },

              FareBreakdown: [
                {
                  ...flight.FareBreakdown[0],

                  BaseFare:
                    flight.FareBreakdown[0].BaseFare +
                    (findInBound?.FareBreakdown?.[0]?.BaseFare ?? 0),

                  Tax:
                    flight.FareBreakdown[0].Tax +
                    (findInBound?.FareBreakdown?.[0]?.Tax ?? 0),
                },
              ],

              Segments: [...flight.Segments, ...findInBound?.Segments],

              FareRules: [...flight.FareRules, ...findInBound?.FareRules],

              // Separate fare per leg
              outboundFare: {
                BaseFare: flight.Fare?.BaseFare,
                Tax: flight.Fare?.Tax,
                PublishedFare: flight.Fare?.PublishedFare,
                ServiceFee: flight.Fare?.ServiceFee,
              },

              inboundFare: findInBound
                ? {
                    BaseFare: findInBound.Fare?.BaseFare,
                    Tax: findInBound.Fare?.Tax,
                    PublishedFare: findInBound.Fare?.PublishedFare,
                    ServiceFee: findInBound.Fare?.ServiceFee,
                  }
                : null,

              totalFare: {
                PublishedFare:
                  flight.Fare.PublishedFare +
                  (findInBound?.Fare?.PublishedFare ?? 0),
              },
            };

            // console.log("returnValue::::::::::::::", returnValue);

            // console.log("==== ROUNDTRIP DEBUG END ====");

            return returnValue;
          } else {
            return null;
          }
        });

        flightJourneys = flightJourneys.filter((flight) => flight);
      }

      const flightRoutes: Route[] = flightJourneys.map((flightJourney) => {
        const flightSegments: any[] = [];
        const departureInfos: LocationInfo[] = [];
        const arrivalInfos: LocationInfo[] = [];
        const flightStops: number[] = [];
        const cabinBaggages: BaggageInfo[] = [];
        const checkInBaggages: BaggageInfo[] = [];
        const hashCodes: string[] = [];
        let groupHashCode: string = "";
        let segments: Segment[] = [];
        const totalDurations: string[] = [];
        const totalIntervals: string[] = [];
        const airlineCodes: string[] = [];
        const airlineNames: string[] = [];
        let fareSourceCode: string = "";
        let cabinB: BaggageInfo = new BaggageInfo();
        let checkInB: BaggageInfo = new BaggageInfo();
        const solutionDetails: Fare[] = flightJourney.Fare;

        /* Setting up the prices */
        const flightRoute = new Route();
        const fare = this.settingUpPrices(
          searchReq,
          solutionDetails,
          flightJourney?.FareBreakdown,
          preferredCurrency,
          flightJourney?.ResultFareType,
        );
        flightRoute.fare = [fare];

        // ✅ NEW STANDARD STRUCTURE (same for oneway & roundtrip)
        type Leg = {
          type: "outbound" | "inbound";
          fare: any;
        };

        const legs: Leg[] = [];

        // OUTBOUND (always present)
        legs.push({
          type: "outbound",
          fare: flightJourney.outboundFare || {
            BaseFare: flightJourney.Fare?.BaseFare,
            Tax: flightJourney.Fare?.Tax,
            PublishedFare: flightJourney.Fare?.PublishedFare,
          },
        });

        // INBOUND (only if roundtrip)
        if (flightJourney.inboundFare) {
          legs.push({
            type: "inbound",
            fare: flightJourney.inboundFare,
          });
        }

        // attach to response
        flightRoute.legs = legs;

        // flightRoute.outboundFare = flightJourney.outboundFare || null;
        flightRoute.outboundFare = flightJourney.outboundFare || {
          BaseFare: flightJourney.Fare?.BaseFare,
          Tax: flightJourney.Fare?.Tax,
          PublishedFare: flightJourney.Fare?.PublishedFare,
        };
        flightRoute.inboundFare = flightJourney.inboundFare || null;

        flightJourney.Segments.forEach((segmentArray) => {
          // console.log("segmentArray:::::::::::::",segmentArray);
          let airlineCode: string = "";
          let hashCode: string = "";
          let totalDuration = 0;
          let totalInterval: number = 0;
          let supplierFareClass: string = "";
          segments = [];
          segmentArray.forEach((segment) => {
            // console.log("segment:::::::::::::",segment);
            fareSourceCode = "";
            airlineCode = segment.Airline.AirlineCode;
            supplierFareClass = segment.SupplierFareClass;

            /* Creating a time duration */
            // const result = Generic.convertTimeStringToHoursNew(segment.Duration);
            totalDuration += segment.Duration;

            /* Creating Flight Segments */
            const fSegment = this.settingUpSegments(segment);
            segments.push(fSegment);

            /* Adding Interval */
            totalInterval += fSegment.intervalMinutes;

            /* Creating flight HashCode */
            hashCode +=
              fSegment.airlineCode +
              fSegment.flightNumber +
              fSegment.cabinClass;
          });

          airlineCodes.push(airlineCode);
          airlineNames.push(airlines("")[airlineCode] || airlineCode);
          hashCodes.push(md5(hashCode));
          groupHashCode += md5(hashCode);
          totalIntervals.push(Generic.convertMinutesToHours(totalInterval));
          totalDurations.push(
            Generic.convertMinutesToHours(totalDuration + totalInterval),
          );
          flightSegments.push(segments);
          flightStops.push(segments.length - 1);
          const locationInfo = this.settingUpLocationInfo(segments);

          /* Setting Departure and Arrival locations */
          departureInfos.push(locationInfo["departureInfo"]);
          arrivalInfos.push(locationInfo["arrivalInfo"]);

          cabinBaggages.push(cabinB);
          checkInBaggages.push(checkInB);
        });

        flightRoute.routeId = "";
        flightRoute.solutionId = isArray(flightJourney?.ResultIndex)
          ? flightJourney?.ResultIndex
          : [flightJourney?.ResultIndex];
        flightRoute.isRefundable = flightJourney?.IsRefundable;
        flightRoute.airlineCode = airlineCodes;
        flightRoute.airlineName = airlineNames;
        flightRoute.flightStops = flightStops;
        flightRoute.hashCode = hashCodes;
        flightRoute.groupHashCode = md5(groupHashCode);
        flightRoute.fareSourceCode = [fareSourceCode];
        flightRoute.isDuplicateOutbound = false;
        flightRoute.airlineType = flightJourney?.IsLCC
          ? AirlineCategory.LCC
          : AirlineCategory.Non_LCC;
        flightRoute.totalDuration = totalDurations;
        flightRoute.totalInterval = totalIntervals;
        flightRoute.departureInfo = departureInfos;
        flightRoute.arrivalInfo = arrivalInfos;
        flightRoute.flightSegments = flightSegments;
        // const [flightSegment] = flightSegments;
        // flightRoute.flightSegments = flightSegment;
        const groupHash = new GroupHash();
        groupHash.provider = ["TBO"];
        groupHash.hashCode = hashCodes;
        groupHash.groupHashCode = flightRoute.groupHashCode;
        groupHash.totalAmount = flightRoute.fare[0].totalFare;
        groupHash.solutionId = flightRoute.solutionId[0];
        flightRoute.groupHash = [groupHash];

        return flightRoute;
      });

      searchResponse.route = flightRoutes;
      searchResponse.isDomestic = results?.IsDomestic;
      searchResponse.searchReqId = searchReqId;
      searchResponse.trackingId = results?.Response?.TraceId;
      searchResponse.trackingId = results?.Response?.TraceId;
      searchResponse.mode = "TBO-" + providerCred.mode;
      searchResponse.error = false;
      searchResponse.message = "OK";
    } else {
      const errorMessage =
        results?.Response?.Error?.ErrorMessage || "No flight found.";

      searchResponse.route = [];
      searchResponse.isDomestic = results?.IsDomestic || "";
      searchResponse.searchReqId = searchReqId;
      searchResponse.trackingId = results?.Response?.TraceId;
      searchResponse.mode = "TBO-" + providerCred.mode;
      searchResponse.error = true;
      searchResponse.message = errorMessage;
    }

    return searchResponse;
  }

  /** [@Description: This method is used to set up the prices]
   * @author: Prashant Joshi at 13-10-2025 **/
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

    let adultTaxPP = 0,
      childTaxPP = 0,
      infantTaxPP = 0;
    let adultSFeePP = 0,
      childSFeePP = 0,
      infantSFeePP = 0;
    let adultOChargePP = 0,
      childOChargePP = 0,
      infantOChargePP = 0;

    fareDetail.fareType = FareType || "";

    fareBreakDown.forEach((element) => {
      const passengerCount = element?.PassengerCount || 1; // Avoid division by zero

      if (element.PassengerType === 1) {
        /* Adult */
        fareDetail.perPersonAdultFare =
          Generic.currencyConversion(
            element?.BaseFare / passengerCount,
            element.Currency,
            preferredCurrency,
          ) || 0;
        fareDetail.adultFare = fareDetail.perPersonAdultFare * adultCount;

        /* Tax calculation */
        adultTaxPP = element?.Tax
          ? Generic.currencyConversion(
              element?.Tax / passengerCount,
              element.Currency,
              preferredCurrency,
            )
          : 0;

        /* Service fee calculation */
        adultSFeePP = element?.ServiceFee
          ? Generic.currencyConversion(
              element?.ServiceFee / passengerCount,
              element.Currency,
              preferredCurrency,
            )
          : 0;

        /* Other charges calculation */
        adultOChargePP = element?.OtherCharges
          ? Generic.currencyConversion(
              element?.OtherCharges / passengerCount,
              element.Currency,
              preferredCurrency,
            )
          : 0;
      } else if (element.PassengerType === 2) {
        /* Child */
        fareDetail.perPersonChildFare =
          childCount > 0
            ? Generic.currencyConversion(
                element?.BaseFare / passengerCount,
                element.Currency,
                preferredCurrency,
              )
            : 0;
        fareDetail.childFare = fareDetail.perPersonChildFare * childCount;

        /* Tax calculation */
        childTaxPP = element?.Tax
          ? Generic.currencyConversion(
              element?.Tax / passengerCount,
              element.Currency,
              preferredCurrency,
            )
          : 0;

        /* Service fee calculation */
        childSFeePP = element?.ServiceFee
          ? Generic.currencyConversion(
              element?.ServiceFee / passengerCount,
              element.Currency,
              preferredCurrency,
            )
          : 0;

        /* Other charges calculation */
        childOChargePP = element?.OtherCharges
          ? Generic.currencyConversion(
              element?.OtherCharges / passengerCount,
              element.Currency,
              preferredCurrency,
            )
          : 0;
      } else if (element.PassengerType === 3) {
        /* Infant */
        fareDetail.perPersonInfantFare =
          infantCount > 0
            ? Generic.currencyConversion(
                element?.BaseFare / passengerCount,
                element.Currency,
                preferredCurrency,
              )
            : 0;
        fareDetail.infantFare = fareDetail.perPersonInfantFare * infantCount;

        /* Tax calculation */
        infantTaxPP = element?.Tax
          ? Generic.currencyConversion(
              element?.Tax / passengerCount,
              element.Currency,
              preferredCurrency,
            )
          : 0;

        /* Service fee calculation */
        infantSFeePP = element?.ServiceFee
          ? Generic.currencyConversion(
              element?.ServiceFee / passengerCount,
              element.Currency,
              preferredCurrency,
            )
          : 0;

        /* Other charges calculation */
        infantOChargePP = element?.OtherCharges
          ? Generic.currencyConversion(
              element?.OtherCharges / passengerCount,
              element.Currency,
              preferredCurrency,
            )
          : 0;
      }
    });

    /* Base fare calculation */
    fareDetail.baseFare =
      (fareDetail.adultFare || 0) +
      (fareDetail.childFare || 0) +
      (fareDetail.infantFare || 0);

    /* Tax calculation */
    fareDetail.tax =
      adultTaxPP * adultCount +
      childTaxPP * childCount +
      infantTaxPP * infantCount;

    /* Service fee calculation */
    fareDetail.serviceFee =
      adultSFeePP * adultCount +
      childSFeePP * childCount +
      infantSFeePP * infantCount;

    /* Other charges calculation */
    fareDetail.otherCharges =
      adultOChargePP * adultCount +
      childOChargePP * childCount +
      infantOChargePP * infantCount;

    /* Creating search page fare */
    fareDetail.searchBaseFare = fareDetail.perPersonAdultFare;
    fareDetail.searchTax = adultTaxPP + adultSFeePP + adultOChargePP;
    fareDetail.searchTotalFare =
      (fareDetail.searchBaseFare || 0) + fareDetail.searchTax;

    /* Creating total fares */
    const totalFare =
      (fareDetail.baseFare || 0) +
      (fareDetail.serviceFee || 0) +
      (fareDetail.tax || 0) +
      (fareDetail.otherCharges || 0);
    fareDetail.totalFare = totalFare;
    fareDetail.perPersonFare =
      adultCount + childCount + infantCount > 0
        ? Math.ceil(totalFare / (adultCount + childCount + infantCount))
        : 0;

    /* Setting up currency */
    fareDetail.currency = preferredCurrency;
    fareDetail.fareQuote = Generic.encrypt(JSON.stringify(passengerFareArr));

    return fareDetail;
  }

  /** [@Description: This method is used to set up the segments]
   * @author: Prashant Joshi at 13-10-2025 **/
  settingUpSegments(segment) {
    const segmentDepartureInfo: LocationInfo = new LocationInfo();
    const segmentArrivalInfo: LocationInfo = new LocationInfo();
    const flightSegment: Segment = new Segment();
    flightSegment.intervalMinutes = 0;

    flightSegment.segmentId = segment.SegmentIndicator;
    flightSegment.airlineCode = segment.Airline.AirlineCode;
    flightSegment.airlineName =
      airlines[segment.Airline.AirlineCode] || segment.Airline;
    ((flightSegment.supplierFareClass = segment.SupplierFareClass),
      (flightSegment.cabinClass = Generic.convertCabinClassCode(
        "TBO",
        segment.CabinClass,
        false,
      )));
    flightSegment.flightNumber = segment?.Airline?.FlightNumber;
    flightSegment.noOfSeatAvailable = segment?.NoOfSeatAvailable;
    flightSegment.mealType = segment?.MealType || "";
    flightSegment.distance = segment?.Mile || "";
    flightSegment.craft = segment?.Craft || "";
    flightSegment.inFlightServices = segment?.InFlightServices || "";

    /* Setting up Baggages */
    const cabinBaggage: BaggageInfo = new BaggageInfo();
    const checkInBaggage: BaggageInfo = new BaggageInfo();

    cabinBaggage.paxType = "";
    cabinBaggage.rule = segment?.CabinBaggage || "";
    cabinBaggage.size = "";
    cabinBaggage.flightNum = segment?.Airline?.FlightNumber;
    flightSegment.cabinBaggages = [cabinBaggage];

    checkInBaggage.paxType = "";
    checkInBaggage.rule = segment?.Baggage || "";
    checkInBaggage.size = "";
    checkInBaggage.flightNum = segment?.Airline?.FlightNumber;
    flightSegment.checkInBaggages = [checkInBaggage];

    /* Segment Departure info */
    segmentDepartureInfo.code = segment?.Origin?.Airport?.AirportCode;
    segmentDepartureInfo.name =
      airports[segmentDepartureInfo.code]?.name ||
      segment?.Origin?.Airport?.AirportName;
    segmentDepartureInfo.country =
      airports[segmentDepartureInfo.code]?.country ||
      segment?.Origin?.Airport?.CountryName;
    segmentDepartureInfo.countryCode =
      airports[segmentDepartureInfo.code]?.iso_country ||
      segment?.Origin?.Airport?.CountryCode;
    segmentDepartureInfo.city =
      airports[segmentDepartureInfo.code]?.city ||
      segment?.Origin?.Airport?.CityName;
    segmentDepartureInfo.cityCode =
      airports[segmentDepartureInfo.code]?.city_code ||
      segment?.Origin?.Airport?.CityCode;
    segmentDepartureInfo.date = DateUtility.convertDateIntoYMD(
      segment?.Origin?.DepTime,
    );
    segmentDepartureInfo.time = DateUtility.getTimeFromDateInHMA(
      segment?.Origin?.DepTime,
    );
    segmentDepartureInfo.terminal = segment?.Origin?.Airport?.Terminal || "";

    /* Segment Arrival Info */
    segmentArrivalInfo.code = segment?.Destination?.Airport?.AirportCode;
    segmentArrivalInfo.name =
      airports[segmentArrivalInfo.code]?.name ||
      segment?.Destination?.Airport?.AirportName;
    segmentArrivalInfo.country =
      airports[segmentArrivalInfo.code]?.country ||
      segment?.Destination?.Airport?.CountryName;
    segmentArrivalInfo.countryCode =
      airports[segmentArrivalInfo.code]?.iso_country ||
      segment?.Destination?.Airport?.CountryCode;
    segmentArrivalInfo.city =
      airports[segmentArrivalInfo.code]?.city ||
      segment?.Destination?.Airport?.CityName;
    segmentArrivalInfo.cityCode =
      airports[segmentArrivalInfo.code]?.city_code ||
      segment?.Destination?.Airport?.CityCode;
    segmentArrivalInfo.date = DateUtility.convertDateIntoYMD(
      segment?.Destination?.ArrTime,
    );
    segmentArrivalInfo.time = DateUtility.getTimeFromDateInHMA(
      segment?.Destination?.ArrTime,
    );
    segmentArrivalInfo.terminal = segment?.Destination?.Airport?.Terminal || "";

    /* Creating segment duration */
    const segmentDuration = segment.Duration;

    flightSegment.segmentDuration =
      DateUtility.convertMinutesIntoHoursMinutes(segmentDuration);
    flightSegment.departure = [segmentDepartureInfo];
    flightSegment.arrival = [segmentArrivalInfo];
    flightSegment.segmentInterval = DateUtility.convertMinutesIntoHoursMinutes(
      segment.GroundTime,
    );
    flightSegment.intervalMinutes = segment.GroundTime;

    return flightSegment;
  }

  /** [@Description: This method is used to set up the location info]
   * @author: Prashant Joshi at 13-10-2025 **/
  settingUpLocationInfo(flightSegment) {
    const departureInfo: LocationInfo = new LocationInfo();
    const arrivalInfo: LocationInfo = new LocationInfo();

    /* Setting Departure Location */
    departureInfo.code = flightSegment[0].departure[0].code;
    departureInfo.city = airports[departureInfo.code]?.city || "";
    departureInfo.cityCode = airports[departureInfo.code]?.city_code || "";
    departureInfo.country = airports[departureInfo.code]?.country || "";
    departureInfo.countryCode = airports[departureInfo.code]?.iso_country || "";
    departureInfo.name = airports[departureInfo.code]?.name || "";
    departureInfo.date = flightSegment[0].departure[0].date;
    departureInfo.time = flightSegment[0].departure[0].time;
    departureInfo.terminal = flightSegment[0].departure[0]?.terminal || "";

    /* Setting Arrival Location */
    arrivalInfo.code = flightSegment[flightSegment.length - 1].arrival[0].code;
    arrivalInfo.city = airports[arrivalInfo.code]?.city || "";
    arrivalInfo.cityCode = airports[arrivalInfo.code]?.city_code || "";
    arrivalInfo.country = airports[arrivalInfo.code]?.country || "";
    arrivalInfo.countryCode = airports[arrivalInfo.code]?.iso_country || "";
    arrivalInfo.name = airports[arrivalInfo.code]?.name || "";
    arrivalInfo.date = flightSegment[flightSegment.length - 1].arrival[0].date;
    arrivalInfo.time = flightSegment[flightSegment.length - 1].arrival[0].time;
    arrivalInfo.terminal =
      flightSegment[flightSegment.length - 1].arrival[0]?.terminal || "";

    const locationInfo = [];
    locationInfo["departureInfo"] = departureInfo;
    locationInfo["arrivalInfo"] = arrivalInfo;

    return locationInfo;
  }
}
