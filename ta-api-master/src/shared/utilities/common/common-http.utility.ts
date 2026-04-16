import axios, { Axios } from 'axios';
import { HttpRequestInterface } from 'src/shared/interfaces/http-request.interface';

export class CommonHttpUtility {
    /** [@Description: Get currencies from the currency api]
     * @author: Mohit Soni at 16-09-2025 **/
    static async httpCurrencyConAPI(params: HttpRequestInterface) {
        try {
            const result = await axios({
                method: params.method,
                url: `${params.url}apiKey=${params.apiKey}`,
                timeout: 10000, // 10 seconds
            });
            return result.data;
        } catch (error: any) {
            if (error.response) {
                // The request was made, but the server responded with an error
                console.error('Server responded with error status:', error.response.status);
                console.error('Response data:', error.response.data);
            } else if (error.request) {
                // The request was made, but no response was received
                console.error('No response received from the server');
            } else {
                // Something happened in setting up the request that triggered an Error
                console.error('Error setting up the request:', error.message);
            }
            return [];
        }
    }
}
