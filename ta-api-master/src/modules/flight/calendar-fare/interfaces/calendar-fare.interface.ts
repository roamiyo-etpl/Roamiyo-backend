export class CalendarFareResponse {
    error: boolean;
    message: string;
    mode: string;
    trackingId?: string;
    origin: string;
    destination: string;
    searchResults: CalendarFareResult[];
}

export class CalendarFareResult {
    airlineCode: string;
    airlineName: string;
    departureTime: string;
    isLowestFareOfMonth: boolean;
    baseFare: number;
    tax: number;
    yqTax: number;
    otherCharge: number;
}
