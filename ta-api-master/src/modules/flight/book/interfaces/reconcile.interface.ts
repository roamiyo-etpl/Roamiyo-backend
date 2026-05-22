export class ReconcileApiResponseData {
    mode?: string;
    searchReqId?: string;
    orderDetail?: unknown[];
    rawSupplierResponse?: unknown[];
    supplierOrderDetailResponse?: unknown[];
    orderDetails?: unknown;
}

export class BookReconcileResponse {
    error: boolean;
    message: string;
    status: string;
    bookingStatus: number;
    paymentStatus: string;
    isPaymentVerified: boolean;
    isBookingComplete: boolean;
    bookingId: string;
    bookingReferenceId: string;
    supplierReferenceId: string | null;
    apiResponse: ReconcileApiResponseData | null;
}
