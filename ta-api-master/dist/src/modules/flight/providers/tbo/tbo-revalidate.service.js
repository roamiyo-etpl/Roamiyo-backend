"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TboRevalidateService = void 0;
const common_1 = require("@nestjs/common");
const generic_repo_utility_1 = require("../../../../shared/utilities/flight/generic-repo.utility");
const tbo_auth_token_service_1 = require("./tbo-auth-token.service");
const s3bucket_utility_1 = require("../../../../shared/utilities/flight/s3bucket.utility");
const revalidate_interface_1 = require("../../revalidate/interfaces/revalidate.interface");
const class_validator_1 = require("class-validator");
const start_routing_interface_1 = require("../../search/interfaces/start-routing.interface");
const airline_utility_1 = require("../../../../shared/utilities/flight/airline.utility");
const generic_utility_1 = require("../../../../shared/utilities/flight/generic.utility");
const flight_enum_1 = require("../../../../shared/enums/flight/flight.enum");
const airport_utility_1 = require("../../../../shared/utilities/flight/airport.utility");
const moment_1 = __importDefault(require("moment"));
const http_utility_1 = require("../../../../shared/utilities/flight/http.utility");
const typeorm_1 = require("@nestjs/typeorm");
const revalidate_response_entity_1 = require("../../../../shared/entities/revalidate-response.entity");
const typeorm_2 = require("typeorm");
const supplier_log_utility_1 = require("../../../../shared/utilities/flight/supplier-log.utility");
let TboRevalidateService = class TboRevalidateService {
    tboAuthToken;
    s3BucketService;
    genericRepo;
    revalidateRepo;
    supplierLogUtility;
    logDate = Date.now();
    constructor(tboAuthToken, s3BucketService, genericRepo, revalidateRepo, supplierLogUtility) {
        this.tboAuthToken = tboAuthToken;
        this.s3BucketService = s3BucketService;
        this.genericRepo = genericRepo;
        this.revalidateRepo = revalidateRepo;
        this.supplierLogUtility = supplierLogUtility;
    }
    async revalidate(requestData) {
        const { providerCred, revalidateReq } = requestData;
        Object.assign(requestData, { tokenReqData: revalidateReq });
        const roundTripSolutionId = revalidateReq.solutionId;
        try {
            const authToken = await this.tboAuthToken.getAuthToken(requestData);
            const handleAuthenticationFailure = () => {
                const revalidateResponse = {
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
            if (authToken === "") {
                return handleAuthenticationFailure();
            }
            const convertedResultArray = [];
            const solutionIds = revalidateReq.solutionId.split(" ||| ");
            for (let i = 0; i < solutionIds.length; i++) {
                const tempRequestData = {
                    ...requestData,
                    revalidateReq: {
                        ...requestData.revalidateReq,
                        solutionId: solutionIds[i],
                    },
                };
                const fareRules = await this.getCancellationFareRules(tempRequestData, i);
                if (fareRules.error === true) {
                    handleAuthenticationFailure();
                }
                const requestBody = this.createRequest(tempRequestData, authToken);
                const endpoint = `${providerCred.url}/rest/FareQuote`;
                const revalidateResult = await http_utility_1.Http.httpRequestTBO("POST", endpoint, JSON.stringify(requestBody));
                await this.revalidateRepo.save({
                    solution_id: solutionIds[i],
                    response: JSON.stringify(revalidateResult),
                    provider_code: providerCred.provider,
                });
                const convertedResult = await this.convertingResponse({ ...requestData, authToken }, revalidateResult);
                const logsWithRes = {
                    ApiRequest: revalidateReq,
                    ApiResponse: convertedResult,
                    supplierRequest: requestBody,
                    supplierResponse: revalidateResult,
                };
                await this.supplierLogUtility.generateLogFile({
                    fileName: revalidateReq.searchReqId + " " + i + "-" + this.logDate + "-TBO",
                    logData: logsWithRes,
                    folderName: "revalidate",
                    logId: null,
                    title: "FareQuote-TBO",
                    searchReqId: revalidateReq.searchReqId,
                    bookingReferenceId: null,
                });
                Object.assign(convertedResult, { supplierRes: revalidateResult });
                convertedResultArray.push(convertedResult);
                if (i === 0 && convertedResult?.error) {
                    break;
                }
            }
            let result = convertedResultArray[0];
            if (convertedResultArray.length > 1 &&
                convertedResultArray[0].isValid === true &&
                convertedResultArray[1].isValid === true) {
                const calculateFare = (fareA, fareB) => {
                    console.log("calculateFare", fareA, fareB);
                    return {
                        baseFare: fareA?.baseFare + (fareB?.baseFare || 0),
                        tax: fareA?.tax + (fareB?.tax || 0),
                        publishedFare: fareA?.publishedFare + (fareB?.publishedFare || 0),
                        serviceFee: fareA?.serviceFee + (fareB?.serviceFee || 0),
                        perPersonFare: fareA?.perPersonFare + (fareB?.perPersonFare || 0),
                        perPersonAdultFare: fareA?.perPersonAdultFare + (fareB?.perPersonAdultFare || 0),
                        perPersonInfantFare: fareA?.perPersonInfantFare + (fareB?.perPersonInfantFare || 0),
                        perPersonChildFare: fareA?.perPersonChildFare + (fareB?.perPersonChildFare || 0),
                        adultFare: fareA?.adultFare + (fareB?.adultFare || 0),
                        childFare: fareA?.childFare + (fareB?.childFare || 0),
                        infantFare: fareA?.infantFare + (fareB?.infantFare || 0),
                        otherCharges: fareA?.otherCharges + (fareB?.otherCharges || 0),
                        searchTotalFare: fareA?.searchTotalFare + (fareB?.searchTotalFare || 0),
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
                        netValue: convertedResultArray[0].supplierRes?.Response?.Results?.Fare
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
        }
        catch (error) {
            console.log(error);
            this.genericRepo.storeLogs(revalidateReq.searchReqId, 1, error, 0);
            throw new common_1.InternalServerErrorException(`ERR_ISSUE_IN_FETCHING_DATA_FROM_PROVIDER`);
        }
    }
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
    async convertingResponse(revalidateRequest, results) {
        const { providerCred, revalidateReq, headers } = revalidateRequest;
        const preferredCurrency = headers["currency-preference"] || "USD";
        const revalidateResponse = new revalidate_interface_1.RevalidateResponse();
        if (results?.Response?.Results && results?.Response.ResponseStatus == 1) {
            const markup = null;
            const flightJourneys = (0, class_validator_1.isArray)(results?.Response?.Results)
                ? results?.Response?.Results
                : [results?.Response?.Results];
            const flightRoutes = flightJourneys.map((flightJourney) => {
                const flightSegments = [];
                const departureInfos = [];
                const arrivalInfos = [];
                const flightStops = [];
                const cabinBaggages = [];
                const checkInBaggages = [];
                let segments = [];
                const totalDurations = [];
                const totalIntervals = [];
                const airlineCodes = [];
                const airlineNames = [];
                let cabinB = new start_routing_interface_1.BaggageInfo();
                let checkInB = new start_routing_interface_1.BaggageInfo();
                const solutionDetails = flightJourney.Fare;
                const flightRoute = new revalidate_interface_1.RevalidateData();
                const fare = this.settingUpPrices(revalidateReq, solutionDetails, flightJourney?.FareBreakdown, preferredCurrency, flightJourney?.ResultFareType);
                flightRoute.fare = [fare];
                flightRoute.airlineType = [];
                flightRoute.isRefundable = [];
                flightJourney.Segments.forEach((segmentArray) => {
                    let airlineCode = "";
                    let totalDuration = 0;
                    let totalInterval = 0;
                    segments = [];
                    segmentArray.forEach((segment) => {
                        airlineCode = segment.Airline.AirlineCode;
                        totalDuration += segment.Duration;
                        const fSegment = this.settingUpSegments(segment);
                        segments.push(fSegment);
                        totalInterval += fSegment.intervalMinutes;
                    });
                    airlineCodes.push(airlineCode);
                    airlineNames.push((0, airline_utility_1.airlines)("")[airlineCode] || airlineCode);
                    totalIntervals.push(generic_utility_1.Generic.convertMinutesToHours(totalInterval));
                    totalDurations.push(generic_utility_1.Generic.convertMinutesToHours(totalDuration + totalInterval));
                    flightSegments.push(segments);
                    flightStops.push(segments.length - 1);
                    const locationInfo = this.settingUpLocationInfo(segments);
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
                flightRoute.airlineType.push(flightJourney.IsLCC ? flight_enum_1.AirlineCategory.LCC : flight_enum_1.AirlineCategory.Non_LCC);
                flightRoute.isRefundable.push(flightJourney?.IsRefundable);
                return flightRoute;
            });
            Object.assign(revalidateResponse, {
                isValid: true,
                error: false,
                message: "success",
                route: flightRoutes[0],
                passportRequired: results?.Response?.Results?.IsPassportRequiredAtTicket ||
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
        }
        else {
            const errorMessage = results?.Errors?.[0]?.UserMessage || "This flight is not available.";
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
    async getCancellationFareRules(fareRuleRequest, i) {
        const { revalidateReq: fareRuleReq, providerCred, headers, } = fareRuleRequest;
        try {
            const authToken = await this.tboAuthToken.getAuthToken(fareRuleRequest);
            const requestBody = this.getFareRuleRequest(fareRuleReq, authToken, headers);
            const endpoint = `${providerCred.url}/rest/FareRule`;
            const requestResult = await http_utility_1.Http.httpRequestTBO("POST", endpoint, JSON.stringify(requestBody));
            const logs = {
                ApiRequest: fareRuleReq,
                supplierRequest: requestBody,
                supplierResponse: requestResult,
            };
            const convertResponseData = await this.convertFareRuleResponse(fareRuleRequest, requestResult);
            const logsWithRes = {
                ApiRequest: fareRuleReq,
                ApiResponse: convertResponseData,
                supplierRequest: requestBody,
                supplierResponse: requestResult,
            };
            await this.supplierLogUtility.generateLogFile({
                fileName: fareRuleReq.searchReqId + "-" + i + "-" + this.logDate + "-TBO",
                logData: logsWithRes,
                folderName: "revalidate",
                logId: null,
                title: "FareRule-TBO",
                searchReqId: fareRuleReq.searchReqId,
                bookingReferenceId: null,
            });
            return convertResponseData;
        }
        catch (error) {
            console.log(error);
            this.genericRepo.storeLogs(fareRuleReq, 1, error, 0);
            throw new common_1.InternalServerErrorException("There is an issue while fetching data from the providers.");
        }
    }
    settingUpPrices(searchReq, passengerFareArr, fareBreakDown, preferredCurrency, FareType) {
        console.log("searchReq", searchReq);
        const fareDetail = new start_routing_interface_1.Fare();
        const adultCount = searchReq.paxes[0].adult;
        const childCount = searchReq.paxes[0].children;
        const infantCount = searchReq.paxes[0].infant;
        let adultTaxPP = 0, childTaxPP = 0, infantTaxPP = 0;
        let adultSFeePP = 0, childSFeePP = 0, infantSFeePP = 0;
        let adultOChargePP = 0, childOChargePP = 0, infantOChargePP = 0;
        fareDetail.fareType = FareType || "";
        fareBreakDown.forEach((element) => {
            const passengerCount = element?.PassengerCount || 1;
            if (element.PassengerType === 1) {
                fareDetail.perPersonAdultFare =
                    generic_utility_1.Generic.currencyConversion(element?.BaseFare / passengerCount, element.Currency, preferredCurrency) || 0;
                fareDetail.adultFare = fareDetail.perPersonAdultFare * adultCount;
                adultTaxPP = element?.Tax
                    ? generic_utility_1.Generic.currencyConversion(element?.Tax / passengerCount, element.Currency, preferredCurrency)
                    : 0;
                adultSFeePP = element?.ServiceFee
                    ? generic_utility_1.Generic.currencyConversion(element?.ServiceFee / passengerCount, element.Currency, preferredCurrency)
                    : 0;
                adultOChargePP = element?.OtherCharges
                    ? generic_utility_1.Generic.currencyConversion(element?.OtherCharges / passengerCount, element.Currency, preferredCurrency)
                    : 0;
            }
            else if (element.PassengerType === 2) {
                fareDetail.perPersonChildFare =
                    childCount > 0
                        ? generic_utility_1.Generic.currencyConversion(element?.BaseFare / passengerCount, element.Currency, preferredCurrency)
                        : 0;
                fareDetail.childFare = fareDetail.perPersonChildFare * childCount;
                childTaxPP = element?.Tax
                    ? generic_utility_1.Generic.currencyConversion(element?.Tax / passengerCount, element.Currency, preferredCurrency)
                    : 0;
                childSFeePP = element?.ServiceFee
                    ? generic_utility_1.Generic.currencyConversion(element?.ServiceFee / passengerCount, element.Currency, preferredCurrency)
                    : 0;
                childOChargePP = element?.OtherCharges
                    ? generic_utility_1.Generic.currencyConversion(element?.OtherCharges / passengerCount, element.Currency, preferredCurrency)
                    : 0;
            }
            else if (element.PassengerType === 3) {
                fareDetail.perPersonInfantFare =
                    infantCount > 0
                        ? generic_utility_1.Generic.currencyConversion(element?.BaseFare / passengerCount, element.Currency, preferredCurrency)
                        : 0;
                fareDetail.infantFare = fareDetail.perPersonInfantFare * infantCount;
                infantTaxPP = element?.Tax
                    ? generic_utility_1.Generic.currencyConversion(element?.Tax / passengerCount, element.Currency, preferredCurrency)
                    : 0;
                infantSFeePP = element?.ServiceFee
                    ? generic_utility_1.Generic.currencyConversion(element?.ServiceFee / passengerCount, element.Currency, preferredCurrency)
                    : 0;
                infantOChargePP = element?.OtherCharges
                    ? generic_utility_1.Generic.currencyConversion(element?.OtherCharges / passengerCount, element.Currency, preferredCurrency)
                    : 0;
            }
        });
        fareDetail.baseFare =
            (fareDetail.adultFare || 0) +
                (fareDetail.childFare || 0) +
                (fareDetail.infantFare || 0);
        fareDetail.tax =
            adultTaxPP * adultCount +
                childTaxPP * childCount +
                infantTaxPP * infantCount;
        fareDetail.serviceFee =
            adultSFeePP * adultCount +
                childSFeePP * childCount +
                infantSFeePP * infantCount;
        fareDetail.otherCharges =
            adultOChargePP * adultCount +
                childOChargePP * childCount +
                infantOChargePP * infantCount;
        fareDetail.searchBaseFare = fareDetail.perPersonAdultFare;
        fareDetail.searchTax = adultTaxPP + adultSFeePP + adultOChargePP;
        fareDetail.searchTotalFare =
            (fareDetail.searchBaseFare || 0) + (fareDetail.searchTax || 0);
        console.log("fareDetail", fareDetail);
        const totalFare = (fareDetail.baseFare || 0) +
            (fareDetail.serviceFee || 0) +
            (fareDetail.tax || 0) +
            (fareDetail.otherCharges || 0);
        fareDetail.totalFare = totalFare;
        fareDetail.perPersonFare =
            adultCount + childCount + infantCount > 0
                ? Math.ceil(totalFare / (adultCount + childCount + infantCount))
                : 0;
        fareDetail.currency = preferredCurrency;
        fareDetail.fareQuote = generic_utility_1.Generic.encrypt(JSON.stringify({ ...passengerFareArr, fareBreakDown }));
        return fareDetail;
    }
    settingUpSegments(segment) {
        const segmentDepartureInfo = new start_routing_interface_1.LocationInfo();
        const segmentArrivalInfo = new start_routing_interface_1.LocationInfo();
        const flightSegment = new start_routing_interface_1.Segment();
        flightSegment.intervalMinutes = 0;
        flightSegment.segmentId = segment.SegmentIndicator;
        flightSegment.airlineCode = segment.Airline.AirlineCode;
        flightSegment.airlineName =
            (0, airline_utility_1.airlines)("")[segment.Airline.AirlineCode] || segment.Airline;
        flightSegment.cabinClass = generic_utility_1.Generic.convertCabinClassCode("TBO", segment.CabinClass, false);
        flightSegment.flightNumber = segment?.Airline?.FlightNumber;
        flightSegment.noOfSeatAvailable = segment?.NoOfSeatAvailable;
        flightSegment.mealType = segment?.MealType || "";
        flightSegment.distance = segment?.Mile || "";
        flightSegment.craft = segment?.Craft || "";
        flightSegment.inFlightServices = segment?.InFlightServices || "";
        const cabinBaggage = new start_routing_interface_1.BaggageInfo();
        const checkInBaggage = new start_routing_interface_1.BaggageInfo();
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
        segmentDepartureInfo.code = segment?.Origin?.Airport?.AirportCode;
        segmentDepartureInfo.name =
            airport_utility_1.airports[segmentDepartureInfo.code]?.name ||
                segment?.Origin?.Airport?.AirportName;
        segmentDepartureInfo.country =
            airport_utility_1.airports[segmentDepartureInfo.code]?.country ||
                segment?.Origin?.Airport?.CountryName;
        segmentDepartureInfo.countryCode =
            airport_utility_1.airports[segmentDepartureInfo.code]?.iso_country ||
                segment?.Origin?.Airport?.CountryCode;
        segmentDepartureInfo.city =
            airport_utility_1.airports[segmentDepartureInfo.code]?.city ||
                segment?.Origin?.Airport?.CityName;
        segmentDepartureInfo.cityCode =
            airport_utility_1.airports[segmentDepartureInfo.code]?.city_code ||
                segment?.Origin?.Airport?.CityCode;
        segmentDepartureInfo.date = (0, moment_1.default)(segment?.Origin?.DepTime).format("YYYY-MM-DD");
        segmentDepartureInfo.time = (0, moment_1.default)(segment?.Origin?.DepTime).format("hh:mm A");
        segmentDepartureInfo.terminal = segment?.Origin?.Airport?.Terminal || "";
        segmentArrivalInfo.code = segment?.Destination?.Airport?.AirportCode;
        segmentArrivalInfo.name =
            airport_utility_1.airports[segmentArrivalInfo.code]?.name ||
                segment?.Destination?.Airport?.AirportName;
        segmentArrivalInfo.country =
            airport_utility_1.airports[segmentArrivalInfo.code]?.country ||
                segment?.Destination?.Airport?.CountryName;
        segmentArrivalInfo.countryCode =
            airport_utility_1.airports[segmentArrivalInfo.code]?.iso_country ||
                segment?.Destination?.Airport?.CountryCode;
        segmentArrivalInfo.city =
            airport_utility_1.airports[segmentArrivalInfo.code]?.city ||
                segment?.Destination?.Airport?.CityName;
        segmentArrivalInfo.cityCode =
            airport_utility_1.airports[segmentArrivalInfo.code]?.city_code ||
                segment?.Destination?.Airport?.CityCode;
        segmentArrivalInfo.date = (0, moment_1.default)(segment?.Destination?.ArrTime).format("YYYY-MM-DD");
        segmentArrivalInfo.time = (0, moment_1.default)(segment?.Destination?.ArrTime).format("hh:mm A");
        segmentArrivalInfo.terminal = segment?.Destination?.Airport?.Terminal || "";
        const segmentDuration = segment.Duration;
        flightSegment.segmentDuration = generic_utility_1.Generic.convertTimeString(segmentDuration);
        flightSegment.departure = [segmentDepartureInfo];
        flightSegment.arrival = [segmentArrivalInfo];
        flightSegment.segmentInterval = generic_utility_1.Generic.convertTimeString(segment.GroundTime);
        flightSegment.intervalMinutes = segment.GroundTime;
        return flightSegment;
    }
    settingUpLocationInfo(flightSegment) {
        const departureInfo = new start_routing_interface_1.LocationInfo();
        const arrivalInfo = new start_routing_interface_1.LocationInfo();
        departureInfo.code = flightSegment[0].departure[0].code;
        departureInfo.city = airport_utility_1.airports[departureInfo.code]?.city || "";
        departureInfo.cityCode = airport_utility_1.airports[departureInfo.code]?.city_code || "";
        departureInfo.country = airport_utility_1.airports[departureInfo.code]?.country || "";
        departureInfo.countryCode = airport_utility_1.airports[departureInfo.code]?.iso_country || "";
        departureInfo.name = airport_utility_1.airports[departureInfo.code]?.name || "";
        departureInfo.date = flightSegment[0].departure[0].date;
        departureInfo.time = flightSegment[0].departure[0].time;
        departureInfo.terminal = flightSegment[0].departure[0]?.terminal || "";
        arrivalInfo.code = flightSegment[flightSegment.length - 1].arrival[0].code;
        arrivalInfo.city = airport_utility_1.airports[arrivalInfo.code]?.city || "";
        arrivalInfo.cityCode = airport_utility_1.airports[arrivalInfo.code]?.city_code || "";
        arrivalInfo.country = airport_utility_1.airports[arrivalInfo.code]?.country || "";
        arrivalInfo.countryCode = airport_utility_1.airports[arrivalInfo.code]?.iso_country || "";
        arrivalInfo.name = airport_utility_1.airports[arrivalInfo.code]?.name || "";
        arrivalInfo.date = flightSegment[flightSegment.length - 1].arrival[0].date;
        arrivalInfo.time = flightSegment[flightSegment.length - 1].arrival[0].time;
        arrivalInfo.terminal =
            flightSegment[flightSegment.length - 1].arrival[0]?.terminal || "";
        const locationInfo = [];
        locationInfo["departureInfo"] = departureInfo;
        locationInfo["arrivalInfo"] = arrivalInfo;
        return locationInfo;
    }
    getFareRuleRequest(changeRequestFareReq, authToken, headers) {
        return {
            TokenId: authToken,
            TraceId: changeRequestFareReq?.trackingId,
            ResultIndex: changeRequestFareReq?.solutionId,
            EndUserIp: headers["ip-address"],
        };
    }
    createFareRules(fareRule) {
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
    async convertFareRuleResponse(apiReqData, searchResult) {
        const { providerCred } = apiReqData;
        const cancellationFareRuleResponse = new revalidate_interface_1.CancellationFareRule();
        if (searchResult?.Response?.ResponseStatus === 1 &&
            searchResult?.Response?.FareRules.length > 0) {
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
        }
        else {
            cancellationFareRuleResponse.message =
                searchResult?.Response?.Error?.ErrorMessage ||
                    "ERR_FAILED_IN_FARE_RULE_REQUEST";
            cancellationFareRuleResponse.mode = "TBO-" + providerCred?.mode;
            cancellationFareRuleResponse.error = true;
            cancellationFareRuleResponse.fareRules = [];
        }
        return cancellationFareRuleResponse;
    }
};
exports.TboRevalidateService = TboRevalidateService;
exports.TboRevalidateService = TboRevalidateService = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, typeorm_1.InjectRepository)(revalidate_response_entity_1.RevalidateResponseEntity)),
    __metadata("design:paramtypes", [tbo_auth_token_service_1.TboAuthTokenService,
        s3bucket_utility_1.s3BucketService,
        generic_repo_utility_1.GenericRepo,
        typeorm_2.Repository,
        supplier_log_utility_1.SupplierLogUtility])
], TboRevalidateService);
//# sourceMappingURL=tbo-revalidate.service.js.map