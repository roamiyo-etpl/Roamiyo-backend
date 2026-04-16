import { paxesData } from "src/shared/entities/bookings.entity";
import { StarRatingEnum } from "src/shared/entities/hotel-master.entity";
import { ContactDetailsDto } from "../dtos/hotel-book-initiate.dto";
import { HotelImageSizes } from "src/modules/dump/hotel/interfaces/hotel-detail.interface";

export interface BookingDetailResponse {
    bookingId: string;
    bookingReferenceId: string;
    supplierBookingId?: string;
    status: string;
    bookingDate: string;
    numberOfNights?: number | null;
    checkIn?: string;
    checkOut?: string;
    price: {
        selling: number;
        taxes: number;
        taxIncluded: boolean;
        currency: string;
    };
    contactDetails?: ContactDetailsDto;
    paxes?: paxesData;
    hotel?: HotelResponseInterface | null;
    roomInfo?: any[] | null;
    isRefundable?: boolean;
    termsCancellationPolicy?: string | null;
}

export interface HotelResponseInterface {
    hotelId: string;
    name: string;
    address: string;
    phones: string[];
    description: string;
    rating: HotelRating;
    location: HotelLocation;
    images?: HotelImageSizes | null;
}

export interface HotelRating {
    stars: number;
    reviewScore: string;
}


export interface HotelLocation {
    geoLocation: HotelGeoLocation;
    city: string;
    state: string;
    country: string;
    countryCode: string;
}

export interface HotelGeoLocation {
    latitude: string;
    longitude: string;
}

export interface NightlyRate {
  price: string;
  dateYmd: string;
}