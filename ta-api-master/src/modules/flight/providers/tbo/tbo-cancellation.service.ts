import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Http } from 'src/shared/utilities/flight/http.utility';
import { TboAuthTokenService } from './tbo-auth-token.service';
import { SupplierLogUtility } from 'src/shared/utilities/flight/supplier-log.utility';
import {
    CancelFlightDto,
    ReleasePNRRequestDto,
    SendChangeRequestDto,
    GetChangeRequestStatusRequestDto,
    GetCancellationChargesRequestDto,
} from '../../cancel/dtos/cancel.dto';
import {
    CancelResponse,
    CancellationChargesResponse,
} from 'src/modules/cancel/interfaces/cancel.interface';
import { Generic } from 'src/shared/utilities/flight/generic.utility';

/**
 * TBO Cancellation Service
 * Handles flight booking cancellation for TBO provider
 * Implements the main cancellation flow:
 * 1. SendChangeRequest - Send cancellation request (works for both hold and ticketed bookings)
 * 2. GetChangeRequestStatus - Check cancellation status (polls until complete)
 * 3. GetCancellationCharges - Get cancellation charges
 * 
 * Optional: ReleasePNRRequest - Only for releasing hold bookings that haven't been ticketed
 * This is NOT called automatically. Set releasePnr=true in request to call it.
 * 
 */
@Injectable()
export class TboCancellationService {
    constructor(
        private readonly tboAuthTokenService: TboAuthTokenService,
        private readonly supplierLogUtility: SupplierLogUtility,
    ) { }

    /**
     * @param cancelRequest - Cancellation request parameters
     * @returns Promise<CancelResponse>
     */
    async cancel(cancelRequest): Promise<CancelResponse> {
        const { cancelReq, headers, providerCred, booking } = cancelRequest;
        const finalResponse = new CancelResponse();
        finalResponse.success = false;
        finalResponse.cancellationStatus = '';
        // finalResponse.message = 'Cancellation failed';
        finalResponse.mode = 'TBO';

        try {
            const tokenRequestData = {
                providerCred,
                tokenReqData: cancelReq,
                headers,
            };
            const authToken = await this.tboAuthTokenService.getAuthToken(tokenRequestData);

            if (!authToken) {
                throw new InternalServerErrorException('Authentication failed');
            }

            const logPrefix = `cancel-${Date.now()}`;

            // Step 1: Release PNR Request (only for hold bookings - ticket not generated)
            // If releasePnr is true, ONLY call ReleasePNR and return - no other APIs needed
            if (cancelReq?.supplierParams?.releasePnr === true) {
                // Fetch booking details to get Source field
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

                // Build response for ReleasePNR
                finalResponse.success = releaseResult?.Response?.ResponseStatus === 1;
                finalResponse.message = 'Hold booking released successfully';
                finalResponse.error = releaseResult?.Response?.Error;

                return finalResponse;
            }

            // Step 1.5: Check booking status before sending change request
            // Only allow cancellation if booking is CONFIRMED
            if (booking) {
                const allowedStatuses = [1]; // CONFIRMED from BookingStatus enum
                if (!allowedStatuses.includes(booking.booking_status)) {
                    finalResponse.message = `Cancellation not allowed for booking with status: ${booking.booking_status}`;
                    finalResponse.error = {
                        errorCode: 400,
                        errorMessage: `Booking status must be CONFIRMED to cancel. Current status: ${booking.booking_status}`,
                    };
                    return finalResponse;
                }
            }

            // Step 2: Send Change Request (only for ticketed bookings)
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

            // Step 3: Get Change Request Status 
            const getStatusResult = await this.getChangeRequestStatus({
                changeRequestId,
                providerCred,
                authToken,
                headers,
                logPrefix,
            });

            finalResponse.success = getStatusResult.responseStatus === 1;
            finalResponse.cancellationStatus = getStatusResult.responseStatus === 1 && getStatusResult.changeRequestStatus === 3; // 3 = Completed
            finalResponse.cancellationCharge = getStatusResult.cancellationCharge;
            finalResponse.refundedAmount = getStatusResult.refundedAmount;
            finalResponse.status = this.getCancellationStatusText(getStatusResult.changeRequestStatus);
            finalResponse.error = getStatusResult.error;
            finalResponse.creditNoteNo = getStatusResult.creditNoteNo;
            finalResponse.creditNoteCreatedOn = getStatusResult.creditNoteCreatedOn;

            return finalResponse;
        } catch (error) {
            console.error('TBO Cancellation Error:', error);
            finalResponse.message = error.message || 'Cancellation failed';
            finalResponse.error = {
                errorCode: -1,
                errorMessage: error.message,
            };
            return finalResponse;
        }
    }

    /**
     * Step 1: Release PNR Request
     * Used to release hold bookings that user doesn't want to ticket
     * Source is fetched from GetBookingDetails API response
     */
    private async releasePNR({ cancelReq, providerCred, authToken, headers, logPrefix, source }) {
        try {
            const requestData: ReleasePNRRequestDto = {
                EndUserIp: headers['ip-address'] || '192.168.10.36',
                TokenId: authToken,
                BookingId: cancelReq.bookingId,
                Source: source || '4', // Source fetched from GetBookingDetails API
            };

            // dev
            const endpoint = `${providerCred.url}BookingEngineService_Air/AirService.svc/rest/ReleasePNRRequest`;

            // prod
            // const endpoint = `${providerCred.book_url}/rest/ReleasePNRRequest`;
            const response = await Http.httpRequestTBO('POST', endpoint, JSON.stringify(requestData));

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
        } catch (error) {
            console.error('Release PNR Error:', error);
            return null;
        }
    }

    /**
     * Step 2: Send Change Request
     * Sends cancellation request (full or partial)
     */
    private async sendChangeRequest({ cancelReq, providerCred, authToken, headers, logPrefix }) {
        try {
            const requestData: SendChangeRequestDto = {
                EndUserIp: headers['ip-address'] || '192.168.10.36',
                TokenId: authToken,
                BookingId: cancelReq.bookingId,
                RequestType: this.generateRequestType(cancelReq.requestType),
                CancellationType: this.generateCancellationType(cancelReq?.supplierParams?.cancellationType),
                Remarks: ((cancelReq?.supplierParams?.remarks) || 'Cancellation requested via API').trim(),
            };

            // Important: TicketId/Sectors must be sent ONLY for PartialCancellation
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

            // dev
            const endpoint = `${providerCred.url}BookingEngineService_Air/AirService.svc/rest/SendChangeRequest`;

            // prod url
            // const endpoint = `${providerCred.book_url}/rest/SendChangeRequest`;
            const response = await Http.httpRequestTBO('POST', endpoint, JSON.stringify(requestData));

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
        } catch (error) {
            console.error('Send Change Request Error:', error);
            return {
                success: false,
                changeRequestId: null,
                error: error.message,
            };
        }
    }

    /**
     * Step 3: Get Change Request Status
     * Checks the status of the cancellation request
     */
    private async getChangeRequestStatus({ changeRequestId, providerCred, authToken, headers, logPrefix }) {
        try {
            const requestData: GetChangeRequestStatusRequestDto = {
                EndUserIp: headers['ip-address'] || '192.168.10.36',
                TokenId: authToken,
                ChangeRequestId: changeRequestId,
            };

            // dev
            const endpoint = `${providerCred.url}BookingEngineService_Air/AirService.svc/rest/GetChangeRequestStatus`;

            // prod
            // const endpoint = `${providerCred.book_url}/rest/GetChangeRequestStatus`;

            const response = await Http.httpRequestTBO('POST', endpoint, JSON.stringify(requestData));

            // Some responses are wrapped inside a top-level `Response` object. Normalize it.
            const res = (response && response.Response) ? response.Response : response;

            // Log the request/response
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
        } catch (error) {
            console.error('Get Change Request Status Error:', error);
            return {
                changeRequestStatus: 0,
                responseStatus: 2,
                error: { ErrorCode: -1, ErrorMessage: error.message },
            };
        }
    }

    /**
     * Gets cancellation charges and refund amount
    */
    private async getCancellationCharges({
        cancelReq,
        providerCred,
        authToken,
        headers,
        logPrefix,
    }) {
        try {
            console.log('================ TBO GET CANCELLATION CHARGES API ================');
    
            console.log('Incoming cancelReq =>', JSON.stringify(cancelReq, null, 2));
            console.log('Incoming headers =>', JSON.stringify(headers, null, 2));
            console.log('Incoming providerCred =>', JSON.stringify(providerCred, null, 2));
            console.log('Incoming authToken =>', authToken);
            console.log('Incoming logPrefix =>', logPrefix);
    
            const requestData: GetCancellationChargesRequestDto = {
                // EndUserIp: headers['ip-address'] || '192.168.10.36',
                // EndUserIp: '20.244.28.12',
                EndUserIp: '104.211.206.107',
                TokenId: authToken,
                RequestType: this.generateRequestType(cancelReq.requestType),
                BookingId: cancelReq.bookingId,
                BookingMode: 5,
            };
    
            console.log(
                'Prepared TBO Request Payload =>',
                JSON.stringify(requestData, null, 2),
            );
    
            // dev
            const endpoint = `${providerCred.url}BookingEngineService_Air/AirService.svc/rest/GetCancellationCharges`;
    
            // prod
            // const endpoint = `${providerCred.book_url}/rest/GetCancellationCharges`;
    
            console.log('Final Endpoint =>', endpoint);
            console.log('HTTP Method => POST');
    
            console.log('Calling TBO API');
    
            const response = await Http.httpRequestTBO(
                'POST',
                endpoint,
                JSON.stringify(requestData),
            );
    
            console.log(
                'Raw Supplier Response =>',
                JSON.stringify(response, null, 2),
            );
    
            console.log('Generating Supplier Log File');
    
            await this.supplierLogUtility.generateLogFile({
                fileName: `${logPrefix}-getcancellationcharges-TBO`,
                logData: {
                    request: requestData,
                    response,
                },
                folderName: 'cancellation',
                logId: null,
                title: 'Get-Cancellation-Charges-TBO',
                searchReqId: null,
                bookingReferenceId: cancelReq.bookingId.toString(),
            });
    
            console.log('Supplier Log File Generated');
    
            const supplierResponseStatus =
                response?.Response?.ResponseStatus || 0;
    
            console.log('Supplier Response Status =>', supplierResponseStatus);
    
            const finalResponse = {
                success: supplierResponseStatus === 1,
                supplierResponseStatus:
                    this.getResponseStatusText(supplierResponseStatus),
                refundAmount: response?.Response?.RefundAmount || 0,
                cancellationCharge:
                    response?.Response?.CancellationCharge || 0,
                remarks: response?.Response?.Remarks || '',
                currency: response?.Response?.Currency || '',
                traceId: response?.Response?.TraceId,
                error: response?.Response?.Error,
            };
    
            console.log(
                'Final API Response =>',
                JSON.stringify(finalResponse, null, 2),
            );
    
            return finalResponse;
        } catch (error) {
            console.log('================ GET CANCELLATION CHARGES ERROR ================');
    
            console.log('Error Message =>', error?.message);
            console.log('Full Error =>', error);
    
            return {
                success: false,
                supplierResponseStatus: 'Failed',
                refundAmount: 0,
                cancellationCharge: 0,
                remarks: '',
                currency: '',
                error: {
                    errorCode: -1,
                    errorMessage:
                        error.message || 'Error fetching cancellation charges',
                },
            };
        }
    }

    async fetchCancellationCharges(cancelRequest): Promise<CancellationChargesResponse> {
        const { cancelReq, headers, providerCred } = cancelRequest;
    
        console.log('================ TBO FETCH CANCELLATION CHARGES ================');
    
        console.log('Headers =>', JSON.stringify(headers, null, 2));
        console.log('CancelReq =>', JSON.stringify(cancelReq, null, 2));
        console.log('ProviderCred =>', JSON.stringify(providerCred, null, 2));
    
        try {
            const tokenRequestData = {
                providerCred,
                tokenReqData: cancelReq,
                headers,
            };
    
            console.log(
                'Token Request Data =>',
                JSON.stringify(tokenRequestData, null, 2),
            );
    
            console.log('Requesting auth token from TBO');
    
            const authToken =
                await this.tboAuthTokenService.getAuthToken(tokenRequestData);
    
            console.log('Received Auth Token =>', authToken);
    
            if (!authToken) {
                console.log('Auth token generation failed');
    
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
    
            console.log('Generated Log Prefix =>', logPrefix);
    
            console.log('Calling internal getCancellationCharges');
    
            return await this.getCancellationCharges({
                cancelReq,
                providerCred,
                authToken,
                headers,
                logPrefix,
            });
        } catch (error) {
            console.log('Error inside fetchCancellationCharges');
            console.log(error);
    
            return {
                success: false,
                supplierResponseStatus: 'Failed',
                refundAmount: 0,
                cancellationCharge: 0,
                remarks: '',
                currency: '',
                error: {
                    errorCode: -1,
                    errorMessage:
                        error.message || 'Error fetching cancellation charges',
                },
            };
        }
    }

    private getCancellationStatusText(status: number): string {
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

    private getResponseStatusText(status: number): string {
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

    private generateRequestType(requestType: string | number): number {
        if (typeof requestType === 'number') return requestType;
        const map = {
            NotSet: 0,
            FullCancellation: 1,
            PartialCancellation: 2,
            Reissuance: 3,
        } as Record<string, number>;
        return map[(requestType || '').trim()] ?? 0;
    }

    /**
     * Generate cancellation type for TBO
     * Defaults to 'Others' (3) if not provided or invalid
     */
    private generateCancellationType(cancellationType?: string | number): number {
        if (typeof cancellationType === 'number') return cancellationType;
        const map = {
            NotSet: 0,
            NoShow: 1,
            FlightCancelled: 2,
            Others: 3,
        } as Record<string, number>;
        return map[(cancellationType || 'Others').trim()] ?? 3; // Default to 'Others'
    }

    /**
     * Get booking details to fetch Source field for ReleasePNR
     */
    private async getBookingDetails({ cancelReq, providerCred, authToken, headers, logPrefix }) {
        try {
            const requestData = {
                EndUserIp: headers['ip-address'] || '192.168.10.36',
                TokenId: authToken,
                BookingId: cancelReq.bookingId,
            };

            // dev
            const endpoint = `${providerCred.url}BookingEngineService_Air/AirService.svc/rest/GetBookingDetails`;

            // prod
            // const endpoint = `${providerCred.book_url}/rest/GetBookingDetails`;
            const response = await Http.httpRequestTBO('POST', endpoint, JSON.stringify(requestData));

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
        } catch (error) {
            console.error('Get Booking Details Error:', error);
            return null;
        }
    }
}


