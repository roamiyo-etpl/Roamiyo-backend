import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { TboAuthTokenService } from "./tbo-auth-token.service";
import { Http } from "src/shared/utilities/flight/http.utility";

@Injectable()
export class TboOrderDetailService {
    constructor(
        private readonly tboAuthTokenService: TboAuthTokenService,
    ) { }

    async orderDetail(orderRequest, providerCredentials: any, headers): Promise<any> {
        const { activeProviders, searchReqId, bookingId, bookingLogId, currency, bookingRefId } = orderRequest;

        // console.log(orderRequest,"orderReq");
        const getTokenRequest = []

        getTokenRequest['providerCred'] = JSON.parse(activeProviders[0].providerCredentials);
        getTokenRequest['headers'] = headers;
    

        try {

            // Prepare TBO API credentials
            const auth = {
                username: providerCredentials.username,
                password: providerCredentials.password,
            };

            
            // console.log(getTokenRequest, "token");

            const authToken = await this.tboAuthTokenService.getAuthToken(getTokenRequest);
            console.log(authToken, "token");
            // return true;

            const tboOrderRequest = {
                BookingId: 2032181,
                // BookingId: 2034658,
                // BookingId: orderRequest.bookingRefId,
                EndUserIp: headers['ip-address'] || "192.000.000.000",
                TokenId: authToken
            }
            const endPointGetBooking = `${providerCredentials.service_url}/Getbookingdetail`;

            const getBookingDetails = await this.executeQuoteWithRetry(tboOrderRequest, endPointGetBooking, auth);

            // console.log(getBookingDetails,"getBookingDetails");

            return {
                success: true,
                // errorCode: response.BookResult.Error.ErrorCode,
                // message: response.BookResult.HotelBookingStatus,
                bookDetailsResponse: getBookingDetails.GetBookingDetailResult,
            }

        } catch (error) {
            console.error('TBO Book Detail Service Error:', error);
            throw new InternalServerErrorException('ERR_TBO_Book_Details_FAILED');

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