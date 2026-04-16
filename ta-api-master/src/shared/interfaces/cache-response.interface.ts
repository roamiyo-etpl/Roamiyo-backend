export interface CacheResponse {
    success?: boolean;
    errorMsg?: string;
    errorData?: string;
    data?: any;
    hashKey?: string;
    isSearchNeeded?: boolean;
}