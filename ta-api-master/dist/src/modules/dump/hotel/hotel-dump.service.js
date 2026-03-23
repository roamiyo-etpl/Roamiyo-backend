"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var HotelDumpService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HotelDumpService = void 0;
const common_1 = require("@nestjs/common");
const http_utility_1 = require("../../../shared/utilities/flight/http.utility");
const amenity_master_entity_1 = require("./entities/amenity-master.entity");
const amenity_mapping_entity_1 = require("./entities/amenity-mapping.entity");
const board_code_master_entity_1 = require("./entities/board-code-master.entity");
const board_code_mapping_entity_1 = require("./entities/board-code-mapping.entity");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const supplier_cred_service_1 = require("../../generic/supplier-credientials/supplier-cred.service");
const country_entity_1 = require("../../../shared/entities/country.entity");
const city_entity_1 = require("../../../shared/entities/city.entity");
const hotel_master_entity_1 = require("../../../shared/entities/hotel-master.entity");
const tbo_hotel_images_entity_1 = require("./entities/tbo-hotel-images.entity");
const tbo_hotel_additional_details_entity_1 = require("./entities/tbo-hotel-additional-details.entity");
const tbo_hotel_content_entity_1 = require("./entities/tbo-hotel-content.entity");
const tbo_hotel_room_content_entity_1 = require("./entities/tbo-hotel-room-content.entity");
const stream_json_1 = require("stream-json");
const StreamArray_1 = require("stream-json/streamers/StreamArray");
const Pick_1 = require("stream-json/filters/Pick");
let HotelDumpService = HotelDumpService_1 = class HotelDumpService {
    amenityMasterRepository;
    amenityMappingRepository;
    boardCodeMasterRepository;
    boardCodeMappingRepository;
    hotelDetailsRepository;
    hotelImagesRepository;
    hotelContentRepository;
    hotelRoomContentRepository;
    countryRepository;
    cityRepository;
    hotelMasterRepository;
    supplierCredService;
    logger = new common_1.Logger(HotelDumpService_1.name);
    terminalsCache = new Map();
    constructor(amenityMasterRepository, amenityMappingRepository, boardCodeMasterRepository, boardCodeMappingRepository, hotelDetailsRepository, hotelImagesRepository, hotelContentRepository, hotelRoomContentRepository, countryRepository, cityRepository, hotelMasterRepository, supplierCredService) {
        this.amenityMasterRepository = amenityMasterRepository;
        this.amenityMappingRepository = amenityMappingRepository;
        this.boardCodeMasterRepository = boardCodeMasterRepository;
        this.boardCodeMappingRepository = boardCodeMappingRepository;
        this.hotelDetailsRepository = hotelDetailsRepository;
        this.hotelImagesRepository = hotelImagesRepository;
        this.hotelContentRepository = hotelContentRepository;
        this.hotelRoomContentRepository = hotelRoomContentRepository;
        this.countryRepository = countryRepository;
        this.cityRepository = cityRepository;
        this.hotelMasterRepository = hotelMasterRepository;
        this.supplierCredService = supplierCredService;
    }
    async getHotelAutocomplete(hotelAutocompleteDto) {
        try {
            const { query: search, lat, long } = hotelAutocompleteDto;
            if (!search || search.trim().length < 2) {
                throw new common_1.BadRequestException('Search term must be at least 2 characters long');
            }
            const searchTerm = search.trim().toLowerCase();
            const hotels = await this.hotelContentRepository
                .createQueryBuilder('hotel')
                .where('(LOWER(hotel.hotelName) LIKE :search OR LOWER(hotel.city) LIKE :search OR LOWER(hotel.country) LIKE :search)', { search: `%${searchTerm}%` })
                .orderBy('hotel.hotelName', 'ASC')
                .limit(10)
                .getMany();
            const suggestions = hotels.map((hotel) => ({
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
        }
        catch (error) {
            this.logger.error('Error in getHotelAutocomplete:', error);
            if (error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.InternalServerErrorException('Failed to get hotel autocomplete suggestions');
        }
    }
    async getHotelDetails(hotelCode) {
        try {
            if (!hotelCode) {
                throw new common_1.BadRequestException('Hotel code is required');
            }
            const hotel = await this.hotelMasterRepository.findOne({
                where: { hotelCode },
            });
            const hotelContent = await this.hotelContentRepository.findOne({
                where: { hotelCode },
            });
            if (!hotel || !hotelContent) {
                throw new common_1.BadRequestException('Hotel not found');
            }
            const additionalDetails = await this.hotelDetailsRepository.findOne({
                where: { hotelCode },
            });
            const images = await this.hotelImagesRepository.find({
                where: { hotelCode },
            });
            const hotelPois = additionalDetails?.interestPoints?.length
                ? additionalDetails.interestPoints.map(poi => ({
                    name: poi,
                    distance: '',
                }))
                : [];
            const hotelAmenities = additionalDetails?.amenities?.length
                ? additionalDetails.amenities.map(poi => ({
                    code: this.createAmenitiesCode(poi),
                    title: poi,
                    isPaid: false,
                }))
                : [];
            const hotelImages = images.length > 0
                ? images.map(img => ({
                    thumbnail: '',
                    small: '',
                    bigger: '',
                    standard: img.url || '',
                    xl: '',
                    xxl: '',
                    original: '',
                }))
                : [];
            const boardCodes = [];
            const processedImages = [];
            return {
                hotelId: hotel.hotelCode,
                name: hotel.hotelName,
                address: hotelContent.address,
                phones: [],
                description: hotel?.highlightText || '',
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
            };
        }
        catch (error) {
            this.logger.error('Error in getHotelDetails:', error);
            if (error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.InternalServerErrorException('Failed to get hotel details');
        }
    }
    async transferDataToHotelContent(transferData) {
        try {
            const { from, to } = transferData;
            if (!from || !to) {
                throw new common_1.BadRequestException('From and to values are required');
            }
            this.logger.log(`Transferring data from ${from} to ${to}`);
            return {
                success: true,
                message: `Data transfer from ${from} to ${to} completed successfully`,
            };
        }
        catch (error) {
            this.logger.error('Error in transferDataToHotelContent:', error);
            if (error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.InternalServerErrorException('Failed to transfer data');
        }
    }
    async getHotelRoomContent(hotelCode) {
        try {
            if (!hotelCode) {
                throw new common_1.BadRequestException('Hotel code is required');
            }
            const roomContent = await this.hotelRoomContentRepository.find({
                where: { hotelCode },
            });
            return {
                success: true,
                message: 'Hotel room content retrieved successfully',
                data: roomContent,
            };
        }
        catch (error) {
            this.logger.error('Error in getHotelRoomContent:', error);
            if (error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.InternalServerErrorException('Failed to get hotel room content');
        }
    }
    async bulkInsertHotelContent(hotelData) {
        try {
            if (!hotelData || hotelData.length === 0) {
                throw new common_1.BadRequestException('Hotel data is required');
            }
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
        }
        catch (error) {
            this.logger.error('Error in bulkInsertHotelContent:', error);
            if (error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.InternalServerErrorException('Failed to insert hotel content');
        }
    }
    async addCountryList(headers) {
        this.logger.log(`Initiating country dump check...`);
        this.processCountriesInBackground(headers).catch(err => this.logger.error(`Background country dump failed: ${err.message}`, err.stack));
        return {
            status: 202,
            message: "Country dump initiated. Check server logs for progress.",
            timestamp: new Date().toISOString(),
        };
    }
    async processCountriesInBackground(headers) {
        const startTime = Date.now();
        this.logger.log(`Starting background recursive country dump from CountryList API (Streaming).`);
        let processed = 0;
        let failed = 0;
        try {
            const providersData = await this.supplierCredService.getActiveProviders(headers);
            const tboProvider = providersData.find((p) => p.code === 'TBO');
            if (!tboProvider) {
                throw new common_1.BadRequestException('TBO provider not found');
            }
            const providerCredentials = JSON.parse(tboProvider.provider_credentials);
            const auth = {
                username: providerCredentials.dump_username,
                password: providerCredentials.dump_password,
            };
            const endpoint = `${providerCredentials?.dump_url}/CountryList`;
            this.logger.debug(`Fetching countries from ${endpoint}`);
            const stream = await http_utility_1.Http.httpRequestTBOHotelStream('GET', endpoint, null, auth);
            const pipeline = stream
                .pipe((0, stream_json_1.parser)())
                .pipe((0, Pick_1.pick)({ filter: 'CountryList' }))
                .pipe((0, StreamArray_1.streamArray)());
            await new Promise((resolve, reject) => {
                const batchSize = 1000;
                let batch = [];
                pipeline.on('data', async (data) => {
                    const country = data.value;
                    batch.push(country);
                    if (batch.length >= batchSize) {
                        pipeline.pause();
                        try {
                            await this.saveCountryBatch(batch);
                            processed += batch.length;
                            batch = [];
                            this.logger.log(`[CountryDump] Processed ${processed} countries...`);
                            pipeline.resume();
                        }
                        catch (err) {
                            this.logger.error(`Error saving country batch: ${err.message}`);
                            failed += batch.length;
                            batch = [];
                            pipeline.resume();
                        }
                    }
                });
                pipeline.on('end', async () => {
                    if (batch.length > 0) {
                        try {
                            await this.saveCountryBatch(batch);
                            processed += batch.length;
                        }
                        catch (err) {
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
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this.logger.error(`Error during background country dump: ${error.message}`, error.stack);
        }
    }
    async saveCountryBatch(countries) {
        for (const country of countries) {
            try {
                const countryCode = country.Code;
                const countryName = country.Name;
                const existing = await this.countryRepository.findOne({ where: { iso2: countryCode } });
                if (existing) {
                    existing.iso2 = countryCode;
                    existing.countryName = countryName;
                    await this.countryRepository.save(existing);
                }
                else {
                    const newCountry = this.countryRepository.create({
                        iso2: countryCode,
                        countryName: countryName,
                    });
                    await this.countryRepository.save(newCountry);
                }
            }
            catch (e) {
                this.logger.error(`Error saving country struct: ${e.message}`);
                throw e;
            }
        }
    }
    async addCityList(headers, countryCode) {
        this.logger.log(`Initiating destination dump check...`);
        let countriesCount = 0;
        if (countryCode) {
            countriesCount = 1;
        }
        else {
            countriesCount = await this.countryRepository.count();
        }
        this.processDestinationsInBackground(headers, countryCode).catch(err => this.logger.error(`Background destination dump failed: ${err.message}`, err.stack));
        return {
            status: 202,
            message: `Destination dump initiated. Processing destinations for approximately ${countriesCount} countries. Check server logs for progress.`,
            totalCountries: countriesCount,
            timestamp: new Date().toISOString(),
        };
    }
    async processDestinationsInBackground(headers, countryCode) {
        const startTime = Date.now();
        this.logger.log(`Starting background recursive destination dump from CityList API (Streaming).`);
        let processed = 0;
        let failed = 0;
        let totalRecords = 0;
        try {
            const providersData = await this.supplierCredService.getActiveProviders(headers);
            const tboProvider = providersData.find((p) => p.code === 'TBO');
            if (!tboProvider) {
                throw new common_1.BadRequestException('TBO provider not found');
            }
            const providerCredentials = JSON.parse(tboProvider.provider_credentials);
            const auth = {
                username: providerCredentials.dump_username,
                password: providerCredentials.dump_password,
            };
            const endpoint = `${providerCredentials?.dump_url}/CityList`;
            let countriesToProcess = [];
            if (countryCode) {
                const selectCountry = await this.countryRepository.findOne({
                    where: { iso2: countryCode },
                    select: ['iso2', 'countryId', 'countryName']
                });
                if (selectCountry) {
                    countriesToProcess.push({ iso2: countryCode, countryId: selectCountry?.countryId, countryName: selectCountry?.countryName });
                }
            }
            else {
                const allCountries = await this.countryRepository.find({ select: ['iso2', 'countryId', 'countryName'] });
                countriesToProcess = allCountries.map((c) => ({ iso2: c.iso2, countryId: c.countryId, countryName: c.countryName }));
            }
            this.logger.log(`Processing destinations for ${countriesToProcess.length} countries`);
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
                    const stream = await http_utility_1.Http.httpRequestTBOHotelStream('POST', endpoint, payload, auth);
                    const pipeline = stream
                        .pipe((0, stream_json_1.parser)())
                        .pipe((0, Pick_1.pick)({ filter: 'CityList' }))
                        .pipe((0, StreamArray_1.streamArray)());
                    await new Promise((resolve, reject) => {
                        const batchSize = 1000;
                        let batch = [];
                        pipeline.on('data', async (data) => {
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
                                }
                                catch (err) {
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
                                }
                                catch (err) {
                                    this.logger.error(`Error saving final city batch for ${country.iso2}: ${err.message}`);
                                    failed += batch.length;
                                }
                            }
                            resolve(true);
                        });
                        pipeline.on('error', (err) => {
                            this.logger.error(`Stream error during city dump for ${country.iso2}: ${err.message}`);
                            resolve(false);
                        });
                    });
                }
                catch (err) {
                    this.logger.error(`Error processing country ${country.iso2}: ${err.message}`);
                    failed++;
                }
            }
            const duration = Date.now() - startTime;
            this.logger.log(`Background Destination dump completed in ${duration}ms. Processed: ${processed}, Failed: ${failed}`);
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this.logger.error(`Error during background destination dump: ${error.message}`, error.stack);
        }
    }
    async saveCityBatch(cities, country) {
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
                }
                else {
                    const newCity = this.cityRepository.create({
                        cityName: cityName,
                        cityCodeTbo: cityCode,
                        countryId: country.countryId,
                        countryCode: country.iso2 || '',
                        countryName: country.countryName,
                        stateId: 0,
                        stateCode: '',
                        stateName: '',
                        latitude: 0,
                        longitude: 0,
                    });
                    await this.cityRepository.save(newCity);
                }
            }
            catch (innerErr) {
                this.logger.error(`Error saving city ${city.Code}: ${innerErr.message}`);
            }
        }
    }
    async dumpHotelBasicDetails(headers, cityCode) {
        this.logger.log(`Initiating hotel basic details dump check...`);
        try {
            let citiesCount = 0;
            if (cityCode) {
                citiesCount = 1;
            }
            else {
                citiesCount = await this.cityRepository.count();
            }
            this.processHotelBasicDetailsInBackground(headers, cityCode).catch(err => this.logger.error(`Background hotel basic details dump failed: ${err.message}`, err.stack));
            return {
                status: 202,
                message: `Hotel basic details dump initiated. Processing hotels for approximately ${citiesCount} cities. Check server logs for progress.`,
                totalCities: citiesCount,
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
            this.logger.error(`Error initiating hotel basic details dump: ${error.message}`, error.stack);
            throw new common_1.BadRequestException(`Failed to initiate dump: ${error.message}`);
        }
    }
    async processHotelBasicDetailsInBackground(headers, cityCode) {
        const startTime = Date.now();
        this.logger.log(`Starting background hotel basic details dump from TBOHotelCodeList API (Streaming).`);
        let processed = 0;
        let failed = 0;
        let totalRecords = 0;
        try {
            const providersData = await this.supplierCredService.getActiveProviders(headers);
            const tboProvider = providersData.find((p) => p.code === 'TBO');
            if (!tboProvider) {
                throw new common_1.BadRequestException('TBO provider not found');
            }
            const providerCredentials = JSON.parse(tboProvider.provider_credentials);
            const auth = {
                username: providerCredentials.dump_username,
                password: providerCredentials.dump_password,
            };
            const endpoint = `${providerCredentials?.dump_url}/TBOHotelCodeList`;
            let citiesToProcess = [];
            if (cityCode) {
                const specificCity = await this.cityRepository.findOne({ where: { cityCodeTbo: cityCode }, select: ['cityCodeTbo', 'hotelDumpUpdatedAt'] });
                if (specificCity) {
                    citiesToProcess.push({ code: specificCity.cityCodeTbo, hotelDumpUpdatedAt: specificCity.hotelDumpUpdatedAt });
                }
                else {
                    citiesToProcess.push({ code: cityCode });
                }
            }
            else {
                this.logger.log('Fetching all destinations from database...');
                const allCities = await this.cityRepository.find({ select: ['cityCodeTbo', 'hotelDumpUpdatedAt'] });
                citiesToProcess = allCities.map((c) => ({ code: c.cityCodeTbo, hotelDumpUpdatedAt: c.hotelDumpUpdatedAt }));
            }
            this.logger.log(`Processing hotels for ${citiesToProcess.length} cities`);
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
                    const stream = await http_utility_1.Http.httpRequestTBOHotelStream('POST', endpoint, payload, auth);
                    const pipeline = stream
                        .pipe((0, stream_json_1.parser)())
                        .pipe((0, Pick_1.pick)({ filter: 'Hotels' }))
                        .pipe((0, StreamArray_1.streamArray)());
                    await new Promise((resolve, reject) => {
                        const batchSize = 1000;
                        let batch = [];
                        pipeline.on('data', async (data) => {
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
                                }
                                catch (err) {
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
                                }
                                catch (err) {
                                    this.logger.error(`Error saving final hotel batch for city ${city.code}: ${err.message}`);
                                    failed += batch.length;
                                }
                            }
                            try {
                                await this.cityRepository.update({ cityCodeTbo: city.code }, { hotelDumpUpdatedAt: new Date() });
                            }
                            catch (updateErr) {
                                this.logger.error(`Error updating hotelDumpUpdatedAt for city ${city.code}: ${updateErr.message}`);
                            }
                            resolve(true);
                        });
                        pipeline.on('error', (err) => {
                            this.logger.error(`Stream error during hotel dump for city ${city.code}: ${err.message}`);
                            resolve(false);
                        });
                    });
                }
                catch (err) {
                    this.logger.error(`Error processing city ${city.code}: ${err.message}`);
                    failed++;
                }
            }
            const duration = Date.now() - startTime;
            this.logger.log(`Background Hotel dump completed in ${duration}ms. Processed: ${processed}, Failed: ${failed}`);
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this.logger.error(`Error during background hotel dump: ${error.message}`, error.stack);
        }
    }
    async saveHotelBasicBatch(hotels, cityCode) {
        const hotelCodes = hotels.map(h => String(h.HotelCode));
        const existingMaster = await this.hotelMasterRepository.find({ where: { hotelCode: (0, typeorm_2.In)(hotelCodes) }, select: ['hotelCode'] });
        const existingMasterSet = new Set(existingMaster.map(e => e.hotelCode));
        const hotelEntities = [];
        const hotelContentEntities = [];
        const hotelAdditionalDetailsEntities = [];
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
                    const master = new hotel_master_entity_1.HotelMasterEntity();
                    master.hotelCode = hotelCode;
                    master.hotelSource = hotel_master_entity_1.HotelSourceEnum.TBO;
                    master.providerCode = 'TBO';
                    master.hotelName = hotelName;
                    master.address = address;
                    master.city = city;
                    master.countryCode = countryCode;
                    master.latitude = lat;
                    master.longitude = lng;
                    master.starRating = (rating ? String(rating) : null);
                    master.isActive = true;
                    master.isDeleted = false;
                    master.createdAt = new Date();
                    hotelEntities.push(master);
                    const content = new tbo_hotel_content_entity_1.TboHotelContentEntity();
                    content.hotelCode = hotelCode;
                    content.hotelName = hotelName;
                    content.address = address;
                    content.city = city;
                    content.cityCode = cityCode;
                    content.countryCode = countryCode;
                    content.latitude = lat;
                    content.longitude = lng;
                    content.rating = (rating ? String(rating) : null);
                    hotelContentEntities.push(content);
                    const detail = new tbo_hotel_additional_details_entity_1.TboHotelAdditionalDetailsEntity();
                    detail.hotelCode = hotelCode;
                    detail.supplierCode = 'TBO';
                    detail.hotelName = hotelName;
                    detail.latitude = lat;
                    detail.longitude = lng;
                    detail.rating = (rating ? String(rating) : null);
                    detail.address = address;
                    detail.country = country;
                    detail.countryCode = countryCode;
                    detail.city = city;
                    detail.cityCode = cityCode;
                    detail.status = 'PENDING';
                    hotelAdditionalDetailsEntities.push(detail);
                    existingMasterSet.add(hotelCode);
                }
            }
            catch (innerErr) {
                this.logger.error(`Error processing hotel basic batch for code ${hotel?.HotelCode}: ${innerErr.message}`);
            }
        }
        if (hotelEntities.length > 0) {
            try {
                const entityManager = this.hotelMasterRepository.manager;
                await entityManager.transaction(async (transactionalEntityManager) => {
                    await transactionalEntityManager.save(hotel_master_entity_1.HotelMasterEntity, hotelEntities);
                    await transactionalEntityManager.save(tbo_hotel_content_entity_1.TboHotelContentEntity, hotelContentEntities);
                    await transactionalEntityManager.save(tbo_hotel_additional_details_entity_1.TboHotelAdditionalDetailsEntity, hotelAdditionalDetailsEntities);
                });
            }
            catch (err) {
                this.logger.error(`Error in bulk save transaction for basic details: ${err.message}`);
            }
        }
    }
    async dumpHotelInfo(headers) {
        this.logger.log(`Initiating hotel details dump check...`);
        try {
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
            this.processHotelInfoInBackground(headers).catch(err => this.logger.error(`Background hotel info dump failed: ${err.message}`, err.stack));
            return {
                status: 202,
                message: `Hotel details dump initiated. ${totalPending} hotels remaining to process. Check server logs for progress.`,
                totalPending: totalPending,
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
            this.logger.error(`Error initiating hotel details dump: ${error.message}`, error.stack);
            throw new common_1.BadRequestException(`Failed to initiate dump: ${error.message}`);
        }
    }
    async processHotelInfoInBackground(headers) {
        const startTime = Date.now();
        this.logger.log(`Starting background hotel details dump from TBOHotelDetails API.`);
        let processed = 0;
        let failed = 0;
        try {
            const providersData = await this.supplierCredService.getActiveProviders(headers);
            const tboProvider = providersData.find((p) => p.code === 'TBO');
            if (!tboProvider) {
                throw new common_1.BadRequestException('TBO provider not found');
            }
            const providerCredentials = JSON.parse(tboProvider.provider_credentials);
            const auth = {
                username: providerCredentials.dump_username,
                password: providerCredentials.dump_password,
            };
            const endpoint = `${providerCredentials?.dump_url}/Hoteldetails`;
            const pendingHotels = await this.hotelDetailsRepository.find({
                where: { status: 'PENDING' },
                select: ['hotelCode', 'supplierCode'],
            });
            this.logger.log(`Found ${pendingHotels.length} pending hotels to process`);
            const chunkSize = 50;
            const retryChunkSize = 10;
            for (let i = 0; i < pendingHotels.length; i += chunkSize) {
                const chunk = pendingHotels.slice(i, i + chunkSize);
                const result = await this.fetchAndProcessHotels(chunk, endpoint, auth);
                if (!result.success) {
                    this.logger.warn(`Batch starting at ${i} failed. Retrying in smaller chunks of ${retryChunkSize}...`);
                    for (let j = 0; j < chunk.length; j += retryChunkSize) {
                        const subChunk = chunk.slice(j, j + retryChunkSize);
                        const subResult = await this.fetchAndProcessHotels(subChunk, endpoint, auth);
                        if (subResult.success) {
                            processed += subResult.processed;
                            failed += subResult.failed;
                        }
                        else {
                            this.logger.error(`Sub-chunk starting at ${i + j} failed. Skipping.`);
                            failed += subChunk.length;
                        }
                    }
                }
                else {
                    processed += result.processed;
                    failed += result.failed;
                }
                this.logger.log(`[HotelDetailDump] Processed ${processed}/${pendingHotels.length} hotels. (Chunk ${i + 1}-${Math.min(i + chunkSize, pendingHotels.length)})`);
            }
            const duration = Date.now() - startTime;
            this.logger.log(`Background Hotel details dump completed in ${duration}ms. Processed: ${processed}, Failed: ${failed}`);
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this.logger.error(`Error during background hotel details dump: ${error.message}`, error.stack);
        }
    }
    async fetchAndProcessHotels(hotels, endpoint, auth) {
        let localProcessed = 0;
        let localFailed = 0;
        try {
            const requestedCodes = hotels.map((h) => String(h.hotelCode));
            const batchResponses = await Promise.all(requestedCodes.map(code => http_utility_1.Http.httpRequestTBOHotel('POST', endpoint, { Hotelcodes: code, Language: 'en' }, auth)
                .catch(e => null)));
            const allDetails = batchResponses
                .filter(res => res && res.HotelDetails && Array.isArray(res.HotelDetails) && res.HotelDetails.length > 0)
                .map(res => res.HotelDetails[0]);
            if (allDetails.length === 0) {
                return { success: false, processed: 0, failed: requestedCodes.length };
            }
            localFailed += requestedCodes.length - allDetails.length;
            const codes = allDetails.map(d => String(d.HotelCode));
            const existingMasters = await this.hotelMasterRepository.find({ where: { hotelCode: (0, typeorm_2.In)(codes) } });
            const existingContents = await this.hotelContentRepository.find({ where: { hotelCode: (0, typeorm_2.In)(codes) } });
            const existingDetails = await this.hotelDetailsRepository.find({ where: { hotelCode: (0, typeorm_2.In)(codes) } });
            const mastersMap = new Map(existingMasters.map(e => [e.hotelCode, e]));
            const contentsMap = new Map(existingContents.map(e => [e.hotelCode, e]));
            const detailsMap = new Map(existingDetails.map(e => [e.hotelCode, e]));
            const hotelEntities = [];
            const hotelContentEntities = [];
            const hotelAdditionalDetailsEntities = [];
            const hotelImagesEntities = [];
            for (const details of allDetails) {
                try {
                    const hotelCode = String(details.HotelCode);
                    const master = mastersMap.get(hotelCode) || new hotel_master_entity_1.HotelMasterEntity();
                    const content = contentsMap.get(hotelCode) || new tbo_hotel_content_entity_1.TboHotelContentEntity();
                    const additional = detailsMap.get(hotelCode) || new tbo_hotel_additional_details_entity_1.TboHotelAdditionalDetailsEntity();
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
                    master.hotelSource = hotel_master_entity_1.HotelSourceEnum.TBO;
                    master.isActive = true;
                    master.isDeleted = false;
                    master.updatedAt = new Date();
                    hotelEntities.push(master);
                    content.hotelCode = hotelCode;
                    content.hotelName = details.HotelName || '';
                    content.address = details.Address || '';
                    content.city = details.CityName || '';
                    if (!content.cityCode)
                        content.cityCode = additional.cityCode || '';
                    content.countryCode = details.CountryCode || '';
                    content.latitude = details.Map ? details.Map.split('|')[0] : null;
                    content.longitude = details.Map ? details.Map.split('|')[1] : null;
                    content.rating = details.HotelRating || null;
                    hotelContentEntities.push(content);
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
                    if (details.Images && Array.isArray(details.Images)) {
                        let order = 1;
                        for (const imgUrl of details.Images) {
                            const img = new tbo_hotel_images_entity_1.TboHotelImagesEntity();
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
                }
                catch (innerErr) {
                    this.logger.error(`Error processing details for hotel ${details.HotelCode}: ${innerErr.message}`);
                    localFailed++;
                }
            }
            const entityManager = this.hotelMasterRepository.manager;
            await entityManager.transaction(async (transactionalEntityManager) => {
                if (codes.length > 0) {
                    await transactionalEntityManager.delete(tbo_hotel_images_entity_1.TboHotelImagesEntity, { hotelCode: (0, typeorm_2.In)(codes) });
                }
                if (hotelEntities.length > 0) {
                    await transactionalEntityManager.save(hotel_master_entity_1.HotelMasterEntity, hotelEntities);
                }
                if (hotelContentEntities.length > 0) {
                    await transactionalEntityManager.save(tbo_hotel_content_entity_1.TboHotelContentEntity, hotelContentEntities);
                }
                if (hotelAdditionalDetailsEntities.length > 0) {
                    await transactionalEntityManager.save(tbo_hotel_additional_details_entity_1.TboHotelAdditionalDetailsEntity, hotelAdditionalDetailsEntities);
                }
                if (hotelImagesEntities.length > 0) {
                    await transactionalEntityManager.save(tbo_hotel_images_entity_1.TboHotelImagesEntity, hotelImagesEntities);
                }
            });
            return { success: true, processed: localProcessed, failed: localFailed };
        }
        catch (e) {
            this.logger.warn(`API call failed for batch: ${e.message}`);
            return { success: false, processed: 0, failed: 0 };
        }
    }
    parseHotelRating(rating) {
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
    createAmenitiesCode(name) {
        return name
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '');
    }
};
exports.HotelDumpService = HotelDumpService;
exports.HotelDumpService = HotelDumpService = HotelDumpService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(amenity_master_entity_1.AmenityMasterEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(amenity_mapping_entity_1.AmenityMappingEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(board_code_master_entity_1.BoardCodeMasterEntity)),
    __param(3, (0, typeorm_1.InjectRepository)(board_code_mapping_entity_1.BoardCodeMappingEntity)),
    __param(4, (0, typeorm_1.InjectRepository)(tbo_hotel_additional_details_entity_1.TboHotelAdditionalDetailsEntity)),
    __param(5, (0, typeorm_1.InjectRepository)(tbo_hotel_images_entity_1.TboHotelImagesEntity)),
    __param(6, (0, typeorm_1.InjectRepository)(tbo_hotel_content_entity_1.TboHotelContentEntity)),
    __param(7, (0, typeorm_1.InjectRepository)(tbo_hotel_room_content_entity_1.TboHotelRoomContentEntity)),
    __param(8, (0, typeorm_1.InjectRepository)(country_entity_1.CountryEntity)),
    __param(9, (0, typeorm_1.InjectRepository)(city_entity_1.CityEntity)),
    __param(10, (0, typeorm_1.InjectRepository)(hotel_master_entity_1.HotelMasterEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        supplier_cred_service_1.SupplierCredService])
], HotelDumpService);
//# sourceMappingURL=hotel-dump.service.js.map