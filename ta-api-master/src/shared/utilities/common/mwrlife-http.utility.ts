import axios from 'axios';
import { HttpRequestInterface } from 'src/shared/interfaces/http-request.interface';

export class MwrLifeHttpUtility {
    /** [@Description: MWR Life API call handler]
     * @author: Assistant **/
    static async mwrLifeAPI(params: HttpRequestInterface) {
        try {
            const result = await axios({
                method: params.method,
                url: params.url,
                timeout: 15000, // 15 seconds
                headers: {
                    'Content-Type': 'application/json',
                },
                data: params.body,
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
