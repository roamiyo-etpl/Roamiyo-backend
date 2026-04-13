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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TboSearchService = void 0;
const common_1 = require("@nestjs/common");
const tbo_auth_token_service_1 = require("./tbo-auth-token.service");
const http_utility_1 = require("../../../../shared/utilities/flight/http.utility");
const generic_repo_utility_1 = require("../../../../shared/utilities/flight/generic-repo.utility");
const generic_utility_1 = require("../../../../shared/utilities/flight/generic.utility");
const date_utility_1 = require("../../../../shared/utilities/flight/date.utility");
const airline_utility_1 = require("../../../../shared/utilities/flight/airline.utility");
const airport_utility_1 = require("../../../../shared/utilities/flight/airport.utility");
const start_routing_interface_1 = require("../../search/interfaces/start-routing.interface");
const flight_enum_1 = require("../../../../shared/enums/flight/flight.enum");
const md5_1 = __importDefault(require("md5"));
const lodash_1 = require("lodash");
let TboSearchService = class TboSearchService {
    tboAuthTokenService;
    genericRepo;
    constructor(tboAuthTokenService, genericRepo) {
        this.tboAuthTokenService = tboAuthTokenService;
        this.genericRepo = genericRepo;
    }
    async search(searchRequest) {
        const { providerCred, searchReqId, searchReq } = searchRequest;
        const authToken = await this.tboAuthTokenService.getAuthToken(searchRequest);
        searchRequest.authToken = authToken;
        try {
            console.log("Azure URL:", process.env.AZURE_BLOB_SAS_LINK);
            const requestBody = this.creatingSearchRequest(searchRequest);
            const endpoint = `${providerCred.url}/rest/Search`;
            const startTime = Date.now();
            const searchResult = await http_utility_1.Http.httpRequestTBO('POST', endpoint, JSON.stringify(requestBody));
            const endTime = Date.now();
            const logs = { ApiRequest: searchReq, supplierRequest: requestBody, supplierResponse: searchResult };
            generic_utility_1.Generic.generateLogFile(searchReqId + '-TBO', logs, 'search');
            const searchResponse = await this.convertingResponse(searchRequest, searchResult);
            const convertResponseTime = Date.now();
            const logsWithRes = {
                ApiRequest: searchReq,
                ApiResponse: searchResponse,
                ApiResponseTime: `${(convertResponseTime - startTime) / 1000} seconds`,
                supplierRequest: requestBody,
                supplierResponse: searchResult,
                supplierResponseTime: `${(endTime - startTime) / 1000} seconds`,
            };
            console.log('logsWithRes.supplierResponseTime', logsWithRes.supplierResponseTime);
            console.log('ConvertTime', logsWithRes.ApiResponseTime);
            generic_utility_1.Generic.generateLogFile(searchReqId + '-TBO', logsWithRes, 'search');
            return searchResponse;
        }
        catch (error) {
            await this.genericRepo.storeLogs(searchReqId, 1, error, 0);
            console.log(error);
            throw new common_1.InternalServerErrorException('There is an issue while fetching data from the providers.');
        }
    }
    creatingSearchRequest(searchRequest) {
        const { searchReq, headers } = searchRequest;
        const adultCount = generic_utility_1.Generic.getAdultCount(searchReq);
        const childCount = generic_utility_1.Generic.getChildCount(searchReq);
        const infantCount = generic_utility_1.Generic.getInfantCount(searchReq);
        const searchAirLegs = [];
        searchReq.searchAirLegs.forEach((element) => {
            if (searchReq.travelPreferences[0]?.airTripType === flight_enum_1.TripType.ONEWAY) {
                searchAirLegs.push({
                    Origin: element.origin,
                    Destination: element.destination,
                    FlightCabinClass: generic_utility_1.Generic.convertCabinClassCode('TBO', searchReq.travelPreferences[0].cabinClass, true),
                    PreferredDepartureTime: element.departureDate + 'T00: 00: 00',
                    PreferredArrivalTime: element.departureDate + 'T00: 00: 00',
                });
            }
            if (searchReq.travelPreferences[0]?.airTripType === flight_enum_1.TripType.ROUNDTRIP) {
                searchAirLegs.push({
                    Origin: element.origin,
                    Destination: element.destination,
                    FlightCabinClass: generic_utility_1.Generic.convertCabinClassCode('TBO', searchReq.travelPreferences[0].cabinClass, true),
                    PreferredDepartureTime: element.departureDate + 'T00: 00: 00',
                    PreferredArrivalTime: element.departureDate + 'T00: 00: 00',
                });
            }
            if (searchReq.travelPreferences[0]?.airTripType === flight_enum_1.TripType.MULTI_CITY) {
                searchAirLegs.push({
                    Origin: element.origin,
                    Destination: element.destination,
                    FlightCabinClass: generic_utility_1.Generic.convertCabinClassCode('TBO', searchReq.travelPreferences[0].cabinClass, true),
                    PreferredDepartureTime: element.departureDate + 'T00: 00: 00',
                    PreferredArrivalTime: element.departureDate + 'T00: 00: 00',
                });
            }
        });
        const params = {
            EndUserIp: headers['ip-address'],
            TokenId: searchRequest.authToken,
            AdultCount: adultCount,
            ChildCount: childCount,
            InfantCount: infantCount,
            DirectFlight: false,
            OneStopFlight: false,
            ResultFareType: searchReq.ResultFareType,
            JourneyType: generic_utility_1.Generic.getTripTypeTbo(searchReq.travelPreferences[0].airTripType),
            PreferredAirlines: null,
            Segments: searchAirLegs,
            Sources: null,
        };
        return params;
    }
    async convertingResponse(searchRequest, results) {
        const { providerCred, searchReq, searchReqId, headers } = searchRequest;
        const preferredCurrency = headers['currency-preference'] || 'USD';
        const searchResponse = new start_routing_interface_1.StartRoutingResponse();
        if (results?.Response?.ResponseStatus && results?.Response?.Results?.length > 0) {
            let [flightJourneys] = results?.Response?.Results;
            const origin = results?.Response?.Origin;
            const destination = results?.Response?.Destination;
            const originCountry = airport_utility_1.airports[origin]?.country;
            const destinationCountry = airport_utility_1.airports[destination]?.country;
            const isMultiCity = searchReq.travelPreferences[0].airTripType == flight_enum_1.TripType.MULTI_CITY;
            const isRoundtrip = searchReq.travelPreferences[0].airTripType == flight_enum_1.TripType.ROUNDTRIP;
            if (isMultiCity) {
                console.log('Multi-city scenario detected');
            }
            if (originCountry == destinationCountry && isRoundtrip) {
                flightJourneys = flightJourneys.map((flight) => {
                    const resultInd = flight.ResultIndex.split('[')[0];
                    const findInBound = results.Response.Results[1]?.find((inBoundFlight) => {
                        const inBoundInd = inBoundFlight?.ResultIndex?.split('[')[0];
                        const searchInBound = 'O' + inBoundInd.slice(1);
                        return searchInBound == resultInd;
                    });
                    if (findInBound) {
                        const returnValue = {
                            ...flight,
                            ResultIndex: [flight.ResultIndex, findInBound?.ResultIndex],
                            Fare: {
                                ...flight.Fare[0],
                                BaseFare: flight.Fare.BaseFare + (findInBound?.Fare?.BaseFare ?? 0),
                                Tax: flight.Fare.Tax + (findInBound?.Fare?.Tax ?? 0),
                                PublishedFare: flight.Fare.PublishedFare + (findInBound?.Fare?.PublishedFare ?? 0),
                                ServiceFee: flight.Fare.ServiceFee + (findInBound?.Fare?.ServiceFee ?? 0),
                            },
                            FareBreakdown: [
                                {
                                    ...flight.FareBreakdown[0],
                                    BaseFare: flight.FareBreakdown[0].BaseFare + (findInBound?.FareBreakdown?.[0]?.BaseFare ?? 0),
                                    Tax: flight.FareBreakdown[0].Tax + (findInBound?.FareBreakdown?.[0]?.Tax ?? 0),
                                },
                            ],
                            Segments: [...flight.Segments, ...findInBound?.Segments],
                            FareRules: [...flight.FareRules, ...findInBound?.FareRules],
                        };
                        return returnValue;
                    }
                    else {
                        return null;
                    }
                });
                flightJourneys = flightJourneys.filter((flight) => flight);
            }
            const flightRoutes = flightJourneys.map((flightJourney) => {
                const flightSegments = [];
                const departureInfos = [];
                const arrivalInfos = [];
                const flightStops = [];
                const cabinBaggages = [];
                const checkInBaggages = [];
                const hashCodes = [];
                let groupHashCode = '';
                let segments = [];
                const totalDurations = [];
                const totalIntervals = [];
                const airlineCodes = [];
                const airlineNames = [];
                let fareSourceCode = '';
                let cabinB = new start_routing_interface_1.BaggageInfo();
                let checkInB = new start_routing_interface_1.BaggageInfo();
                const solutionDetails = flightJourney.Fare;
                const flightRoute = new start_routing_interface_1.Route();
                const fare = this.settingUpPrices(searchReq, solutionDetails, flightJourney?.FareBreakdown, preferredCurrency, flightJourney?.ResultFareType);
                flightRoute.fare = [fare];
                flightJourney.Segments.forEach((segmentArray) => {
                    let airlineCode = '';
                    let hashCode = '';
                    let totalDuration = 0;
                    let totalInterval = 0;
                    let supplierFareClass = '';
                    segments = [];
                    segmentArray.forEach((segment) => {
                        fareSourceCode = '';
                        airlineCode = segment.Airline.AirlineCode;
                        supplierFareClass = segment.SupplierFareClass;
                        totalDuration += segment.Duration;
                        const fSegment = this.settingUpSegments(segment);
                        segments.push(fSegment);
                        totalInterval += fSegment.intervalMinutes;
                        hashCode += fSegment.airlineCode + fSegment.flightNumber + fSegment.cabinClass;
                    });
                    airlineCodes.push(airlineCode);
                    airlineNames.push((0, airline_utility_1.airlines)('')[airlineCode] || airlineCode);
                    hashCodes.push((0, md5_1.default)(hashCode));
                    groupHashCode += (0, md5_1.default)(hashCode);
                    totalIntervals.push(generic_utility_1.Generic.convertMinutesToHours(totalInterval));
                    totalDurations.push(generic_utility_1.Generic.convertMinutesToHours(totalDuration + totalInterval));
                    flightSegments.push(segments);
                    flightStops.push(segments.length - 1);
                    const locationInfo = this.settingUpLocationInfo(segments);
                    departureInfos.push(locationInfo['departureInfo']);
                    arrivalInfos.push(locationInfo['arrivalInfo']);
                    cabinBaggages.push(cabinB);
                    checkInBaggages.push(checkInB);
                });
                flightRoute.routeId = '';
                flightRoute.solutionId = (0, lodash_1.isArray)(flightJourney?.ResultIndex) ? flightJourney?.ResultIndex : [flightJourney?.ResultIndex];
                flightRoute.isRefundable = flightJourney?.IsRefundable;
                flightRoute.airlineCode = airlineCodes;
                flightRoute.airlineName = airlineNames;
                flightRoute.flightStops = flightStops;
                flightRoute.hashCode = hashCodes;
                flightRoute.groupHashCode = (0, md5_1.default)(groupHashCode);
                flightRoute.fareSourceCode = [fareSourceCode];
                flightRoute.isDuplicateOutbound = false;
                flightRoute.airlineType = flightJourney?.IsLCC ? flight_enum_1.AirlineCategory.LCC : flight_enum_1.AirlineCategory.Non_LCC;
                flightRoute.totalDuration = totalDurations;
                flightRoute.totalInterval = totalIntervals;
                flightRoute.departureInfo = departureInfos;
                flightRoute.arrivalInfo = arrivalInfos;
                flightRoute.flightSegments = flightSegments;
                const groupHash = new start_routing_interface_1.GroupHash();
                groupHash.provider = ['TBO'];
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
            searchResponse.mode = 'TBO-' + providerCred.mode;
            searchResponse.error = false;
            searchResponse.message = 'OK';
        }
        else {
            const errorMessage = results?.Response?.Error?.ErrorMessage || 'No flight found.';
            searchResponse.route = [];
            searchResponse.isDomestic = results?.IsDomestic || '';
            searchResponse.searchReqId = searchReqId;
            searchResponse.trackingId = results?.Response?.TraceId;
            searchResponse.mode = 'TBO-' + providerCred.mode;
            searchResponse.error = true;
            searchResponse.message = errorMessage;
        }
        return searchResponse;
    }
    settingUpPrices(searchReq, passengerFareArr, fareBreakDown, preferredCurrency, FareType) {
        const fareDetail = new start_routing_interface_1.Fare();
        const adultCount = generic_utility_1.Generic.getAdultCount(searchReq);
        const childCount = generic_utility_1.Generic.getChildCount(searchReq);
        const infantCount = generic_utility_1.Generic.getInfantCount(searchReq);
        let adultTaxPP = 0, childTaxPP = 0, infantTaxPP = 0;
        let adultSFeePP = 0, childSFeePP = 0, infantSFeePP = 0;
        let adultOChargePP = 0, childOChargePP = 0, infantOChargePP = 0;
        fareDetail.fareType = FareType || '';
        fareBreakDown.forEach((element) => {
            const passengerCount = element?.PassengerCount || 1;
            if (element.PassengerType === 1) {
                fareDetail.perPersonAdultFare = generic_utility_1.Generic.currencyConversion(element?.BaseFare / passengerCount, element.Currency, preferredCurrency) || 0;
                fareDetail.adultFare = fareDetail.perPersonAdultFare * adultCount;
                adultTaxPP = element?.Tax ? generic_utility_1.Generic.currencyConversion(element?.Tax / passengerCount, element.Currency, preferredCurrency) : 0;
                adultSFeePP = element?.ServiceFee ? generic_utility_1.Generic.currencyConversion(element?.ServiceFee / passengerCount, element.Currency, preferredCurrency) : 0;
                adultOChargePP = element?.OtherCharges ? generic_utility_1.Generic.currencyConversion(element?.OtherCharges / passengerCount, element.Currency, preferredCurrency) : 0;
            }
            else if (element.PassengerType === 2) {
                fareDetail.perPersonChildFare = childCount > 0 ? generic_utility_1.Generic.currencyConversion(element?.BaseFare / passengerCount, element.Currency, preferredCurrency) : 0;
                fareDetail.childFare = fareDetail.perPersonChildFare * childCount;
                childTaxPP = element?.Tax ? generic_utility_1.Generic.currencyConversion(element?.Tax / passengerCount, element.Currency, preferredCurrency) : 0;
                childSFeePP = element?.ServiceFee ? generic_utility_1.Generic.currencyConversion(element?.ServiceFee / passengerCount, element.Currency, preferredCurrency) : 0;
                childOChargePP = element?.OtherCharges ? generic_utility_1.Generic.currencyConversion(element?.OtherCharges / passengerCount, element.Currency, preferredCurrency) : 0;
            }
            else if (element.PassengerType === 3) {
                fareDetail.perPersonInfantFare = infantCount > 0 ? generic_utility_1.Generic.currencyConversion(element?.BaseFare / passengerCount, element.Currency, preferredCurrency) : 0;
                fareDetail.infantFare = fareDetail.perPersonInfantFare * infantCount;
                infantTaxPP = element?.Tax ? generic_utility_1.Generic.currencyConversion(element?.Tax / passengerCount, element.Currency, preferredCurrency) : 0;
                infantSFeePP = element?.ServiceFee ? generic_utility_1.Generic.currencyConversion(element?.ServiceFee / passengerCount, element.Currency, preferredCurrency) : 0;
                infantOChargePP = element?.OtherCharges ? generic_utility_1.Generic.currencyConversion(element?.OtherCharges / passengerCount, element.Currency, preferredCurrency) : 0;
            }
        });
        fareDetail.baseFare = (fareDetail.adultFare || 0) + (fareDetail.childFare || 0) + (fareDetail.infantFare || 0);
        fareDetail.tax = adultTaxPP * adultCount + childTaxPP * childCount + infantTaxPP * infantCount;
        fareDetail.serviceFee = adultSFeePP * adultCount + childSFeePP * childCount + infantSFeePP * infantCount;
        fareDetail.otherCharges = adultOChargePP * adultCount + childOChargePP * childCount + infantOChargePP * infantCount;
        fareDetail.searchBaseFare = fareDetail.perPersonAdultFare;
        fareDetail.searchTax = adultTaxPP + adultSFeePP + adultOChargePP;
        fareDetail.searchTotalFare = (fareDetail.searchBaseFare || 0) + fareDetail.searchTax;
        const totalFare = (fareDetail.baseFare || 0) + (fareDetail.serviceFee || 0) + (fareDetail.tax || 0) + (fareDetail.otherCharges || 0);
        fareDetail.totalFare = totalFare;
        fareDetail.perPersonFare = adultCount + childCount + infantCount > 0 ? Math.ceil(totalFare / (adultCount + childCount + infantCount)) : 0;
        fareDetail.currency = preferredCurrency;
        fareDetail.fareQuote = generic_utility_1.Generic.encrypt(JSON.stringify(passengerFareArr));
        return fareDetail;
    }
    settingUpSegments(segment) {
        const segmentDepartureInfo = new start_routing_interface_1.LocationInfo();
        const segmentArrivalInfo = new start_routing_interface_1.LocationInfo();
        const flightSegment = new start_routing_interface_1.Segment();
        flightSegment.intervalMinutes = 0;
        flightSegment.segmentId = segment.SegmentIndicator;
        flightSegment.airlineCode = segment.Airline.AirlineCode;
        flightSegment.airlineName = airline_utility_1.airlines[segment.Airline.AirlineCode] || segment.Airline;
        flightSegment.supplierFareClass = segment.SupplierFareClass,
            flightSegment.cabinClass = generic_utility_1.Generic.convertCabinClassCode('TBO', segment.CabinClass, false);
        flightSegment.flightNumber = segment?.Airline?.FlightNumber;
        flightSegment.noOfSeatAvailable = segment?.NoOfSeatAvailable;
        flightSegment.mealType = segment?.MealType || '';
        flightSegment.distance = segment?.Mile || '';
        flightSegment.craft = segment?.Craft || '';
        flightSegment.inFlightServices = segment?.InFlightServices || '';
        const cabinBaggage = new start_routing_interface_1.BaggageInfo();
        const checkInBaggage = new start_routing_interface_1.BaggageInfo();
        cabinBaggage.paxType = '';
        cabinBaggage.rule = segment?.CabinBaggage || '';
        cabinBaggage.size = '';
        cabinBaggage.flightNum = segment?.Airline?.FlightNumber;
        flightSegment.cabinBaggages = [cabinBaggage];
        checkInBaggage.paxType = '';
        checkInBaggage.rule = segment?.Baggage || '';
        checkInBaggage.size = '';
        checkInBaggage.flightNum = segment?.Airline?.FlightNumber;
        flightSegment.checkInBaggages = [checkInBaggage];
        segmentDepartureInfo.code = segment?.Origin?.Airport?.AirportCode;
        segmentDepartureInfo.name = airport_utility_1.airports[segmentDepartureInfo.code]?.name || segment?.Origin?.Airport?.AirportName;
        segmentDepartureInfo.country = airport_utility_1.airports[segmentDepartureInfo.code]?.country || segment?.Origin?.Airport?.CountryName;
        segmentDepartureInfo.countryCode = airport_utility_1.airports[segmentDepartureInfo.code]?.iso_country || segment?.Origin?.Airport?.CountryCode;
        segmentDepartureInfo.city = airport_utility_1.airports[segmentDepartureInfo.code]?.city || segment?.Origin?.Airport?.CityName;
        segmentDepartureInfo.cityCode = airport_utility_1.airports[segmentDepartureInfo.code]?.city_code || segment?.Origin?.Airport?.CityCode;
        segmentDepartureInfo.date = date_utility_1.DateUtility.convertDateIntoYMD(segment?.Origin?.DepTime);
        segmentDepartureInfo.time = date_utility_1.DateUtility.getTimeFromDateInHMA(segment?.Origin?.DepTime);
        segmentDepartureInfo.terminal = segment?.Origin?.Airport?.Terminal || '';
        segmentArrivalInfo.code = segment?.Destination?.Airport?.AirportCode;
        segmentArrivalInfo.name = airport_utility_1.airports[segmentArrivalInfo.code]?.name || segment?.Destination?.Airport?.AirportName;
        segmentArrivalInfo.country = airport_utility_1.airports[segmentArrivalInfo.code]?.country || segment?.Destination?.Airport?.CountryName;
        segmentArrivalInfo.countryCode = airport_utility_1.airports[segmentArrivalInfo.code]?.iso_country || segment?.Destination?.Airport?.CountryCode;
        segmentArrivalInfo.city = airport_utility_1.airports[segmentArrivalInfo.code]?.city || segment?.Destination?.Airport?.CityName;
        segmentArrivalInfo.cityCode = airport_utility_1.airports[segmentArrivalInfo.code]?.city_code || segment?.Destination?.Airport?.CityCode;
        segmentArrivalInfo.date = date_utility_1.DateUtility.convertDateIntoYMD(segment?.Destination?.ArrTime);
        segmentArrivalInfo.time = date_utility_1.DateUtility.getTimeFromDateInHMA(segment?.Destination?.ArrTime);
        segmentArrivalInfo.terminal = segment?.Destination?.Airport?.Terminal || '';
        const segmentDuration = segment.Duration;
        flightSegment.segmentDuration = date_utility_1.DateUtility.convertMinutesIntoHoursMinutes(segmentDuration);
        flightSegment.departure = [segmentDepartureInfo];
        flightSegment.arrival = [segmentArrivalInfo];
        flightSegment.segmentInterval = date_utility_1.DateUtility.convertMinutesIntoHoursMinutes(segment.GroundTime);
        flightSegment.intervalMinutes = segment.GroundTime;
        return flightSegment;
    }
    settingUpLocationInfo(flightSegment) {
        const departureInfo = new start_routing_interface_1.LocationInfo();
        const arrivalInfo = new start_routing_interface_1.LocationInfo();
        departureInfo.code = flightSegment[0].departure[0].code;
        departureInfo.city = airport_utility_1.airports[departureInfo.code]?.city || '';
        departureInfo.cityCode = airport_utility_1.airports[departureInfo.code]?.city_code || '';
        departureInfo.country = airport_utility_1.airports[departureInfo.code]?.country || '';
        departureInfo.countryCode = airport_utility_1.airports[departureInfo.code]?.iso_country || '';
        departureInfo.name = airport_utility_1.airports[departureInfo.code]?.name || '';
        departureInfo.date = flightSegment[0].departure[0].date;
        departureInfo.time = flightSegment[0].departure[0].time;
        departureInfo.terminal = flightSegment[0].departure[0]?.terminal || '';
        arrivalInfo.code = flightSegment[flightSegment.length - 1].arrival[0].code;
        arrivalInfo.city = airport_utility_1.airports[arrivalInfo.code]?.city || '';
        arrivalInfo.cityCode = airport_utility_1.airports[arrivalInfo.code]?.city_code || '';
        arrivalInfo.country = airport_utility_1.airports[arrivalInfo.code]?.country || '';
        arrivalInfo.countryCode = airport_utility_1.airports[arrivalInfo.code]?.iso_country || '';
        arrivalInfo.name = airport_utility_1.airports[arrivalInfo.code]?.name || '';
        arrivalInfo.date = flightSegment[flightSegment.length - 1].arrival[0].date;
        arrivalInfo.time = flightSegment[flightSegment.length - 1].arrival[0].time;
        arrivalInfo.terminal = flightSegment[flightSegment.length - 1].arrival[0]?.terminal || '';
        const locationInfo = [];
        locationInfo['departureInfo'] = departureInfo;
        locationInfo['arrivalInfo'] = arrivalInfo;
        return locationInfo;
    }
};
exports.TboSearchService = TboSearchService;
exports.TboSearchService = TboSearchService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tbo_auth_token_service_1.TboAuthTokenService,
        generic_repo_utility_1.GenericRepo])
], TboSearchService);
//# sourceMappingURL=tbo-search.service.js.map