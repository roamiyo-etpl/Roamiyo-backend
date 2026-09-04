import { Fare, Segment, LocationInfo } from '../../search/interfaces/start-routing.interface';

export class RevalidateResponse {
    isValid: boolean;
    isPriceChanged?: boolean;
    error: boolean;
    message: string;
    searchReqId: string;
    hashReqKey: string;
    trackingId?: string;
    mode: string;
    provider: string;
    prevSolutionID: string;
    isDomestic?: boolean;
    route?: RevalidateData;
    /**
     * TBO FareQuote (IndiGo): when true, Book/Ticket may complete without the chosen seat if it sells out.
     */
    isBookableIfSeatNotAvailable?: boolean;
    /**
     * Hint: IndiGo + FareQuote `IsBookableIfSeatNotAvailable` true → Book/Ticket always sends
     * `IsAllowBookingWithoutSeat: true` (seat selection not required for this flag).
     */
    isAllowBookingWithoutSeat?: boolean;
}

export class CharacterLimit {
    firstName: string;
    lastName: string;
    paxName: string;
}

export class RevalidateData {
    requiredFieldsToBook: string[];
    /** TBO FareQuote passthrough: true when supplier `RequiredFieldValidators.IsSeatRequired` is true. */
    isSeatRequired?: boolean;
    /** TBO FareQuote passthrough: raw supplier `RequiredFieldValidators` object (future-proof for new fields). */
    requiredFieldValidators?: unknown;
    characterLimit: CharacterLimit;
    solutionId: string;
    passportRequired: boolean;
    fare: Fare[];
    /** TBO FareQuote passthrough: supplier `FareRules` (same shape as search). */
    fareRules?: unknown[];
    /** TBO FareQuote passthrough: supplier `MiniFareRules` (Cancellation / Reissue / etc.). */
    miniFareRules?: unknown[];
    flightStops: number[];
    airlineName: string[];
    airlineCode: string[];
    isRefundable?: boolean[];
    airlineType?: string[];
    departureInfo: LocationInfo[];
    arrivalInfo: LocationInfo[];
    totalDuration: string[];
    totalInterval: string[];
    flightSegments: Segment[];
    supplierRes?: any;
}

export class FareRules {
    origin?: string;
    Destination?: string;
    Airline?: string;
    FareRestriction?: string;
    FareBasisCode?: string;
    FareRuleDetail?: string;
    DepartureDate?: string;
    FlightNumber?: string;
}

export class CancellationFareRule {
    trackingId: string;
    fareRules: {
        destination: string;
        origin: string;
        fareRuleDetails: string;
        fareBasisCode: string;
    }[];
    message?: string;
    mode?: string;
    error?: boolean;
}
