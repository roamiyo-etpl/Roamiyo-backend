import { HotelPrice } from "../../search/interfaces/initiate-result-response.interface";

export interface HotelBookInitiateResponse {
    success: boolean;
    searchReqId: string;
    mode: string;
    message: string;
    bookingRefId?: string;
    price?: HotelPrice;
}
