import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { HotelBookConfirmationResponse } from "../../book/interfaces/book-confirmation-response.interface";
import { Http } from "src/shared/utilities/flight/http.utility";
import { TboAuthTokenService } from "./tbo-auth-token.service";

@Injectable()
export class TboBookService {
    constructor(
        private readonly tboAuthTokenService: TboAuthTokenService,
    ) { }


    async bookConfirmation(bookRequest, providerCredentials: any, headers): Promise<any> {
        const { roomQuoteResponse, originalBookRequest, activeProviders, searchReqId, bookingId, bookingLogId, currency } = bookRequest;

        // console.log(bookRequest);
        const getTokenRequest = []

        getTokenRequest['providerCred'] = JSON.parse(activeProviders[0].providerCredentials);
        getTokenRequest['headers'] = headers;



        // console.log(getTokenRequest, 'providerCred');
        /* get authentication token*/
        try {
            const authToken = await this.tboAuthTokenService.getAuthToken(getTokenRequest);
            // console.log(authToken, "token");

            const hotelPassengers = this.creatingBookRequest(originalBookRequest.passengers);
            // console.log(hotelPassengers[0]);

            const prices = this.parsePriceHash(roomQuoteResponse.prices.priceHash);

            // Prepare TBO API credentials
            const auth = {
                username: providerCredentials.username,
                password: providerCredentials.password,
            };
            const endpoint = `${providerCredentials.book_url}/book`;
            // const endpoint = `test`;

            // console.log(auth, endpoint)


            // Create quote request
            const tboBookRequest = {
                BookingCode: roomQuoteResponse.rateKey,
                IsVoucherBooking: true,
                GuestNationality: "IN",
                EndUserIp: headers['ip-address'] || "192.168.9.119",
                RequestedBookingMode: 5,
                NetAmount: prices.price,
                ClientReferenceId: roomQuoteResponse.searchReqId,
                HotelRoomsDetails: hotelPassengers,
            };
            // console.log(tboBookRequest,"tboBookRequest");

            // console.log(tboRequest);
            // Execute quote request
            const response = await this.executeQuoteWithRetry(tboBookRequest, endpoint, auth);
            
            // const response = {
            //     BookResult: {
            //         TBOReferenceNo: null,
            //         VoucherStatus: true,
            //         ResponseStatus: 1,
            //         Error: { ErrorCode: 0, ErrorMessage: '' },
            //         TraceId: '287f1d9e-b574-11f0-8195-4a620032403f',
            //         Status: 1,
            //         HotelBookingStatus: 'Confirmed',
            //         InvoiceNumber: 'MW/2526/16077',
            //         ConfirmationNo: '7654603044297',
            //         BookingRefNo: '652757430215698',
            //         BookingId: 2033239,
            //         IsPriceChanged: false,
            //         IsCancellationPolicyChanged: false
            //     }
            // };

            // console.log(response, "book");
            if (response.BookResult.Error.ErrorCode === 0) {


                const tboOrderRequest = {
                    BookingId: response.BookResult.BookingId,
                    EndUserIp: headers['ip-address'] || "192.000.000.000",
                    TokenId: authToken
                }

                console.log(tboOrderRequest,"orderRequest")
                const endPointGetBooking = `${providerCredentials.service_url}/Getbookingdetail`;

                const responseBookingDetails = await this.executeQuoteWithRetry(tboOrderRequest, endPointGetBooking, auth);

                return {
                    success: true,
                    errorCode: response.BookResult.Error.ErrorCode,
                    message: response.BookResult.HotelBookingStatus,
                    supplierRequest: tboBookRequest,
                    supplierResponse: response.BookResult,
                    supplierOrderDetails: responseBookingDetails.GetBookingDetailResult,
                };
            } else {
                return {
                    success: false,
                    errorCode: response.BookResult.Error.ErrorCode,
                    message: response.BookResult.Error.ErrorMessage,
                    supplierRequest: tboBookRequest,
                    supplierResponse: '',
                    supplierOrderDetails: '',

                }
            }
        } catch (error) {
            console.error('TBO Room Book Service Error:', error);
            throw new InternalServerErrorException('ERR_TBO_ROOM_Book_FAILED');
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


    /** [@Description: Transforms book criteria into Tbo API request format
        * @author: Qamar Ali at 30-10-2025 **/
    private creatingBookRequest(passengers): any {
        // Group passengers by roomId
        const rooms = {};
        passengers.forEach(pax => {
            if (!rooms[pax.roomId]) {
                rooms[pax.roomId] = [];
            }
            rooms[pax.roomId].push(pax);
        });

        // 🪪 Find a global PAN if any adult has one
        let globalPAN = null;
        for (const pax of passengers) {
            if (pax.type?.toLowerCase() === "adult" && pax.pan) {
                globalPAN = pax.pan;
                break;
            }
        }

        // 📧 Find a global email if any adult has one
        let globalEmail = null;
        for (const pax of passengers) {
            if (pax.type?.toLowerCase() === "adult" && pax.email) {
                globalEmail = pax.email;
                break;
            }
        }

        // 📧 Find a global phone if any adult has one
        let globalPhoneno: string | null = null;
        for (const pax of passengers) {
            if (pax.type?.toLowerCase() === "adult" && pax.mobileNo && pax.dialCode) {
                // globalPhoneno = pax.phone;
                globalPhoneno = `${pax.dialCode}${pax.mobileNo}`;
                break;
            }
        }

        // Build HotelRoomsDetails array
        const HotelRoomsDetails = Object.keys(rooms).map(roomId => {
            const roomPassengers = rooms[roomId];
            let leadAssigned = false;
            let sharedEmail = null;
            let sharedPan = null;
            let sharedPhoneno: string|null = null;

            // Find shared email for this room
            for (const pax of roomPassengers) {
                if (pax.type?.toLowerCase() === "adult" && pax.email) {
                    sharedEmail = pax.email;
                    break;
                }
            }

            // Find shared Phone no for this room
            for (const pax of roomPassengers) {
                if (pax.type?.toLowerCase() === "adult" && pax.dialCode && pax.mobileNo) {
                    // sharedPhoneno = pax.phone;
                    sharedPhoneno = `${pax.dialCode}${pax.mobileNo}`;
                    break;
                }
            }

            // Find shared PAN for this room
            for (const pax of roomPassengers) {
                if (pax.type?.toLowerCase() === "adult" && pax.pan) {
                    sharedPan = pax.pan;
                    break;
                }
            }

            // If no email in this room, use global email
            if (!sharedEmail && globalEmail) {
                sharedEmail = globalEmail;
            }
            // If no PAN in this room, use global PAN
            if (!sharedPan && globalPAN) {
                sharedPan = globalPAN;
            }

            // If no Phone Number in this room, use global Phone Number
            if (!sharedPhoneno && globalPhoneno) {
                sharedPhoneno = globalPhoneno;
            }

            // Map passengers for this room
            const HotelPassenger = rooms[roomId].map(pax => {
                const isAdult = pax.type?.toLowerCase() === "adult";

                const passengerData = {
                    Title: pax.title,
                    FirstName: pax.firstName,
                    MiddleName: pax.middleName || "",
                    LastName: pax.lastName,
                    // If lead has email, assign to all adults; children keep null
                    Email: isAdult
                        ? (sharedEmail || pax.email || null)
                        : null,
                    PaxType: isAdult ? 1 : 2,
                    LeadPassenger: false,
                    Age: pax.age || 0,
                    PassportNo: pax.passport || null,
                    PassportIssueDate: pax.passportIssueDate || null,
                    PassportExpDate: pax.passportExpDate || null,
                    Phoneno: isAdult ? (pax.phone || sharedPhoneno) : null,
                    PaxId: 0,
                    GSTCompanyAddress: null,
                    GSTCompanyContactNumber: null,
                    GSTCompanyName: null,
                    GSTNumber: null,
                    GSTCompanyEmail: null,
                    PAN: pax.pan || sharedPan || null,
                };

                // Mark the first adult as LeadPassenger
                if (isAdult && !leadAssigned) {
                    passengerData.LeadPassenger = true;
                    leadAssigned = true;
                }

                return passengerData;
            });

            return { HotelPassenger };
        });

        return HotelRoomsDetails;
    }


    /** [@Description: This is used to calculate nights]
        * @author: Qamar Ali at 30-10-2025 **/
    private parsePriceHash(inputStr) {
        // Split the string by underscores
        let splitStr = inputStr.split('_');

        return {
            supplierCode: splitStr[0],
            hotelCode: splitStr[1],
            price: parseFloat(splitStr[2]),
            tax: parseFloat(splitStr[3]),
            searchReqId: splitStr[4]
        };
    }
}