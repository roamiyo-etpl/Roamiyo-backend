/**
 * TBO Hotel ChangeRequestStatus values (SendChangeRequest / GetChangeRequestStatus).
 * These differ from flight cancellation status enums.
 */
export enum HotelChangeRequestStatus {
    NotSet = 0,
    Pending = 1,
    InProgress = 2,
    Processed = 3,
    Rejected = 4,
}

export const HOTEL_CHANGE_REQUEST_STATUS_LABELS: Record<HotelChangeRequestStatus, string> = {
    [HotelChangeRequestStatus.NotSet]: 'NotSet',
    [HotelChangeRequestStatus.Pending]: 'Pending',
    [HotelChangeRequestStatus.InProgress]: 'InProgress',
    [HotelChangeRequestStatus.Processed]: 'Processed',
    [HotelChangeRequestStatus.Rejected]: 'Rejected',
};

/** TBO hotel cancel request type */
export const HOTEL_CANCEL_REQUEST_TYPE = 4;

/** TBO hotel booking mode */
export const HOTEL_BOOKING_MODE = 5;

export function getHotelChangeRequestStatusLabel(status: number): string {
    return HOTEL_CHANGE_REQUEST_STATUS_LABELS[status as HotelChangeRequestStatus] ?? 'Unknown';
}

export function isHotelCancellationSuccessful(status: number): boolean {
    return status === HotelChangeRequestStatus.Processed;
}

export function isHotelCancellationTerminal(status: number): boolean {
    return (
        status === HotelChangeRequestStatus.Processed ||
        status === HotelChangeRequestStatus.Rejected
    );
}

export function shouldPollHotelChangeRequestStatus(status: number): boolean {
    return (
        status === HotelChangeRequestStatus.Pending ||
        status === HotelChangeRequestStatus.InProgress
    );
}

export function isHotelCancellationInFlight(status: number): boolean {
    return shouldPollHotelChangeRequestStatus(status);
}

/** Fallback when caller omits pollMaxAttempts (e.g. direct API use without payment service). */
export const HOTEL_CANCEL_POLL_MAX_ATTEMPTS = Number(
    process.env.HOTEL_CANCEL_POLL_MAX_ATTEMPTS ?? 5,
);
/** Fallback when caller omits pollIntervalMs. */
export const HOTEL_CANCEL_POLL_DELAY_MS = Number(
    process.env.HOTEL_CANCEL_POLL_DELAY_MS ?? 6000,
);

export interface HotelCancelPollInput {
    pollMaxAttempts?: number;
    pollIntervalMs?: number;
    pollTimeoutMs?: number;
}

export interface ResolvedHotelCancelPollOptions {
    maxAttempts: number;
    delayMs: number;
    timeoutMs?: number;
}

/** Payment service drives poll window via request body; env vars are fallback only. */
export function resolveHotelCancelPollOptions(
    input?: HotelCancelPollInput,
): ResolvedHotelCancelPollOptions {
    const maxAttempts = Math.max(
        1,
        Number(input?.pollMaxAttempts ?? HOTEL_CANCEL_POLL_MAX_ATTEMPTS) || HOTEL_CANCEL_POLL_MAX_ATTEMPTS,
    );
    const delayMs = Math.max(
        0,
        Number(input?.pollIntervalMs ?? HOTEL_CANCEL_POLL_DELAY_MS) || HOTEL_CANCEL_POLL_DELAY_MS,
    );
    const timeoutMsRaw = input?.pollTimeoutMs;
    const timeoutMs =
        timeoutMsRaw !== undefined && timeoutMsRaw !== null && Number(timeoutMsRaw) > 0
            ? Number(timeoutMsRaw)
            : undefined;

    return { maxAttempts, delayMs, timeoutMs };
}
