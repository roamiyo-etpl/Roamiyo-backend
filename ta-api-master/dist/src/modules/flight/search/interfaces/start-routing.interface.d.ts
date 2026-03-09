export declare class StartRoutingResponse {
    searchReqId: string;
    hashReqKey?: string;
    trackingId?: string;
    error: boolean;
    message: string;
    mode: string;
    complete?: boolean;
    isDomestic?: boolean;
    count?: number;
    route: Route[];
    filters?: Filter;
    travelPreferences?: TravelPreference;
}
export declare class TravelPreference {
    maxStopsQuantity?: number;
    cabinClass?: string;
    airTripType?: string;
    nearByAirports?: boolean;
    airlineFilter?: string;
}
export declare class Filter {
    stopsList?: StopsFilter[];
    priceList?: PriceFilter;
    durationList?: minMaxFilter[];
    flightTimes?: flightTimesFilter[];
    airlineList?: AirlineFilter[];
    layoverList?: minMaxFilter[];
}
export declare class flightTimesFilter {
    departure: {
        location: string;
        min: string;
        max: string;
    };
    arrival: {
        location: string;
        min: string;
        max: string;
    };
}
export declare class minMaxFilter {
    min: string;
    max: string;
}
export declare class PriceFilter {
    minAmount: number;
    maxAmount: number;
    currency: string;
    currencySymbol: string;
}
export declare class StopsFilter {
    nonStop: Stops;
    oneStop: Stops;
    onePlusStop: Stops;
}
export declare class Stops {
    count: number;
    minAmount: number;
}
export declare class AirlineFilter {
    name: string;
    code: string;
    minAmount: number;
    count: number;
}
export declare class Route {
    routeId?: string;
    solutionId: string[];
    flightStops: number[];
    airlineName: string[];
    airlineCode: string[];
    fareSourceCode: string[];
    isRefundable?: boolean;
    fare: Fare[];
    airlineType?: string;
    departureInfo: LocationInfo[];
    arrivalInfo: LocationInfo[];
    totalDuration: string[];
    totalInterval: string[];
    hashCode: string[];
    groupHashCode: string;
    isDuplicateOutbound: boolean;
    groupHash: GroupHash[];
    flightSegments: Segment[];
}
export declare class Fare {
    sellingPrice?: number;
    fareType?: string;
    totalFare: number;
    perPersonFare: number;
    adultFare?: number;
    perPersonAdultFare?: number;
    childFare?: number;
    perPersonChildFare?: number;
    infantFare?: number;
    perPersonInfantFare?: number;
    baseFare?: number;
    serviceFee?: number;
    tax?: number;
    otherCharges?: number;
    currency?: string;
    searchTotalFare?: number;
    searchBaseFare?: number;
    searchTax?: number;
    currencySymbol?: string;
    fareQuote?: string;
    bsPublish: number;
    bsFare: number;
}
export declare class GroupHash {
    hashCode: string[];
    provider: string[];
    groupHashCode: string;
    totalAmount: number;
    solutionId: string;
}
export declare class LocationInfo {
    city: string;
    cityCode?: string;
    country: string;
    countryCode?: string;
    code: string;
    name: string;
    date: string;
    time: string;
    terminal?: string;
}
export declare class BaggageInfo {
    paxType: string;
    rule: string;
    size: string;
    flightNum: string;
}
export declare class Segment {
    segmentId: string;
    airlineCode: string;
    airlineName: string;
    departure: LocationInfo[];
    arrival: LocationInfo[];
    cabinClass: string;
    segmentDuration: string;
    segmentInterval: string;
    intervalMinutes: number;
    flightNumber: string;
    bookingCode: string;
    cabinBaggages?: BaggageInfo[];
    checkInBaggages?: BaggageInfo[];
    noOfSeatAvailable?: number;
    mealType?: string;
    distance?: string;
    craft?: string;
    inFlightServices?: string;
    supplierFareClass: string;
}
export declare class ArrivalDepartureDate {
    date: string;
    timezone: string;
    timezone_type: number;
}
