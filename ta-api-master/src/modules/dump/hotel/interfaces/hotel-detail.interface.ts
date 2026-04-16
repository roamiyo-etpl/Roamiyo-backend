// /**
//  * Hotel detail interfaces for dump operations
//  * @author Prashant - TBO Integration
//  */

// export interface HotelRating {
//     stars: number;
//     reviewScore: string;
// }

// export interface HotelLocation {
//     geoLocation: HotelGeoLocation;
//     city: string;
//     state: string;
//     country: string;
//     countryCode: string;
// }

// export interface HotelAmenity {
//     code: string;
//     title: string;
//     isPaid: boolean;
// }

// export interface HotelGeoLocation {
//     latitude: string;
//     longitude: string;
// }

// export interface HotelPoi {
//     name: string;
//     distance: string;
// }

// export interface HotelNeighbourhood {
//     name: string;
//     type: string;
//     distance: string;
// }

// export interface HotelImageSizes {
//     thumbnail: string;      // 74px wide
//     small: string;          // 117px wide
//     standard: string;       // 320px wide
//     bigger: string;         // 800px wide
//     xl: string;             // 1024px wide
//     xxl: string;            // 2048px wide
//     original: string;       // Original size
// }

// export interface HotelDetailResponse {
//     hotelId: string;
//     name: string;
//     address: string;
//     phones: string[];
//     description: string;
//     rating: HotelRating;
//     location: HotelLocation;
//     images: HotelImageSizes[];
//     amenities: HotelAmenity[];
//     poi: HotelPoi[];
//     neighbourhoods: HotelNeighbourhood[];
// }



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

export interface HotelAmenity {
    code: string;
    title: string;
    isPaid: boolean;
}

export interface HotelGeoLocation {
    latitude: string;
    longitude: string;
}

export interface HotelPoi {
    name: string;
    distance: string;
}

export interface HotelNeighbourhood {
    name: string;
    type: string;
    distance: string;
}

export interface HotelImageSizes {
    thumbnail: string;      // 74px wide
    small: string;          // 117px wide
    standard: string;       // 320px wide
    bigger: string;         // 800px wide
    xl: string;             // 1024px wide
    xxl: string;            // 2048px wide
    original: string;       // Original size
}

export interface HotelDetailResponse {
    hotelId: string;
    name: string;
    address: string;
    phones: string[];
    description: string;
    rating: HotelRating;
    location: HotelLocation;
    images: HotelImageSizes[];
    amenities: HotelAmenity[];
    poi: HotelPoi[];
    neighbourhoods: HotelNeighbourhood[];
}
