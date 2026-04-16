export interface SupplierLogData {
    data: any;
    title: string;
    logId: string;
    searchReqId: string;
    bookingReferenceId: string;
    folderName?: string;
    fileName?: string;
}

export interface StorageResult {
    success: boolean;
    path: string;
    error?: string;
    fileName: string;
}

export interface SupplierLogEntry {
    supplier_log_id?: number;
    log_id: string;
    title: string;
    search_req_id: string;
    booking_reference_id: string;
    path_url: {
        s3Path?: string;
        localPath?: string;
        storageType: 's3' | 'local';
        fileName: string;
        storedAt: string;
    };
    created_at?: Date;
}
