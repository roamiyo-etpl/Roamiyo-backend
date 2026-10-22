export interface AutocompleteGeoLocation {
    latitude: number;
    longitude: number;
}

export interface CitySuggestion {
    type: 'city';
    cityName: string;
    countryCode: string;
    countryName: string;
    cityCodes: string[];
    hotelCount: number;
    geoLocation: AutocompleteGeoLocation;
}

export interface HotelSuggestion {
    type: 'hotel';
    hotelCode: string;
    hotelName: string;
    cityName: string;
    countryCode: string;
    countryName: string;
    starRating: number;
    address: string;
    geoLocation: AutocompleteGeoLocation | null;
}

export interface HotelAutocompleteV2Response {
    success: boolean;
    message: string;
    query: string;
    data: {
        cities: CitySuggestion[];
        hotels: HotelSuggestion[];
    };
    totalCount: number;
}
