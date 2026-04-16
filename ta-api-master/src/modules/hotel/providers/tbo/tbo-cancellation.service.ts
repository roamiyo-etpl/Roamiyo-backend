import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { TboAuthTokenService } from "./tbo-auth-token.service";
import { Http } from "src/shared/utilities/flight/http.utility";

// Constants for default values
const DEFAULT_IP_ADDRESS = "192.000.000.000";
const BOOKING_MODE = 5;  // Can be changed based on specific needs
const REQUEST_TYPE = 4;  // Can be changed based on specific needs

@Injectable()
export class TboCancellationService {
    constructor(
        private readonly tboAuthTokenService: TboAuthTokenService,
    ) { }


    async cancelRequest(cancelRequest, providerCredentials: any, headers): Promise<any> {
        const { activeProviders, searchReqId, supplierBookingId } = cancelRequest;

        // console.log(orderRequest,"orderReq");
        const getTokenRequest = []

        getTokenRequest['providerCred'] = JSON.parse(activeProviders[0].providerCredentials);
        getTokenRequest['headers'] = headers;


        try {
            const auth = {
                username: providerCredentials.username,
                password: providerCredentials.password,
            };


            // console.log(getTokenRequest, "token");

            const authToken = await this.tboAuthTokenService.getAuthToken(getTokenRequest);
            // console.log(authToken, "token");
            // return true;

            const tboSendChangeRequestBody = {
                BookingMode: BOOKING_MODE,
                RequestType: REQUEST_TYPE,
                Remarks: "cancel hotel",
                // BookingId: 2035975,
                BookingId: 2032181,
                //  BookingId: supplierBookingId,
                EndUserIp: headers['ip-address'] || DEFAULT_IP_ADDRESS,
                TokenId: authToken
            }
            const endSendChangeRequest = `${providerCredentials.book_url}/SendChangeRequest`;

            const sendChangeRequestResponse = await this.executeQuoteWithRetry(tboSendChangeRequestBody, endSendChangeRequest, auth);

            // console.log(sendChangeRequestResponse,"sendChangeRequestResponse");
            let responseResult;
            let isBookingCancelable: boolean = false;
            const changeRequestResponse = sendChangeRequestResponse.HotelChangeRequestResult;
            responseResult = changeRequestResponse;

            if (changeRequestResponse.ChangeRequestStatus === 3 && changeRequestResponse.Error.ErrorCode === 0) {
                // console.log('for second api');
                const tboGetChangeRequestStatusBody = {
                    BookingMode: BOOKING_MODE,
                    ChangeRequestId: changeRequestResponse.ChangeRequestId,
                    EndUserIp: headers['ip-address'] || DEFAULT_IP_ADDRESS,
                    TokenId: authToken
                };

                const endGetChangeRequestStatus = `${providerCredentials.book_url}/GetChangeRequestStatus`;

                const getChangeRequestStatusResponse = await this.executeQuoteWithRetry(tboGetChangeRequestStatusBody, endGetChangeRequestStatus, auth);

                // console.log(getChangeRequestStatusResponse,"status");
                responseResult = getChangeRequestStatusResponse.HotelChangeRequestStatusResult;
                isBookingCancelable = true;

            }

            return {
                success: true,
                // errorCode: response.BookResult.Error.ErrorCode,
                // message: response.BookResult.HotelBookingStatus,
                isBookingCancelable,
                cancellationResponse: responseResult,
            }

        } catch (error) {
            console.error('TBO Book Detail Service Error:', error);
            throw new InternalServerErrorException('ERR_TBO_Book_Details_FAILED');

        }

    }


    /**
     * Get authentication token from TBO API
     * @param providerCredentials - Provider credentials
     * @param headers - Request headers
     * @returns Promise<string> - Authentication token
     */
    private async getAuthToken(providerCredentials: any, headers: any): Promise<string> {
        const getTokenRequest = {
            providerCred: providerCredentials,
            headers: headers
        };

        try {
            return await this.tboAuthTokenService.getAuthToken(getTokenRequest);
        } catch (error) {
            console.error("Failed to get TBO Auth Token:", error);
            throw new InternalServerErrorException("Failed to get TBO Auth Token");
        }
    }


    /**
     * Execute quote request with retry logic
     * @param request - Quote request
     * @param endpoint - API endpoint
     * @param auth - Authentication credentials
     * @param maxRetries - Maximum retry attempts
     * @returns Promise<any> - API response
   */
    private async executeQuoteWithRetry(request: any, endpoint: string, auth: any, maxRetries: number = 1): Promise<any> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await Http.httpRequestTBOHotel('POST', endpoint, request, auth);
                console.log(`TBO Room Book (attempt ${attempt}): Success`);
                return response;
            } catch (error) {
                console.error(`TBO Room Book attempt ${attempt} failed:`, error.message);
                if (attempt === maxRetries) {
                    throw error;
                }
                // Wait before retry (exponential backoff)
                await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
            }
        }
    }

}