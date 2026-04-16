import { Controller, Get, Query, Headers, HttpCode, HttpStatus, HttpException } from '@nestjs/common';
import { GeographyDumpService } from './geography-dump.service';
import { GetCountryDto } from './dtos/get-country.dto';
import { GetStateDto } from './dtos/get-state.dto';
import { GetCityDto } from './dtos/get-city.dto';
import { GetCityListResponse, GetCountryListResponse, GetStateListResponse } from './interfaces/geography-response.interface';
import { CommonResponse } from 'src/shared/interfaces/common-response.interface';

/**
 * Geography dump controller - handles geography data operations
 * @author Prashant - TBO Integration
 */
import {
    DEC_HEADER_API_VERSION_MANDATE,
    DEC_HEADER_CLUB_ID_MANDATE,
    DEC_HEADER_CURRENCY_PREFERENCE_MANDATE,
    DEC_HEADER_DEVICE_INFORMATION_MANDATE,
    DEC_HEADER_IP_ADDRESS_MANDATE,
    DEC_HEADER_LANGUAGE_PREFERENCE_MANDATE,
    SWG_HEADER_API_VERSION_MANDATE,
    SWG_HEADER_CLUB_ID_MANDATE,
    SWG_HEADER_CURRENCY_PREFERENCE,
    SWG_HEADER_DEVICE_INFORMATION_MANDATE,
    SWG_HEADER_IP_MANDATE,
    SWG_HEADER_LANGUAGE_PREFERENCE_MANDATE,
} from 'src/shared/constants/standard-api-headers.constant';

import { ApiHeaders, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequiredHeaders } from 'src/shared/decorators/common/custom-header.decorator';
import {
    SWG_BAD_REQUEST_RESPONSE,
    SWG_INTERNAL_SERVER_ERROR_RESPONSE,
    SWG_NOT_FOUND_RESPONSE,
    SWG_SUCCESS_RESPONSE,
    SWG_UNPROCESSABLE_RESPONSE,
} from 'src/shared/constants/standard-api-responses.constant';

@ApiTags('Geography Dump')
@ApiHeaders([
    SWG_HEADER_CURRENCY_PREFERENCE,
    SWG_HEADER_LANGUAGE_PREFERENCE_MANDATE,
    SWG_HEADER_IP_MANDATE,
    SWG_HEADER_API_VERSION_MANDATE,
    SWG_HEADER_CLUB_ID_MANDATE,
    SWG_HEADER_DEVICE_INFORMATION_MANDATE,
])
@RequiredHeaders([
    DEC_HEADER_LANGUAGE_PREFERENCE_MANDATE,
    DEC_HEADER_IP_ADDRESS_MANDATE,
    DEC_HEADER_API_VERSION_MANDATE,
    DEC_HEADER_CLUB_ID_MANDATE,
    DEC_HEADER_CURRENCY_PREFERENCE_MANDATE,
    DEC_HEADER_DEVICE_INFORMATION_MANDATE,
])
@Controller('dump/geography')
export class GeographyDumpController {
    constructor(private readonly geographyDumpService: GeographyDumpService) {}

    @ApiOperation({ summary: 'Get country list' })
    @ApiResponse(SWG_SUCCESS_RESPONSE)
    @ApiResponse(SWG_NOT_FOUND_RESPONSE)
    @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    @ApiResponse(SWG_UNPROCESSABLE_RESPONSE)
    @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    @Get('countries')
    @HttpCode(HttpStatus.OK)
    async getCountryList(@Query() getCountryDto: GetCountryDto, @Headers() headers: Headers): Promise<GetCountryListResponse> {
        try {
            return await this.geographyDumpService.getCountryList(getCountryDto);
        } catch (error) {
            throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @ApiOperation({ summary: 'Get state list' })
    @ApiResponse(SWG_SUCCESS_RESPONSE)
    @ApiResponse(SWG_NOT_FOUND_RESPONSE)
    @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    @ApiResponse(SWG_UNPROCESSABLE_RESPONSE)
    @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    @Get('states')
    @HttpCode(HttpStatus.OK)
    async getStateList(@Query() getStateDto: GetStateDto, @Headers() headers: Headers): Promise<GetStateListResponse> {
        try {
            return await this.geographyDumpService.getStateList(getStateDto);
        } catch (error) {
            throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @ApiOperation({ summary: 'Get city list' })
    @ApiResponse(SWG_SUCCESS_RESPONSE)
    @ApiResponse(SWG_NOT_FOUND_RESPONSE)
    @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    @ApiResponse(SWG_UNPROCESSABLE_RESPONSE)
    @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    @Get('cities')
    @HttpCode(HttpStatus.OK)
    async getCityList(@Query() getCityDto: GetCityDto, @Headers() headers: Headers): Promise<GetCityListResponse> {
        try {
            return await this.geographyDumpService.getCityList(getCityDto);
        } catch (error) {
            throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @ApiOperation({ summary: 'Update city vector and city name normalized' })
    @ApiResponse(SWG_SUCCESS_RESPONSE)
    @ApiResponse(SWG_NOT_FOUND_RESPONSE)
    @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    @ApiResponse(SWG_UNPROCESSABLE_RESPONSE)
    @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    @Get('update-city-vector')
    @HttpCode(HttpStatus.OK)
    async updateCityVectorAndCityNameNormalized(@Headers() headers: Headers): Promise<CommonResponse> {
        try {
            return await this.geographyDumpService.updateCityVectorAndCityNameNormalized();
        } catch (error) {
            throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
