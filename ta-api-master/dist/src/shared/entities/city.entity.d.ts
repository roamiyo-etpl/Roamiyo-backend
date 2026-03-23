export declare class CityEntity {
    cityId: number;
    cityName: string;
    cityCodeTbo: string;
    stateId: number;
    stateCode: string;
    stateName: string;
    countryId: number;
    countryCode: string;
    countryName: string;
    latitude: number;
    longitude: number;
    cityVector: string | null;
    cityNameNormalized: string | null;
    createdAt: Date;
    updatedAt: Date;
    hotelDumpUpdatedAt: Date | null;
}
