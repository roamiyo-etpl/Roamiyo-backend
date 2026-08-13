export class CalendarFareResponse {
    error: boolean;
    message: string;
    mode: string;
    trackingId?: string;
    origin: string;
    destination: string;
    cabinClass: string;
    /**
     * Untouched pass-through of TBO's SearchResults array - whatever fields/casing
     * TBO actually sends (AirlineCode, AirlineName, DepartureDate, Fare, BaseFare,
     * Tax, OtherCharges, FuelSurcharge, Currency, etc.), unfiltered.
     */
    searchResults: unknown[];
}
