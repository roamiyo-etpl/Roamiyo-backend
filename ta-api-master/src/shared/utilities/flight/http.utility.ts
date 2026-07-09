import Axios from 'axios';
import {
    classifyTboApiOutcome,
    extractTboEndpointName,
    logTboApiCallEnd,
    logTboApiCallStart,
    TboCallPhase,
    tryExtractTraceIdFromPayload,
} from './tbo-api-instrumentation.utility';

export class Http {
    /** [@Description: For Mystifly API]
     * @author: Prashant Joshi at 23-09-2025 **/
    static async httpRequestMY(method: string, data, endpoint: string, sessionId: string) {
        try {
            let result;
            if (data == '') {
                result = await Axios({
                    method: method,
                    url: endpoint,
                    headers: {
                        Authorization: `Bearer ${sessionId}`,
                        'Content-Type': 'application/json',
                    },
                });
            } else {
                result = await Axios({
                    method: method,
                    url: endpoint,
                    headers: {
                        Authorization: `Bearer ${sessionId}`,
                        'Content-Type': 'application/json',
                    },
                    data: data,
                });
            }
            return result.data;
        } catch (error) {
            console.log(error);
            return [];
        }
    }

    /** [@Description: For PKfare API]
     * @author: Prashant Joshi at 23-09-2025 **/
    static async httpRequestPK(method: string, endpoint: string, apiType = '') {
        try {
            const result = await Axios({
                method: method,
                url: endpoint,
                headers: {
                    'Content-Type': 'text/xml',
                },
                responseType: apiType != '' ? 'arraybuffer' : 'text',
            });

            return result.data;
        } catch (error) {
            return false;
        }
    }

    /** [@Description: For PKfare JSON API]
     * @author: Prashant Joshi at 23-09-2025 **/
    static async httpRequestPKJson(method: string, endpoint: string, data) {
        try {
            const result = await Axios({
                method: method,
                url: endpoint,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: JSON.stringify(data),
            });

            return result.data;
        } catch (error) {
            return false;
        }
    }

    /** [@Description: For Qunar API]
     * @author: Prashant Joshi at 23-09-2025 **/
    static async httpRequestQN(method: string, endpoint: string) {
        try {
            const result = await Axios({
                method: method,
                url: endpoint,
                headers: {
                    'Content-Type': 'text/xml',
                },
                responseType: 'text',
            });

            return result.data;
        } catch (error) {
            return [];
        }
    }

    /** Flight TBO Air API — logs START/END for every call (FareQuote, FareRule, Book, Ticket, SSR, Search, Auth, etc.). */
    static async httpRequestTBO(
        method: string,
        endpoint: string,
        data,
        phase: TboCallPhase = 'other',
    ) {
        const apiName = extractTboEndpointName(endpoint);
        const traceId = tryExtractTraceIdFromPayload(data);
        const startMs = Date.now();

        logTboApiCallStart({ apiName, phase, traceId, method });

        try {
            const result = await Axios({
                method: method,
                url: endpoint,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: data,
            });

            const outcome = classifyTboApiOutcome(result.data);
            logTboApiCallEnd({
                apiName,
                phase,
                traceId,
                method,
                durationMs: Date.now() - startMs,
                success: outcome.success,
                responseStatus: outcome.responseStatus,
                message: outcome.message,
                httpStatus: result.status,
            });

            return result.data;
        } catch (error: any) {
            const httpStatus = error?.response?.status;
            const message =
                error?.response?.data?.Response?.Error?.ErrorMessage ??
                error?.response?.data?.Error ??
                error?.message ??
                'HTTP request failed';

            logTboApiCallEnd({
                apiName,
                phase,
                traceId,
                method,
                durationMs: Date.now() - startMs,
                success: false,
                message: String(message),
                httpStatus,
            });

            if (error.response) {
                console.error('Server responded with error status:', error.response.status);
                console.error('Response data:', error.response.data);
            } else if (error.request) {
                console.error('No response received from the server');
            } else {
                console.error('Error setting up the request:', error.message);
            }
            return [];
        }
    }

    /** [@Description: For TBO Hotel API with authentication]
     * @author: Prashant - TBO Hotel Integration **/
    static async httpRequestTBOHotel(method: string, endpoint: string, data, auth: { username: string; password: string }) {
        try {
            const authHeader = 'Basic ' + Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
            const result = await Axios({
                method: method,
                url: endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'Authorization': authHeader
                },
                data: data,
                timeout: 60000,
            });
            return result.data;
        } catch (error) {
            if (error.response) {
                console.error('TBO Hotel API Error - Status:', error.response.status);
                console.error('TBO Hotel API Error - Response:', error.response.data);
            } else if (error.request) {
                console.error('TBO Hotel API - No response received');
            } else {
                console.error('TBO Hotel API Setup Error:', error.message);
            }
            throw error;
        }
    }


     /**
     * Streams data from TBO Hotel API
     * @author Qamar Ali - 12-03-2026
     */
    static async httpRequestTBOHotelStream(method: string, endpoint: string, data, auth?: { username: string; password: string }) {
        try {
            const authHeader = 'Basic ' + Buffer.from(`${auth?.username}:${auth?.password}`).toString('base64');
            const axiosConfig: any = {
                method: method,
                url: endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    Authorization: authHeader,
                },
                responseType: 'stream',
                timeout: 300000,
            };

            if (data !== null && data !== undefined && Object.keys(data).length > 0) {
                axiosConfig.data = data;
            } else if (data) {
                axiosConfig.data = data;
            }

            const response = await Axios(axiosConfig);
            return response.data;
        } catch (error) {
            if (error.response) {
                console.error('TBO Hotel Stream API Error - Status:', error.response.status);
            } else {
                console.error('TBO Hotel Stream API Setup Error:', error.message);
            }
            throw error;
        }
    }
}
