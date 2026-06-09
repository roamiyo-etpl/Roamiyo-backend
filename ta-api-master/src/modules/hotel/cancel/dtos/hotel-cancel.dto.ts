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
