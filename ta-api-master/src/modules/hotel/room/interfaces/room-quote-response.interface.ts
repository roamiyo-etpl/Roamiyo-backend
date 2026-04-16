import { CancellationPolicy, HotelPrice } from "../../search/interfaces/initiate-result-response.interface";

//Tbo Hotel Booking Validation
export interface ValidationInfo {
    isPanMandatory: boolean;
    isPassportMandatory: boolean;
    isPanCountRequired: number;
    isSamePaxNameAllowed: boolean;
    isSpaceAllowed: boolean;
    isSpecialCharAllowed: boolean;
    isPaxNameMinLength: number;
    isPaxNameMaxLength: number;
}

export interface HotelRoomQuoteResponse {
    rateKey: string;
    searchReqId: string;
    status: string;
    remarks: string;
    prices?: HotelPrice;
    cancellationPolicy?: CancellationPolicy;
    validationInfo? : ValidationInfo;
}
