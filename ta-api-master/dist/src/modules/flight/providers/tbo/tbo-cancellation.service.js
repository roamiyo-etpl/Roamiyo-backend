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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TboCancellationService = void 0;
const common_1 = require("@nestjs/common");
const http_utility_1 = require("../../../../shared/utilities/flight/http.utility");
const tbo_auth_token_service_1 = require("./tbo-auth-token.service");
const supplier_log_utility_1 = require("../../../../shared/utilities/flight/supplier-log.utility");
const cancel_interface_1 = require("../../../cancel/interfaces/cancel.interface");
let TboCancellationService = class TboCancellationService {
    tboAuthTokenService;
    supplierLogUtility;
    constructor(tboAuthTokenService, supplierLogUtility) {
        this.tboAuthTokenService = tboAuthTokenService;
        this.supplierLogUtility = supplierLogUtility;
    }
    async cancel(cancelRequest) {
        const { cancelReq, headers, providerCred, booking } = cancelRequest;
        const finalResponse = new cancel_interface_1.CancelResponse();
        finalResponse.success = false;
        finalResponse.cancellationStatus = '';
        finalResponse.mode = 'TBO';
        try {
            const tokenRequestData = {
                providerCred,
                tokenReqData: cancelReq,
                headers,
            };
            const authToken = await this.tboAuthTokenService.getAuthToken(tokenRequestData);
            if (!authToken) {
                throw new common_1.InternalServerErrorException('Authentication failed');
            }
            const logPrefix = `cancel-${Date.now()}`;
            if (cancelReq?.supplierParams?.releasePnr === true) {
                const bookingDetails = await this.getBookingDetails({
                    cancelReq,
                    providerCred,
                    authToken,
                    headers,
                    logPrefix,
                });
                const source = bookingDetails?.Response?.FlightItinerary?.Source;
                const releaseResult = await this.releasePNR({
                    cancelReq,
                    providerCred,
                    authToken,
                    headers,
                    logPrefix,
                    source,
                });
                finalResponse.success = releaseResult?.Response?.ResponseStatus === 1;
                finalResponse.message = 'Hold booking released successfully';
                finalResponse.error = releaseResult?.Response?.Error;
                return finalResponse;
            }
            if (booking) {
                const allowedStatuses = [1];
                if (!allowedStatuses.includes(booking.booking_status)) {
                    finalResponse.message = `Cancellation not allowed for booking with status: ${booking.booking_status}`;
                    finalResponse.error = {
                        errorCode: 400,
                        errorMessage: `Booking status must be CONFIRMED to cancel. Current status: ${booking.booking_status}`,
                    };
                    return finalResponse;
                }
            }
            const sendChangeRequestResult = await this.sendChangeRequest({
                cancelReq,
                providerCred,
                authToken,
                headers,
                logPrefix,
            });
            if (!sendChangeRequestResult.success) {
                finalResponse.message = 'Failed to send change request';
                return finalResponse;
            }
            const changeRequestId = sendChangeRequestResult.changeRequestId;
            if (!changeRequestId) {
                finalResponse.message = 'No change request ID received';
                return finalResponse;
            }
            const getStatusResult = await this.getChangeRequestStatus({
                changeRequestId,
                providerCred,
                authToken,
                headers,
                logPrefix,
            });
            finalResponse.success = getStatusResult.responseStatus === 1;
            finalResponse.cancellationStatus = getStatusResult.responseStatus === 1 && getStatusResult.changeRequestStatus === 3;
            finalResponse.cancellationCharge = getStatusResult.cancellationCharge;
            finalResponse.refundedAmount = getStatusResult.refundedAmount;
            finalResponse.status = this.getCancellationStatusText(getStatusResult.changeRequestStatus);
            finalResponse.error = getStatusResult.error;
            finalResponse.creditNoteNo = getStatusResult.creditNoteNo;
            finalResponse.creditNoteCreatedOn = getStatusResult.creditNoteCreatedOn;
            return finalResponse;
        }
        catch (error) {
            console.error('TBO Cancellation Error:', error);
            finalResponse.message = error.message || 'Cancellation failed';
            finalResponse.error = {
                errorCode: -1,
                errorMessage: error.message,
            };
            return finalResponse;
        }
    }
    async releasePNR({ cancelReq, providerCred, authToken, headers, logPrefix, source }) {
        try {
            const requestData = {
                EndUserIp: headers['ip-address'] || '192.168.10.36',
                TokenId: authToken,
                BookingId: cancelReq.bookingId,
                Source: source || '4',
            };
            const endpoint = `${providerCred.book_url}/rest/ReleasePNRRequest`;
            const response = await http_utility_1.Http.httpRequestTBO('POST', endpoint, JSON.stringify(requestData));
            await this.supplierLogUtility.generateLogFile({
                fileName: `${logPrefix}-releasepnr-TBO`,
                logData: { request: requestData, response },
                folderName: 'cancellation',
                logId: null,
                title: 'Release-PNR-TBO',
                searchReqId: null,
                bookingReferenceId: cancelReq.bookingId.toString(),
            });
            return response;
        }
        catch (error) {
            console.error('Release PNR Error:', error);
            return null;
        }
    }
    async sendChangeRequest({ cancelReq, providerCred, authToken, headers, logPrefix }) {
        try {
            const requestData = {
                EndUserIp: headers['ip-address'] || '192.168.10.36',
                TokenId: authToken,
                BookingId: cancelReq.bookingId,
                RequestType: this.generateRequestType(cancelReq.requestType),
                CancellationType: this.generateCancellationType(cancelReq?.supplierParams?.cancellationType),
                Remarks: ((cancelReq?.supplierParams?.remarks) || 'Cancellation requested via API').trim(),
            };
            if (this.generateRequestType(cancelReq.requestType) === 2) {
                if (cancelReq?.supplierParams?.ticketIds && cancelReq.supplierParams.ticketIds.length > 0) {
                    requestData.TicketId = cancelReq.supplierParams.ticketIds;
                }
                if (cancelReq?.supplierParams?.sectors && cancelReq.supplierParams.sectors.length > 0) {
                    requestData.Sectors = cancelReq.supplierParams.sectors.map((sector) => ({
                        Origin: sector.origin,
                        Destination: sector.destination,
                    }));
                }
            }
            const endpoint = `${providerCred.book_url}/rest/SendChangeRequest`;
            const response = await http_utility_1.Http.httpRequestTBO('POST', endpoint, JSON.stringify(requestData));
            await this.supplierLogUtility.generateLogFile({
                fileName: `${logPrefix}-sendchangerequest-TBO`,
                logData: { request: requestData, response },
                folderName: 'cancellation',
                logId: null,
                title: 'Send-Change-Request-TBO',
                searchReqId: null,
                bookingReferenceId: cancelReq.bookingId.toString(),
            });
            const changeRequestId = response?.Response?.TicketCRInfo?.[0]?.ChangeRequestId;
            const success = response?.Response?.ResponseStatus === 1;
            return {
                success,
                changeRequestId,
                response,
            };
        }
        catch (error) {
            console.error('Send Change Request Error:', error);
            return {
                success: false,
                changeRequestId: null,
                error: error.message,
            };
        }
    }
    async getChangeRequestStatus({ changeRequestId, providerCred, authToken, headers, logPrefix }) {
        try {
            const requestData = {
                EndUserIp: headers['ip-address'] || '192.168.10.36',
                TokenId: authToken,
                ChangeRequestId: changeRequestId,
            };
            const endpoint = `${providerCred.book_url}/rest/GetChangeRequestStatus`;
            const response = await http_utility_1.Http.httpRequestTBO('POST', endpoint, JSON.stringify(requestData));
            const res = (response && response.Response) ? response.Response : response;
            await this.supplierLogUtility.generateLogFile({
                fileName: `${logPrefix}-getchangerequeststatus-TBO`,
                logData: { request: requestData, response: res },
                folderName: 'cancellation',
                logId: null,
                title: 'Get-Change-Request-Status-TBO',
                searchReqId: null,
                bookingReferenceId: changeRequestId?.toString(),
            });
            return {
                changeRequestId: res?.ChangeRequestId,
                refundedAmount: res?.RefundedAmount || 0,
                cancellationCharge: res?.CancellationCharge || 0,
                serviceTaxOnRAF: res?.ServiceTaxOnRAF || 0,
                changeRequestStatus: res?.ChangeRequestStatus || 0,
                traceId: res?.TraceId,
                responseStatus: res?.ResponseStatus || 0,
                error: res?.Error,
                creditNoteNo: res?.CreditNoteNo,
                creditNoteCreatedOn: res?.CreditNoteCreatedOn,
            };
        }
        catch (error) {
            console.error('Get Change Request Status Error:', error);
            return {
                changeRequestStatus: 0,
                responseStatus: 2,
                error: { ErrorCode: -1, ErrorMessage: error.message },
            };
        }
    }
    async getCancellationCharges({ cancelReq, providerCred, authToken, headers, logPrefix }) {
        try {
            const requestData = {
                EndUserIp: headers['ip-address'] || '192.168.10.36',
                TokenId: authToken,
                RequestType: this.generateRequestType(cancelReq.requestType),
                BookingId: cancelReq.bookingId,
                BookingMode: 5,
            };
            const endpoint = `${providerCred.book_url}/rest/GetCancellationCharges`;
            const response = await http_utility_1.Http.httpRequestTBO('POST', endpoint, JSON.stringify(requestData));
            await this.supplierLogUtility.generateLogFile({
                fileName: `${logPrefix}-getcancellationcharges-TBO`,
                logData: { request: requestData, response },
                folderName: 'cancellation',
                logId: null,
                title: 'Get-Cancellation-Charges-TBO',
                searchReqId: null,
                bookingReferenceId: cancelReq.bookingId.toString(),
            });
            const supplierResponseStatus = response?.Response?.ResponseStatus || 0;
            return {
                success: supplierResponseStatus === 1,
                supplierResponseStatus: this.getResponseStatusText(supplierResponseStatus),
                refundAmount: response?.Response?.RefundAmount || 0,
                cancellationCharge: response?.Response?.CancellationCharge || 0,
                remarks: response?.Response?.Remarks || '',
                currency: response?.Response?.Currency || '',
                traceId: response?.Response?.TraceId,
                error: response?.Response?.Error,
            };
        }
        catch (error) {
            console.error('Get Cancellation Charges Error:', error);
            return {
                success: false,
                supplierResponseStatus: 'Failed',
                refundAmount: 0,
                cancellationCharge: 0,
                remarks: '',
                currency: '',
                error: {
                    errorCode: -1,
                    errorMessage: error.message || 'Error fetching cancellation charges',
                },
            };
        }
    }
    async fetchCancellationCharges(cancelRequest) {
        const { cancelReq, headers, providerCred } = cancelRequest;
        try {
            const tokenRequestData = {
                providerCred,
                tokenReqData: cancelReq,
                headers,
            };
            const authToken = await this.tboAuthTokenService.getAuthToken(tokenRequestData);
            if (!authToken) {
                return {
                    success: false,
                    supplierResponseStatus: 'InValidCredentials',
                    refundAmount: 0,
                    cancellationCharge: 0,
                    remarks: '',
                    currency: '',
                    error: {
                        errorCode: -1,
                        errorMessage: 'Authentication failed',
                    },
                };
            }
            const logPrefix = `cancel-${Date.now()}`;
            return await this.getCancellationCharges({ cancelReq, providerCred, authToken, headers, logPrefix });
        }
        catch (error) {
            return {
                success: false,
                supplierResponseStatus: 'Failed',
                refundAmount: 0,
                cancellationCharge: 0,
                remarks: '',
                currency: '',
                error: {
                    errorCode: -1,
                    errorMessage: error.message || 'Error fetching cancellation charges',
                },
            };
        }
    }
    getCancellationStatusText(status) {
        const statusMap = {
            0: 'Unassigned',
            1: 'Assigned',
            2: 'Acknowledged',
            3: 'Completed',
            4: 'Rejected',
            5: 'Closed',
            6: 'Pending',
            7: 'Other',
        };
        return statusMap[status] || 'Other';
    }
    getResponseStatusText(status) {
        const statusMap = {
            0: 'NotSet',
            1: 'Successfull',
            2: 'Failed',
            3: 'InValidRequest',
            4: 'InValidSession',
            5: 'InValidCredentials',
        };
        return statusMap[status] || 'Unknown';
    }
    generateRequestType(requestType) {
        if (typeof requestType === 'number')
            return requestType;
        const map = {
            NotSet: 0,
            FullCancellation: 1,
            PartialCancellation: 2,
            Reissuance: 3,
        };
        return map[(requestType || '').trim()] ?? 0;
    }
    generateCancellationType(cancellationType) {
        if (typeof cancellationType === 'number')
            return cancellationType;
        const map = {
            NotSet: 0,
            NoShow: 1,
            FlightCancelled: 2,
            Others: 3,
        };
        return map[(cancellationType || 'Others').trim()] ?? 3;
    }
    async getBookingDetails({ cancelReq, providerCred, authToken, headers, logPrefix }) {
        try {
            const requestData = {
                EndUserIp: headers['ip-address'] || '192.168.10.36',
                TokenId: authToken,
                BookingId: cancelReq.bookingId,
            };
            const endpoint = `${providerCred.book_url}/rest/GetBookingDetails`;
            const response = await http_utility_1.Http.httpRequestTBO('POST', endpoint, JSON.stringify(requestData));
            await this.supplierLogUtility.generateLogFile({
                fileName: `${logPrefix}-getbookingdetails-TBO`,
                logData: { request: requestData, response },
                folderName: 'cancellation',
                logId: null,
                title: 'Get-Booking-Details-TBO',
                searchReqId: null,
                bookingReferenceId: cancelReq.bookingId.toString(),
            });
            return response;
        }
        catch (error) {
            console.error('Get Booking Details Error:', error);
            return null;
        }
    }
};
exports.TboCancellationService = TboCancellationService;
exports.TboCancellationService = TboCancellationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tbo_auth_token_service_1.TboAuthTokenService,
        supplier_log_utility_1.SupplierLogUtility])
], TboCancellationService);
//# sourceMappingURL=tbo-cancellation.service.js.map