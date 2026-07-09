import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { TboAuthTokenService } from './tbo-auth-token.service';
import { Http } from 'src/shared/utilities/flight/http.utility';
import { HotelProviderUtility } from 'src/shared/utilities/hotel/hotel-provider.utility';
import { CancelResponse } from 'src/modules/cancel/interfaces/cancel.interface';
import {
    HOTEL_BOOKING_MODE,
    HOTEL_CANCEL_REQUEST_TYPE,
    HotelChangeRequestStatus,
    HotelCancelPollInput,
    ResolvedHotelCancelPollOptions,
    getHotelChangeRequestStatusLabel,
    isHotelCancellationSuccessful,
    isHotelCancellationTerminal,
    resolveHotelCancelPollOptions,
    shouldPollHotelChangeRequestStatus,
} from '../../cancel/dtos/hotel-cancel.dto';

const DEFAULT_IP_ADDRESS = '192.000.000.000';

interface TboHotelError {
    ErrorCode?: number;
    ErrorMessage?: string;
}

interface TboHotelSendChangeRequestResult {
    TraceId?: string;
    ChangeRequestId?: number;
    ChangeRequestStatus?: number;
    ResponseStatus?: number;
    Error?: TboHotelError;
}

interface TboHotelGetChangeRequestStatusResult {
    TraceId?: string;
    ChangeRequestId?: number;
    ChangeRequestStatus?: number;
    CancellationCharge?: number;
    RefundedAmount?: number;
    RefundAmount?: number;
    ResponseStatus?: number;
    Error?: TboHotelError;
}

interface TboHotelSendChangeResponse {
    HotelChangeRequestResult?: TboHotelSendChangeRequestResult;
}

interface TboHotelGetChangeStatusResponse {
    HotelChangeRequestStatusResult?: TboHotelGetChangeRequestStatusResult;
}

type HotelCancelExtendedResponse = CancelResponse & {
    hotelChangeRequestStatus?: number;
    sendChangeRequestResponse?: unknown;
    getChangeRequestStatusResponse?: unknown;
};

interface StatusPollResult {
    changeRequestId: number;
    changeRequestStatus: number;
    cancellationCharge: number;
    refundedAmount: number;
    responseStatus: number;
    traceId?: string;
    error?: TboHotelError;
    raw: unknown;
}

@Injectable()
export class TboCancellationService {
    constructor(
        private readonly tboAuthTokenService: TboAuthTokenService,
    ) {}

    async cancel(cancelRequest: {
        cancelReq: {
            bookingId: number;
            supplierParams?: { remarks?: string };
        } & HotelCancelPollInput;
        providerCred: Record<string, unknown>;
        headers: Record<string, unknown>;
        booking?: { booking_reference_id?: string; search_id?: string };
    }): Promise<HotelCancelExtendedResponse> {
        const { cancelReq, providerCred, headers, booking } = cancelRequest;
        const pollOptions = resolveHotelCancelPollOptions(cancelReq);

        console.log('════════════════ TBO HOTEL CANCEL START ════════════════');
        console.log('[TBO-HOTEL-CANCEL] bookingId:', cancelReq.bookingId);
        console.log('[TBO-HOTEL-CANCEL] Poll config:', JSON.stringify(pollOptions));

        const finalResponse: HotelCancelExtendedResponse = {
            success: false,
            message: 'Hotel cancellation failed',
            mode: HotelProviderUtility.modeFromCredentials(providerCred) || 'TBO',
            cancellationStatus: false,
        };

        try {
            const auth = {
                username: String(providerCred.username ?? ''),
                password: String(providerCred.password ?? ''),
            };

            const tokenRequest = {
                providerCred,
                headers,
                searchReqId: booking?.search_id,
            };

            console.log('[TBO-HOTEL-CANCEL][STEP-1] Fetching auth token');
            const authToken = await this.tboAuthTokenService.getAuthToken(tokenRequest);
            console.log('[TBO-HOTEL-CANCEL][STEP-1] Auth token received');

            const endUserIp = String(headers['ip-address'] || DEFAULT_IP_ADDRESS);
            const remarks = cancelReq.supplierParams?.remarks || 'Hotel cancellation requested';

            const sendChangeRequestBody = {
                BookingMode: HOTEL_BOOKING_MODE,
                RequestType: HOTEL_CANCEL_REQUEST_TYPE,
                Remarks: remarks,
                BookingId: cancelReq.bookingId,
                EndUserIp: endUserIp,
                TokenId: authToken,
            };

            const sendChangeEndpoint = `${providerCred.book_url}/SendChangeRequest`;

            console.log('[TBO-HOTEL-CANCEL][STEP-2] BEFORE SendChangeRequest');
            console.log('[TBO-HOTEL-CANCEL][STEP-2] Endpoint:', sendChangeEndpoint);
            console.log('[TBO-HOTEL-CANCEL][STEP-2] Request:', JSON.stringify(sendChangeRequestBody, null, 2));

            const sendChangeRaw = (await this.executeWithRetry(
                sendChangeRequestBody,
                sendChangeEndpoint,
                auth,
            )) as TboHotelSendChangeResponse;

            console.log('[TBO-HOTEL-CANCEL][STEP-2] AFTER SendChangeRequest');
            console.log('[TBO-HOTEL-CANCEL][STEP-2] Response:', JSON.stringify(sendChangeRaw, null, 2));

            const sendChangeResult = sendChangeRaw?.HotelChangeRequestResult;
            finalResponse.sendChangeRequestResponse = sendChangeResult;
            finalResponse.traceId = sendChangeResult?.TraceId;

            if (!sendChangeResult) {
                finalResponse.message = 'Invalid SendChangeRequest response from TBO';
                finalResponse.error = { errorCode: -1, errorMessage: finalResponse.message };
                return finalResponse;
            }

            if (sendChangeResult.Error?.ErrorCode !== 0) {
                finalResponse.message =
                    sendChangeResult.Error?.ErrorMessage || 'SendChangeRequest failed';
                finalResponse.error = {
                    errorCode: sendChangeResult.Error?.ErrorCode ?? -1,
                    errorMessage: finalResponse.message,
                };
                return finalResponse;
            }

            const changeRequestId = sendChangeResult.ChangeRequestId;
            if (!changeRequestId) {
                finalResponse.message = 'No ChangeRequestId received from TBO';
                finalResponse.error = { errorCode: -1, errorMessage: finalResponse.message };
                return finalResponse;
            }

            finalResponse.changeRequestId = changeRequestId;

            console.log('[TBO-HOTEL-CANCEL][STEP-3] ChangeRequestId:', changeRequestId);
            console.log(
                '[TBO-HOTEL-CANCEL][STEP-3] Initial ChangeRequestStatus:',
                sendChangeResult.ChangeRequestStatus,
                getHotelChangeRequestStatusLabel(sendChangeResult.ChangeRequestStatus ?? 0),
            );

            const statusResult = await this.pollChangeRequestStatus({
                changeRequestId,
                authToken,
                endUserIp,
                providerCred,
                auth,
                initialStatus: sendChangeResult.ChangeRequestStatus,
                pollOptions,
            });

            return this.applyStatusToResponse({
                finalResponse,
                statusResult,
                remarks,
                changeRequestId,
            });
        } catch (error) {
            console.error('[TBO-HOTEL-CANCEL] ERROR:', error);
            finalResponse.message = error.message || 'Hotel cancellation failed';
            finalResponse.error = {
                errorCode: -1,
                errorMessage: finalResponse.message,
            };
            return finalResponse;
        }
    }

    /** Poll existing ChangeRequestId only — no SendChangeRequest */
    async pollCancelStatus(cancelRequest: {
        changeRequestId: number;
        providerCred: Record<string, unknown>;
        headers: Record<string, unknown>;
        booking?: { search_id?: string };
    } & HotelCancelPollInput): Promise<HotelCancelExtendedResponse> {
        const { changeRequestId, providerCred, headers, booking, ...pollInput } = cancelRequest;
        const pollOptions = resolveHotelCancelPollOptions(pollInput);

        console.log('════════════════ TBO HOTEL POLL STATUS START ════════════════');
        console.log('[TBO-HOTEL-POLL] changeRequestId:', changeRequestId);
        console.log('[TBO-HOTEL-POLL] Poll config:', JSON.stringify(pollOptions));

        const finalResponse: HotelCancelExtendedResponse = {
            success: false,
            message: 'Hotel cancellation status check failed',
            mode: HotelProviderUtility.modeFromCredentials(providerCred) || 'TBO',
            cancellationStatus: false,
            changeRequestId,
        };

        try {
            const auth = {
                username: String(providerCred.username ?? ''),
                password: String(providerCred.password ?? ''),
            };

            const tokenRequest = {
                providerCred,
                headers,
                searchReqId: booking?.search_id,
            };

            const authToken = await this.tboAuthTokenService.getAuthToken(tokenRequest);
            const endUserIp = String(headers['ip-address'] || DEFAULT_IP_ADDRESS);

            const statusResult = await this.pollChangeRequestStatus({
                changeRequestId,
                authToken,
                endUserIp,
                providerCred,
                auth,
                pollOptions,
            });

            return this.applyStatusToResponse({
                finalResponse,
                statusResult,
                changeRequestId,
            });
        } catch (error) {
            console.error('[TBO-HOTEL-POLL] ERROR:', error);
            finalResponse.message = error.message || 'Hotel cancellation status check failed';
            finalResponse.error = {
                errorCode: -1,
                errorMessage: finalResponse.message,
            };
            return finalResponse;
        }
    }

    private applyStatusToResponse(params: {
        finalResponse: HotelCancelExtendedResponse;
        statusResult: StatusPollResult;
        remarks?: string;
        changeRequestId: number;
    }): HotelCancelExtendedResponse {
        const { finalResponse, statusResult, remarks, changeRequestId } = params;

        finalResponse.getChangeRequestStatusResponse = statusResult.raw;
        finalResponse.hotelChangeRequestStatus = statusResult.changeRequestStatus;
        finalResponse.cancellationCharge = statusResult.cancellationCharge;
        finalResponse.refundedAmount = statusResult.refundedAmount;
        finalResponse.traceId = statusResult.traceId ?? finalResponse.traceId;
        finalResponse.status = getHotelChangeRequestStatusLabel(statusResult.changeRequestStatus);
        finalResponse.changeRequestId = changeRequestId;

        if (remarks) {
            finalResponse.remarks = remarks;
        }

        const isProcessed = isHotelCancellationSuccessful(statusResult.changeRequestStatus);
        const isRejected = statusResult.changeRequestStatus === HotelChangeRequestStatus.Rejected;
        const pending = shouldPollHotelChangeRequestStatus(statusResult.changeRequestStatus);

        finalResponse.cancelSubmitted = true;
        finalResponse.cancelCompleted = isProcessed;
        finalResponse.pendingCompletion = pending;
        finalResponse.success = statusResult.responseStatus === 1 && !isRejected;
        finalResponse.cancellationStatus = isProcessed;
        finalResponse.message = isProcessed
            ? 'Hotel cancellation processed successfully'
            : isRejected
              ? 'Hotel cancellation was rejected by supplier'
              : pending
                ? `Hotel cancellation is ${finalResponse.status}. Poll POST /cancel/status with changeRequestId until Processed.`
                : `Hotel cancellation in status: ${finalResponse.status}`;

        if (statusResult.error?.ErrorCode) {
            finalResponse.error = {
                errorCode: statusResult.error.ErrorCode ?? -1,
                errorMessage: statusResult.error.ErrorMessage || finalResponse.message,
            };
        }

        console.log('[TBO-HOTEL-CANCEL] Final response:', JSON.stringify(finalResponse, null, 2));
        console.log('════════════════ TBO HOTEL CANCEL END ════════════════');

        return finalResponse;
    }

    private async pollChangeRequestStatus(params: {
        changeRequestId: number;
        authToken: string;
        endUserIp: string;
        providerCred: Record<string, unknown>;
        auth: { username: string; password: string };
        initialStatus?: number;
        pollOptions?: ResolvedHotelCancelPollOptions;
    }): Promise<StatusPollResult> {
        const {
            changeRequestId,
            authToken,
            endUserIp,
            providerCred,
            auth,
            pollOptions: resolvedPoll = resolveHotelCancelPollOptions(),
        } = params;
        const { maxAttempts, delayMs, timeoutMs } = resolvedPoll;
        const pollStartedAt = Date.now();

        let lastResult: StatusPollResult = {
            changeRequestId,
            changeRequestStatus: params.initialStatus ?? HotelChangeRequestStatus.NotSet,
            cancellationCharge: 0,
            refundedAmount: 0,
            responseStatus: 0,
            traceId: undefined,
            error: undefined,
            raw: null,
        };

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const statusBody = {
                BookingMode: HOTEL_BOOKING_MODE,
                ChangeRequestId: changeRequestId,
                EndUserIp: endUserIp,
                TokenId: authToken,
            };

            const statusEndpoint = `${providerCred.book_url}/GetChangeRequestStatus`;

            console.log(`[TBO-HOTEL-CANCEL][POLL-${attempt}] BEFORE GetChangeRequestStatus`);
            console.log(`[TBO-HOTEL-CANCEL][POLL-${attempt}] Endpoint:`, statusEndpoint);
            console.log(`[TBO-HOTEL-CANCEL][POLL-${attempt}] Request:`, JSON.stringify(statusBody, null, 2));

            const statusRaw = (await this.executeWithRetry(
                statusBody,
                statusEndpoint,
                auth,
            )) as TboHotelGetChangeStatusResponse;

            console.log(`[TBO-HOTEL-CANCEL][POLL-${attempt}] AFTER GetChangeRequestStatus`);
            console.log(`[TBO-HOTEL-CANCEL][POLL-${attempt}] Response:`, JSON.stringify(statusRaw, null, 2));

            const statusResult = statusRaw?.HotelChangeRequestStatusResult;
            if (!statusResult) {
                throw new InternalServerErrorException('Invalid GetChangeRequestStatus response from TBO');
            }

            const changeRequestStatus = Number(
                statusResult.ChangeRequestStatus ?? HotelChangeRequestStatus.NotSet,
            );

            lastResult = {
                changeRequestId: statusResult.ChangeRequestId ?? changeRequestId,
                changeRequestStatus,
                cancellationCharge: Number(statusResult.CancellationCharge ?? 0),
                refundedAmount: Number(
                    statusResult.RefundedAmount ?? statusResult.RefundAmount ?? 0,
                ),
                responseStatus: Number(statusResult.ResponseStatus ?? 0),
                traceId: statusResult.TraceId,
                error: statusResult.Error,
                raw: statusResult,
            };

            console.log(
                `[TBO-HOTEL-CANCEL][POLL-${attempt}] Status:`,
                changeRequestStatus,
                getHotelChangeRequestStatusLabel(changeRequestStatus),
            );

            if (isHotelCancellationTerminal(changeRequestStatus)) {
                return lastResult;
            }

            if (!shouldPollHotelChangeRequestStatus(changeRequestStatus)) {
                return lastResult;
            }

            const elapsedMs = Date.now() - pollStartedAt;
            if (timeoutMs !== undefined && elapsedMs >= timeoutMs) {
                console.log(
                    `[TBO-HOTEL-CANCEL][POLL-${attempt}] Stopping — pollTimeoutMs (${timeoutMs}ms) reached`,
                );
                return lastResult;
            }

            if (attempt < maxAttempts) {
                console.log(`[TBO-HOTEL-CANCEL][POLL-${attempt}] Waiting ${delayMs}ms before retry`);
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        }

        return lastResult;
    }

    private async executeWithRetry(
        request: Record<string, unknown>,
        endpoint: string,
        auth: { username: string; password: string },
        maxRetries = 2,
    ): Promise<unknown> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await Http.httpRequestTBOHotel('POST', endpoint, request, auth);
                console.log(`[TBO-HOTEL-CANCEL] HTTP success (attempt ${attempt}):`, endpoint);
                return response;
            } catch (error) {
                console.error(
                    `[TBO-HOTEL-CANCEL] HTTP failed (attempt ${attempt}):`,
                    endpoint,
                    error?.message,
                );
                if (attempt === maxRetries) {
                    throw error;
                }
                await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
            }
        }

        throw new InternalServerErrorException('TBO hotel cancel request failed after retries');
    }
}
