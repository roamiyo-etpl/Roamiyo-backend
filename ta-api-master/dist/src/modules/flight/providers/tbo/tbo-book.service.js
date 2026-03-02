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
exports.TboBookService = void 0;
const common_1 = require("@nestjs/common");
const book_interface_1 = require("../../book/interfaces/book.interface");
const tbo_auth_token_service_1 = require("./tbo-auth-token.service");
const flight_enum_1 = require("../../../../shared/enums/flight/flight.enum");
const booking_enum_1 = require("../../../../shared/enums/flight/booking.enum");
const generic_repo_utility_1 = require("../../../../shared/utilities/flight/generic-repo.utility");
const http_utility_1 = require("../../../../shared/utilities/flight/http.utility");
const moment_1 = __importDefault(require("moment"));
const revalidate_response_entity_1 = require("../../../../shared/entities/revalidate-response.entity");
const typeorm_1 = require("typeorm");
const typeorm_2 = require("@nestjs/typeorm");
const order_detail_interface_1 = require("../../order-details/interfaces/order-detail.interface");
const supplier_log_utility_1 = require("../../../../shared/utilities/flight/supplier-log.utility");
let TboBookService = class TboBookService {
    tboAuthTokenService;
    genericRepo;
    revalidateRepo;
    supplierLogUtility;
    logDate = Date.now();
    constructor(tboAuthTokenService, genericRepo, revalidateRepo, supplierLogUtility) {
        this.tboAuthTokenService = tboAuthTokenService;
        this.genericRepo = genericRepo;
        this.revalidateRepo = revalidateRepo;
        this.supplierLogUtility = supplierLogUtility;
    }
    async book(bookRequest) {
        const { bookReq } = bookRequest;
        const bookResponse = new book_interface_1.BookResponse();
        Object.assign(bookRequest, { tokenReqData: bookReq, searchReqId: bookReq.searchReqId });
        const collectedLogs = [];
        const addLogEntry = (entry) => {
            collectedLogs.push({
                apiRequest: bookRequest.bookReq,
                ...entry,
            });
        };
        const flushLogs = async (response) => {
            for (const { index, title, fileSuffix, supplierRequest, supplierResponse, apiRequest } of collectedLogs) {
                const logs = {
                    ApiRequest: apiRequest ?? bookRequest.bookReq,
                    ApiResponse: response,
                    supplierRequest,
                    supplierResponse,
                };
                await this.supplierLogUtility.generateLogFile({
                    fileName: `${bookRequest.searchReqId}-${index}-${this.logDate}${fileSuffix}`,
                    logData: logs,
                    folderName: 'book',
                    logId: bookRequest.logId,
                    title,
                    searchReqId: bookReq.searchReqId,
                    bookingReferenceId: null,
                });
            }
        };
        const finalizeAndReturn = async (response) => {
            await flushLogs(response);
            return response;
        };
        try {
            const handleAuthenticationFailure = (...messages) => {
                const supplierMessage = messages.filter(Boolean).join(' ') || 'Authentication failed';
                const bookResponse = {
                    error: true,
                    message: 'There is no flight available.',
                    supplierMessage,
                    searchReqId: bookReq.searchReqId,
                    orderDetail: [],
                    orderDetails: new order_detail_interface_1.OrderDetailResponse(),
                    mode: 'TBO-' + bookRequest.providerCred.mode,
                };
                addLogEntry({
                    index: 0,
                    title: 'Book-TBO',
                    fileSuffix: 'book-TBO',
                    supplierRequest: null,
                    supplierResponse: { supplierMessage },
                    apiRequest: bookRequest.bookReq,
                });
                return bookResponse;
            };
            const authToken = await this.tboAuthTokenService.getAuthToken(bookRequest);
            if (authToken === '' || bookRequest?.redisData?.data?.length === 0) {
                const failureResponse = handleAuthenticationFailure('Authentication failed');
                return finalizeAndReturn(failureResponse);
            }
            let result;
            if (bookReq.airTripType.toLowerCase() === flight_enum_1.TripType.ROUNDTRIP && bookReq.solutionId?.includes('|||')) {
                console.log('ROUND TRIP');
                result = await this.createMultipleBook({ bookRequest, handleAuthenticationFailure, logCollector: addLogEntry });
            }
            else {
                console.log('ONE WAY');
                result = await this.createSingleBook({ bookRequest, index: 0, handleAuthenticationFailure, logCollector: addLogEntry });
            }
            let oneOrderSuccess = false;
            let message = '';
            let supplierMessage = '';
            bookResponse.orderDetail = [];
            const rawSupplierResponses = [];
            if (Array.isArray(result)) {
                for (const data of result) {
                    const order = new book_interface_1.Order();
                    rawSupplierResponses.push({
                        request: data?.requestBodyTicketing,
                        response: data?.ticketingResult,
                    });
                    if (data?.ticketingResult?.Response?.ResponseStatus === 1) {
                        order.orderNo = data.ticketingResult.Response?.Response?.BookingId;
                        order.supplierBaseAmount = data.ticketingResult.Response?.Response?.FlightItinerary?.Fare?.PublishedFare || 0;
                        order.orderStatus = booking_enum_1.BookingStatus.CONFIRMED;
                        order.pnr = data.ticketingResult?.Response?.Response.PNR || '';
                        oneOrderSuccess = true;
                    }
                    else {
                        order.orderStatus = booking_enum_1.BookingStatus.FAILED;
                        message = data.ticketingResult?.Errors?.[0]?.UserMessage;
                        supplierMessage = data.ticketingResult?.Response?.Error?.ErrorMessage;
                    }
                    bookResponse.orderDetail.push(order);
                }
            }
            bookResponse.rawSupplierResponse = rawSupplierResponses;
            if (oneOrderSuccess) {
                bookResponse.error = false;
                bookResponse.message = 'Booking successful.';
                bookResponse.searchReqId = bookReq.searchReqId;
                bookResponse.mode = 'TBO-' + bookRequest.providerCred.mode;
            }
            else {
                Object.assign(bookResponse, {
                    error: true,
                    message: message || 'This flight is not available.',
                    searchReqId: bookReq.searchReqId,
                    supplierMessage: supplierMessage,
                    mode: 'TBO-' + bookRequest.providerCred.mode,
                });
            }
            return finalizeAndReturn(bookResponse);
        }
        catch (error) {
            console.log('BOOKING ERROR', error);
            const errorLog = {};
            Object.assign(errorLog, { error: error.stack });
            const logs = { ApiRequest: bookRequest.bookReq, TypeError: errorLog };
            this.genericRepo.storeLogs(bookReq.searchReqId, 1, error, 0);
            const failureResponse = new book_interface_1.BookResponse();
            Object.assign(failureResponse, {
                error: true,
                message: 'ERR_ISSUE_IN_FETCHING_DATA_FROM_PROVIDER',
                searchReqId: bookReq.searchReqId,
                supplierMessage: error?.message,
                mode: 'TBO-' + bookRequest.providerCred.mode,
                orderDetail: [],
            });
            await flushLogs(failureResponse);
            throw new common_1.InternalServerErrorException(`ERR_ISSUE_IN_FETCHING_DATA_FROM_PROVIDER`);
        }
    }
    async createSingleBook(reqParams) {
        const { bookRequest, index = 0, handleAuthenticationFailure, logCollector, } = reqParams;
        const { providerCred } = bookRequest;
        const { bookReq } = bookRequest;
        const bookResponse = new book_interface_1.BookResponse();
        const order = new book_interface_1.Order();
        const solutionId = bookReq.solutionId;
        console.log('Looking for revalidate with solution_id:', solutionId);
        console.log('Provider:', providerCred.provider);
        const revalidateResponse = await this.revalidateRepo.findOne({
            where: {
                solution_id: solutionId,
                provider_code: providerCred.provider,
            },
        });
        if (!revalidateResponse) {
            console.error('Revalidate response not found for solution_id:', solutionId);
            return handleAuthenticationFailure('Revalidate response not found for solution_id:', solutionId, null);
        }
        console.log('Revalidate response found:', !!revalidateResponse);
        const res = JSON.parse(revalidateResponse.response);
        const fareBreakDown = res.Response.Results?.FareBreakdown;
        const isLCC = res.Response.Results.IsLCC;
        const revalidateResultIndex = res.Response.Results?.ResultIndex;
        if (revalidateResultIndex) {
            bookReq.solutionId = revalidateResultIndex;
        }
        Object.assign(bookRequest, {
            tokenReqData: bookReq,
            searchReqId: bookReq.searchReqId,
            trackingId: bookReq.trackingId,
            fareBreakDown,
            airlineType: isLCC ? 'LCC' : 'Non-LCC',
        });
        let pnr = '';
        let bookingId = '';
        let bookTraceId = '';
        if (!isLCC) {
            const requestBody = await this.createBookRequest({ bookRequest, pnr, bookingId, bookTraceId, index });
            const endpoint = `${providerCred.book_url}/rest/Book`;
            let bookResult;
            try {
                bookResult = await http_utility_1.Http.httpRequestTBO('POST', endpoint, JSON.stringify(requestBody));
            }
            catch (error) {
                logCollector?.({
                    index,
                    title: 'Book-TBO',
                    fileSuffix: 'book-TBO',
                    supplierRequest: requestBody,
                    supplierResponse: { error: error?.message ?? 'Unknown error', details: error },
                    apiRequest: bookRequest.bookReq,
                });
                throw error;
            }
            console.log('requestBody BOOK \n', JSON.stringify(requestBody), '\n');
            console.log('BOOKING RESULT \n', JSON.stringify(bookResult), '\n');
            logCollector?.({
                index,
                title: 'Book-TBO',
                fileSuffix: 'book-TBO',
                supplierRequest: requestBody,
                supplierResponse: bookResult,
                apiRequest: bookRequest.bookReq,
            });
            if (bookResult.Response.ResponseStatus !== 1) {
                const message = bookResult?.Errors?.[0]?.UserMessage || 'This flight is not available.';
                order.orderStatus = booking_enum_1.BookingStatus.FAILED;
                Object.assign(bookResponse, {
                    error: true,
                    message: message,
                    orderDetail: order,
                    searchReqId: bookReq.searchReqId,
                    supplierMessage: bookResult.Response.Error?.ErrorMessage,
                    mode: 'TBO-' + bookRequest.providerCred.mode,
                });
                return [{ ticketingResult: bookResponse }];
            }
            pnr = bookResult.Response.Response.PNR || '';
            bookingId = bookResult.Response.Response.BookingId || '';
            bookTraceId = bookResult.Response.TraceId || '';
        }
        return await this.ticketingCall({ bookRequest, pnr, bookingId, bookTraceId, index, supplierResult: null, logCollector });
    }
    async ticketingCall(reqParams) {
        const { bookRequest, pnr, bookingId, bookTraceId, index, supplierResult = null, logCollector, } = reqParams;
        const { providerCred } = bookRequest;
        const startTime = Date.now();
        const requestBodyTicketing = await this.createBookRequest({ bookRequest, pnr, bookingId, bookTraceId, index, supplierResult });
        const endpointTicketing = `${providerCred.book_url}/rest/Ticket`;
        let ticketingResult;
        try {
            ticketingResult = await http_utility_1.Http.httpRequestTBO('POST', endpointTicketing, JSON.stringify(requestBodyTicketing));
        }
        catch (error) {
            logCollector?.({
                index,
                title: 'Ticketing-TBO',
                fileSuffix: 'ticketing-TBO',
                supplierRequest: requestBodyTicketing,
                supplierResponse: { error: error?.message ?? 'Unknown error', details: error },
                apiRequest: bookRequest.bookReq,
            });
            throw error;
        }
        const endTime = Date.now();
        const responseTimeMs = endTime - startTime;
        console.log('requestBodyTicketing \n', JSON.stringify(requestBodyTicketing), '\n');
        console.log('TICKITING RESULT \n', JSON.stringify(ticketingResult), '\n');
        logCollector?.({
            index,
            title: 'Ticketing-TBO',
            fileSuffix: 'ticketing-TBO',
            supplierRequest: requestBodyTicketing,
            supplierResponse: ticketingResult,
            apiRequest: bookRequest.bookReq,
        });
        if (ticketingResult?.Response?.Response?.IsPriceChanged || ticketingResult?.Response?.Response?.IsTimeChanged) {
            this.ticketingCall({ bookRequest, pnr, bookingId, bookTraceId, index, supplierResult: ticketingResult, logCollector });
        }
        return [{ ticketingResult, requestBodyTicketing }];
    }
    async createMultipleBook(reqParams) {
        const { bookRequest, handleAuthenticationFailure, logCollector } = reqParams;
        const { bookReq } = bookRequest;
        const solutionIds = bookReq.solutionId.split(' ||| ');
        const bookingResults = [];
        for (const [i, solutionId] of solutionIds.entries()) {
            const trimmedSolutionId = solutionId.trim();
            const selectedSegment = bookReq.routes[i];
            const airlineType = bookReq.airlineType;
            const updatedBookRequest = {
                ...bookRequest,
                bookReq: {
                    ...bookReq,
                    solutionId: trimmedSolutionId,
                    selectedSegment,
                    airlineType,
                },
            };
            const result = await this.createSingleBook({ bookRequest: updatedBookRequest, index: i, handleAuthenticationFailure, logCollector });
            if (Array.isArray(result)) {
                if (i === 0 && (result[0]?.ticketingResult?.error || result[0]?.ticketingResult?.Response?.ResponseStatus != 1)) {
                    return result;
                }
                bookingResults.push(...result);
            }
        }
        return bookingResults;
    }
    async createBookRequest(reqParams) {
        const { bookRequest, pnr, bookingId, bookTraceId, index: idx = 0, supplierResult = null } = reqParams;
        const fareBreakDown = bookRequest?.FareBreakdown;
        const { bookReq, headers } = bookRequest;
        const passengers = bookReq.passengers;
        const passengerArray = passengers.map((element, index) => {
            const pexT = element?.passengerType === 'ADT' ? 1 : element?.passengerType === 'CHD' ? 2 : 3;
            const fare = fareBreakDown?.find((f) => f?.PassengerType === pexT);
            return {
                Title: element?.passengerDetail?.title || 'Mr',
                FirstName: element?.passengerDetail?.firstName.trim(),
                LastName: element?.passengerDetail?.lastName.trim(),
                PaxType: pexT,
                DateOfBirth: (0, moment_1.default)(element?.dateOfBirth, 'YYYY-MM-DD').format('YYYY-MM-DDTHH:mm:ss'),
                Gender: element.gender == 'M' ? 1 : 2,
                PassportNo: element?.document?.documentNumber,
                PassportExpiry: element?.document?.expiryDate,
                PassportIssueDate: element?.document?.issueDate,
                PassportIssueCountryCode: element?.document?.country,
                AddressLine1: `${element?.city?.name || ''}, ${element?.country?.name || ''}, ${bookReq?.contact?.postalCode}`,
                AddressLine2: '',
                City: element?.city?.name,
                CountryName: element?.country?.name,
                CountryCode: element?.document?.country,
                Nationality: element?.nationality,
                GSTCompanyAddress: bookReq?.gst?.gstCompanyAddress || '',
                GSTCompanyContactNumber: bookReq?.gst?.gstCompanyContactNumber || '',
                GSTCompanyName: bookReq?.gst?.gstCompanyName || '',
                GSTNumber: bookReq?.gst?.gstNumber || '',
                GSTCompanyEmail: bookReq?.gst?.gstCompanyEmail || '',
                ContactNo: element.mobile.replace('+', '').trim(),
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
                    AdditionalTxnFeeOfrd: fare?.AdditionalTxnFeeOfrd / (fare?.PassengerCount || 1) || 0,
                    AdditionalTxnFeePubL: fare?.AdditionalTxnFeePubL / (fare?.PassengerCount || 1) || 0,
                    PGCharge: fare?.PGCharge / (fare?.PassengerCount || 1) || 0,
                },
            };
        });
        const authToken = await this.tboAuthTokenService.getAuthToken(bookRequest);
        let obj = {};
        if (pnr) {
            obj = {
                TokenId: authToken,
                TraceId: bookTraceId,
                PNR: pnr,
                BookingId: bookingId,
                EndUserIp: headers['ip-address'],
            };
        }
        else {
            obj = {
                TokenId: authToken,
                TraceId: bookReq?.trackingId,
                ResultIndex: bookReq?.solutionId,
                EndUserIp: headers['ip-address'],
                Passengers: passengerArray,
            };
            console.log('Ticketing API Request - ResultIndex:', bookReq?.solutionId);
        }
        if (supplierResult?.Response?.Response?.IsPriceChanged) {
            obj.IsPriceChangeAccepted = true;
        }
        if (supplierResult?.Response?.Response?.IsTimeChanged) {
            obj.IsPriceChangeAccepted = true;
        }
        return obj;
    }
};
exports.TboBookService = TboBookService;
exports.TboBookService = TboBookService = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, typeorm_2.InjectRepository)(revalidate_response_entity_1.RevalidateResponseEntity)),
    __metadata("design:paramtypes", [tbo_auth_token_service_1.TboAuthTokenService,
        generic_repo_utility_1.GenericRepo,
        typeorm_1.Repository,
        supplier_log_utility_1.SupplierLogUtility])
], TboBookService);
//# sourceMappingURL=tbo-book.service.js.map