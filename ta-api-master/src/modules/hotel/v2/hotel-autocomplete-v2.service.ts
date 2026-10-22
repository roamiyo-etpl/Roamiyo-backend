import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import Axios from 'axios';
import { Cacheable } from 'cacheable';
import { TboHotelListEntity } from 'src/modules/dump/hotel/entities/tbo-hotel-list.entity';
import { HotelCityGeoEntity } from './entities/hotel-city-geo.entity';
import { HotelAutocompleteV2Dto } from './dtos/hotel-autocomplete-v2.dto';
import { AutocompleteGeoLocation, CitySuggestion, HotelAutocompleteV2Response, HotelSuggestion } from './interfaces/hotel-autocomplete-v2.interface';

interface CityIndexEntry {
    normName: string;
    cityName: string;
    countryCode: string;
    countryName: string;
    cityCodes: string[];
    hotelCount: number;
    /* Median of the city's hotel coordinates, used only when Google geocoding is not available */
    fallbackGeo: AutocompleteGeoLocation | null;
}

/**
 * v2 hotel autocomplete: cities and hotels from tbo_hotel_list.
 * City coordinates come from Google Geocoding once per city and are saved in hotel_city_geo.
 */
@Injectable()
export class HotelAutocompleteV2Service implements OnModuleInit {
    private readonly logger = new Logger(HotelAutocompleteV2Service.name);

    private static readonly MAX_CITIES = 8;
    private static readonly MAX_HOTELS = 20;
    private static readonly CITY_INDEX_TTL_MS = 24 * 60 * 60 * 1000;
    private static readonly CITY_INDEX_MAX_WAIT_MS = 3000;
    private static readonly QUERY_CACHE_TTL = '6h';
    private static readonly GEOCODE_RETRY_AFTER_MS = 60 * 60 * 1000;
    private static readonly GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

    /* All cities that have hotels, built from tbo_hotel_list (one slow aggregate query, kept in memory) */
    private cityIndex: CityIndexEntry[] = [];
    private cityIndexBuiltAt = 0;
    private cityIndexBuild: Promise<CityIndexEntry[]> | null = null;

    /* geoKey -> time of last failed Google call, so a failing city is not retried on every keystroke */
    private readonly failedGeocodes = new Map<string, number>();
    private readonly queryCache = new Cacheable();

    constructor(
        @InjectRepository(TboHotelListEntity)
        private readonly hotelListRepo: Repository<TboHotelListEntity>,
        @InjectRepository(HotelCityGeoEntity)
        private readonly cityGeoRepo: Repository<HotelCityGeoEntity>,
    ) {}

    onModuleInit(): void {
        // Warm up the city index in the background so the first user does not wait for it
        this.getCityIndex().catch((error) => this.logger.error('[HOTEL-AUTOCOMPLETE-V2] city index warm-up failed', error));
    }

    async autocomplete(dto: HotelAutocompleteV2Dto): Promise<HotelAutocompleteV2Response> {
        const query = this.normalize(dto.query);
        if (query.length < 3) {
            throw new BadRequestException('query must be at least 3 characters long');
        }
        const countryCode = dto.countryCode || null;
        const market = dto.market || null;

        const cacheKey = `HOTEL_AUTOCOMPLETE_V2-${countryCode ?? 'ALL'}-${market ?? 'ANY'}-${query}`;
        const cached = await this.queryCache.get<HotelAutocompleteV2Response>(cacheKey);
        if (cached) {
            return cached;
        }

        const startedAt = Date.now();
        const [cities, hotels] = await Promise.all([this.findCities(query, countryCode, market), this.findHotels(query, countryCode, market)]);
        console.log(
            `[HOTEL-AUTOCOMPLETE-V2] query="${query}" country=${countryCode ?? 'ALL'} market=${market ?? 'ANY'} -> ${cities.length} cities, ${hotels.length} hotels in ${((Date.now() - startedAt) / 1000).toFixed(3)}s`,
        );

        const response: HotelAutocompleteV2Response = {
            success: true,
            message: 'Hotel autocomplete suggestions retrieved successfully',
            query: dto.query,
            data: { cities, hotels },
            totalCount: cities.length + hotels.length,
        };

        // Not cached while the city index is still building (that response has no cities)
        if (this.cityIndex.length > 0) {
            await this.queryCache.set(cacheKey, response, HotelAutocompleteV2Service.QUERY_CACHE_TTL);
        }
        return response;
    }

    /**
     * Cities whose name (or a word in it) starts with the query: "del" -> Delhi, New Delhi; not Adelaide
     */
    private async findCities(query: string, countryCode: string | null, market: string | null): Promise<CitySuggestion[]> {
        let index: CityIndexEntry[];
        try {
            // Right after startup the index may still be building: don't hold the user for it, return hotels only
            let waitTimer: NodeJS.Timeout | undefined;
            index = await Promise.race([
                this.getCityIndex(),
                new Promise<CityIndexEntry[]>((resolve) => {
                    waitTimer = setTimeout(() => resolve([]), HotelAutocompleteV2Service.CITY_INDEX_MAX_WAIT_MS);
                }),
            ]).finally(() => clearTimeout(waitTimer));
        } catch (error) {
            this.logger.error('[HOTEL-AUTOCOMPLETE-V2] city index not available', error);
            return [];
        }

        // Score: bigger cities first, boosted when the name starts with the query and when the city is in the market country
        // ("del" + market IN -> New Delhi, Delhi before Playa del Carmen; "del" alone -> New Delhi before Del, US)
        const score = (city: CityIndexEntry): number =>
            Math.log(1 + city.hotelCount) +
            (city.normName.startsWith(query) ? 2 : 0) +
            (city.normName === query ? 1 : 0) +
            (market && city.countryCode === market ? 3 : 0);

        const candidates = index
            .filter((city) => (!countryCode || city.countryCode === countryCode) && (city.normName.startsWith(query) || city.normName.includes(` ${query}`)))
            .map((city) => ({ city, score: score(city) }))
            .sort((a, b) => b.score - a.score)
            .map(({ city }) => city);

        // TBO has name variants of the same city ("Mumbai/Bombay", "Mumbai Maharashtra"): fold them into the bigger city
        const matches: CityIndexEntry[] = [];
        for (const city of candidates) {
            const parent = matches.find((picked) => picked.countryCode === city.countryCode && this.isNameVariant(city.normName, picked.normName));
            if (parent) {
                parent.hotelCount += city.hotelCount;
                parent.cityCodes = [...new Set([...parent.cityCodes, ...city.cityCodes])];
                continue;
            }
            if (matches.length < HotelAutocompleteV2Service.MAX_CITIES) {
                matches.push({ ...city, cityCodes: [...city.cityCodes] });
            }
        }

        if (matches.length === 0) {
            return [];
        }

        const geoByKey = await this.resolveCityGeo(matches);

        return matches
            .map((city): CitySuggestion | null => {
                const geoLocation = geoByKey.get(this.geoKey(city)) ?? city.fallbackGeo;
                if (!geoLocation) {
                    return null; // Without coordinates the city cannot be searched
                }
                return {
                    type: 'city',
                    cityName: city.cityName,
                    countryCode: city.countryCode,
                    countryName: city.countryName,
                    cityCodes: city.cityCodes,
                    hotelCount: city.hotelCount,
                    geoLocation,
                };
            })
            .filter((city): city is CitySuggestion => city !== null);
    }

    /**
     * Hotels whose name (or a word in it) starts with the query: "leela palace" -> The Leela Palace New Delhi, Bengaluru, ...
     */
    private async findHotels(query: string, countryCode: string | null, market: string | null): Promise<HotelSuggestion[]> {
        const escaped = query.replace(/[\\%_]/g, '\\$&');
        const params: (string | number)[] = [`${escaped}%`, `% ${escaped}%`];
        let countryFilter = '';
        if (countryCode) {
            params.push(countryCode);
            countryFilter = `AND country_code = $${params.length}`;
        }
        let marketOrder = '';
        if (market) {
            params.push(market);
            marketOrder = `CASE WHEN country_code = $${params.length} THEN 0 ELSE 1 END,`;
        }
        params.push(HotelAutocompleteV2Service.MAX_HOTELS);

        try {
            const rows: any[] = await this.hotelListRepo.query(
                `SELECT tbo_hotel_id, hotel_name, address_line1, address_line2, city_name, country_code, country_name, star_rating, latitude, longitude
                 FROM tbo_hotel_list
                 WHERE (hotel_name ILIKE $1 OR hotel_name ILIKE $2) ${countryFilter}
                 ORDER BY ${marketOrder} CASE WHEN hotel_name ILIKE $1 THEN 0 ELSE 1 END, star_rating DESC NULLS LAST, hotel_name ASC
                 LIMIT $${params.length}`,
                params,
            );

            return rows.map((row) => ({
                type: 'hotel',
                hotelCode: row.tbo_hotel_id,
                hotelName: row.hotel_name ?? '',
                cityName: row.city_name ?? '',
                countryCode: row.country_code ?? '',
                countryName: row.country_name ?? '',
                starRating: Number(row.star_rating) || 0,
                address: [row.address_line1, row.address_line2].filter(Boolean).join(', '),
                geoLocation: this.toGeo(row.latitude, row.longitude),
            }));
        } catch (error) {
            this.logger.error('[HOTEL-AUTOCOMPLETE-V2] hotel lookup failed', error);
            return [];
        }
    }

    /**
     * Coordinates for the given cities: saved ones from hotel_city_geo, missing ones from Google (then saved)
     */
    private async resolveCityGeo(cities: CityIndexEntry[]): Promise<Map<string, AutocompleteGeoLocation>> {
        const geoByKey = new Map<string, AutocompleteGeoLocation>();
        const keys = cities.map((city) => this.geoKey(city));

        try {
            const saved = await this.cityGeoRepo.find({ where: { geoKey: In(keys) } });
            saved.forEach((row) => geoByKey.set(row.geoKey, { latitude: row.latitude, longitude: row.longitude }));
        } catch (error) {
            this.logger.error('[HOTEL-AUTOCOMPLETE-V2] reading hotel_city_geo failed', error);
        }

        const missing = cities.filter((city) => !geoByKey.has(this.geoKey(city)));
        if (missing.length === 0) {
            return geoByKey;
        }

        const geocoded = await Promise.all(missing.map(async (city) => ({ city, result: await this.geocodeCity(city) })));
        const toSave: Partial<HotelCityGeoEntity>[] = [];
        for (const { city, result } of geocoded) {
            if (!result) continue;
            geoByKey.set(this.geoKey(city), { latitude: result.latitude, longitude: result.longitude });
            toSave.push({
                geoKey: this.geoKey(city),
                cityName: city.cityName,
                countryCode: city.countryCode,
                latitude: result.latitude,
                longitude: result.longitude,
                formattedAddress: result.formattedAddress,
            });
        }

        if (toSave.length > 0) {
            try {
                await this.cityGeoRepo.upsert(toSave, ['geoKey']);
            } catch (error) {
                this.logger.error('[HOTEL-AUTOCOMPLETE-V2] saving hotel_city_geo failed', error);
            }
        }

        return geoByKey;
    }

    private async geocodeCity(city: CityIndexEntry): Promise<(AutocompleteGeoLocation & { formattedAddress: string | null }) | null> {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
        if (!apiKey) {
            this.logger.warn('[HOTEL-AUTOCOMPLETE-V2] GOOGLE_MAPS_API_KEY is not set, using hotel coordinates for city suggestions');
            return null;
        }

        const key = this.geoKey(city);
        const failedAt = this.failedGeocodes.get(key);
        if (failedAt && Date.now() - failedAt < HotelAutocompleteV2Service.GEOCODE_RETRY_AFTER_MS) {
            return null;
        }

        const address = `${city.cityName}, ${city.countryName || city.countryCode}`;
        try {
            const { data } = await Axios.get(HotelAutocompleteV2Service.GEOCODE_URL, {
                params: { address, components: `country:${city.countryCode}`, key: apiKey },
                timeout: 5000,
            });

            const result = data?.status === 'OK' ? data.results?.[0] : null;
            const geo = this.toGeo(result?.geometry?.location?.lat, result?.geometry?.location?.lng);
            if (!geo) {
                this.failedGeocodes.set(key, Date.now());
                this.logger.warn(`[HOTEL-AUTOCOMPLETE-V2] Google geocode "${address}" returned ${data?.status}${data?.error_message ? `: ${data.error_message}` : ''}`);
                return null;
            }

            this.failedGeocodes.delete(key);
            console.log(`[HOTEL-AUTOCOMPLETE-V2] Google geocode "${address}" -> ${geo.latitude},${geo.longitude}`);
            return { ...geo, formattedAddress: result.formatted_address ?? null };
        } catch (error) {
            this.failedGeocodes.set(key, Date.now());
            this.logger.warn(`[HOTEL-AUTOCOMPLETE-V2] Google geocode "${address}" failed: ${error?.message}`);
            return null;
        }
    }

    private async getCityIndex(): Promise<CityIndexEntry[]> {
        const isFresh = this.cityIndex.length > 0 && Date.now() - this.cityIndexBuiltAt < HotelAutocompleteV2Service.CITY_INDEX_TTL_MS;
        if (isFresh) {
            return this.cityIndex;
        }

        if (!this.cityIndexBuild) {
            this.cityIndexBuild = this.buildCityIndex()
                .then((index) => {
                    this.cityIndex = index;
                    this.cityIndexBuiltAt = Date.now();
                    return index;
                })
                .finally(() => {
                    this.cityIndexBuild = null;
                });
        }

        // A stale index is still served while the new one is being built
        return this.cityIndex.length > 0 ? this.cityIndex : this.cityIndexBuild;
    }

    private async buildCityIndex(): Promise<CityIndexEntry[]> {
        const startedAt = Date.now();
        const validGeo = 'latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180 AND NOT (latitude = 0 AND longitude = 0)';
        const rows: any[] = await this.hotelListRepo.query(
            `SELECT LOWER(TRIM(city_name)) AS norm_name,
                    country_code,
                    MODE() WITHIN GROUP (ORDER BY TRIM(city_name)) AS city_name,
                    MAX(country_name) AS country_name,
                    ARRAY_AGG(DISTINCT city_id) FILTER (WHERE city_id IS NOT NULL) AS city_codes,
                    COUNT(*)::int AS hotel_count,
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latitude) FILTER (WHERE ${validGeo}) AS median_lat,
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY longitude) FILTER (WHERE ${validGeo}) AS median_lng
             FROM tbo_hotel_list
             WHERE city_name IS NOT NULL AND TRIM(city_name) <> '' AND country_code IS NOT NULL
             GROUP BY LOWER(TRIM(city_name)), country_code`,
        );

        const index = rows.map((row) => ({
            normName: this.normalize(row.norm_name),
            cityName: row.city_name,
            countryCode: row.country_code,
            countryName: row.country_name ?? '',
            cityCodes: row.city_codes ?? [],
            hotelCount: Number(row.hotel_count) || 0,
            fallbackGeo: this.toGeo(row.median_lat, row.median_lng),
        }));

        console.log(`[HOTEL-AUTOCOMPLETE-V2] city index built: ${index.length} cities in ${((Date.now() - startedAt) / 1000).toFixed(3)}s`);
        return index;
    }

    /* "mumbai/bombay" and "mumbai maharashtra" are variants of "mumbai"; "new delhi" is not a variant of "delhi" */
    private isNameVariant(name: string, baseName: string): boolean {
        return name.length > baseName.length && name.startsWith(baseName) && !/[a-z0-9]/.test(name.charAt(baseName.length));
    }

    private geoKey(city: Pick<CityIndexEntry, 'countryCode' | 'normName'>): string {
        return `${city.countryCode}|${city.normName}`;
    }

    private normalize(value: string): string {
        return String(value ?? '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
    }

    private toGeo(latitude: unknown, longitude: unknown): AutocompleteGeoLocation | null {
        const lat = Number(latitude);
        const lng = Number(longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) {
            return null;
        }
        return { latitude: lat, longitude: lng };
    }
}
