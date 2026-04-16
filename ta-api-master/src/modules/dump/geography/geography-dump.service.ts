import { Injectable, Logger } from '@nestjs/common';
import { GeographyRepository } from './geography.repository';
import { CommonResponse } from 'src/shared/interfaces/common-response.interface';
import { GetCountryDto } from './dtos/get-country.dto';
import { GetStateDto } from './dtos/get-state.dto';
import { GetCityDto } from './dtos/get-city.dto';
import { GetCityListResponse, GetCountryListResponse, GetStateListResponse } from './interfaces/geography-response.interface';

/**
 * Geography dump service - handles geography data operations
 * @author Prashant - TBO Integration
 */
@Injectable()
export class GeographyDumpService {
    private readonly logger = new Logger(GeographyDumpService.name);

    constructor(private readonly geographyRepository: GeographyRepository) {}

    /**
     * Update city vector and city name normalized
     * @returns Promise<CommonResponse> - Update result
     */
    async updateCityVectorAndCityNameNormalized(): Promise<CommonResponse> {
        return await this.geographyRepository.updateCityVectorAndCityNameNormalized();
    }

    /**
     * Get country list
     * @param getCountryDto - Country search criteria
     * @returns Promise<GetCountryListResponse> - Country list
     */
    async getCountryList(getCountryDto: GetCountryDto): Promise<GetCountryListResponse> {
        return await this.geographyRepository.getCountryList(getCountryDto);
    }

    /**
     * Get state list
     * @param getStateDto - State search criteria
     * @returns Promise<GetStateListResponse> - State list
     */
    async getStateList(getStateDto: GetStateDto): Promise<GetStateListResponse> {
        return await this.geographyRepository.getStateList(getStateDto);
    }

    /**
     * Get city list
     * @param getCityDto - City search criteria
     * @returns Promise<GetCityListResponse> - City list
     */
    async getCityList(getCityDto: GetCityDto): Promise<GetCityListResponse> {
        return await this.geographyRepository.getCityList(getCityDto);
    }
}
