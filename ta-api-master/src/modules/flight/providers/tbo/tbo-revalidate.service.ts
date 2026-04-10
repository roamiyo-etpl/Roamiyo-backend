import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { GenericRepo } from "src/shared/utilities/flight/generic-repo.utility";
import { TboAuthTokenService } from "./tbo-auth-token.service";
import { s3BucketService } from "src/shared/utilities/flight/s3bucket.utility";
import {
  CancellationFareRule,
  FareRules,
  RevalidateData,
  RevalidateResponse,
} from "../../revalidate/interfaces/revalidate.interface";
import { isArray } from "class-validator";
import {
  BaggageInfo,
  Fare,
  LocationInfo,
  Segment,
} from "../../search/interfaces/start-routing.interface";
import { airlines } from "src/shared/utilities/flight/airline.utility";
import { Generic } from "src/shared/utilities/flight/generic.utility";
import { AirlineCategory } from "src/shared/enums/flight/flight.enum";
import { airports } from "src/shared/utilities/flight/airport.utility";
import moment from "moment";
import { Http } from "src/shared/utilities/flight/http.utility";
import { InjectRepository } from "@nestjs/typeorm";
import { RevalidateResponseEntity } from "src/shared/entities/revalidate-response.entity";
import { Repository } from "typeorm";
import { SupplierLogUtility } from "src/shared/utilities/flight/supplier-log.utility";

@Injectable()
export class TboRevalidateService {
  logDate = Date.now();
  constructor(
    private readonly tboAuthToken: TboAuthTokenService,
    private readonly s3BucketService: s3BucketService,
    private readonly genericRepo: GenericRepo,
    @InjectRepository(RevalidateResponseEntity)
    private revalidateRepo: Repository<RevalidateResponseEntity>,
    private readonly supplierLogUtility: SupplierLogUtility,
  ) {}

  /** [@Description: This method is used to revalidate the flights]
   * @author: Prashant Joshi at 13-10-2025 **/
  async revalidate(
    requestData,
  ): Promise<RevalidateResponse | RevalidateResponse[]> {
    const { providerCred, revalidateReq } = requestData;

    Object.assign(requestData, { tokenReqData: revalidateReq });
    // For domestic roundTrip pass solutionID with( ||| )
    const roundTripSolutionId = revalidateReq.solutionId;

    try {
      /* get authentication token*/
      const authToken = await this.tboAuthToken.getAuthToken(requestData);
      const handleAuthenticationFailure = () => {
        const revalidateResponse: RevalidateResponse = {
          isValid: false,
          error: true,
          message: "There is no flight available.",
          searchReqId: revalidateReq.searchReqId,
          hashReqKey: revalidateReq.hashReqKey,
          mode: "TBO-" + requestData.providerCred.mode,
          provider: "TBO",
          prevSolutionID: revalidateReq.solutionId,
        };
        return revalidateResponse;
      };

      /* In case there is an issue in authentication from the provider */
      if (authToken === "") {
        return handleAuthenticationFailure();
      }

      const convertedResultArray: any = [];
      const solutionIds = revalidateReq.solutionId.split(" ||| ");

      for (let i = 0; i < solutionIds.length; i++) {
        // requestData.revalidateReq.solutionId = solutionIds[i];
        const tempRequestData = {
          ...requestData,
          revalidateReq: {
            ...requestData.revalidateReq,
            solutionId: solutionIds[i],
          },
        };
        const fareRules = await this.getCancellationFareRules(
          tempRequestData,
          i,
        );
        if (fareRules.error === true) {
          handleAuthenticationFailure();
        }
        const requestBody = this.createRequest(tempRequestData, authToken);
        // const TIMEOUT = Http.Timeout.Others;
        // dev endpoint
        // const endpoint = `${providerCred.url}BookingEngineService_Air/AirService.svc/rest/FareQuote`;

        // prod endpoint
        const endpoint = `${providerCred.url}/rest/FareQuote`;
        const revalidateResult = await Http.httpRequestTBO(
          "POST",
          endpoint,
          JSON.stringify(requestBody),
        );

        /* Saving the revalidate result */
        await this.revalidateRepo.save({
          solution_id: solutionIds[i],
          response: JSON.stringify(revalidateResult),
          provider_code: providerCred.provider,
        });

        // const convertedResult = await this.convertingResponse(requestData, revalidateResult);
        const convertedResult = await this.convertingResponse(
          { ...requestData, authToken },
          revalidateResult,
        );

        /* Updating the log file response */
        const logsWithRes = {
          ApiRequest: revalidateReq,
          ApiResponse: convertedResult,
          supplierRequest: requestBody,
          supplierResponse: revalidateResult,
        };
        // await this.s3BucketService.generateS3LogFile(revalidateReq.searchReqId + ' ' + i + '-' + this.logDate + '-TBO', logsWithRes, 'revalidate');
        // this.supplierLogs.updateSupplierLogs(revalidateReq.searchReqId, logsWithRes, 'TBO', 'revalidate', storedLog?.logId);
        await this.supplierLogUtility.generateLogFile({
          fileName:
            revalidateReq.searchReqId + " " + i + "-" + this.logDate + "-TBO",
          logData: logsWithRes,
          folderName: "revalidate",
          logId: null,
          title: "FareQuote-TBO",
          searchReqId: revalidateReq.searchReqId,
          bookingReferenceId: null,
        });
        /* Adding Supplier response too, for creating booking request */
        Object.assign(convertedResult, { supplierRes: revalidateResult });
        convertedResultArray.push(convertedResult);

        //if one revalidate is failed then no need to revalidate second flight
        if (i === 0 && convertedResult?.error) {
          break;
        }
      }

      let result = convertedResultArray[0];
      if (
        convertedResultArray.length > 1 &&
        convertedResultArray[0].isValid === true &&
        convertedResultArray[1].isValid === true
      ) {
        const calculateFare = (fareA, fareB) => {
          console.log("calculateFare", fareA, fareB);
          return {
            baseFare: fareA?.baseFare + (fareB?.baseFare || 0),
            tax: fareA?.tax + (fareB?.tax || 0),
            publishedFare: fareA?.publishedFare + (fareB?.publishedFare || 0),
            serviceFee: fareA?.serviceFee + (fareB?.serviceFee || 0),
            perPersonFare: fareA?.perPersonFare + (fareB?.perPersonFare || 0),
            perPersonAdultFare:
              fareA?.perPersonAdultFare + (fareB?.perPersonAdultFare || 0),
            perPersonInfantFare:
              fareA?.perPersonInfantFare + (fareB?.perPersonInfantFare || 0),
            perPersonChildFare:
              fareA?.perPersonChildFare + (fareB?.perPersonChildFare || 0),
            adultFare: fareA?.adultFare + (fareB?.adultFare || 0),
            childFare: fareA?.childFare + (fareB?.childFare || 0),
            infantFare: fareA?.infantFare + (fareB?.infantFare || 0),
            otherCharges: fareA?.otherCharges + (fareB?.otherCharges || 0),
            searchTotalFare:
              fareA?.searchTotalFare + (fareB?.searchTotalFare || 0),
            totalFare: fareA?.totalFare + (fareB?.totalFare || 0),
            fareQuote: [fareA?.fareQuote, fareB?.fareQuote || null],
            currency: fareA?.currency,
            currencySymbol: fareA?.currencySymbol,
          };
        };

        const fareA = convertedResultArray[0]?.route?.fare[0];
        const fareB = convertedResultArray[1]?.route?.fare[0];
        console.log(fareA, fareB);
        result = {
          ...convertedResultArray[0],
          prevSolutionID: roundTripSolutionId,
          route: {
            ...convertedResultArray[0].route,
            netValue:
              convertedResultArray[0].supplierRes?.Response?.Results?.Fare
                ?.BaseFare +
                convertedResultArray[1].supplierRes?.Response?.Results?.Fare
                  ?.BaseFare || 0,
            fare: fareB ? [calculateFare(fareA, fareB)] : [fareA],
            solutionId: roundTripSolutionId,
            isRefundable: [
              ...convertedResultArray[0].route.isRefundable,
              ...convertedResultArray[1].route.isRefundable,
            ],
            airlineCode: [
              ...convertedResultArray[0].route.airlineCode,
              ...convertedResultArray[1].route.airlineCode,
            ],
            airlineName: [
              ...convertedResultArray[0].route.airlineName,
              ...convertedResultArray[1].route.airlineName,
            ],
            flightStops: [
              ...convertedResultArray[0].route.flightStops,
              ...convertedResultArray[1].route.flightStops,
            ],
            airlineType: [
              ...convertedResultArray[0].route.airlineType,
              ...convertedResultArray[1].route.airlineType,
            ],
            totalDuration: [
              ...convertedResultArray[0].route.totalDuration,
              ...convertedResultArray[1].route.totalDuration,
            ],
            totalInterval: [
              ...convertedResultArray[0].route.totalInterval,
              ...convertedResultArray[1].route.totalInterval,
            ],
            departureInfo: [
              ...convertedResultArray[0].route.departureInfo,
              ...convertedResultArray[1].route.departureInfo,
            ],
            arrivalInfo: [
              ...convertedResultArray[0].route.arrivalInfo,
              ...convertedResultArray[1].route.arrivalInfo,
            ],
            flightSegments: [
              ...convertedResultArray[0].route.flightSegments,
              ...convertedResultArray[1].route.flightSegments,
            ],
          },
        };
      }

      delete result?.reqPara;
      delete result?.supplierRes;
      return result;
    } catch (error) {
      console.log(error);
      this.genericRepo.storeLogs(revalidateReq.searchReqId, 1, error, 0);
      throw new InternalServerErrorException(
        `ERR_ISSUE_IN_FETCHING_DATA_FROM_PROVIDER`,
      );
    }
  }

  /** [@Description: This method is used to create the request]
   * @author: Prashant Joshi at 13-10-2025 **/
  createRequest(requestData, authToken) {
    const { revalidateReq, headers } = requestData;

    const requestParam = {
      ResultIndex: revalidateReq.solutionId,
      EndUserIp: headers["ip-address"],
      TokenId: authToken,
      TraceId: revalidateReq.trackingId,
    };

    return requestParam;
  }

  /** [@Description: This method is used to convert the response]
   * @author: Prashant Joshi at 13-10-2025 **/
  async convertingResponse(
    revalidateRequest,
    results,
  ): Promise<RevalidateResponse> {
    const { providerCred, revalidateReq, headers } = revalidateRequest;
    const preferredCurrency = headers["currency-preference"] || "USD";
    const revalidateResponse = new RevalidateResponse();

    /* Check for the response error first */
    if (results?.Response?.Results && results?.Response.ResponseStatus == 1) {
      const markup = null;

      const flightJourneys = isArray(results?.Response?.Results)
        ? results?.Response?.Results
        : [results?.Response?.Results];
      const flightRoutes: RevalidateData[] = flightJourneys.map(
        (flightJourney) => {
          const flightSegments: any = [];
          const departureInfos: LocationInfo[] = [];
          const arrivalInfos: LocationInfo[] = [];
          const flightStops: number[] = [];
          const cabinBaggages: BaggageInfo[] = [];
          const checkInBaggages: BaggageInfo[] = [];
          let segments: Segment[] = [];
          const totalDurations: string[] = [];
          const totalIntervals: string[] = [];
          const airlineCodes: string[] = [];
          const airlineNames: string[] = [];
          let cabinB: BaggageInfo = new BaggageInfo();
          let checkInB: BaggageInfo = new BaggageInfo();
          const solutionDetails = flightJourney.Fare;

          /* Setting up the prices */
          const flightRoute: RevalidateData = new RevalidateData();

          //new logic for OC-Travel
          const fare = this.settingUpPrices(
            revalidateReq,
            solutionDetails,
            flightJourney?.FareBreakdown,
            preferredCurrency,
            flightJourney?.ResultFareType,
          );
          flightRoute.fare = [fare];

          flightRoute.airlineType = [];
          flightRoute.isRefundable = [];

          flightJourney.Segments.forEach((segmentArray) => {
            let airlineCode: string = "";
            let totalDuration: number = 0;
            let totalInterval: number = 0;
            segments = [];
            segmentArray.forEach((segment) => {
              airlineCode = segment.Airline.AirlineCode;

              // Creating a time duration
              totalDuration += segment.Duration;

              // Creating Flight Segments ;
              const fSegment = this.settingUpSegments(segment);
              segments.push(fSegment);

              // Adding Interval ;
              totalInterval += fSegment.intervalMinutes;
            });

            airlineCodes.push(airlineCode);
            airlineNames.push(airlines("")[airlineCode] || airlineCode);
            totalIntervals.push(Generic.convertMinutesToHours(totalInterval));
            totalDurations.push(
              Generic.convertMinutesToHours(totalDuration + totalInterval),
            );
            flightSegments.push(segments);
            flightStops.push(segments.length - 1);
            const locationInfo = this.settingUpLocationInfo(segments);

            // Setting Departure and Arrival locations
            departureInfos.push(locationInfo["departureInfo"]);
            arrivalInfos.push(locationInfo["arrivalInfo"]);

            cabinBaggages.push(cabinB);
            checkInBaggages.push(checkInB);
          });
          flightRoute.requiredFieldsToBook = [];
          flightRoute.solutionId = flightJourney?.ResultIndex;
          flightRoute.airlineCode = airlineCodes;
          flightRoute.airlineName = airlineNames;
          flightRoute.flightStops = flightStops;
          flightRoute.totalDuration = totalDurations;
          flightRoute.totalInterval = totalIntervals;
          flightRoute.departureInfo = departureInfos;
          flightRoute.arrivalInfo = arrivalInfos;
          flightRoute.flightSegments = flightSegments;
          // const [flightSegment] = flightSegments;
          // flightRoute.flightSegments = flightSegment;

          flightRoute.airlineType.push(
            flightJourney.IsLCC ? AirlineCategory.LCC : AirlineCategory.Non_LCC,
          );
          flightRoute.isRefundable.push(flightJourney?.IsRefundable);

          return flightRoute;
        },
      );

      Object.assign(revalidateResponse, {
        isValid: true,
        error: false,
        message: "success",
        route: flightRoutes[0],
        IsBookableIfSeatNotAvailable: results?.Response?.Results?.IsBookableIfSeatNotAvailable,
        IsExclusiveFare: results?.Response?.Results?.IsExclusiveFare,
        IsFreeMealAvailable: results?.Response?.Results?.IsFreeMealAvailable,
        IsHoldAllowedWithSSR: results?.Response?.Results?.IsHoldAllowedWithSSR,
        IsHoldMandatoryWithSSR: results?.Response?.Results?.IsHoldMandatoryWithSSR,
        IssuanceType: results?.Response?.Results?.IssuanceType,
        IsLCC: results?.Response?.Results?.IsLCC,
        IsRefundable: results?.Response?.Results?.IsRefundable,
        IsCouponAppilcable: results?.Response?.Results?.IsCouponAppilcable,
        passportRequired:
          results?.Response?.Results?.IsPassportRequiredAtTicket ||
          results?.Response?.Results?.IsPassportFullDetailRequiredAtBook ||
          false,
        isGSTRequired: results?.Response?.Results?.IsGSTMandatory || false,
        searchReqId: revalidateReq.searchReqId,
        hashReqKey: revalidateReq.hashReqKey,
        paxes: revalidateReq?.paxes,
        markup: markup,
        TrackingId: results?.TrackingId,
        mode: "TBO-" + providerCred.mode,
        provider: "TBO",
        prevSolutionID: revalidateReq.solutionId,
        trackingId: results?.TraceId || results?.Response?.TraceId,
        tboMeta: {
          ResultIndex: results?.Response?.Results?.ResultIndex,
          TraceId: results?.TraceId || results?.Response?.TraceId,
          TokenId: revalidateRequest?.authToken || null,
          EndUserIp: revalidateRequest?.headers?.["ip-address"],
        },
      });
    } else {
      const errorMessage =
        results?.Errors?.[0]?.UserMessage || "This flight is not available.";

      Object.assign(revalidateResponse, {
        isValid: false,
        error: true,
        message: errorMessage,
        searchReqId: revalidateReq.searchReqId,
        mode: "TBO-" + providerCred.mode,
        provider: "TBO",
        prevSolutionID: revalidateReq.solutionId,
        trackingId: results?.TraceId || results?.Response?.TraceId,
        route: {},
        tboMeta: {
          ResultIndex: null,
          TraceId: results?.TraceId || results?.Response?.TraceId,
          TokenId: revalidateRequest?.authToken || null,
          EndUserIp: revalidateRequest?.headers?.["ip-address"],
        },
      });
    }

    return revalidateResponse;
  }

  /** [@Description: This method is used to get the cancellation fare rules]
   * @author: Prashant Joshi at 13-10-2025 **/
  async getCancellationFareRules(fareRuleRequest, i) {
    const {
      revalidateReq: fareRuleReq,
      providerCred,
      headers,
    } = fareRuleRequest;

    try {
      // Get auth token
      const authToken = await this.tboAuthToken.getAuthToken(fareRuleRequest);

      // Create API request body
      const requestBody = this.getFareRuleRequest(
        fareRuleReq,
        authToken,
        headers,
      );
      

      //dev
      // const endpoint = `${providerCred.url}BookingEngineService_Air/AirService.svc/rest/FareRule`;

      //prod
      const endpoint = `${providerCred.url}/rest/FareRule`;

      // const TIMEOUT = Http.Timeout.Others;
      const requestResult = await Http.httpRequestTBO(
        "POST",
        endpoint,
        JSON.stringify(requestBody),
      );

      // Create log for API
      const logs = {
        ApiRequest: fareRuleReq,
        supplierRequest: requestBody,
        supplierResponse: requestResult,
      };
      // const storedLog = await this.supplierLogs.addSupplierLogs(fareRuleReq?.searchReqId, logs, 'TBO', 'fareRules');

      const convertResponseData = await this.convertFareRuleResponse(
        fareRuleRequest,
        requestResult,
      );

      /* Updating the log file response */
      const logsWithRes = {
        ApiRequest: fareRuleReq,
        ApiResponse: convertResponseData,
        supplierRequest: requestBody,
        supplierResponse: requestResult,
      };
      // this.supplierLogs.updateSupplierLogs(fareRuleReq?.searchReqId, logsWithRes, 'TBO', 'fareRules', storedLog?.logId);
      // await this.s3BucketService.generateS3LogFile(fareRuleReq.searchReqId + '-' + i + '-' + this.logDate + '-TBO', logsWithRes, 'fareRules');
      await this.supplierLogUtility.generateLogFile({
        fileName:
          fareRuleReq.searchReqId + "-" + i + "-" + this.logDate + "-TBO",
        logData: logsWithRes,
        folderName: "revalidate",
        logId: null,
        title: "FareRule-TBO",
        searchReqId: fareRuleReq.searchReqId,
        bookingReferenceId: null,
      });
      return convertResponseData;
    } catch (error) {
      console.log(error);
      this.genericRepo.storeLogs(fareRuleReq, 1, error, 0);
      throw new InternalServerErrorException(
        "There is an issue while fetching data from the providers.",
      );
    }
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
    console.log("searchReq", searchReq);
    const fareDetail: Fare = new Fare();
    const adultCount = searchReq.paxes[0].adult;
    const childCount = searchReq.paxes[0].children;
    const infantCount = searchReq.paxes[0].infant;

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
      (fareDetail.searchBaseFare || 0) + (fareDetail.searchTax || 0);

    /* Creating total fares */
    console.log("fareDetail", fareDetail);
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
    // fareDetail.fareQuote = Generic.encrypt(JSON.stringify(passengerFareArr));
    fareDetail.fareQuote = Generic.encrypt(
      JSON.stringify({ ...passengerFareArr, fareBreakDown }),
    );
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
      airlines("")[segment.Airline.AirlineCode] || segment.Airline;
    flightSegment.cabinClass = Generic.convertCabinClassCode(
      "TBO",
      segment.CabinClass,
      false,
    );
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
    segmentDepartureInfo.date = moment(segment?.Origin?.DepTime).format(
      "YYYY-MM-DD",
    );
    segmentDepartureInfo.time = moment(segment?.Origin?.DepTime).format(
      "hh:mm A",
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
    segmentArrivalInfo.date = moment(segment?.Destination?.ArrTime).format(
      "YYYY-MM-DD",
    );
    segmentArrivalInfo.time = moment(segment?.Destination?.ArrTime).format(
      "hh:mm A",
    );
    segmentArrivalInfo.terminal = segment?.Destination?.Airport?.Terminal || "";

    /* Creating segment duration */
    const segmentDuration = segment.Duration;

    flightSegment.segmentDuration = Generic.convertTimeString(segmentDuration);
    flightSegment.departure = [segmentDepartureInfo];
    flightSegment.arrival = [segmentArrivalInfo];
    flightSegment.segmentInterval = Generic.convertTimeString(
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

  /** [@Description: This method is used to get the fare rule request]
   * @author: Prashant Joshi at 13-10-2025 **/
  getFareRuleRequest(changeRequestFareReq, authToken, headers) {
    return {
      TokenId: authToken,
      TraceId: changeRequestFareReq?.trackingId,
      ResultIndex: changeRequestFareReq?.solutionId,
      EndUserIp: headers["ip-address"],
    };
  }

  /** [@Description: This method is used to create the fare rules]
   * @author: Prashant Joshi at 13-10-2025 **/
  createFareRules(fareRule): FareRules {
    return {
      origin: fareRule?.Origin,
      Destination: fareRule?.destination,
      Airline: fareRule?.Airline,
      FareRestriction: fareRule?.FareRestriction,
      FareBasisCode: fareRule?.FareBasisCode,
      FareRuleDetail: fareRule?.FareRuleDetail,
      DepartureDate: fareRule?.DepartureDate,
      FlightNumber: fareRule?.FlightNumber,
    };
  }

  /** [@Description: This method is used to convert the fare rule response]
   * @author: Prashant Joshi at 13-10-2025 **/
  async convertFareRuleResponse(apiReqData, searchResult) {
    const { providerCred } = apiReqData;
    const cancellationFareRuleResponse = new CancellationFareRule();

    if (
      searchResult?.Response?.ResponseStatus === 1 &&
      searchResult?.Response?.FareRules.length > 0
    ) {
      cancellationFareRuleResponse.trackingId = searchResult?.Response?.TraceId;
      cancellationFareRuleResponse.fareRules =
        searchResult?.Response?.FareRules.map((rule) => ({
          destination: rule.Destination,
          origin: rule.Origin,
          fareRuleDetails: rule.FareRuleDetail,
          fareBasisCode: rule.FareBasisCode,
          flightId: rule.FlightId,
        }));
      cancellationFareRuleResponse.message = "OK";
      cancellationFareRuleResponse.mode = "TBO-" + providerCred?.mode;
      cancellationFareRuleResponse.error = false;
    } else {
      cancellationFareRuleResponse.message =
        searchResult?.Response?.Error?.ErrorMessage ||
        "ERR_FAILED_IN_FARE_RULE_REQUEST";
      cancellationFareRuleResponse.mode = "TBO-" + providerCred?.mode;
      cancellationFareRuleResponse.error = true;
      cancellationFareRuleResponse.fareRules = [];
    }
    return cancellationFareRuleResponse;
  }
}
