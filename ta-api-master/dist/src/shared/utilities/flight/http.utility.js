"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Http = void 0;
const axios_1 = __importDefault(require("axios"));
class Http {
    static async httpRequestMY(method, data, endpoint, sessionId) {
        try {
            let result;
            if (data == '') {
                result = await (0, axios_1.default)({
                    method: method,
                    url: endpoint,
                    headers: {
                        Authorization: `Bearer ${sessionId}`,
                        'Content-Type': 'application/json',
                    },
                });
            }
            else {
                result = await (0, axios_1.default)({
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
        }
        catch (error) {
            console.log(error);
            return [];
        }
    }
    static async httpRequestPK(method, endpoint, apiType = '') {
        try {
            const result = await (0, axios_1.default)({
                method: method,
                url: endpoint,
                headers: {
                    'Content-Type': 'text/xml',
                },
                responseType: apiType != '' ? 'arraybuffer' : 'text',
            });
            return result.data;
        }
        catch (error) {
            return false;
        }
    }
    static async httpRequestPKJson(method, endpoint, data) {
        try {
            const result = await (0, axios_1.default)({
                method: method,
                url: endpoint,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: JSON.stringify(data),
            });
            return result.data;
        }
        catch (error) {
            return false;
        }
    }
    static async httpRequestQN(method, endpoint) {
        try {
            const result = await (0, axios_1.default)({
                method: method,
                url: endpoint,
                headers: {
                    'Content-Type': 'text/xml',
                },
                responseType: 'text',
            });
            return result.data;
        }
        catch (error) {
            return [];
        }
    }
    static async httpRequestTBO(method, endpoint, data) {
        try {
            const result = await (0, axios_1.default)({
                method: method,
                url: endpoint,
                headers: {
                    'Content-Type': 'application/json',
                },
                data: data,
            });
            return result.data;
        }
        catch (error) {
            if (error.response) {
                console.error('Server responded with error status:', error.response.status);
                console.error('Response data:', error.response.data);
            }
            else if (error.request) {
                console.error('No response received from the server');
            }
            else {
                console.error('Error setting up the request:', error.message);
            }
            return [];
        }
    }
    static async httpRequestTBOHotel(method, endpoint, data, auth) {
        try {
            const authHeader = 'Basic ' + Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
            const result = await (0, axios_1.default)({
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
        }
        catch (error) {
            if (error.response) {
                console.error('TBO Hotel API Error - Status:', error.response.status);
                console.error('TBO Hotel API Error - Response:', error.response.data);
            }
            else if (error.request) {
                console.error('TBO Hotel API - No response received');
            }
            else {
                console.error('TBO Hotel API Setup Error:', error.message);
            }
            throw error;
        }
    }
    static async httpRequestTBOHotelStream(method, endpoint, data, auth) {
        try {
            const authHeader = 'Basic ' + Buffer.from(`${auth?.username}:${auth?.password}`).toString('base64');
            const axiosConfig = {
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
            }
            else if (data) {
                axiosConfig.data = data;
            }
            const response = await (0, axios_1.default)(axiosConfig);
            return response.data;
        }
        catch (error) {
            if (error.response) {
                console.error('TBO Hotel Stream API Error - Status:', error.response.status);
            }
            else {
                console.error('TBO Hotel Stream API Setup Error:', error.message);
            }
            throw error;
        }
    }
}
exports.Http = Http;
//# sourceMappingURL=http.utility.js.map