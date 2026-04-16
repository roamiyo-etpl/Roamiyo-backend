/**
 * Common response interface for API responses
 * @author Prashant - TBO Integration
 */
export interface CommonResponse {
    success: boolean;
    message: string;
    data?: any;
}
