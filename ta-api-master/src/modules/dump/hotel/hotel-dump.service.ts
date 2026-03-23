import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { Http } from 'src/shared/utilities/flight/http.utility';
import { AmenityMasterEntity } from './entities/amenity-master.entity';
import { AmenityMappingEntity } from './entities/amenity-mapping.entity';
import { BoardCodeMasterEntity } from './entities/board-code-master.entity';
import { BoardCodeMappingEntity } from './entities/board-code-mapping.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { HotelAutocompleteDto } from './dtos/hotel-autocomplete.dto';
import { HotelAutocompleteInterface, HotelAutocompleteResponse } from './interfaces/hotel-response.interface';
import { CommonResponse } from 'src/shared/interfaces/common-response.interface';
import { HotelAmenity, HotelDetailResponse, HotelImageSizes, HotelPoi } from './interfaces/hotel-detail.interface';
import { TransferDataToHotelContent } from './dtos/transfer-data-to-hotel-content.dto';
import { SupplierCredService } from 'src/modules/generic/supplier-credientials/supplier-cred.service';
import { CountryEntity } from 'src/shared/entities/country.entity';
import { CityEntity } from 'src/shared/entities/city.entity';
import { HotelMasterEntity, HotelSourceEnum, StarRatingEnum } from 'src/shared/entities/hotel-master.entity';
import { TboHotelImagesEntity } from './entities/tbo-hotel-images.entity';
import { TboHotelAdditionalDetailsEntity } from './entities/tbo-hotel-additional-details.entity';
import { TboHotelContentEntity } from './entities/tbo-hotel-content.entity';
import { TboHotelRoomContentEntity } from './entities/tbo-hotel-room-content.entity';
import { EntityManager } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/StreamArray';
import { pick } from 'stream-json/filters/Pick';

/**
 * Hotel dump service - handles hotel data dump operations
 * @author Prashant - TBO Integration
 */
@Injectable()
export class HotelDumpService {
    private readonly logger = new Logger(HotelDumpService.name);
    private terminalsCache: Map<string, any> = new Map();

    constructor(
        @InjectRepository(AmenityMasterEntity)
        private readonly amenityMasterRepository: Repository<AmenityMasterEntity>,
        @InjectRepository(AmenityMappingEntity)
        private readonly amenityMappingRepository: Repository<AmenityMappingEntity>,
        @InjectRepository(BoardCodeMasterEntity)
        private readonly boardCodeMasterRepository: Repository<BoardCodeMasterEntity>,
        @InjectRepository(BoardCodeMappingEntity)
        private readonly boardCodeMappingRepository: Repository<BoardCodeMappingEntity>,
        @InjectRepository(TboHotelAdditionalDetailsEntity)
        private readonly hotelDetailsRepository: Repository<TboHotelAdditionalDetailsEntity>,
        @InjectRepository(TboHotelImagesEntity)
        private readonly hotelImagesRepository: Repository<TboHotelImagesEntity>,
        @InjectRepository(TboHotelContentEntity)
        private readonly hotelContentRepository: Repository<TboHotelContentEntity>,
        @InjectRepository(TboHotelRoomContentEntity)
        private readonly hotelRoomContentRepository: Repository<TboHotelRoomContentEntity>,
        @InjectRepository(CountryEntity)
        private readonly countryRepository: Repository<CountryEntity>,
        @InjectRepository(CityEntity)
        private readonly cityRepository: Repository<CityEntity>,
        @InjectRepository(HotelMasterEntity)
        private readonly hotelMasterRepository: Repository<HotelMasterEntity>,
        private readonly supplierCredService: SupplierCredService,
    ) { }

    /**
     * Get hotel autocomplete suggestions
     * @param hotelAutocompleteDto - Search criteria
     * @returns Promise<HotelAutocompleteResponse> - Autocomplete suggestions
     */
    async getHotelAutocomplete(hotelAutocompleteDto: HotelAutocompleteDto): Promise<HotelAutocompleteResponse> {
        try {
            const { query: search, lat, long } = hotelAutocompleteDto;

            if (!search || search.trim().length < 2) {
                throw new BadRequestException('Search term must be at least 2 characters long');
            }

            const searchTerm = search.trim().toLowerCase();

            // Search hotels by name, city, or country
            const hotels = await this.hotelContentRepository
                .createQueryBuilder('hotel')
                .where('(LOWER(hotel.hotelName) LIKE :search OR LOWER(hotel.city) LIKE :search OR LOWER(hotel.country) LIKE :search)', { search: `%${searchTerm}%` })
                .orderBy('hotel.hotelName', 'ASC')
                .limit(10)
                .getMany();

            const suggestions: HotelAutocompleteInterface[] = hotels.map((hotel) => ({
                hotelCode: hotel.hotelCode,
                hotelName: hotel.hotelName,
                city: hotel.city,
                state: hotel.state,
                country: hotel.country,
                rating: hotel.rating,
                address: hotel.address,
                heroImage: hotel.heroImage,
            }));

            return {
                success: true,
                message: 'Hotel autocomplete suggestions retrieved successfully',
                data: suggestions,
                totalCount: suggestions.length,
            };
        } catch (error) {
            this.logger.error('Error in getHotelAutocomplete:', error);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to get hotel autocomplete suggestions');
        }
    }

    /**
     * Get hotel details by hotel code
     * @param hotelCode - Hotel code
     * @returns Promise<HotelDetailResponse> - Hotel details
     */
    async getHotelDetails(hotelCode: string): Promise<HotelDetailResponse> {
        try {
            if (!hotelCode) {
                throw new BadRequestException('Hotel code is required');
            }

            // Get basic hotel information


            const hotel = await this.hotelMasterRepository.findOne({
                where: { hotelCode },
            });

            const hotelContent = await this.hotelContentRepository.findOne({
                where: { hotelCode },
            });

            if (!hotel || !hotelContent) {
                throw new BadRequestException('Hotel not found');
            }



            // Get additional hotel details
            const additionalDetails = await this.hotelDetailsRepository.findOne({
                where: { hotelCode },
            });


            // Get hotel images (simplified for now)
            const images = await this.hotelImagesRepository.find({
                where: { hotelCode },
            });


            // ✅ Properly map DB HotelPoi records into HotelPoi objects
            const hotelPois: HotelPoi[] =
                additionalDetails?.interestPoints?.length
                    ? additionalDetails.interestPoints.map(poi => ({
                        name: poi,
                        distance: '',
                    }))
                    : [];


            // Get hotel amenities (simplified - return empty for now)

            const hotelAmenities: HotelAmenity[] =
                additionalDetails?.amenities?.length
                    ? additionalDetails.amenities.map(poi => ({
                        code: this.createAmenitiesCode(poi),
                        title: poi,
                        isPaid: false,
                    }))
                    : [];

            // ✅ Transform single heroImage string into HotelImageSizes format
            const hotelImages: HotelImageSizes[] = images.length > 0
            ? images.map(img => ({
                thumbnail: '',
                small: '',
                bigger: '',  // map DB column to interface property
                standard: img.url || '',         // map DB column to interface property
                xl: '',       // numeric order
                xxl: '',       // numeric order
                original: '', // convert to string if needed
            }))
            : [];




            // Get board codes (simplified - return empty for now)
            const boardCodes = [];

            // Process images (simplified for now)
            const processedImages: HotelImageSizes[] = [];

            return {
                hotelId: hotel.hotelCode,
                name: hotel.hotelName,
                address: hotelContent.address,
                phones: [],
                description: (hotel?.highlightText as unknown as string) || '',
                rating: {
                    stars: hotelContent.rating,
                    reviewScore: ''

                },
                location: {
                    geoLocation: {
                        latitude: hotelContent.latitude,
                        longitude: hotelContent.longitude,
                    },
                    city: hotelContent.city,
                    state: hotelContent.state,
                    country: additionalDetails?.country || '',
                    countryCode: hotelContent.countryCode,
                },
                images: hotelImages || [],
                amenities: hotelAmenities || [],
                poi: hotelPois || [],
                neighbourhoods: [],
            }
        } catch (error) {
            this.logger.error('Error in getHotelDetails:', error);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to get hotel details');
        }
    }

    /**
     * Transfer data to hotel content table
     * @param transferData - Data transfer request
     * @returns Promise<CommonResponse> - Transfer result
     */
    async transferDataToHotelContent(transferData: TransferDataToHotelContent): Promise<CommonResponse> {
        try {
            const { from, to } = transferData;

            if (!from || !to) {
                throw new BadRequestException('From and to values are required');
            }

            // This is a placeholder implementation
            // In a real scenario, you would implement the actual data transfer logic
            this.logger.log(`Transferring data from ${from} to ${to}`);

            return {
                success: true,
                message: `Data transfer from ${from} to ${to} completed successfully`,
            };
        } catch (error) {
            this.logger.error('Error in transferDataToHotelContent:', error);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to transfer data');
        }
    }

    /**
     * Get hotel room content by hotel code
     * @param hotelCode - Hotel code
     * @returns Promise<any> - Room content
     */
    async getHotelRoomContent(hotelCode: string): Promise<any> {
        try {
            if (!hotelCode) {
                throw new BadRequestException('Hotel code is required');
            }

            const roomContent = await this.hotelRoomContentRepository.find({
                where: { hotelCode },
            });

            return {
                success: true,
                message: 'Hotel room content retrieved successfully',
                data: roomContent,
            };
        } catch (error) {
            this.logger.error('Error in getHotelRoomContent:', error);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to get hotel room content');
        }
    }

    /**
     * Bulk insert hotel content
     * @param hotelData - Array of hotel data
     * @returns Promise<CommonResponse> - Insert result
     */
    async bulkInsertHotelContent(hotelData: any[]): Promise<CommonResponse> {
        try {
            if (!hotelData || hotelData.length === 0) {
                throw new BadRequestException('Hotel data is required');
            }

            // Process and insert hotel data
            const processedData = hotelData.map((hotel) => ({
                hotelCode: hotel.hotelCode,
                hotelName: hotel.hotelName,
                rating: hotel.rating,
                latitude: hotel.latitude,
                longitude: hotel.longitude,
                address: hotel.address,
                city: hotel.city,
                state: hotel.state,
                country: hotel.country,
                cityCode: hotel.cityCode,
                stateCode: hotel.stateCode,
                countryCode: hotel.countryCode,
                pincode: hotel.pincode,
                heroImage: hotel.heroImage,
                hotelNameNormalized: hotel.hotelName?.toLowerCase().replace(/[^a-z0-9]/g, ''),
            }));

            await this.hotelContentRepository.save(processedData);

            return {
                success: true,
                message: `${processedData.length} hotel records inserted successfully`,
            };
        } catch (error) {
            this.logger.error('Error in bulkInsertHotelContent:', error);
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to insert hotel content');
        }
    }

    /**
     * Add country list dump from TBO API
     * @param headers - Request headers
     * @returns Promise<CommonResponse> - Dump result
     */

    async addCountryList(headers: Headers): Promise<any> {
        this.logger.log(`Initiating country dump check...`);

        // Trigger background process
        this.processCountriesInBackground(headers).catch(err =>
            this.logger.error(`Background country dump failed: ${err.message}`, err.stack)
        );

        return {
            status: 202,
            message: "Country dump initiated. Check server logs for progress.",
            timestamp: new Date().toISOString(),
        };
    }

    private async processCountriesInBackground(headers: Headers) {
        const startTime = Date.now();
        this.logger.log(`Starting background recursive country dump from CountryList API (Streaming).`);

        let processed = 0;
        let failed = 0;

        try {

            const providersData = await this.supplierCredService.getActiveProviders(headers);
            const tboProvider = providersData.find((p) => p.code === 'TBO');

            if (!tboProvider) {
                throw new BadRequestException('TBO provider not found');
            }
            

            const providerCredentials = JSON.parse(tboProvider.provider_credentials);
            const auth = {
                username: providerCredentials.dump_username,
                password: providerCredentials.dump_password,
            };

            const endpoint = `${providerCredentials?.dump_url}/CountryList`;          

            this.logger.debug(`Fetching countries from ${endpoint}`);

            // Streaming implementation
            const stream = await Http.httpRequestTBOHotelStream('GET', endpoint, null, auth);

            const pipeline = stream
                .pipe(parser())
                .pipe(pick({ filter: 'CountryList' }))
                .pipe(streamArray());

            await new Promise((resolve, reject) => {
                const batchSize = 1000;
                let batch: any[] = [];

                pipeline.on('data', async (data: any) => {
                    const country = data.value;
                    batch.push(country);

                    if (batch.length >= batchSize) {
                        pipeline.pause(); // Pause stream
                        try {
                            await this.saveCountryBatch(batch);
                            processed += batch.length;
                            batch = []; // Clear batch
                            this.logger.log(`[CountryDump] Processed ${processed} countries...`);
                            pipeline.resume(); // Resume stream
                        } catch (err) {
                            this.logger.error(`Error saving country batch: ${err.message}`);
                            failed += batch.length; // Approximate
                            batch = [];
                            pipeline.resume();
                        }
                    }
                });

                pipeline.on('end', async () => {
                    // Process remaining
                    if (batch.length > 0) {
                        try {
                            await this.saveCountryBatch(batch);
                            processed += batch.length;
                        } catch (err) {
                            this.logger.error(`Error saving final country batch: ${err.message}`);
                            failed += batch.length;
                        }
                    }
                    resolve({ processed, failed });
                });

                pipeline.on('error', (err) => {
                    this.logger.error(`Stream error during country dump: ${err.message}`);
                    reject(err);
                });
            });

            const duration = Date.now() - startTime;
            this.logger.log(`Background Country dump completed in ${duration}ms. Processed: ${processed}, Failed: ${failed}`);

        } catch (error: any) {
            const duration = Date.now() - startTime;
            this.logger.error(`Error during background country dump: ${error.message}`, error.stack);
        }
    }

    private async saveCountryBatch(countries: any[]) {
        for (const country of countries) {
            try {
                const countryCode = country.Code;
                const countryName = country.Name;

                const existing = await this.countryRepository.findOne({ where: { iso2: countryCode } });

                if (existing) {
                    existing.iso2 = countryCode;
                    existing.countryName = countryName;
                    await this.countryRepository.save(existing);
                } else {
                    const newCountry = this.countryRepository.create({
                        iso2: countryCode,
                        countryName: countryName,
                    });
                    await this.countryRepository.save(newCountry);
                }
            } catch (e) {
                this.logger.error(`Error saving country struct: ${e.message}`);
                throw e;
            }
        }
    }



    async addCityList(headers: Headers, countryCode?: string): Promise<any> {
        this.logger.log(`Initiating destination dump check...`);

        // Determine countries count
        let countriesCount = 0;
        if (countryCode) {
            countriesCount = 1;
        } else {
            countriesCount = await this.countryRepository.count();
        }

        // Trigger background process
        this.processDestinationsInBackground(headers, countryCode).catch(err =>
            this.logger.error(`Background destination dump failed: ${err.message}`, err.stack)
        );

        return {
            status: 202,
            message: `Destination dump initiated. Processing destinations for approximately ${countriesCount} countries. Check server logs for progress.`,
            totalCountries: countriesCount,
            timestamp: new Date().toISOString(),
        };
    }

    private async processDestinationsInBackground(headers: Headers, countryCode?: string) {
        const startTime = Date.now();
        this.logger.log(`Starting background recursive destination dump from CityList API (Streaming).`);

        let processed = 0;
        let failed = 0;
        let totalRecords = 0;

        try {

            const providersData = await this.supplierCredService.getActiveProviders(headers);
            const tboProvider = providersData.find((p) => p.code === 'TBO');

            if (!tboProvider) {
                throw new BadRequestException('TBO provider not found');
            }
           

            const providerCredentials = JSON.parse(tboProvider.provider_credentials);
            const auth = {
                username: providerCredentials.dump_username,
                password: providerCredentials.dump_password,
            };

            const endpoint = `${providerCredentials?.dump_url}/CityList`;

            // Determine countries to process
            let countriesToProcess: {  iso2: string, countryId: number, countryName: string }[] = [];

            if (countryCode) {
                const selectCountry = await this.countryRepository.findOne({
                    where: { iso2: countryCode },
                    select: ['iso2', 'countryId', 'countryName']
                    });
                    if (selectCountry) {
                countriesToProcess.push({  iso2: countryCode, countryId: selectCountry?.countryId , countryName: selectCountry?.countryName });
                    }
            } else {
                const allCountries = await this.countryRepository.find({ select: ['iso2', 'countryId', 'countryName'] });
                countriesToProcess = allCountries.map((c) => ({ iso2: c.iso2 , countryId: c.countryId, countryName: c.countryName}));
            }

            this.logger.log(`Processing destinations for ${countriesToProcess.length} countries`);

            // Loop through countries
            for (const country of countriesToProcess) {
                try {
                    const existingCityCount = await this.cityRepository.count({ where: { countryCode: country.iso2 } });
                    if (existingCityCount > 0 && !countryCode) {
                        this.logger.log(`[DestinationDump] Skipping country ${country.iso2} as cities already exist.`);
                        continue;
                    }

                    const payload = {
                        CountryCode: country.iso2,
                    };

                    this.logger.debug(`Fetching cities for country: ${country.iso2}`);

                    const stream = await Http.httpRequestTBOHotelStream('POST', endpoint, payload, auth);

                    const pipeline = stream
                        .pipe(parser())
                        .pipe(pick({ filter: 'CityList' }))
                        .pipe(streamArray());

                    await new Promise((resolve, reject) => {
                        const batchSize = 1000;
                        let batch: any[] = [];

                        pipeline.on('data', async (data: any) => {
                            const city = data.value;
                            batch.push(city);
                            totalRecords++;

                            if (batch.length >= batchSize) {
                                pipeline.pause();
                                try {
                                    await this.saveCityBatch(batch, country);
                                    processed += batch.length;
                                    this.logger.log(`[DestinationDump] Country ${country.iso2}: Processed ${processed} destinations...`);
                                    batch = [];
                                    pipeline.resume();
                                } catch (err) {
                                    this.logger.error(`Error saving city batch for ${country.iso2}: ${err.message}`);
                                    failed += batch.length;
                                    batch = [];
                                    pipeline.resume();
                                }
                            }
                        });

                        pipeline.on('end', async () => {
                            if (batch.length > 0) {
                                try {
                                    await this.saveCityBatch(batch, country);
                                    processed += batch.length;
                                } catch (err) {
                                    this.logger.error(`Error saving final city batch for ${country.iso2}: ${err.message}`);
                                    failed += batch.length;
                                }
                            }
                            resolve(true);
                        });

                        pipeline.on('error', (err) => {
                            this.logger.error(`Stream error during city dump for ${country.iso2}: ${err.message}`);
                            // Don't reject the main loop, just log and resolve to continue to next country
                            resolve(false);
                        });
                    });

                } catch (err) {
                    this.logger.error(`Error processing country ${country.iso2}: ${err.message}`);
                    failed++;
                }
            }

            const duration = Date.now() - startTime;
            this.logger.log(`Background Destination dump completed in ${duration}ms. Processed: ${processed}, Failed: ${failed}`);

        } catch (error: any) {
            const duration = Date.now() - startTime;
            this.logger.error(`Error during background destination dump: ${error.message}`, error.stack);
        }
    }

    private async saveCityBatch(cities: any[], country: {countryId: number,countryName: string, iso2: string }) {
        for (const city of cities) {
            try {
                const cityCode = city.Code;
                const cityName = city.Name;

                const existing = await this.cityRepository.findOne({ where: { cityCodeTbo: cityCode } });

                if (existing) {
                    existing.cityName = cityName;
                    existing.countryCode = country.iso2;
                    existing.countryCode = country.iso2;
                    await this.cityRepository.save(existing);
                } else {
                    const newCity = this.cityRepository.create({
                        cityName : cityName,
                        cityCodeTbo : cityCode,
                        countryId : country.countryId,
                        countryCode : country.iso2|| '',
                        countryName : country.countryName,
                        stateId : 0,
                        stateCode : '', 
                        stateName : '', 
                        latitude : 0, 
                        longitude: 0,
                    });
                    await this.cityRepository.save(newCity);
                }
            } catch (innerErr) {
                this.logger.error(`Error saving city ${city.Code}: ${innerErr.message}`);
            }
        }
    }


    /**
     * Dumps hotel basic details from TBOHotelCodeList API
     * @param headers - HTTP headers
     * @param cityCode - Optional city code to filter hotels
     * @returns Promise with dump results
     */
    async dumpHotelBasicDetails(headers: Headers, cityCode?: string): Promise<any> {
        this.logger.log(`Initiating hotel basic details dump check...`);

        try {
            // Determine cities count
            let citiesCount = 0;
            if (cityCode) {
                citiesCount = 1;
            } else {
                citiesCount = await this.cityRepository.count();
            }

            // Trigger background process
            this.processHotelBasicDetailsInBackground(headers, cityCode).catch(err =>
                this.logger.error(`Background hotel basic details dump failed: ${err.message}`, err.stack)
            );

            return {
                status: 202,
                message: `Hotel basic details dump initiated. Processing hotels for approximately ${citiesCount} cities. Check server logs for progress.`,
                totalCities: citiesCount,
                timestamp: new Date().toISOString(),
            };
        } catch (error: any) {
            this.logger.error(`Error initiating hotel basic details dump: ${error.message}`, error.stack);
            throw new BadRequestException(`Failed to initiate dump: ${error.message}`);
        }
    }

    private async processHotelBasicDetailsInBackground(headers: Headers, cityCode?: string) {
        const startTime = Date.now();
        this.logger.log(`Starting background hotel basic details dump from TBOHotelCodeList API (Streaming).`);

        let processed = 0;
        let failed = 0;
        let totalRecords = 0;

        try {          

            const providersData = await this.supplierCredService.getActiveProviders(headers);
            const tboProvider = providersData.find((p) => p.code === 'TBO');

            if (!tboProvider) {
                throw new BadRequestException('TBO provider not found');
            }

            const providerCredentials = JSON.parse(tboProvider.provider_credentials);
            const auth = {
                username: providerCredentials.dump_username,
                password: providerCredentials.dump_password,
            };

            const endpoint = `${providerCredentials?.dump_url}/TBOHotelCodeList`;

            // Determine cities to process
            let citiesToProcess: { code: string, hotelDumpUpdatedAt?: Date | null }[] = [];

            if (cityCode) {
                const specificCity = await this.cityRepository.findOne({ where: { cityCodeTbo: cityCode }, select: ['cityCodeTbo', 'hotelDumpUpdatedAt'] });
                if (specificCity) {
                   citiesToProcess.push({ code: specificCity.cityCodeTbo, hotelDumpUpdatedAt: specificCity.hotelDumpUpdatedAt });
                } else {
                   citiesToProcess.push({ code: cityCode });
                }
            } else {
                this.logger.log('Fetching all destinations from database...');
                const allCities = await this.cityRepository.find({ select: ['cityCodeTbo', 'hotelDumpUpdatedAt'] });
                citiesToProcess = allCities.map((c) => ({ code: c.cityCodeTbo, hotelDumpUpdatedAt: c.hotelDumpUpdatedAt }));
            }

            this.logger.log(`Processing hotels for ${citiesToProcess.length} cities`);

            // Loop through cities
            for (const city of citiesToProcess) {
                try {
                    if (city.hotelDumpUpdatedAt && !cityCode) {
                        const oneWeekAgo = new Date();
                        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                        if (city.hotelDumpUpdatedAt > oneWeekAgo) {
                            this.logger.log(`[HotelBasicDump] Skipping city ${city.code} as it was dumped within the last 1 week.`);
                            continue;
                        }
                    }

                    const payload = {
                        CityCode: city.code,
                    };

                    this.logger.debug(`Fetching hotels for city: ${city.code}`);

                    const stream = await Http.httpRequestTBOHotelStream('POST', endpoint, payload, auth);

                    const pipeline = stream
                        .pipe(parser())
                        .pipe(pick({ filter: 'Hotels' }))
                        .pipe(streamArray());

                    await new Promise((resolve, reject) => {
                        const batchSize = 1000;
                        let batch: any[] = [];

                        pipeline.on('data', async (data: any) => {
                            const hotel = data.value;
                            batch.push(hotel);
                            totalRecords++;

                            if (batch.length >= batchSize) {
                                pipeline.pause();
                                try {
                                    await this.saveHotelBasicBatch(batch, city.code);
                                    processed += batch.length;
                                    this.logger.log(`[HotelBasicDump] City ${city.code}: Processed ${processed} hotels...`);
                                    batch = [];
                                    pipeline.resume();
                                } catch (err) {
                                    this.logger.error(`Error saving hotel batch for city ${city.code}: ${err.message}`);
                                    failed += batch.length;
                                    batch = [];
                                    pipeline.resume();
                                }
                            }
                        });

                        pipeline.on('end', async () => {
                            if (batch.length > 0) {
                                try {
                                    await this.saveHotelBasicBatch(batch, city.code);
                                    processed += batch.length;
                                } catch (err) {
                                    this.logger.error(`Error saving final hotel batch for city ${city.code}: ${err.message}`);
                                    failed += batch.length;
                                }
                            }
                            
                            try {
                                await this.cityRepository.update({ cityCodeTbo: city.code }, { hotelDumpUpdatedAt: new Date() });
                            } catch (updateErr) {
                                this.logger.error(`Error updating hotelDumpUpdatedAt for city ${city.code}: ${updateErr.message}`);
                            }

                            resolve(true);
                        });

                        pipeline.on('error', (err) => {
                            this.logger.error(`Stream error during hotel dump for city ${city.code}: ${err.message}`);
                            resolve(false);
                        });
                    });

                } catch (err) {
                    this.logger.error(`Error processing city ${city.code}: ${err.message}`);
                    failed++;
                }
            }

            const duration = Date.now() - startTime;
            this.logger.log(`Background Hotel dump completed in ${duration}ms. Processed: ${processed}, Failed: ${failed}`);

        } catch (error: any) {
            const duration = Date.now() - startTime;
            this.logger.error(`Error during background hotel dump: ${error.message}`, error.stack);
        }
    }


    private async saveHotelBasicBatch(hotels: any[], cityCode: string) {
        const hotelCodes = hotels.map(h => String(h.HotelCode));

        const existingMaster = await this.hotelMasterRepository.find({ where: { hotelCode: In(hotelCodes) }, select: ['hotelCode'] });
        const existingMasterSet = new Set(existingMaster.map(e => e.hotelCode));

        const hotelEntities: HotelMasterEntity[] = [];
        const hotelContentEntities: TboHotelContentEntity[] = [];
        const hotelAdditionalDetailsEntities: TboHotelAdditionalDetailsEntity[] = [];

        for (const hotel of hotels) {
            try {
                const hotelCode = String(hotel.HotelCode);

                if (!existingMasterSet.has(hotelCode)) {
                    const hotelName = hotel.HotelName || '';
                    const lat = hotel.Latitude || null;
                    const lng = hotel.Longitude || null;
                    const address = hotel.Address || '';
                    const rating = this.parseHotelRating(hotel.HotelRating);
                    const country = hotel.CountryName || '';
                    const countryCode = hotel.CountryCode || '';
                    const city = hotel.CityName || '';

                    const master = new HotelMasterEntity();
                    master.hotelCode = hotelCode;
                    master.hotelSource = HotelSourceEnum.TBO;
                    master.providerCode = 'TBO';
                    master.hotelName = hotelName;
                    master.address = address;
                    master.city = city;
                    master.countryCode = countryCode;
                    master.latitude = lat;
                    master.longitude = lng;
                    master.starRating = (rating ? String(rating) : null) as any;
                    master.isActive = true;
                    master.isDeleted = false;
                    master.createdAt = new Date();
                    hotelEntities.push(master);

                    const content = new TboHotelContentEntity();
                    content.hotelCode = hotelCode;
                    content.hotelName = hotelName;
                    content.address = address;
                    content.city = city;
                    content.cityCode = cityCode;
                    content.countryCode = countryCode;
                    content.latitude = lat;
                    content.longitude = lng;
                    content.rating = (rating ? String(rating) : null) as any;
                    hotelContentEntities.push(content);

                    const detail = new TboHotelAdditionalDetailsEntity();
                    detail.hotelCode = hotelCode;
                    detail.supplierCode = 'TBO';
                    detail.hotelName = hotelName;
                    detail.latitude = lat;
                    detail.longitude = lng;
                    detail.rating = (rating ? String(rating) : null) as any;
                    detail.address = address;
                    detail.country = country;
                    detail.countryCode = countryCode;
                    detail.city = city;
                    detail.cityCode = cityCode;
                    detail.status = 'PENDING';
                    hotelAdditionalDetailsEntities.push(detail);

                    existingMasterSet.add(hotelCode);
                }
            } catch (innerErr) {
                this.logger.error(`Error processing hotel basic batch for code ${hotel?.HotelCode}: ${innerErr.message}`);
            }
        }

        if (hotelEntities.length > 0) {
            try {
                const entityManager: EntityManager = this.hotelMasterRepository.manager;
                await entityManager.transaction(async (transactionalEntityManager) => {
                    await transactionalEntityManager.save(HotelMasterEntity, hotelEntities);
                    await transactionalEntityManager.save(TboHotelContentEntity, hotelContentEntities);
                    await transactionalEntityManager.save(TboHotelAdditionalDetailsEntity, hotelAdditionalDetailsEntities);
                });
            } catch (err) {
                 this.logger.error(`Error in bulk save transaction for basic details: ${err.message}`);
            }
        }
    }


    async dumpHotelInfo(headers: Headers): Promise<any> {
        this.logger.log(`Initiating hotel details dump check...`);

        try {
            // Check pending count
            const totalPending = await this.hotelDetailsRepository.count({
                where: { status: 'PENDING' },
            });

            if (totalPending === 0) {
                return {
                    status: 200,
                    message: "No pending hotels found. All hotels are already processed.",
                    totalPending: 0,
                    timestamp: new Date().toISOString()
                };
            }

            // Trigger background process
            this.processHotelInfoInBackground(headers).catch(err =>
                this.logger.error(`Background hotel info dump failed: ${err.message}`, err.stack)
            );

            return {
                status: 202,
                message: `Hotel details dump initiated. ${totalPending} hotels remaining to process. Check server logs for progress.`,
                totalPending: totalPending,
                timestamp: new Date().toISOString(),
            };
        } catch (error: any) {
            this.logger.error(`Error initiating hotel details dump: ${error.message}`, error.stack);
            throw new BadRequestException(`Failed to initiate dump: ${error.message}`);
        }
    }


    private async processHotelInfoInBackground(headers: Headers) {
        const startTime = Date.now();
        this.logger.log(`Starting background hotel details dump from TBOHotelDetails API.`);

        let processed = 0;
        let failed = 0;

        try {

            const providersData = await this.supplierCredService.getActiveProviders(headers);
            const tboProvider = providersData.find((p) => p.code === 'TBO');

            if (!tboProvider) {
                throw new BadRequestException('TBO provider not found');
            }

            const providerCredentials = JSON.parse(tboProvider.provider_credentials);
            const auth = {
                username: providerCredentials.dump_username,
                password: providerCredentials.dump_password,
            };

            const endpoint = `${providerCredentials?.dump_url}/Hoteldetails`;

            //  Fetch ALL PENDING hotels (only codes)
            const pendingHotels = await this.hotelDetailsRepository.find({
                where: { status: 'PENDING' },
                select: ['hotelCode', 'supplierCode'],
            });

            this.logger.log(`Found ${pendingHotels.length} pending hotels to process`);

            // Process in chunks of 50
            const chunkSize = 50; // Using 50 to avoid overloading TBO with concurrent requests
            const retryChunkSize = 10;

            for (let i = 0; i < pendingHotels.length; i += chunkSize) {
                const chunk = pendingHotels.slice(i, i + chunkSize);

                // Try processing large batch
                const result = await this.fetchAndProcessHotels(chunk, endpoint, auth);

                if (!result.success) {
                    this.logger.warn(`Batch starting at ${i} failed. Retrying in smaller chunks of ${retryChunkSize}...`);

                    // Retry in smaller chunks
                    for (let j = 0; j < chunk.length; j += retryChunkSize) {
                        const subChunk = chunk.slice(j, j + retryChunkSize);
                        const subResult = await this.fetchAndProcessHotels(subChunk, endpoint, auth);

                        if (subResult.success) {
                            processed += subResult.processed;
                            failed += subResult.failed;
                        } else {
                            this.logger.error(`Sub-chunk starting at ${i + j} failed. Skipping.`);
                            failed += subChunk.length;
                        }
                    }
                } else {
                    processed += result.processed;
                    failed += result.failed;
                }

                this.logger.log(`[HotelDetailDump] Processed ${processed}/${pendingHotels.length} hotels. (Chunk ${i + 1}-${Math.min(i + chunkSize, pendingHotels.length)})`);
            }

            const duration = Date.now() - startTime;
            this.logger.log(`Background Hotel details dump completed in ${duration}ms. Processed: ${processed}, Failed: ${failed}`);

        } catch (error: any) {
            const duration = Date.now() - startTime;
            this.logger.error(`Error during background hotel details dump: ${error.message}`, error.stack);
        }
    }


    private async fetchAndProcessHotels(hotels: any[], endpoint: string, auth: any): Promise<{ success: boolean; processed: number; failed: number }> {
        let localProcessed = 0;
        let localFailed = 0;
        try {
            const requestedCodes = hotels.map((h) => String(h.hotelCode));
            const batchResponses = await Promise.all(
                requestedCodes.map(code => 
                    Http.httpRequestTBOHotel('POST', endpoint, { Hotelcodes: code, Language: 'en' }, auth)
                    .catch(e => null)
                )
            );

            const allDetails = batchResponses
                .filter(res => res && res.HotelDetails && Array.isArray(res.HotelDetails) && res.HotelDetails.length > 0)
                .map(res => res.HotelDetails[0]);

            if (allDetails.length === 0) {
                return { success: false, processed: 0, failed: requestedCodes.length };
            }

            localFailed += requestedCodes.length - allDetails.length;

            const codes = allDetails.map(d => String(d.HotelCode));
            const existingMasters = await this.hotelMasterRepository.find({ where: { hotelCode: In(codes) } });
            const existingContents = await this.hotelContentRepository.find({ where: { hotelCode: In(codes) } });
            const existingDetails = await this.hotelDetailsRepository.find({ where: { hotelCode: In(codes) } });

            const mastersMap = new Map(existingMasters.map(e => [e.hotelCode, e]));
            const contentsMap = new Map(existingContents.map(e => [e.hotelCode, e]));
            const detailsMap = new Map(existingDetails.map(e => [e.hotelCode, e]));

            const hotelEntities: HotelMasterEntity[] = [];
            const hotelContentEntities: TboHotelContentEntity[] = [];
            const hotelAdditionalDetailsEntities: TboHotelAdditionalDetailsEntity[] = [];
            const hotelImagesEntities: TboHotelImagesEntity[] = [];

            for (const details of allDetails) {
                try {
                    const hotelCode = String(details.HotelCode);
                    
                    const master = mastersMap.get(hotelCode) || new HotelMasterEntity();
                    const content = contentsMap.get(hotelCode) || new TboHotelContentEntity();
                    const additional = detailsMap.get(hotelCode) || new TboHotelAdditionalDetailsEntity();

                    // 1. HotelMasterEntity
                    master.hotelCode = hotelCode;
                    master.hotelName = details.HotelName || '';
                    master.highlightText = details.Description || '';
                    master.address = details.Address || '';
                    master.city = details.CityName || '';
                    master.countryCode = details.CountryCode || '';
                    master.latitude = details.Map ? details.Map.split('|')[0] : null;
                    master.longitude = details.Map ? details.Map.split('|')[1] : null;
                    master.starRating = details.HotelRating || null;
                    master.providerCode = 'TBO';
                    master.hotelSource = HotelSourceEnum.TBO;
                    master.isActive = true;
                    master.isDeleted = false;
                    master.updatedAt = new Date();
                    hotelEntities.push(master);

                    // 2. TboHotelContentEntity
                    content.hotelCode = hotelCode;
                    content.hotelName = details.HotelName || '';
                    content.address = details.Address || '';
                    content.city = details.CityName || '';
                    if (!content.cityCode) content.cityCode = additional.cityCode || '';
                    content.countryCode = details.CountryCode || '';
                    content.latitude = details.Map ? details.Map.split('|')[0] : null;
                    content.longitude = details.Map ? details.Map.split('|')[1] : null;
                    content.rating = details.HotelRating || null;
                    hotelContentEntities.push(content);

                    // 3. TboHotelAdditionalDetailsEntity
                    additional.hotelCode = hotelCode;
                    additional.supplierCode = 'TBO';
                    additional.hotelName = details.HotelName || '';
                    additional.rating = details.HotelRating || null;
                    additional.latitude = details.Map ? details.Map.split('|')[0] : null;
                    additional.longitude = details.Map ? details.Map.split('|')[1] : null;
                    additional.address = details.Address || '';
                    additional.city = details.CityName || '';
                    additional.country = details.CountryName || '';
                    additional.countryCode = details.CountryCode || '';
                    additional.pincode = details.PinCode || '';
                    additional.heroImage = details.Image || '';
                    additional.amenities = details.HotelFacilities || [];
                    additional.description = details.Description || '';
                    additional.hotelEmail = details.Email || '';
                    additional.hotelPhones = details.PhoneNumber ? [details.PhoneNumber] : [];
                    if (details.FaxNumber) {
                        additional.hotelPhones.push(details.FaxNumber);
                    }
                    additional.websiteUrl = details.HotelWebsiteUrl || '';
                    additional.interestPoints = details.Attractions ? Object.values(details.Attractions) : [];
                    additional.status = 'COMPLETE';
                    additional.updatedAt = new Date();
                    additional.hotelNameNormalized = details.HotelName?.toLowerCase() || null;
                    hotelAdditionalDetailsEntities.push(additional);

                    // 4. TboHotelImagesEntity
                    if (details.Images && Array.isArray(details.Images)) {
                        let order = 1;
                        for (const imgUrl of details.Images) {
                            const img = new TboHotelImagesEntity();
                            img.hotelCode = hotelCode;
                            img.supplierCode = 'TBO';
                            img.typeCode = 'EXTERIOR';
                            img.url = imgUrl;
                            img.order = order++;
                            img.visualOrder = order++;
                            img.createdAt = new Date();
                            img.updatedAt = new Date();
                            hotelImagesEntities.push(img);
                        }
                    }

                    localProcessed++;
                } catch (innerErr) {
                    this.logger.error(`Error processing details for hotel ${details.HotelCode}: ${innerErr.message}`);
                    localFailed++;
                }
            }

            const entityManager: EntityManager = this.hotelMasterRepository.manager;
            await entityManager.transaction(async (transactionalEntityManager) => {
                if (codes.length > 0) {
                    await transactionalEntityManager.delete(TboHotelImagesEntity, { hotelCode: In(codes) });
                }

                if (hotelEntities.length > 0) {
                     await transactionalEntityManager.save(HotelMasterEntity, hotelEntities);
                }
                if (hotelContentEntities.length > 0) {
                     await transactionalEntityManager.save(TboHotelContentEntity, hotelContentEntities);
                }
                if (hotelAdditionalDetailsEntities.length > 0) {
                     await transactionalEntityManager.save(TboHotelAdditionalDetailsEntity, hotelAdditionalDetailsEntities);
                }
                if (hotelImagesEntities.length > 0) {
                     await transactionalEntityManager.save(TboHotelImagesEntity, hotelImagesEntities);
                }
            });

            return { success: true, processed: localProcessed, failed: localFailed };
        } catch (e) {
            this.logger.warn(`API call failed for batch: ${e.message}`);
            return { success: false, processed: 0, failed: 0 };
        }
    }

    private parseHotelRating(rating: string): number {
        switch (rating) {
            case 'OneStar':
                return 1;
            case 'TwoStar':
                return 2;
            case 'ThreeStar':
                return 3;
            case 'FourStar':
                return 4;
            case 'FiveStar':
                return 5;
            default:
                return 0;
        }
    } 

 


    private createAmenitiesCode(name) {
        return name
            .trim()                // remove spaces at start/end
            .toLowerCase()         // make it lowercase
            .replace(/\s+/g, '_')  // replace spaces with underscores
            .replace(/[^a-z0-9_]/g, ''); // remove non-alphanumeric characters
    }
}




