export declare class CountryEntity {
    countryId: number;
    countryName: string;
    iso3: string | null;
    iso2: string;
    numericCode: string | null;
    phonecode: string | null;
    capital: string | null;
    currency: string | null;
    currencyName: string | null;
    currencySymbol: string | null;
    population: number | null;
    gdp: number | null;
    region: string | null;
    regionId: number | null;
    subregion: string | null;
    subregionId: number | null;
    nationality: string | null;
    timezones: {
        zoneName: string;
        gmtOffset: number;
        gmtOffsetName: string;
        abbreviation: string;
        tzName: string;
    }[] | null;
    translations: object | null;
    latitude: number | null;
    longitude: number | null;
    emojiU: string | null;
    createdAt: Date;
    updatedAt: Date;
}
