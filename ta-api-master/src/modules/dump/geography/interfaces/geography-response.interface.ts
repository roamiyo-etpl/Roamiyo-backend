/**
 * Geography response interfaces for dump operations
 * @author Prashant - TBO Integration
 */

export interface CountryData {
    countryId: number;
    countryName: string;
    iso2: string;
    emojiU: string;
}

export interface StateData {
    stateId: number;
    stateName: string;
    countryCode: string;
    stateCode: string;
}

export interface CityData {
    cityId: number;
    cityName: string;
    stateCode: string;
    countryCode: string;
}

export interface GetCountryListResponse {
    success: boolean;
    message: string;
    data: CountryData[];
    totalCount: number;
}

export interface GetStateListResponse {
    success: boolean;
    message: string;
    data: StateData[];
    totalCount: number;
}

export interface GetCityListResponse {
    success: boolean;
    message: string;
    data: CityData[];
    totalCount: number;
}
