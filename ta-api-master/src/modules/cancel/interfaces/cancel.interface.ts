import { GenericCancelDto } from '../dto/cancel.dto';

export class CancelResponse {
    success: boolean;
    message: string;
    mode: string;
    cancellationStatus?: boolean | string;
    cancellationCharge?: number;
    refundedAmount?: number;
    status?: string;
    remarks?: string;
    creditNoteNo?: string;
    creditNoteCreatedOn?: string;
    changeRequestId?: number;
    traceId?: string;
    /** UUID of the row saved in `cancellations` after a successful supplier call */
    cancellationId?: string;
    /** Hotel: true when TBO returned ChangeRequestId (cancel submitted) */
    cancelSubmitted?: boolean;
    /** Hotel: true only when TBO ChangeRequestStatus = Processed (3) */
    cancelCompleted?: boolean;
    /** Hotel: true when status is Pending or InProgress — poll POST /cancel/status */
    pendingCompletion?: boolean;
    /** Hotel: true when POST /cancel is idempotent — booking was already cancelled */
    alreadyCancelled?: boolean;
    /** Hotel: raw TBO ChangeRequestStatus 0–4 */
    hotelChangeRequestStatus?: number;
    error?: {
        errorCode: number;
        errorMessage: string;
    };
}

export class CancellationStatusResponse {
    changeRequestId: number;
    refundedAmount: number;
    cancellationCharge: number;
    refundAmount: number;
    status: string;
    remarks?: string;
    currency: string;
    provider: string;
}

export interface CancelRequest {
    cancelReq: GenericCancelDto;
    headers: any;
}

export class CancellationChargesResponse {
    success: boolean;
    supplierResponseStatus: string;
    refundAmount: number;
    cancellationCharge: number;
    remarks: string;
    currency: string;
    traceId?: string;
    error?: {
        errorCode: number;
        errorMessage: string;
    };
}


