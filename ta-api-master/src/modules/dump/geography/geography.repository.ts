import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CityEntity } from 'src/shared/entities/city.entity';
import { Repository } from 'typeorm';
import { StateEntity } from 'src/shared/entities/state.entity';
import { CountryEntity } from 'src/shared/entities/country.entity';
import { CommonResponse } from 'src/shared/interfaces/common-response.interface';
import { GetCityDto } from './dtos/get-city.dto';
import { GetCountryDto } from './dtos/get-country.dto';
import { GetStateDto } from './dtos/get-state.dto';
import { GetStateListResponse, GetCountryListResponse, GetCityListResponse, CountryData, StateData, CityData } from './interfaces/geography-response.interface';

/**
 * Geography Repository - handles geography data operations
 * @author Prashant - TBO Integration
 */
@Injectable()
export class GeographyRepository {
    constructor(
        @InjectRepository(CityEntity)
        private readonly cityRepo: Repository<CityEntity>,
        @InjectRepository(StateEntity)
        private readonly stateRepo: Repository<StateEntity>,
        @InjectRepository(CountryEntity)
        private readonly countryRepo: Repository<CountryEntity>,
    ) {}

    /**
     * Update city vector and city name normalized
     * @returns Promise<CommonResponse> - Update result
     */
    async updateCityVectorAndCityNameNormalized(): Promise<CommonResponse> {
        try {
            const cities = await this.cityRepo
                .createQueryBuilder()
                .update('city')
                .set({
                    cityVector: () => `setweight(to_tsvector('english', coalesce(city_name, '')), 'A')`,
                    cityNameNormalized: () => `lower(replace(city_name, ' ', ''))`,
                })
                .where('cityVector IS NULL')
                .andWhere('cityNameNormalized IS NULL')
                .execute();

            if (!cities) {
                throw new InternalServerErrorException('Failed to update city vector and city name normalized');
            }

            return {
                success: true,
                message: 'City vector and city name normalized updated successfully',
            };
        } catch (error) {
            throw new InternalServerErrorException('Failed to update city vector and city name normalized');
        }
    }

    /**
     * Get country list
     * @param getCountryDto - Country search criteria
     * @returns Promise<GetCountryListResponse> - Country list
     */
    async getCountryList(getCountryDto: GetCountryDto): Promise<GetCountryListResponse> {
        try {
            const query = this.countryRepo
                .createQueryBuilder('country')
                .select(['country.countryId AS "countryId"', 'country.countryName AS "countryName"', 'country.iso2 AS "iso2"', 'country.emojiU AS "emojiU"']);

            if (getCountryDto.countryName) {
                const countryName = getCountryDto.countryName.toLowerCase().trim();
                query.andWhere('country.countryName ILIKE :countryName', { countryName: `%${countryName}%` });
            }

            const countryList: CountryData[] | null = await query.orderBy('country.countryName', 'ASC').getRawMany();

            if (!countryList) {
                throw new InternalServerErrorException('Failed to fetch country list');
            }

            return {
                message: 'Fetched Country List Successfully',
                data: countryList,
                success: true,
                totalCount: countryList.length,
            };
        } catch (error) {
            throw new InternalServerErrorException('Failed to fetch country list');
        }
    }

    /**
     * Get state list
     * @param getStateDto - State search criteria
     * @returns Promise<GetStateListResponse> - State list
     */
    async getStateList(getStateDto: GetStateDto): Promise<GetStateListResponse> {
        try {
            const { countryCode } = getStateDto;
            const query = this.stateRepo
                .createQueryBuilder('state')
                .where('state.countryCode = :countryCode', { countryCode })
                .select(['state.stateId AS "stateId"', 'state.stateName AS "stateName"', 'state.countryCode AS "countryCode"', 'state.iso2 AS "stateCode"']);

            if (getStateDto.stateName) {
                const stateName = getStateDto.stateName.toLowerCase().trim();
                query.andWhere('state.stateName ILIKE :stateName', { stateName: `%${stateName}%` });
            }

            const stateList: StateData[] | null = await query.orderBy('state.stateName', 'ASC').getRawMany();

            if (!stateList) {
                throw new InternalServerErrorException('Failed to fetch state list');
            }

            return {
                message: 'Fetched State List Successfully',
                data: stateList,
                success: true,
                totalCount: stateList.length,
            };
        } catch (error) {
            throw new InternalServerErrorException('Failed to fetch state list');
        }
    }

    /**
     * Get city list
     * @param getCityDto - City search criteria
     * @returns Promise<GetCityListResponse> - City list
     */
    async getCityList(getCityDto: GetCityDto): Promise<GetCityListResponse> {
        try {
            const { stateCode, countryCode } = getCityDto;
            const cityList = this.cityRepo
                .createQueryBuilder('city')
                .where('city.stateCode = :stateCode', { stateCode })
                .andWhere('city.countryCode = :countryCode', { countryCode })
                .select(['city.cityId AS "cityId"', 'city.cityName AS "cityName"', 'city.stateCode AS "stateCode"', 'city.countryCode AS "countryCode"']);

            if (getCityDto.cityName) {
                const cityName = getCityDto.cityName.toLowerCase().trim();
                cityList.andWhere('city.cityName ILIKE :cityName', { cityName: `%${cityName}%` });
            }

            const finalCityList: CityData[] | null = await cityList.orderBy('city.cityName', 'ASC').getRawMany();

            if (!finalCityList) {
                throw new InternalServerErrorException('Failed to fetch city list');
            }

            return {
                message: 'Fetched City List Successfully',
                data: finalCityList,
                success: true,
                totalCount: finalCityList.length,
            };
        } catch (error) {
            throw new InternalServerErrorException('Failed to fetch city list');
        }
    }
}
