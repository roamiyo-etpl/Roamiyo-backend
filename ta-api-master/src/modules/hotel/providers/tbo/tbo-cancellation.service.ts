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

interface TboHotelCancellationChargeBreakUp {
    CancellationFees?: number;
    CancellationServiceCharge?: number;
}

interface TboHotelCreditNoteFields {
    CreditNoteNo?: string;
    CreditNoteCreatedOn?: string;
    CreditNoteGSTIN?: string;
    TotalPrice?: number;
    CancellationChargeBreakUp?: TboHotelCancellationChargeBreakUp | null;
}

interface TboHotelSendChangeRequestResult extends TboHotelCreditNoteFields {
    TraceId?: string;
    ChangeRequestId?: number;
    ChangeRequestStatus?: number;
    CancellationCharge?: number;
    RefundedAmount?: number;
    RefundAmount?: number;
    ResponseStatus?: number;
    Error?: TboHotelError;
}

interface TboHotelGetChangeRequestStatusResult extends TboHotelCreditNoteFields {
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
    creditNoteNo?: string;
    creditNoteCreatedOn?: string;
    creditNoteGstin?: string;
    totalPrice?: number;
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
                'cancel-send-change',
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

            const sendCreditFields = this.extractCreditNoteFields(sendChangeResult);
            finalResponse.creditNoteNo = sendCreditFields.creditNoteNo;
            finalResponse.creditNoteCreatedOn = sendCreditFields.creditNoteCreatedOn;
            if (sendChangeResult.RefundedAmount != null || sendChangeResult.RefundAmount != null) {
                finalResponse.refundedAmount = Number(
                    sendChangeResult.RefundedAmount ?? sendChangeResult.RefundAmount ?? 0,
                );
            }
            finalResponse.cancellationCharge = this.extractCancellationCharge(sendChangeResult);

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

            // Prefer poll values; fall back to SendChangeRequest credit/amount fields.
            if (!statusResult.creditNoteNo && sendCreditFields.creditNoteNo) {
                statusResult.creditNoteNo = sendCreditFields.creditNoteNo;
            }
            if (!statusResult.creditNoteCreatedOn && sendCreditFields.creditNoteCreatedOn) {
                statusResult.creditNoteCreatedOn = sendCreditFields.creditNoteCreatedOn;
            }
            if (!statusResult.creditNoteGstin && sendCreditFields.creditNoteGstin) {
                statusResult.creditNoteGstin = sendCreditFields.creditNoteGstin;
            }
            if (!statusResult.refundedAmount && finalResponse.refundedAmount) {
                statusResult.refundedAmount = Number(finalResponse.refundedAmount);
            }
            if (!statusResult.cancellationCharge && finalResponse.cancellationCharge) {
                statusResult.cancellationCharge = Number(finalResponse.cancellationCharge);
            }

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
        finalResponse.creditNoteNo = statusResult.creditNoteNo ?? finalResponse.creditNoteNo;
        finalResponse.creditNoteCreatedOn =
            statusResult.creditNoteCreatedOn ?? finalResponse.creditNoteCreatedOn;

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
                'cancel-change-status',
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

            const creditFields = this.extractCreditNoteFields(statusResult);

            lastResult = {
                changeRequestId: statusResult.ChangeRequestId ?? changeRequestId,
                changeRequestStatus,
                cancellationCharge: this.extractCancellationCharge(statusResult),
                refundedAmount: Number(
                    statusResult.RefundedAmount ?? statusResult.RefundAmount ?? 0,
                ),
                responseStatus: Number(statusResult.ResponseStatus ?? 0),
                traceId: statusResult.TraceId,
                creditNoteNo: creditFields.creditNoteNo,
                creditNoteCreatedOn: creditFields.creditNoteCreatedOn,
                creditNoteGstin: creditFields.creditNoteGstin,
                totalPrice: creditFields.totalPrice,
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

    private extractCancellationCharge(
        result?: TboHotelCreditNoteFields & { CancellationCharge?: number },
    ): number {
        if (result?.CancellationCharge != null && !Number.isNaN(Number(result.CancellationCharge))) {
            return Number(result.CancellationCharge);
        }

        const breakUp = result?.CancellationChargeBreakUp;
        if (breakUp) {
            return (
                Number(breakUp.CancellationFees ?? 0) +
                Number(breakUp.CancellationServiceCharge ?? 0)
            );
        }

        return 0;
    }

    private extractCreditNoteFields(result?: TboHotelCreditNoteFields): {
        creditNoteNo?: string;
        creditNoteCreatedOn?: string;
        creditNoteGstin?: string;
        totalPrice?: number;
    } {
        if (!result) {
            return {};
        }

        return {
            creditNoteNo: result.CreditNoteNo || undefined,
            creditNoteCreatedOn: result.CreditNoteCreatedOn || undefined,
            creditNoteGstin: result.CreditNoteGSTIN || undefined,
            totalPrice:
                result.TotalPrice != null && !Number.isNaN(Number(result.TotalPrice))
                    ? Number(result.TotalPrice)
                    : undefined,
        };
    }

    private async executeWithRetry(
        request: Record<string, unknown>,
        endpoint: string,
        auth: { username: string; password: string },
        flow: string,
        maxRetries = 2,
    ): Promise<unknown> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await Http.httpRequestTBOHotel('POST', endpoint, request, auth, { flow });
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
