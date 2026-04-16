import { HotelSearchBy, SortOrder } from 'src/shared/enums/hotel/hotel.enum';

export interface InitiateResultResponse {
    searchReqId: string;
    status: 'inProgress' | 'completed' | 'failed' | 'expired';
    message: string;
    timestamp: string; // ISO date string
    totalResults: number;
    location: Coordinates;
    radiusKm: number;
    facets: Facets;
    pagination: Pagination;
    results: HotelResult[];
    appliedFilters: AppliedFilters;
    appliedSort: SortOption;
}

export interface Coordinates {
    lat: number;
    lon: number;
}

export interface Facets {
    ratings: Record<string, number>; // e.g., "1": 3, "2": 28...
    price: {
        min: number;
        max: number;
        buckets: Record<string, number>; // e.g., "0_100": 158...
    };
    amenities: Record<string, number>; // e.g., "Parking": 92...
    poi: Record<string, number>; // Points of interest
    neighborhoods: Record<string, number>;
    mealTypes: Record<string, number>;
    hotelNames: string[];
}

export interface Pagination {
    page: number;
    limit: number;
    totalPages: number;
    totalFilteredResults: number;
}

export interface HotelResult {
    hotelId: string;
    hotelRefId: string;
    name: string;
    address: string;
    city: string;
    state: string;
    country: string;
    countryCode: string;
    location: Coordinates;
    rating: {
        stars: number;
        reviewScore: number | null;
    };
    nights: number;
    prices: HotelPrice;
    cancellationPolicy: CancellationPolicy;
    images: string[];
    amenities: string[];
    poi: string[];
    neighborhoods: string[];
    mealType: string;
    providerID: string;
    providerCode: string;
}

export interface HotelPrice {
    selling: number;
    public?: number;
    currency: string;
    taxIncluded: boolean;
    taxes: number;
    priceHash: string;
    memberSavings?: {
        loyaltyPoints: number;
        totalSavings: number;
        savingPercentage: number;
    };
}

export interface CancellationPolicy {
    refundable: boolean;
    currency: string;
    penalties: CancellationPenalty[];
}

export interface CancellationPenalty {
    type: 'none' | 'partial' | 'full';
    chargeType: 'percent' | 'fixed';
    amount: number;
    appliesUntil?: string;
    appliesFrom?: string;
    description: string;
}

export interface AppliedFilters {
    filteredResults: number;
    priceRange: [number, number];
    starRating: number[];
    amenities: string[];
    mealTypes: string[];
    neighborhoods: string[];
    poi: string[];
    cancellation: string[]; // e.g., ['refundable']
    hotelNames: string[];
}

export interface SortOption {
    by: HotelSearchBy;
    direction: SortOrder;
}
