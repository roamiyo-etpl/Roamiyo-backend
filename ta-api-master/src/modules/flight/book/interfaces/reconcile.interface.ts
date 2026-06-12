export class RefundablePerPnr {
    pnr: string | null;
    bookingId: string | null;
    is_refundable: boolean;
}

export class ReconcileApiResponseData {
    mode?: string;
    searchReqId?: string;
    orderDetail?: unknown[];
    rawSupplierResponse?: unknown[];
    supplierOrderDetailResponse?: unknown[];
    orderDetails?: unknown;
    /** Per-PNR refundability for domestic round trip (one entry per supplier order). */
    is_refundable?: RefundablePerPnr[];
}

export class BookReconcileResponse {
    error: boolean;
    message: string;
    status: string;
    bookingStatus: number;
    paymentStatus: string;
    isPaymentVerified: boolean;
    isBookingComplete: boolean;
    /** Remaining minutes to keep polling reconcile from now (0 = stop). */
    recommendedPollUntilMinutes: number;
    bookingId: string;
    bookingReferenceId: string;
    supplierReferenceId: string | null;
    /** Per-PNR refundability so the booking screen can show/hide "Cancel booking". Mirrors confirm response. */
    is_refundable?: RefundablePerPnr[];
    apiResponse: ReconcileApiResponseData | null;
}
