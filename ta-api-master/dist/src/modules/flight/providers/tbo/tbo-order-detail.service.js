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
exports.TboOrderDetailService = void 0;
const common_1 = require("@nestjs/common");
const generic_repo_utility_1 = require("../../../../shared/utilities/flight/generic-repo.utility");
const s3bucket_utility_1 = require("../../../../shared/utilities/flight/s3bucket.utility");
const tbo_auth_token_service_1 = require("./tbo-auth-token.service");
const order_detail_interface_1 = require("../../order-details/interfaces/order-detail.interface");
const booking_enum_1 = require("../../../../shared/enums/flight/booking.enum");
const http_utility_1 = require("../../../../shared/utilities/flight/http.utility");
const moment_1 = __importDefault(require("moment"));
const start_routing_interface_1 = require("../../search/interfaces/start-routing.interface");
const airline_utility_1 = require("../../../../shared/utilities/flight/airline.utility");
const generic_utility_1 = require("../../../../shared/utilities/flight/generic.utility");
const airport_utility_1 = require("../../../../shared/utilities/flight/airport.utility");
const supplier_log_utility_1 = require("../../../../shared/utilities/flight/supplier-log.utility");
const revalidate_response_entity_1 = require("../../../../shared/entities/revalidate-response.entity");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let TboOrderDetailService = class TboOrderDetailService {
    tboAuthTokenService;
    genericRepo;
    s3Service;
    supplierLogUtility;
    revalidateRepo;
    logDate = Date.now();
    constructor(tboAuthTokenService, genericRepo, s3Service, supplierLogUtility, revalidateRepo) {
        this.tboAuthTokenService = tboAuthTokenService;
        this.genericRepo = genericRepo;
        this.s3Service = s3Service;
        this.supplierLogUtility = supplierLogUtility;
        this.revalidateRepo = revalidateRepo;
    }
    async getOrderDetails(orderRequest) {
        const { orderReq, providerCred, bookReq, headers } = orderRequest;
        Object.assign(orderRequest, { tokenReqData: orderReq, searchReqId: orderReq.searchReqId, bookReq: bookReq });
        try {
            const authToken = await this.tboAuthTokenService.getAuthToken(orderRequest);
            const endpoint = `${providerCred.book_url}/rest/GetBookingDetails`;
            const supplierOrderDetailResponse = [];
            const result = [];
            const bookingDetails = Array.isArray(orderReq?.bookingDetails) ? orderReq.bookingDetails : [orderReq?.bookingDetails];
            for (let i = 0; i < bookingDetails.length; i++) {
                const bookRes = bookingDetails[i];
                let convertRes = new order_detail_interface_1.OrderDetailResponse();
                if (bookRes?.orderStatus === booking_enum_1.BookingStatus.FAILED) {
                    convertRes = await this.convertResponse(bookRes, orderRequest);
                }
                else {
                    const requestBody = {
                        TokenId: authToken,
                        PNR: bookRes?.pnr,
                        bookingId: bookRes?.orderNo,
                        EndUserIp: headers['ip-address'],
                        FirstName: bookReq?.passengers[0]?.passengerDetail?.firstName || bookRes?.firstName,
                        LastName: bookReq?.passengers[0]?.passengerDetail?.lastName || bookRes?.lastName,
                    };
                    console.log('requestBody', requestBody);
                    const requestResult = await http_utility_1.Http.httpRequestTBO('POST', endpoint, JSON.stringify(requestBody));
                    supplierOrderDetailResponse.push(requestResult);
                    console.log('requestResult', requestResult);
                    const logs = { supplierRequest: requestBody, supplierResponse: requestResult, ApiRequest: orderReq, ApiResponse: convertRes };
                    await this.supplierLogUtility.generateLogFile({
                        fileName: orderReq.searchReqId + '-' + i + '-' + this.logDate + '-TBO-orderDetail',
                        logData: logs,
                        folderName: 'orderDetail',
                        logId: null,
                        title: 'OrderDetail-TBO',
                        searchReqId: orderReq.searchReqId,
                        bookingReferenceId: null,
                    });
                    convertRes = await this.convertResponse(requestResult, orderRequest);
                }
                result.push(convertRes);
            }
            return { orderDetails: result, supplierOrderDetailResponse: supplierOrderDetailResponse };
        }
        catch (error) {
            this.genericRepo.storeLogs(orderReq.searchReqId, 1, error, 0);
            const errorLog = {};
            Object.assign(errorLog, { error: error.stack });
            const logs = { ApiRequest: orderReq, TypeError: errorLog };
            console.log('ORDER REQUEST SERVICE _ HANDLE error -', error);
            throw new common_1.InternalServerErrorException(`ERR_ISSUE_IN_FETCHING_DATA_FROM_PROVIDER`);
        }
    }
    async convertResponse(tripResult, orderRequest) {
        const { orderReq, redisData } = orderRequest;
        const orderResponse = new order_detail_interface_1.OrderDetailResponse();
        const passengerArray = [];
        try {
            if (tripResult?.Response?.ResponseStatus == 1) {
                let ticketNumString = '';
                let ticketIdString = '';
                tripResult?.Response?.FlightItinerary?.Passenger.forEach((element) => {
                    passengerArray.push({
                        passengerType: element?.PaxType === 1 ? 'ADT' : element?.PaxType === 2 ? 'CHD' : 'INF',
                        gender: element?.Gender === 1 ? 'M' : 'F',
                        passengerDetail: {
                            firstName: element?.FirstName,
                            lastName: element?.LastName,
                            title: element?.Title,
                        },
                        ticketId: element?.Ticket?.TicketId || '',
                        dateOfBirth: (0, moment_1.default)(element?.DateOfBirth).format('YYYY-MM-DD'),
                        document: {
                            documentType: 'P',
                            documentNumber: element?.PassportNo,
                            country: element?.countryCode,
                        },
                        nationality: element?.CountryCode,
                        mobile: element?.ContactNo,
                        mobileCountryCode: element?.Mobile1CountryCode || '',
                    });
                    if (element?.Ticket?.TicketNumber) {
                        ticketNumString += ticketNumString == '' ? element?.Ticket?.TicketNumber : ' | ' + element?.Ticket?.TicketNumber;
                    }
                    if (element?.Ticket?.TicketId) {
                        ticketIdString = element?.Ticket?.TicketId || '';
                    }
                });
                const flightJourney = tripResult?.Response?.FlightItinerary;
                const flightRoute = new order_detail_interface_1.OrderRoutes();
                flightRoute.separateRoute = [];
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
                flightRoute.fare = redisData?.data?.route?.fare || [{ bsFare: 0 }];
                if (!redisData) {
                    const revalidateData = await this.revalidateRepo.findOne({ where: { solution_id: orderReq.searchReqId } });
                    if (revalidateData) {
                        const res = JSON.parse(revalidateData.response);
                        const fareBreakDown = res.Response.Results?.FareBreakdown;
                        flightRoute.fare = fareBreakDown || [{ bsFare: 0 }];
                    }
                }
                flightRoute.fare[0]['bsFare'] = flightJourney?.Fare?.BaseFare;
                flightRoute.fare[0]['fareType'] = flightJourney?.FareType;
                flightRoute.fare[0]['currency'] = flightJourney?.Fare?.Currency;
                flightRoute.fare[0]['bsPublish'] = flightJourney?.Fare?.PublishedFare;
                const separatedData = this.separateBySegmentIndicator(flightJourney.Segments);
                separatedData.forEach((segmentArray) => {
                    let airlineCode = '';
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
                    airlineNames.push((0, airline_utility_1.airlines)('')[airlineCode] || airlineCode);
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
                flightRoute.isRefundable = !flightJourney?.NonRefundable || false;
                flightRoute.airlineCode = airlineCodes;
                flightRoute.airlineName = airlineNames;
                flightRoute.flightStops = flightStops;
                flightRoute.totalDuration = totalDurations;
                flightRoute.totalInterval = totalIntervals;
                flightRoute.departureInfo = departureInfos;
                flightRoute.arrivalInfo = arrivalInfos;
                flightRoute.flightSegments = flightSegments.flat();
                orderResponse.routes = flightRoute;
                orderResponse.bookingRefNumber = tripResult?.TokenId;
                orderResponse.pnr = flightJourney.PNR || '';
                orderResponse.ticketNumber = ticketNumString || '';
                orderResponse.ticketId = ticketIdString || '';
                orderResponse.bookingId = flightJourney?.BookingId || '';
                orderResponse.passengers = passengerArray;
                orderResponse.bookingStatus = booking_enum_1.BookingStatus.PENDING;
                const status = tripResult?.Response?.FlightItinerary.Status || tripResult?.Response?.Response?.TicketStatus;
                if (status === 1 || status === 2 || status === 5) {
                    orderResponse.bookingStatus = booking_enum_1.BookingStatus.CONFIRMED;
                }
                orderResponse.error = false;
                orderResponse.message = 'Order details fetched.';
                orderResponse.searchReqId = orderReq.searchReqId;
                orderResponse.mode = 'TBO-' + orderRequest.providerCred.mode;
            }
            else {
                const message = tripResult?.Response?.Error?.ErrorMessage || 'Order details not found.';
                orderResponse.bookingStatus = booking_enum_1.BookingStatus.FAILED;
                Object.assign(orderResponse, {
                    success: false,
                    message: message,
                    data: [],
                    searchReqId: orderReq.searchReqId,
                    mode: 'TBO-' + orderRequest.providerCred.mode,
                });
            }
            return orderResponse;
        }
        catch (error) {
            this.genericRepo.storeLogs(orderReq.searchReqId, 1, error, 0);
            throw new common_1.InternalServerErrorException(`ERR_ISSUE_IN_FETCHING_DATA_FROM_PROVIDER`);
        }
    }
    separateBySegmentIndicator(data) {
        const segmentMap = {};
        data.forEach((segment) => {
            const { TripIndicator, ...rest } = segment;
            if (!segmentMap[TripIndicator]) {
                segmentMap[TripIndicator] = [];
            }
            segmentMap[TripIndicator].push(rest);
        });
        return Object.values(segmentMap);
    }
    settingUpSegments(segment) {
        const segmentDepartureInfo = new start_routing_interface_1.LocationInfo();
        const segmentArrivalInfo = new start_routing_interface_1.LocationInfo();
        const flightSegment = new start_routing_interface_1.Segment();
        flightSegment.intervalMinutes = 0;
        flightSegment.segmentId = segment.SegmentIndicator;
        flightSegment.airlineCode = segment.Airline.AirlineCode;
        flightSegment.airlineName = segment.Airline;
        flightSegment.cabinClass = segment.CabinClass;
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
        segmentDepartureInfo.date = (0, moment_1.default)(segment?.Origin?.DepTime).format('YYYY-MM-DD');
        segmentDepartureInfo.time = (0, moment_1.default)(segment?.Origin?.DepTime).format('hh:mm A');
        segmentDepartureInfo.terminal = segment?.Origin?.Airport?.Terminal || '';
        segmentArrivalInfo.code = segment?.Destination?.Airport?.AirportCode;
        segmentArrivalInfo.name = airport_utility_1.airports[segmentArrivalInfo.code]?.name || segment?.Destination?.Airport?.AirportName;
        segmentArrivalInfo.country = airport_utility_1.airports[segmentArrivalInfo.code]?.country || segment?.Destination?.Airport?.CountryName;
        segmentArrivalInfo.countryCode = airport_utility_1.airports[segmentArrivalInfo.code]?.iso_country || segment?.Destination?.Airport?.CountryCode;
        segmentArrivalInfo.city = airport_utility_1.airports[segmentArrivalInfo.code]?.city || segment?.Destination?.Airport?.CityName;
        segmentArrivalInfo.cityCode = airport_utility_1.airports[segmentArrivalInfo.code]?.city_code || segment?.Destination?.Airport?.CityCode;
        segmentArrivalInfo.date = (0, moment_1.default)(segment?.Destination?.ArrTime).format('YYYY-MM-DD');
        segmentArrivalInfo.time = (0, moment_1.default)(segment?.Destination?.ArrTime).format('hh:mm A');
        segmentArrivalInfo.terminal = segment?.Destination?.Airport?.Terminal || '';
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
exports.TboOrderDetailService = TboOrderDetailService;
exports.TboOrderDetailService = TboOrderDetailService = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, typeorm_1.InjectRepository)(revalidate_response_entity_1.RevalidateResponseEntity)),
    __metadata("design:paramtypes", [tbo_auth_token_service_1.TboAuthTokenService,
        generic_repo_utility_1.GenericRepo,
        s3bucket_utility_1.s3BucketService,
        supplier_log_utility_1.SupplierLogUtility,
        typeorm_2.Repository])
], TboOrderDetailService);
//# sourceMappingURL=tbo-order-detail.service.js.map