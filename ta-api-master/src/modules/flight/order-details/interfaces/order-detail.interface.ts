import { FareRules } from '../../revalidate/interfaces/revalidate.interface';
import { Fare, LocationInfo, Segment } from '../../search/interfaces/start-routing.interface';

export class OrderRoutes {
    fare: Fare[];
    fareRules: FareRules[];
    flightStops: number[];
    airlineName?: string[];
    airlineCode: string[];
    departureInfo: LocationInfo[];
    arrivalInfo: LocationInfo[];
    totalDuration: string[];
    totalInterval: string[];
    flightSegments: Segment[];
    isRefundable?: boolean;
    separateRoute?: any;
}

export class OrderDetailResponse {
    error: boolean;
    message: string;
    searchReqId: string;
    mode: string;
    bookingRefNumber?: string;
    pnr?: string;
    bookingId?: string;
    ticketNumber?: string;
    ticketId?: string;
    bookingStatus?: string;
    passengers?: OrderDetailPassenger[];
    routes: OrderRoutes;
}

class orderDetailPassengerDetail {
    firstName: string;
    lastName: string;
    title: string;
}

class orderDocument {
    documentType: string;
    documentNumber: string;
    expiryDate?: string;
    country: string;
}

export class OrderDetailPassenger {
    passengerType: string;
    gender: string;
    passengerDetail: orderDetailPassengerDetail;
    dateOfBirth: string;
    document: orderDocument;
    nationality: string;
    mobile: string;
    mobileCountryCode: string;
    ticketId?: string;
}

class CancellationRules {
    adultCharges: number;
    refundable: boolean;
    durationTo: string;
    durationFrom: string;
    returnFlight: boolean;
    remarks: string;
    type: string;
    childCharges?: number;
    infantCharges?: number;
    passengerType?: number;
}

// import { FareRules } from '../../revalidate/interfaces/revalidate.interface';
// import { Fare, LocationInfo, Segment } from '../../search/interfaces/start-routing.interface';

// export class OrderRoutes {
//     fare: Fare[];
//     fareRules: FareRules[];
//     flightStops: number[];
//     airlineName?: string[];
//     airlineCode: string[];
//     departureInfo: LocationInfo[];
//     arrivalInfo: LocationInfo[];
//     totalDuration: string[];
//     totalInterval: string[];
//     flightSegments: Segment[];
//     isRefundable?: boolean;
//     separateRoute?: any;
// }

// export class OrderDetailResponse {
//     error: boolean;
//     message: string;
//     searchReqId: string;
//     mode: string;
//     bookingRefNumber?: string;
//     pnr?: string;
//     ticketNumber?: string;
//     bookingStatus?: string;
//     passengers?: OrderDetailPassenger[];
//     routes: OrderRoutes;
// }

// export class orderDetailPassengerDetail {
//     firstName: string;
//     lastName: string;
//     title: string;
// }

// export class orderDocument {
//     documentType: string;
//     documentNumber: string;
//     expiryDate?: string;
//     country: string;
// }

// export class OrderDetailPassenger {
//     passengerType: string;
//     gender: string;
//     passengerDetail: orderDetailPassengerDetail;
//     ticketId?: string;
//     dateOfBirth: string;
//     document: orderDocument;
//     nationality: string;
//     mobile: string;
//     mobileCountryCode: string;
// }
