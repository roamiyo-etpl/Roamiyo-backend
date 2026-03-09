"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArrivalDepartureDate = exports.Segment = exports.BaggageInfo = exports.LocationInfo = exports.GroupHash = exports.Fare = exports.Route = exports.AirlineFilter = exports.Stops = exports.StopsFilter = exports.PriceFilter = exports.minMaxFilter = exports.flightTimesFilter = exports.Filter = exports.TravelPreference = exports.StartRoutingResponse = void 0;
class StartRoutingResponse {
    searchReqId;
    hashReqKey;
    trackingId;
    error;
    message;
    mode;
    complete;
    isDomestic;
    count;
    route;
    filters;
    travelPreferences;
}
exports.StartRoutingResponse = StartRoutingResponse;
class TravelPreference {
    maxStopsQuantity;
    cabinClass;
    airTripType;
    nearByAirports;
    airlineFilter;
}
exports.TravelPreference = TravelPreference;
class Filter {
    stopsList;
    priceList;
    durationList;
    flightTimes;
    airlineList;
    layoverList;
}
exports.Filter = Filter;
class flightTimesFilter {
    departure;
    arrival;
}
exports.flightTimesFilter = flightTimesFilter;
class minMaxFilter {
    min;
    max;
}
exports.minMaxFilter = minMaxFilter;
class PriceFilter {
    minAmount;
    maxAmount;
    currency;
    currencySymbol;
}
exports.PriceFilter = PriceFilter;
class StopsFilter {
    nonStop;
    oneStop;
    onePlusStop;
}
exports.StopsFilter = StopsFilter;
class Stops {
    count;
    minAmount;
}
exports.Stops = Stops;
class AirlineFilter {
    name;
    code;
    minAmount;
    count;
}
exports.AirlineFilter = AirlineFilter;
class Route {
    routeId;
    solutionId;
    flightStops;
    airlineName;
    airlineCode;
    fareSourceCode;
    isRefundable;
    fare;
    airlineType;
    departureInfo;
    arrivalInfo;
    totalDuration;
    totalInterval;
    hashCode;
    groupHashCode;
    isDuplicateOutbound;
    groupHash;
    flightSegments;
}
exports.Route = Route;
class Fare {
    sellingPrice;
    fareType;
    totalFare;
    perPersonFare;
    adultFare;
    perPersonAdultFare;
    childFare;
    perPersonChildFare;
    infantFare;
    perPersonInfantFare;
    baseFare;
    serviceFee;
    tax;
    otherCharges;
    currency;
    searchTotalFare;
    searchBaseFare;
    searchTax;
    currencySymbol;
    fareQuote;
    bsPublish;
    bsFare;
}
exports.Fare = Fare;
class GroupHash {
    hashCode;
    provider;
    groupHashCode;
    totalAmount;
    solutionId;
}
exports.GroupHash = GroupHash;
class LocationInfo {
    city;
    cityCode;
    country;
    countryCode;
    code;
    name;
    date;
    time;
    terminal;
}
exports.LocationInfo = LocationInfo;
class BaggageInfo {
    paxType;
    rule;
    size;
    flightNum;
}
exports.BaggageInfo = BaggageInfo;
class Segment {
    segmentId;
    airlineCode;
    airlineName;
    departure;
    arrival;
    cabinClass;
    segmentDuration;
    segmentInterval;
    intervalMinutes;
    flightNumber;
    bookingCode;
    cabinBaggages;
    checkInBaggages;
    noOfSeatAvailable;
    mealType;
    distance;
    craft;
    inFlightServices;
    supplierFareClass;
}
exports.Segment = Segment;
class ArrivalDepartureDate {
    date;
    timezone;
    timezone_type;
}
exports.ArrivalDepartureDate = ArrivalDepartureDate;
//# sourceMappingURL=start-routing.interface.js.map