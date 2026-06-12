import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { Http } from 'src/shared/utilities/flight/http.utility';
import { TboAuthTokenService } from './tbo-auth-token.service';
import { SupplierLogUtility } from 'src/shared/utilities/flight/supplier-log.utility';
import {
    CancellationStatus,
    ReleasePNRRequestDto,
    SendChangeRequestDto,
    GetChangeRequestStatusRequestDto,
    GetCancellationChargesRequestDto,
} from '../../cancel/dtos/cancel.dto';
import {
    CancelResponse,
    CancellationChargesResponse,
} from 'src/modules/cancel/interfaces/cancel.interface';
import {
    redactTboCredentialsForLog,
    resolveTboEndUserIp,
} from 'src/shared/utilities/flight/tbo-request-context.utility';

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
    // async cancel(cancelRequest): Promise<CancelResponse> {
    //     const { cancelReq, headers, providerCred, booking } = cancelRequest;
    //     const finalResponse = new CancelResponse();
    //     finalResponse.success = false;
    //     finalResponse.cancellationStatus = '';
    //     // finalResponse.message = 'Cancellation failed';
    //     finalResponse.mode = 'TBO';

    //     try {
    //         const tokenRequestData = {
    //             providerCred,
    //             tokenReqData: cancelReq,
    //             headers,
    //         };
    //         const authToken = await this.tboAuthTokenService.getAuthToken(tokenRequestData);

    //         if (!authToken) {
    //             throw new InternalServerErrorException('Authentication failed');
    //         }

    //         const logPrefix = `cancel-${Date.now()}`;

    //         // Step 1: Release PNR Request (only for hold bookings - ticket not generated)
    //         // If releasePnr is true, ONLY call ReleasePNR and return - no other APIs needed
    //         if (cancelReq?.supplierParams?.releasePnr === true) {
    //             // Fetch booking details to get Source field
    //             const bookingDetails = await this.getBookingDetails({
    //                 cancelReq,
    //                 providerCred,
    //                 authToken,
    //                 headers,
    //                 logPrefix,
    //             });

    //             const itinerary = this.getFlightItineraryFromBookingDetails(
    //                 bookingDetails,
    //             );
    //             const source = itinerary?.Source;

    //             const releaseResult = await this.releasePNR({
    //                 cancelReq,
    //                 providerCred,
    //                 authToken,
    //                 headers,
    //                 logPrefix,
    //                 source,
    //             });

    //             // Build response for ReleasePNR
    //             finalResponse.success = releaseResult?.Response?.ResponseStatus === 1;
    //             finalResponse.message = 'Hold booking released successfully';
    //             finalResponse.error = releaseResult?.Response?.Error;

    //             return finalResponse;
    //         }

    //         // Step 1.5: Check booking status before sending change request
    //         // Only allow cancellation if booking is CONFIRMED
    //         if (booking) {
    //             const allowedStatuses = [1]; // CONFIRMED from BookingStatus enum
    //             if (!allowedStatuses.includes(booking.booking_status)) {
    //                 finalResponse.message = `Cancellation not allowed for booking with status: ${booking.booking_status}`;
    //                 finalResponse.error = {
    //                     errorCode: 400,
    //                     errorMessage: `Booking status must be CONFIRMED to cancel. Current status: ${booking.booking_status}`,
    //                 };
    //                 return finalResponse;
    //             }
    //         }

    //         // Step 2: Send Change Request (only for ticketed bookings)
    //         const sendChangeRequestResult = await this.sendChangeRequest({
    //             cancelReq,
    //             providerCred,
    //             authToken,
    //             headers,
    //             logPrefix,
    //         });

    //         if (!sendChangeRequestResult.success) {
    //             finalResponse.message = 'Failed to send change request';
    //             return finalResponse;
    //         }

    //         const changeRequestId = sendChangeRequestResult.changeRequestId;
    //         if (!changeRequestId) {
    //             finalResponse.message = 'No change request ID received';
    //             return finalResponse;
    //         }

    //         // Step 3: Get Change Request Status 
    //         const getStatusResult = await this.getChangeRequestStatus({
    //             changeRequestId,
    //             providerCred,
    //             authToken,
    //             headers,
    //             logPrefix,
    //         });

    //         finalResponse.success = getStatusResult.responseStatus === 1;
    //         finalResponse.cancellationStatus = getStatusResult.responseStatus === 1 && getStatusResult.changeRequestStatus === CancellationStatus.Completed;
    //         finalResponse.cancellationCharge = getStatusResult.cancellationCharge;
    //         finalResponse.refundedAmount = getStatusResult.refundedAmount;
    //         finalResponse.status = this.getCancellationStatusText(getStatusResult.changeRequestStatus);
    //         finalResponse.error = getStatusResult.error;
    //         finalResponse.creditNoteNo = getStatusResult.creditNoteNo;
    //         finalResponse.creditNoteCreatedOn = getStatusResult.creditNoteCreatedOn;

    //         return finalResponse;
    //     } catch (error) {
    //         console.error('TBO Cancellation Error:', error);
    //         finalResponse.message = error.message || 'Cancellation failed';
    //         finalResponse.error = {
    //             errorCode: -1,
    //             errorMessage: error.message,
    //         };
    //         return finalResponse;
    //     }
    // }

    async cancel(cancelRequest): Promise<CancelResponse> {

        const { cancelReq, headers, providerCred, booking } = cancelRequest;

        console.log("════════════════ TBO CANCEL START ════════════════");

        console.log("[TBO-CANCEL] Incoming cancelReq:",
            JSON.stringify(cancelReq, null, 2)
        );

        console.log("[TBO-CANCEL] Incoming booking:",
            JSON.stringify(booking, null, 2)
        );

        console.log("[TBO-CANCEL] Incoming providerCred:",
            JSON.stringify(providerCred, null, 2)
        );

        const finalResponse = new CancelResponse();

        finalResponse.success = false;
        finalResponse.cancellationStatus = '';
        finalResponse.mode = 'TBO';

        try {

            // STEP 1: GET AUTH TOKEN
            console.log("[TBO-CANCEL][STEP-1] Generating auth token request payload");

            const tokenRequestData = {
                providerCred,
                tokenReqData: cancelReq,
                headers,
                searchReqId: booking?.search_id,
                bookingReferenceId: booking?.booking_reference_id,
            };

            console.log("[TBO-CANCEL][STEP-1] tokenRequestData:",
                JSON.stringify(tokenRequestData, null, 2)
            );

            console.log("[TBO-CANCEL][STEP-1] Calling getAuthToken");

            const authToken =
                await this.tboAuthTokenService.getAuthToken(tokenRequestData);

            console.log("[TBO-CANCEL][STEP-1] Auth token response:",
                authToken
            );

            if (!authToken) {

                console.log("[TBO-CANCEL][STEP-1] Auth token failed");

                throw new InternalServerErrorException('Authentication failed');
            }

            const logPrefix = `cancel-${Date.now()}`;

            console.log("[TBO-CANCEL] logPrefix:", logPrefix);

            // STEP 2: RELEASE PNR FLOW
            if (cancelReq?.supplierParams?.releasePnr === true) {

                console.log("[TBO-CANCEL][STEP-2] RELEASE PNR FLOW STARTED");

                console.log("[TBO-CANCEL][STEP-2] Fetching booking details");

                const bookingDetails = await this.getBookingDetails({
                    cancelReq,
                    providerCred,
                    authToken,
                    headers,
                    logPrefix,
                    booking,
                });

                console.log("[TBO-CANCEL][STEP-2] bookingDetails:",
                    JSON.stringify(bookingDetails, null, 2)
                );

                const itinerary =
                    this.getFlightItineraryFromBookingDetails(bookingDetails);

                console.log("[TBO-CANCEL][STEP-2] itinerary:",
                    JSON.stringify(itinerary, null, 2)
                );

                const source = itinerary?.Source;

                console.log("[TBO-CANCEL][STEP-2] source:", source);

                console.log("[TBO-CANCEL][STEP-2] Calling releasePNR");

                const releaseResult = await this.releasePNR({
                    cancelReq,
                    providerCred,
                    authToken,
                    headers,
                    logPrefix,
                    source,
                    booking,
                });

                console.log("[TBO-CANCEL][STEP-2] releasePNR response:",
                    JSON.stringify(releaseResult, null, 2)
                );

                finalResponse.success =
                    releaseResult?.Response?.ResponseStatus === 1;

                finalResponse.message =
                    'Hold booking released successfully';

                finalResponse.error =
                    releaseResult?.Response?.Error;

                console.log("[TBO-CANCEL][STEP-2] Final releasePNR response:",
                    JSON.stringify(finalResponse, null, 2)
                );

                console.log("════════════════ TBO CANCEL END ════════════════");

                return finalResponse;
            }

            // STEP 3: BOOKING STATUS VALIDATION
            console.log("[TBO-CANCEL][STEP-3] Validating booking status");

            if (booking) {

                console.log("[TBO-CANCEL][STEP-3] booking.booking_status:",
                    booking.booking_status
                );

                const allowedStatuses = [1];

                if (!allowedStatuses.includes(booking.booking_status)) {

                    console.log("[TBO-CANCEL][STEP-3] Invalid booking status");

                    finalResponse.message =
                        `Cancellation not allowed for booking with status: ${booking.booking_status}`;

                    finalResponse.error = {
                        errorCode: 400,
                        errorMessage:
                            `Booking status must be CONFIRMED to cancel. Current status: ${booking.booking_status}`,
                    };

                    console.log("[TBO-CANCEL][STEP-3] Final response:",
                        JSON.stringify(finalResponse, null, 2)
                    );

                    return finalResponse;
                }
            }

            console.log("[TBO-CANCEL][STEP-3] Booking status validation passed");

            // STEP 4: SEND CHANGE REQUEST
            console.log("[TBO-CANCEL][STEP-4] Calling sendChangeRequest");

            const sendChangeRequestResult =
                await this.sendChangeRequest({
                    cancelReq,
                    providerCred,
                    authToken,
                    headers,
                    logPrefix,
                    booking,
                });

            console.log("[TBO-CANCEL][STEP-4] sendChangeRequestResult:",
                JSON.stringify(sendChangeRequestResult, null, 2)
            );

            if (!sendChangeRequestResult.success) {

                console.log("[TBO-CANCEL][STEP-4] Send change request failed");

                finalResponse.message =
                    'Failed to send change request';

                return finalResponse;
            }

            const changeRequestId =
                sendChangeRequestResult.changeRequestId;

            console.log("[TBO-CANCEL][STEP-4] changeRequestId:",
                changeRequestId
            );

            if (!changeRequestId) {

                console.log("[TBO-CANCEL][STEP-4] No changeRequestId received");

                finalResponse.message =
                    'No change request ID received';

                return finalResponse;
            }

            // STEP 5: GET CHANGE REQUEST STATUS
            console.log("[TBO-CANCEL][STEP-5] Calling getChangeRequestStatus");

            const getStatusResult =
                await this.getChangeRequestStatus({
                    changeRequestId,
                    providerCred,
                    authToken,
                    headers,
                    logPrefix,
                    booking,
                    cancelReq,
                });

            console.log("[TBO-CANCEL][STEP-5] getChangeRequestStatus response:",
                JSON.stringify(getStatusResult, null, 2)
            );

            // STEP 6: FINAL RESPONSE BUILD
            console.log("[TBO-CANCEL][STEP-6] Building final response");

            finalResponse.success =
                getStatusResult.responseStatus === 1;

            finalResponse.cancellationStatus =
                getStatusResult.responseStatus === 1 &&
                getStatusResult.changeRequestStatus ===
                    CancellationStatus.Completed;

            finalResponse.cancellationCharge =
                getStatusResult.cancellationCharge;

            finalResponse.refundedAmount =
                getStatusResult.refundedAmount;

            finalResponse.status =
                this.getCancellationStatusText(
                    getStatusResult.changeRequestStatus
                );

            finalResponse.error =
                getStatusResult.error;

            finalResponse.creditNoteNo =
                getStatusResult.creditNoteNo;

            finalResponse.creditNoteCreatedOn =
                getStatusResult.creditNoteCreatedOn;

            finalResponse.changeRequestId = changeRequestId;
            finalResponse.traceId = getStatusResult.traceId;

            console.log("[TBO-CANCEL][STEP-6] Final response:",
                JSON.stringify(finalResponse, null, 2)
            );

            console.log("════════════════ TBO CANCEL END ════════════════");

            return finalResponse;

        } catch (error) {

            console.error("[TBO-CANCEL] ERROR OCCURRED");
            console.error(error);

            finalResponse.message =
                error.message || 'Cancellation failed';

            finalResponse.error = {
                errorCode: -1,
                errorMessage: error.message,
            };

            console.log("[TBO-CANCEL] Final error response:",
                JSON.stringify(finalResponse, null, 2)
            );

            return finalResponse;
        }
    }

    /**
     * Resolves supplier_log_flight keys from DB booking (search_id is required for DB insert).
     */
    private resolveSupplierLogContext(
        booking?: {
            search_id?: string;
            booking_reference_id?: string;
            supplier_reference_id?: string;
        },
        cancelReq?: { bookingId?: number },
    ): { searchReqId: string | null; bookingReferenceId: string | null } {
        const searchReqId = booking?.search_id ?? null;
        const bookingReferenceId =
            booking?.booking_reference_id ??
            (cancelReq?.bookingId != null ? String(cancelReq.bookingId) : null);
        return { searchReqId, bookingReferenceId };
    }

    private async writeCancellationSupplierLog(params: {
        fileName: string;
        logData: unknown;
        title: string;
        booking?: {
            search_id?: string;
            booking_reference_id?: string;
            supplier_reference_id?: string;
        };
        cancelReq?: { bookingId?: number };
    }): Promise<void> {
        const { searchReqId, bookingReferenceId } = this.resolveSupplierLogContext(
            params.booking,
            params.cancelReq,
        );
        await this.supplierLogUtility.generateLogFile({
            fileName: params.fileName,
            logData: params.logData,
            folderName: 'cancellation',
            logId: null,
            title: params.title,
            searchReqId,
            bookingReferenceId,
        });
    }

    /**
     * Step 1: Release PNR Request
     * Used to release hold bookings that user doesn't want to ticket
     * Source is fetched from GetBookingDetails API response
     */
    private async releasePNR({
        cancelReq,
        providerCred,
        authToken,
        headers,
        logPrefix,
        source,
        booking,
    }) {
        try {
            const requestData: ReleasePNRRequestDto = {
                EndUserIp: resolveTboEndUserIp(headers as Record<string, unknown>),
                TokenId: authToken,
                BookingId: cancelReq.bookingId,
                Source: source || '4', // Source fetched from GetBookingDetails API
            };

            // dev
            // const endpoint = `${providerCred.url}BookingEngineService_Air/AirService.svc/rest/ReleasePNRRequest`;

            // prod
            const endpoint = `${providerCred.book_url}/rest/ReleasePNRRequest`;
            const response = await Http.httpRequestTBO('POST', endpoint, JSON.stringify(requestData));

            await this.writeCancellationSupplierLog({
                fileName: `${logPrefix}-releasepnr-TBO`,
                logData: { request: requestData, response },
                title: 'Release-PNR-TBO',
                booking,
                cancelReq,
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
    // private async sendChangeRequest({ cancelReq, providerCred, authToken, headers, logPrefix }) {
    //     try {
    //         const requestData: SendChangeRequestDto = {
    //             EndUserIp: resolveTboEndUserIp(headers as Record<string, unknown>),
    //             TokenId: authToken,
    //             BookingId: cancelReq.bookingId,
    //             RequestType: this.generateRequestType(cancelReq.requestType),
    //             CancellationType: this.generateCancellationType(cancelReq?.supplierParams?.cancellationType),
    //             Remarks: ((cancelReq?.supplierParams?.remarks) || 'Cancellation requested via API').trim(),
    //         };

    //         this.applyPartialCancellationFields(requestData, cancelReq);

    //         // dev
    //         const endpoint = `${providerCred.url}BookingEngineService_Air/AirService.svc/rest/SendChangeRequest`;

    //         // prod url
    //         // const endpoint = `${providerCred.book_url}/rest/SendChangeRequest`;
    //         const response = await Http.httpRequestTBO('POST', endpoint, JSON.stringify(requestData));

    //         await this.supplierLogUtility.generateLogFile({
    //             fileName: `${logPrefix}-sendchangerequest-TBO`,
    //             logData: { request: requestData, response },
    //             folderName: 'cancellation',
    //             logId: null,
    //             title: 'Send-Change-Request-TBO',
    //             searchReqId: null,
    //             bookingReferenceId: cancelReq.bookingId.toString(),
    //         });

    //         const changeRequestId = response?.Response?.TicketCRInfo?.[0]?.ChangeRequestId;
    //         const success = response?.Response?.ResponseStatus === 1;

    //         return {
    //             success,
    //             changeRequestId,
    //             response,
    //         };
    //     } catch (error) {
    //         console.error('Send Change Request Error:', error);
    //         return {
    //             success: false,
    //             changeRequestId: null,
    //             error: error.message,
    //         };
    //     }
    // }

    private async sendChangeRequest({
        cancelReq,
        providerCred,
        authToken,
        headers,
        logPrefix,
        booking,
    }) {

        console.log("════════════════ SEND CHANGE REQUEST START ════════════════");

        try {

            // STEP 1: BUILD REQUEST DATA
            console.log("[SEND-CHANGE-REQUEST][STEP-1] Building request payload");

            const requestData: SendChangeRequestDto = {
                EndUserIp: resolveTboEndUserIp(
                    headers as Record<string, unknown>
                ),

                TokenId: authToken,

                BookingId: cancelReq.bookingId,

                RequestType: this.generateRequestType(
                    cancelReq.requestType
                ),

                CancellationType: this.generateCancellationType(
                    cancelReq?.supplierParams?.cancellationType
                ),

                Remarks: (
                    (
                        cancelReq?.supplierParams?.remarks
                    ) || 'Cancellation requested via API'
                ).trim(),
            };

            console.log("[SEND-CHANGE-REQUEST][STEP-1] requestData before partial fields:",
                JSON.stringify(requestData, null, 2)
            );

            // STEP 2: APPLY PARTIAL CANCELLATION FIELDS
            console.log("[SEND-CHANGE-REQUEST][STEP-2] Applying partial cancellation fields");

            this.applyPartialCancellationFields(
                requestData,
                cancelReq
            );

            console.log("[SEND-CHANGE-REQUEST][STEP-2] requestData after partial fields:",
                JSON.stringify(requestData, null, 2)
            );

            // STEP 3: BUILD ENDPOINT
            console.log("[SEND-CHANGE-REQUEST][STEP-3] Building endpoint");

            const endpoint =
                `${providerCred.url}BookingEngineService_Air/AirService.svc/rest/SendChangeRequest`;

            console.log("[SEND-CHANGE-REQUEST][STEP-3] endpoint:",
                endpoint
            );

            // STEP 4: CALL TBO API
            console.log("[SEND-CHANGE-REQUEST][STEP-4] Calling TBO SendChangeRequest API");

            console.log("[SEND-CHANGE-REQUEST][STEP-4] FINAL REQUEST PAYLOAD:",
                JSON.stringify(requestData, null, 2)
            );

            const response = await Http.httpRequestTBO(
                'POST',
                endpoint,
                JSON.stringify(requestData)
            );

            console.log("[SEND-CHANGE-REQUEST][STEP-4] RAW API RESPONSE:",
                JSON.stringify(response, null, 2)
            );

            // STEP 5: SAVE LOG FILE
            console.log("[SEND-CHANGE-REQUEST][STEP-5] Saving supplier log");

            await this.writeCancellationSupplierLog({
                fileName: `${logPrefix}-sendchangerequest-TBO`,
                logData: {
                    request: requestData,
                    response,
                },
                title: 'Send-Change-Request-TBO',
                booking,
                cancelReq,
            });

            console.log("[SEND-CHANGE-REQUEST][STEP-5] Supplier log saved");

            // STEP 6: PARSE RESPONSE
            console.log("[SEND-CHANGE-REQUEST][STEP-6] Parsing response");

            const changeRequestId =
                response?.Response?.TicketCRInfo?.[0]?.ChangeRequestId;

            const success =
                response?.Response?.ResponseStatus === 1;

            console.log("[SEND-CHANGE-REQUEST][STEP-6] changeRequestId:",
                changeRequestId
            );

            console.log("[SEND-CHANGE-REQUEST][STEP-6] success:",
                success
            );

            const finalResult = {
                success,
                changeRequestId,
                response,
            };

            console.log("[SEND-CHANGE-REQUEST] Final result:",
                JSON.stringify(finalResult, null, 2)
            );

            console.log("════════════════ SEND CHANGE REQUEST END ════════════════");

            return finalResult;

        } catch (error) {

            console.error("[SEND-CHANGE-REQUEST] ERROR OCCURRED");
            console.error(error);

            const errorResult = {
                success: false,
                changeRequestId: null,
                error: error.message,
            };

            console.log("[SEND-CHANGE-REQUEST] Final error result:",
                JSON.stringify(errorResult, null, 2)
            );

            return errorResult;
        }
    }

    /**
     * Step 3: Get Change Request Status
     * Checks the status of the cancellation request
     */
    // private async getChangeRequestStatus({ changeRequestId, providerCred, authToken, headers, logPrefix }) {
    //     try {
    //         const requestData: GetChangeRequestStatusRequestDto = {
    //             EndUserIp: resolveTboEndUserIp(headers as Record<string, unknown>),
    //             TokenId: authToken,
    //             ChangeRequestId: changeRequestId,
    //         };

    //         // dev
    //         const endpoint = `${providerCred.url}BookingEngineService_Air/AirService.svc/rest/GetChangeRequestStatus`;

    //         // prod
    //         // const endpoint = `${providerCred.book_url}/rest/GetChangeRequestStatus`;

    //         const response = await Http.httpRequestTBO('POST', endpoint, JSON.stringify(requestData));

    //         // Some responses are wrapped inside a top-level `Response` object. Normalize it.
    //         const res = (response && response.Response) ? response.Response : response;

    //         // Log the request/response
    //         await this.supplierLogUtility.generateLogFile({
    //             fileName: `${logPrefix}-getchangerequeststatus-TBO`,
    //             logData: { request: requestData, response: res },
    //             folderName: 'cancellation',
    //             logId: null,
    //             title: 'Get-Change-Request-Status-TBO',
    //             searchReqId: null,
    //             bookingReferenceId: changeRequestId?.toString(),
    //         });

    //         return {
    //             changeRequestId: res?.ChangeRequestId,
    //             refundedAmount: res?.RefundedAmount || 0,
    //             cancellationCharge: res?.CancellationCharge || 0,
    //             serviceTaxOnRAF: res?.ServiceTaxOnRAF || 0,
    //             changeRequestStatus: res?.ChangeRequestStatus || 0,
    //             traceId: res?.TraceId,
    //             responseStatus: res?.ResponseStatus || 0,
    //             error: res?.Error,
    //             creditNoteNo: res?.CreditNoteNo,
    //             creditNoteCreatedOn: res?.CreditNoteCreatedOn,
    //         };
    //     } catch (error) {
    //         console.error('Get Change Request Status Error:', error);
    //         return {
    //             changeRequestStatus: 0,
    //             responseStatus: 2,
    //             error: { ErrorCode: -1, ErrorMessage: error.message },
    //         };
    //     }
    // }

    private async getChangeRequestStatus({
        changeRequestId,
        providerCred,
        authToken,
        headers,
        logPrefix,
        booking,
        cancelReq,
    }) {

        console.log("════════════════ GET CHANGE REQUEST STATUS START ════════════════");

        try {

            // STEP 1: BUILD REQUEST DATA
            console.log("[GET-CHANGE-STATUS][STEP-1] Building request payload");

            const requestData: GetChangeRequestStatusRequestDto = {

                EndUserIp: resolveTboEndUserIp(
                    headers as Record<string, unknown>
                ),

                TokenId: authToken,

                ChangeRequestId: changeRequestId,
            };

            console.log("[GET-CHANGE-STATUS][STEP-1] requestData:",
                JSON.stringify(requestData, null, 2)
            );

            // STEP 2: BUILD ENDPOINT
            console.log("[GET-CHANGE-STATUS][STEP-2] Building endpoint");

            const endpoint =
                `${providerCred.url}BookingEngineService_Air/AirService.svc/rest/GetChangeRequestStatus`;

            console.log("[GET-CHANGE-STATUS][STEP-2] endpoint:",
                endpoint
            );

            // STEP 3: CALL TBO API
            console.log("[GET-CHANGE-STATUS][STEP-3] Calling GetChangeRequestStatus API");

            console.log("[GET-CHANGE-STATUS][STEP-3] FINAL REQUEST PAYLOAD:",
                JSON.stringify(requestData, null, 2)
            );

            const response = await Http.httpRequestTBO(
                'POST',
                endpoint,
                JSON.stringify(requestData)
            );

            console.log("[GET-CHANGE-STATUS][STEP-3] RAW API RESPONSE:",
                JSON.stringify(response, null, 2)
            );

            // STEP 4: NORMALIZE RESPONSE
            console.log("[GET-CHANGE-STATUS][STEP-4] Normalizing response");

            const res =
                (response && response.Response)
                    ? response.Response
                    : response;

            console.log("[GET-CHANGE-STATUS][STEP-4] normalized response:",
                JSON.stringify(res, null, 2)
            );

            // STEP 5: SAVE SUPPLIER LOG
            console.log("[GET-CHANGE-STATUS][STEP-5] Saving supplier log");

            await this.writeCancellationSupplierLog({
                fileName: `${logPrefix}-getchangerequeststatus-TBO`,
                logData: {
                    request: requestData,
                    response: res,
                    changeRequestId,
                },
                title: 'Get-Change-Request-Status-TBO',
                booking,
                cancelReq,
            });

            console.log("[GET-CHANGE-STATUS][STEP-5] Supplier log saved");

            // STEP 6: BUILD FINAL RESPONSE
            console.log("[GET-CHANGE-STATUS][STEP-6] Building final parsed response");

            const finalResult = {

                changeRequestId:
                    res?.ChangeRequestId,

                refundedAmount:
                    res?.RefundedAmount || 0,

                cancellationCharge:
                    res?.CancellationCharge || 0,

                serviceTaxOnRAF:
                    res?.ServiceTaxOnRAF || 0,

                changeRequestStatus:
                    res?.ChangeRequestStatus || 0,

                traceId:
                    res?.TraceId,

                responseStatus:
                    res?.ResponseStatus || 0,

                error:
                    res?.Error,

                creditNoteNo:
                    res?.CreditNoteNo,

                creditNoteCreatedOn:
                    res?.CreditNoteCreatedOn,
            };

            console.log("[GET-CHANGE-STATUS][STEP-6] Final parsed result:",
                JSON.stringify(finalResult, null, 2)
            );

            console.log("════════════════ GET CHANGE REQUEST STATUS END ════════════════");

            return finalResult;

        } catch (error) {

            console.error("[GET-CHANGE-STATUS] ERROR OCCURRED");
            console.error(error);

            // const errorResult = {

            //     changeRequestStatus: 0,

            //     responseStatus: 2,

            //     error: {
            //         ErrorCode: -1,
            //         ErrorMessage: error.message
            //     },
            // };

            const errorResult = {

                changeRequestId: null,

                refundedAmount: 0,

                cancellationCharge: 0,

                serviceTaxOnRAF: 0,

                changeRequestStatus: 0,

                traceId: null,

                responseStatus: 2,

                error: {
                    ErrorCode: -1,
                    ErrorMessage: error.message
                },

                creditNoteNo: null,

                creditNoteCreatedOn: null,
            };
            console.log("[GET-CHANGE-STATUS] Final error result:",
                JSON.stringify(errorResult, null, 2)
            );

            return errorResult;
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
        booking,
    }) {
        try {
            console.log('================ TBO GET CANCELLATION CHARGES API ================');

            console.log('Incoming cancelReq =>', JSON.stringify(cancelReq, null, 2));
            console.log('Incoming headers =>', JSON.stringify(headers, null, 2));
            console.log(
                'Incoming providerCred =>',
                JSON.stringify(
                    redactTboCredentialsForLog(
                        providerCred as Record<string, unknown>,
                    ),
                    null,
                    2,
                ),
            );
            console.log('Incoming authToken =>', authToken);
            console.log('Incoming logPrefix =>', logPrefix);

            const endUserIp = resolveTboEndUserIp(headers as Record<string, unknown>);

            const bookingDetails = await this.getBookingDetails({
                cancelReq,
                providerCred,
                authToken,
                headers,
                logPrefix: `${logPrefix}-precharges`,
                booking,
            });
            const itinerary =
                this.getFlightItineraryFromBookingDetails(bookingDetails);
            const bookingMode =
                typeof itinerary?.BookingMode === 'number'
                    ? itinerary.BookingMode
                    : 5;

            const requestData: GetCancellationChargesRequestDto = {
                EndUserIp: endUserIp,
                TokenId: authToken,
                RequestType: this.generateRequestType(cancelReq.requestType),
                BookingId: cancelReq.bookingId,
                BookingMode: bookingMode,
            };

            this.applyPartialCancellationFields(requestData, cancelReq);

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

            await this.writeCancellationSupplierLog({
                fileName: `${logPrefix}-getcancellationcharges-TBO`,
                logData: {
                    request: requestData,
                    response,
                },
                title: 'Get-Cancellation-Charges-TBO',
                booking,
                cancelReq,
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
        const { cancelReq, headers, providerCred, booking } = cancelRequest;

        console.log('================ TBO FETCH CANCELLATION CHARGES ================');

        console.log('Headers =>', JSON.stringify(headers, null, 2));
        console.log('CancelReq =>', JSON.stringify(cancelReq, null, 2));
        console.log(
            'ProviderCred =>',
            JSON.stringify(
                redactTboCredentialsForLog(
                    providerCred as Record<string, unknown>,
                ),
                null,
                2,
            ),
        );

        try {
            const tokenRequestData = {
                providerCred,
                tokenReqData: cancelReq,
                headers,
                searchReqId: booking?.search_id,
                bookingReferenceId: booking?.booking_reference_id,
            };

            console.log(
                'Token Request Data =>',
                JSON.stringify(
                    {
                        ...tokenRequestData,
                        providerCred: redactTboCredentialsForLog(
                            providerCred as Record<string, unknown>,
                        ),
                    },
                    null,
                    2,
                ),
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
                booking,
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

    private getFlightItineraryFromBookingDetails(
        bookingDetails: Record<string, unknown> | null,
    ): Record<string, unknown> | null {
        if (!bookingDetails) return null;
        const outer = bookingDetails.Response as
            | Record<string, unknown>
            | undefined;
        if (!outer) return null;
        if (outer.FlightItinerary) {
            return outer.FlightItinerary as Record<string, unknown>;
        }
        const inner = outer.Response as Record<string, unknown> | undefined;
        if (inner?.FlightItinerary) {
            return inner.FlightItinerary as Record<string, unknown>;
        }
        return null;
    }

    /** Maps TBO ChangeRequestStatus numeric code to label (see CancellationStatus enum). */
    private getCancellationStatusText(status: number): string {
        return CancellationStatus[status] ?? 'Other';
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
     * Adds TicketId / Sectors for TBO partial cancellation (RequestType 2).
     * Used by GetCancellationCharges and SendChangeRequest.
     */
    private applyPartialCancellationFields(
        requestData: GetCancellationChargesRequestDto | SendChangeRequestDto,
        cancelReq: {
            requestType: string | number;
            supplierParams?: {
                ticketIds?: number[];
                sectors?: { origin: string; destination: string }[];
            };
        },
    ): void {
        if (this.generateRequestType(cancelReq.requestType) !== 2) {
            return;
        }

        const ticketIds = cancelReq?.supplierParams?.ticketIds;
        const sectors = cancelReq?.supplierParams?.sectors;

        if (ticketIds?.length) {
            requestData.TicketId = ticketIds;
        }

        if (sectors?.length) {
            requestData.Sectors = sectors.map((sector) => ({
                Origin: sector.origin,
                Destination: sector.destination,
            }));
        }

        if (!requestData.TicketId && !requestData.Sectors?.length) {
            throw new BadRequestException(
                'Sectors or ticket IDs are required for partial cancellation',
            );
        }
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
    private async getBookingDetails({
        cancelReq,
        providerCred,
        authToken,
        headers,
        logPrefix,
        booking,
    }) {
        try {
            const requestData = {
                EndUserIp: resolveTboEndUserIp(headers as Record<string, unknown>),
                TokenId: authToken,
                BookingId: cancelReq.bookingId,
            };

            // dev
            // const endpoint = `${providerCred.url}BookingEngineService_Air/AirService.svc/rest/GetBookingDetails`;

            // prod
            const endpoint = `${providerCred.book_url}/rest/GetBookingDetails`;
            const response = await Http.httpRequestTBO('POST', endpoint, JSON.stringify(requestData));

            await this.writeCancellationSupplierLog({
                fileName: `${logPrefix}-getbookingdetails-TBO`,
                logData: { request: requestData, response },
                title: 'Get-Booking-Details-TBO',
                booking,
                cancelReq,
            });

            return response;
        } catch (error) {
            console.error('Get Booking Details Error:', error);
            return null;
        }
    }
}


