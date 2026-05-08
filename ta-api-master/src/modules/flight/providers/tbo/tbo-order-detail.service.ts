import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { GenericRepo } from 'src/shared/utilities/flight/generic-repo.utility';
import { s3BucketService } from 'src/shared/utilities/flight/s3bucket.utility';
import { TboAuthTokenService } from './tbo-auth-token.service';
import { OrderDetailPassenger, OrderDetailResponse, OrderRoutes } from '../../order-details/interfaces/order-detail.interface';
import { BookingStatus } from 'src/shared/enums/flight/booking.enum';
import { Http } from 'src/shared/utilities/flight/http.utility';
import moment from 'moment';
import { BaggageInfo, LocationInfo, Segment } from '../../search/interfaces/start-routing.interface';
import { airlines } from 'src/shared/utilities/flight/airline.utility';
import { Generic } from 'src/shared/utilities/flight/generic.utility';
import { airports } from 'src/shared/utilities/flight/airport.utility';
import { SupplierLogUtility } from 'src/shared/utilities/flight/supplier-log.utility';
import { RevalidateResponseEntity } from 'src/shared/entities/revalidate-response.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class TboOrderDetailService {
    logDate = Date.now();

    constructor(
        private readonly tboAuthTokenService: TboAuthTokenService,
        private readonly genericRepo: GenericRepo,
        private readonly s3Service: s3BucketService,
        private readonly supplierLogUtility: SupplierLogUtility,
        @InjectRepository(RevalidateResponseEntity) private revalidateRepo: Repository<RevalidateResponseEntity>,
    ) {}

    /** [@Description: This method is used to get the order details]
     * @author: Prashant Joshi at 13-10-2025 **/
    async getOrderDetails(orderRequest): Promise<{ orderDetails: OrderDetailResponse[]; supplierOrderDetailResponse: any[] }> {
        const { orderReq, providerCred, bookReq, headers } = orderRequest;
        Object.assign(orderRequest, { tokenReqData: orderReq, searchReqId: orderReq.searchReqId, bookReq: bookReq });
        try {
            const authToken = await this.tboAuthTokenService.getAuthToken(orderRequest);
             // dev endpoint
            const endpoint = `${providerCred.url}BookingEngineService_Air/AirService.svc/rest/GetBookingDetails`;

            // prod endpoint
            // const endpoint = `${providerCred.book_url}/rest/GetBookingDetails`;
            const supplierOrderDetailResponse: any[] = [];
            const result: OrderDetailResponse[] = [];
            // let storedLog;
            const bookingDetails = Array.isArray(orderReq?.bookingDetails) ? orderReq.bookingDetails : [orderReq?.bookingDetails];
            //call supplier get order details apis for multiple bookings (2)
            for (let i = 0; i < bookingDetails.length; i++) {
                const bookRes = bookingDetails[i];
                let convertRes: OrderDetailResponse = new OrderDetailResponse();

                //Skip this iteration if orderStatus is 'Failed'
                if (bookRes?.orderStatus === BookingStatus.FAILED) {
                    //convert response into proper format
                    convertRes = await this.convertResponse(bookRes, orderRequest);
                } else {
                    const requestBody = {
                        TokenId: authToken,
                        PNR: bookRes?.pnr,
                        bookingId: bookRes?.orderNo,
                        EndUserIp: headers['ip-address'],
                        FirstName: bookReq?.passengers[0]?.passengerDetail?.firstName || bookRes?.firstName,
                        LastName: bookReq?.passengers[0]?.passengerDetail?.lastName || bookRes?.lastName,
                    };
                    console.log('requestBody', requestBody);
                    const requestResult = await Http.httpRequestTBO('POST', endpoint, JSON.stringify(requestBody));
                    supplierOrderDetailResponse.push(requestResult);
                    console.log('requestResult', requestResult);
                    /* Logging the data */
                    const logs = { supplierRequest: requestBody, supplierResponse: requestResult, ApiRequest: orderReq, ApiResponse: convertRes };
                    // await this.supplierLogs.addSupplierLogs(orderReq.searchReqId, logs, 'TBO', 'orderDetail');
                    // await this.s3Service.generateS3LogFile(orderReq.searchReqId + '-' + i + '-' + this.logDate + '-TBO-orderDetail', logs, 'orderDetail');
                    await this.supplierLogUtility.generateLogFile({
                        fileName: orderReq.searchReqId + '-' + i + '-' + this.logDate + '-TBO-orderDetail',
                        logData: logs,
                        folderName: 'orderDetail',
                        logId: null,
                        title: 'OrderDetail-TBO',
                        searchReqId: orderReq.searchReqId,
                        bookingReferenceId: null,
                    });
                    //convert response into proper format
                    convertRes = await this.convertResponse(requestResult, orderRequest);
                }
                result.push(convertRes);
            }

            return { orderDetails: result, supplierOrderDetailResponse: supplierOrderDetailResponse };
        } catch (error) {
            this.genericRepo.storeLogs(orderReq.searchReqId, 1, error, 0);
            const errorLog = {};
            Object.assign(errorLog, { error: error.stack });
            const logs = { ApiRequest: orderReq, TypeError: errorLog };
            // await this.s3Service.generateS3LogFile(orderReq.searchReqId + '-' + this.logDate + '-TBO-orderDetail-error', logs, 'orderDetail');
            console.log('ORDER REQUEST SERVICE _ HANDLE error -', error);
            throw new InternalServerErrorException(`ERR_ISSUE_IN_FETCHING_DATA_FROM_PROVIDER`);
        }
    }

    /** [@Description: This method is used to convert the response]
     * @author: Prashant Joshi at 13-10-2025 **/
    async convertResponse(tripResult, orderRequest): Promise<OrderDetailResponse> {
        const { orderReq, redisData } = orderRequest;
        const orderResponse: OrderDetailResponse = new OrderDetailResponse();
        const passengerArray: OrderDetailPassenger[] = [];
        try {
            /* Check for the response error first */
            if (tripResult?.Response?.ResponseStatus == 1) {
                /*Creating passenger array*/
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
                        dateOfBirth: moment(element?.DateOfBirth).format('YYYY-MM-DD'),
                        document: {
                            documentType: 'P',
                            documentNumber: element?.PassportNo,
                            country: element?.countryCode,
                        },
                        nationality: element?.CountryCode,
                        mobile: element?.ContactNo,
                        mobileCountryCode: element?.Mobile1CountryCode || '',
                    });

                    /* Creating ticket number */
                    if (element?.Ticket?.TicketNumber) {
                        ticketNumString += ticketNumString == '' ? element?.Ticket?.TicketNumber : ' | ' + element?.Ticket?.TicketNumber;
                    }

                    /* Creating ticket id */
                    if (element?.Ticket?.TicketId) {
                        ticketIdString = element?.Ticket?.TicketId || '';
                    }
                });

                const flightJourney = tripResult?.Response?.FlightItinerary;
                const flightRoute: OrderRoutes = new OrderRoutes();
                flightRoute.separateRoute = [];
                const flightSegments: Segment[][] = [];
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

                /* Setting up the prices + supplier net amount */
                flightRoute.fare = redisData?.data?.route?.fare || [{ bsFare: 0 }];
                if (!redisData) {
                    /* Get from revalidate table */
                    const revalidateData = await this.revalidateRepo.findOne({ where: { solution_id: orderReq.searchReqId } });
                    if (revalidateData) {
                        const res = JSON.parse(revalidateData.response);
                        const fareBreakDown = res.Response.Results?.FareBreakdown;
                        flightRoute.fare = fareBreakDown || [{ bsFare: 0 }];
                    }
                }
                //for domestic roundtrip add supplier fare details
                /* if (index === 2 && flightRoute.fare?.length > 1) {
                    flightRoute.fare[1]['bsFare'] = flightJourney?.Fare?.BaseFare;
                    flightRoute.fare[1]['bsTax'] = flightJourney?.Fare?.Tax;
                    flightRoute.fare[1]['bsPublish'] = flightJourney?.Fare?.PublishedFare;
                } else { */

                flightRoute.fare[0]['bsFare'] = flightJourney?.Fare?.BaseFare;
                flightRoute.fare[0]['fareType'] = flightJourney?.FareType;
                flightRoute.fare[0]['currency'] = flightJourney?.Fare?.Currency;
                flightRoute.fare[0]['bsPublish'] = flightJourney?.Fare?.PublishedFare;

                /* Creating the routes */
                const separatedData = this.separateBySegmentIndicator(flightJourney.Segments);

                separatedData.forEach((segmentArray: any) => {
                    let airlineCode: string = '';
                    let totalDuration = 0;
                    let totalInterval: number = 0;
                    segments = [];

                    segmentArray.forEach((segment) => {
                        airlineCode = segment.Airline.AirlineCode;

                        /* Creating a time duration */
                        totalDuration += segment.Duration;

                        /* Creating Flight Segments */
                        const fSegment = this.settingUpSegments(segment);
                        segments.push(fSegment);

                        /* Adding Interval */
                        totalInterval += fSegment.intervalMinutes;
                    });

                    airlineCodes.push(airlineCode);
                    airlineNames.push(airlines('')[airlineCode] || airlineCode);
                    totalIntervals.push(Generic.convertMinutesToHours(totalInterval));
                    totalDurations.push(Generic.convertMinutesToHours(totalDuration + totalInterval));
                    flightSegments.push(segments);
                    flightStops.push(segments.length - 1);

                    const locationInfo = this.settingUpLocationInfo(segments);

                    /* Setting Departure and Arrival locations */
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

                /* Setting up booking status */
                orderResponse.bookingStatus = BookingStatus.PENDING;
                const status = tripResult?.Response?.FlightItinerary.Status || tripResult?.Response?.Response?.TicketStatus;
                if (status === 1 || status === 2 || status === 5) {
                    orderResponse.bookingStatus = BookingStatus.CONFIRMED;
                }

                orderResponse.error = false;
                orderResponse.message = 'Order details fetched.';
                orderResponse.searchReqId = orderReq.searchReqId;
                orderResponse.mode = 'TBO-' + orderRequest.providerCred.mode;
            } else {
                const message = tripResult?.Response?.Error?.ErrorMessage || 'Order details not found.';
                orderResponse.bookingStatus = BookingStatus.FAILED;
                Object.assign(orderResponse, {
                    success: false,
                    message: message,
                    data: [],
                    searchReqId: orderReq.searchReqId,
                    mode: 'TBO-' + orderRequest.providerCred.mode,
                });
            }

            return orderResponse;
        } catch (error) {
            this.genericRepo.storeLogs(orderReq.searchReqId, 1, error, 0);
            throw new InternalServerErrorException(`ERR_ISSUE_IN_FETCHING_DATA_FROM_PROVIDER`);
        }
    }

    /** [@Description: This method is used to separate the segments by segment indicator]
     * @author: Prashant Joshi at 13-10-2025 **/
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

    /** [@Description: This method is used to set up the segments]
     * @author: Prashant Joshi at 13-10-2025 **/
    settingUpSegments(segment) {
        const segmentDepartureInfo: LocationInfo = new LocationInfo();
        const segmentArrivalInfo: LocationInfo = new LocationInfo();
        const flightSegment: Segment = new Segment();
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

        /* Setting up Baggages */
        const cabinBaggage: BaggageInfo = new BaggageInfo();
        const checkInBaggage: BaggageInfo = new BaggageInfo();

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

        /* Segment Departure info */

        segmentDepartureInfo.code = segment?.Origin?.Airport?.AirportCode;
        segmentDepartureInfo.name = airports[segmentDepartureInfo.code]?.name || segment?.Origin?.Airport?.AirportName;
        segmentDepartureInfo.country = airports[segmentDepartureInfo.code]?.country || segment?.Origin?.Airport?.CountryName;
        segmentDepartureInfo.countryCode = airports[segmentDepartureInfo.code]?.iso_country || segment?.Origin?.Airport?.CountryCode;
        segmentDepartureInfo.city = airports[segmentDepartureInfo.code]?.city || segment?.Origin?.Airport?.CityName;
        segmentDepartureInfo.cityCode = airports[segmentDepartureInfo.code]?.city_code || segment?.Origin?.Airport?.CityCode;
        segmentDepartureInfo.date = moment(segment?.Origin?.DepTime).format('YYYY-MM-DD');
        segmentDepartureInfo.time = moment(segment?.Origin?.DepTime).format('hh:mm A');
        segmentDepartureInfo.terminal = segment?.Origin?.Airport?.Terminal || '';

        /* Segment Arrival Info */
        segmentArrivalInfo.code = segment?.Destination?.Airport?.AirportCode;
        segmentArrivalInfo.name = airports[segmentArrivalInfo.code]?.name || segment?.Destination?.Airport?.AirportName;
        segmentArrivalInfo.country = airports[segmentArrivalInfo.code]?.country || segment?.Destination?.Airport?.CountryName;
        segmentArrivalInfo.countryCode = airports[segmentArrivalInfo.code]?.iso_country || segment?.Destination?.Airport?.CountryCode;
        segmentArrivalInfo.city = airports[segmentArrivalInfo.code]?.city || segment?.Destination?.Airport?.CityName;
        segmentArrivalInfo.cityCode = airports[segmentArrivalInfo.code]?.city_code || segment?.Destination?.Airport?.CityCode;
        segmentArrivalInfo.date = moment(segment?.Destination?.ArrTime).format('YYYY-MM-DD');
        segmentArrivalInfo.time = moment(segment?.Destination?.ArrTime).format('hh:mm A');
        segmentArrivalInfo.terminal = segment?.Destination?.Airport?.Terminal || '';

        /* Creating segment duration */
        const segmentDuration = segment.Duration;

        flightSegment.segmentDuration = Generic.convertTimeString(segmentDuration);
        flightSegment.departure = [segmentDepartureInfo];
        flightSegment.arrival = [segmentArrivalInfo];
        flightSegment.segmentInterval = Generic.convertTimeString(segment.GroundTime);
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
        departureInfo.city = airports[departureInfo.code]?.city || '';
        departureInfo.cityCode = airports[departureInfo.code]?.city_code || '';
        departureInfo.country = airports[departureInfo.code]?.country || '';
        departureInfo.countryCode = airports[departureInfo.code]?.iso_country || '';
        departureInfo.name = airports[departureInfo.code]?.name || '';
        departureInfo.date = flightSegment[0].departure[0].date;
        departureInfo.time = flightSegment[0].departure[0].time;
        departureInfo.terminal = flightSegment[0].departure[0]?.terminal || '';

        /* Setting Arrival Location */
        arrivalInfo.code = flightSegment[flightSegment.length - 1].arrival[0].code;
        arrivalInfo.city = airports[arrivalInfo.code]?.city || '';
        arrivalInfo.cityCode = airports[arrivalInfo.code]?.city_code || '';
        arrivalInfo.country = airports[arrivalInfo.code]?.country || '';
        arrivalInfo.countryCode = airports[arrivalInfo.code]?.iso_country || '';
        arrivalInfo.name = airports[arrivalInfo.code]?.name || '';
        arrivalInfo.date = flightSegment[flightSegment.length - 1].arrival[0].date;
        arrivalInfo.time = flightSegment[flightSegment.length - 1].arrival[0].time;
        arrivalInfo.terminal = flightSegment[flightSegment.length - 1].arrival[0]?.terminal || '';

        const locationInfo = [];
        locationInfo['departureInfo'] = departureInfo;
        locationInfo['arrivalInfo'] = arrivalInfo;

        return locationInfo;
    }
}
