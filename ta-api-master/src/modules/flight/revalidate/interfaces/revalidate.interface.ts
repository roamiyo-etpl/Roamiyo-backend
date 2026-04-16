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
}

export class CharacterLimit {
    firstName: string;
    lastName: string;
    paxName: string;
}

export class RevalidateData {
    requiredFieldsToBook: string[];
    characterLimit: CharacterLimit;
    solutionId: string;
    passportRequired: boolean;
    fare: Fare[];
    fareRules?: FareRules[];
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
