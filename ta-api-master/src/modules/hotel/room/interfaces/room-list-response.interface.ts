import { CancellationPolicy, HotelPrice } from "../../search/interfaces/initiate-result-response.interface";

export interface HotelRoomResponse {
    searchReqId: string;
    message: string;
    roomData: RoomData;
    success: boolean;
}

export interface RoomData {
    hotelName: string;
    latitude: string;
    longitude: string;
    address: string;
    city: string;
    country: string;
    countryCode: string;
    roomCount: number;
    roomList: RoomList[];
}

export interface RoomList {
    options: RoomOption[];
    roomName: string;
    prices: HotelPrice;
    hotelId: string;
    // rateKey: string;
    rateType: string;
    roomBookingInfo: RoomBookingInfo[];
    rooms: number;
    adults: number;
    children: number;
    childAges: string;
    roomCode: string;
    supplierId: string;
    supplierCode: string;
    supplierRoomName: string;
    boardCode: string;
    cancellationPolicy: CancellationPolicy;
    paymentType?: string;
    boardInfo: string;
}

export interface RoomOption {
    roomName: string;
    price: HotelPrice;
    hotelId: string;
    // rateKey: string;
    roomBookingInfo: RoomBookingInfo[];
    rooms: number;
    adults: number;
    children: number;
    childAges: string;
    rateType: string;
    roomCode: string;
    supplierId: string;
    supplierCode: string;
    boardCode: string;
    cancellationPolicy: CancellationPolicy;
    paymentType?: string;
    boardInfo: string;
    roomDetails?: RoomDetails;
    roomPlacement?: string;
}

export interface RoomBookingInfo {
    rateKey: string;
    maxGuestAllowed?: Record<string, any>;
}

export interface RoomDetails {
    roomCategory?: string;
    roomView?: string;
    beds?: Beds;
    bathroomType?: string;
    roomArea?: Record<string, any>;
    // maxGuestAllowed: Record<string, any>;
    roomDescription?: string;
    propertyType?: string;
    roomFacilities: any[];
    roomImages: any[];
}

export interface Beds {
    suggestedBedType?: string;
    suggestedBedTypeWithoutNumber?: string;
    bedsArr?: any[];
}
