import { Body, Controller, HttpCode, HttpStatus, Post, Headers, HttpException, InternalServerErrorException } from '@nestjs/common';
import { HotelSearchInitiateDto } from './dtos/hotel-search-initiate.dto';
import { HotelSearchCheckResultsDto } from './dtos/hotel-search-check-results.dto';
import { HotelSearchFiltrationDto } from './dtos/hotel-search-filtration.dto';
import { SearchService } from './search.service';
import { InitiateResultResponse } from './interfaces/initiate-result-response.interface';
import { ApiHeaders, ApiResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RequiredHeaders } from 'src/shared/decorators/common/custom-header.decorator';
import {
    DEC_HEADER_API_VERSION_MANDATE,
    DEC_HEADER_CURRENCY_PREFERENCE_MANDATE,
    DEC_HEADER_IP_ADDRESS_MANDATE,
    SWG_HEADER_API_VERSION_MANDATE,
    SWG_HEADER_CURRENCY_PREFERENCE,
    SWG_HEADER_IP_MANDATE,
} from 'src/shared/constants/standard-api-headers.constant';
import {
    SWG_BAD_REQUEST_RESPONSE,
    SWG_INTERNAL_SERVER_ERROR_RESPONSE,
    SWG_NOT_FOUND_RESPONSE,
    SWG_SUCCESS_RESPONSE,
    SWG_UNPROCESSABLE_RESPONSE,
} from 'src/shared/constants/standard-api-responses.constant';

@ApiTags('Hotel')
@ApiHeaders([SWG_HEADER_CURRENCY_PREFERENCE, SWG_HEADER_IP_MANDATE, SWG_HEADER_API_VERSION_MANDATE])
@RequiredHeaders([DEC_HEADER_IP_ADDRESS_MANDATE, DEC_HEADER_API_VERSION_MANDATE, DEC_HEADER_CURRENCY_PREFERENCE_MANDATE])
@Controller('hotel/search')
export class SearchController {
    constructor(private readonly searchService: SearchService) {}

    @ApiResponse(SWG_SUCCESS_RESPONSE)
    @ApiResponse(SWG_NOT_FOUND_RESPONSE)
    @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    @ApiResponse(SWG_UNPROCESSABLE_RESPONSE)
    @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    @HttpCode(HttpStatus.OK)
    @Post('initiate')
    async initiate(@Body() hotelSearchInitiateDto: HotelSearchInitiateDto, @Headers() headers): Promise<InitiateResultResponse> {
        try {
            return await this.searchService.searchInitiate(hotelSearchInitiateDto, headers);
        } catch (error: unknown) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new InternalServerErrorException('Internal server error');
        }
    }

    @ApiQuery({ name: 'searchReqId', description: 'Search request ID from initiate endpoint', required: true })
    @ApiResponse(SWG_SUCCESS_RESPONSE)
    @ApiResponse(SWG_NOT_FOUND_RESPONSE)
    @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    @ApiResponse(SWG_UNPROCESSABLE_RESPONSE)
    @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    @HttpCode(HttpStatus.OK)
    @Post('check-results')
    async checkResults(@Body() hotelSearchCheckResultsDto: HotelSearchCheckResultsDto, @Headers() headers): Promise<InitiateResultResponse> {
        try {
            return await this.searchService.searchCheckResults(hotelSearchCheckResultsDto, headers);
        } catch (error: unknown) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new InternalServerErrorException('Internal server error');
        }
    }

    @ApiResponse(SWG_SUCCESS_RESPONSE)
    @ApiResponse(SWG_NOT_FOUND_RESPONSE)
    @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    @ApiResponse(SWG_UNPROCESSABLE_RESPONSE)
    @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    @HttpCode(HttpStatus.OK)
    @Post('filtration')
    async filtration(@Body() hotelSearchFiltrationDto: HotelSearchFiltrationDto, @Headers() headers): Promise<InitiateResultResponse> {
        try {
            return await this.searchService.searchFiltration(hotelSearchFiltrationDto, headers);
        } catch (error: unknown) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new InternalServerErrorException('Internal server error');
        }
    }
}
