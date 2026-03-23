export declare class Http {
    static httpRequestMY(method: string, data: any, endpoint: string, sessionId: string): Promise<any>;
    static httpRequestPK(method: string, endpoint: string, apiType?: string): Promise<any>;
    static httpRequestPKJson(method: string, endpoint: string, data: any): Promise<any>;
    static httpRequestQN(method: string, endpoint: string): Promise<any>;
    static httpRequestTBO(method: string, endpoint: string, data: any): Promise<any>;
    static httpRequestTBOHotel(method: string, endpoint: string, data: any, auth: {
        username: string;
        password: string;
    }): Promise<any>;
    static httpRequestTBOHotelStream(method: string, endpoint: string, data: any, auth?: {
        username: string;
        password: string;
    }): Promise<any>;
}
