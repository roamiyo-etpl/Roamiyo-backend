import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiHeaders, ApiResponse, ApiTags } from '@nestjs/swagger';
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
import { throwHotelApiError } from 'src/shared/utilities/hotel/hotel-error.utility';
import { SearchService } from '../search/search.service';
import { HotelSearchCheckResultsDto } from '../search/dtos/hotel-search-check-results.dto';
import { HotelSearchFiltrationDto } from '../search/dtos/hotel-search-filtration.dto';
import { InitiateResultResponse } from '../search/interfaces/initiate-result-response.interface';
import { HotelSearchInitiateV2Dto } from './dtos/hotel-search-initiate-v2.dto';
import { HotelAutocompleteV2Dto } from './dtos/hotel-autocomplete-v2.dto';
import { HotelAutocompleteV2Response } from './interfaces/hotel-autocomplete-v2.interface';
import { SearchV2Service } from './search-v2.service';
import { HotelAutocompleteV2Service } from './hotel-autocomplete-v2.service';

/**
 * v2 hotel search. check-results and filtration must use these v2 routes too:
 * v2 search results are cached in HotelV2Module, not in the v1 SearchModule.
 */
@ApiTags('Hotel V2')
@ApiHeaders([SWG_HEADER_CURRENCY_PREFERENCE, SWG_HEADER_IP_MANDATE, SWG_HEADER_API_VERSION_MANDATE])
@RequiredHeaders([DEC_HEADER_IP_ADDRESS_MANDATE, DEC_HEADER_API_VERSION_MANDATE, DEC_HEADER_CURRENCY_PREFERENCE_MANDATE])
@Controller('hotel/v2')
export class SearchV2Controller {
    constructor(
        private readonly searchV2Service: SearchV2Service,
        private readonly searchService: SearchService,
        private readonly autocompleteService: HotelAutocompleteV2Service,
    ) {}

    @ApiResponse(SWG_SUCCESS_RESPONSE)
    @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    @HttpCode(HttpStatus.OK)
    @Get('autocomplete')
    async autocomplete(@Query() hotelAutocompleteDto: HotelAutocompleteV2Dto): Promise<HotelAutocompleteV2Response> {
        try {
            return await this.autocompleteService.autocomplete(hotelAutocompleteDto);
        } catch (error: unknown) {
            throwHotelApiError(error, 'Hotel autocomplete failed');
        }
    }

    @ApiResponse(SWG_SUCCESS_RESPONSE)
    @ApiResponse(SWG_NOT_FOUND_RESPONSE)
    @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    @ApiResponse(SWG_UNPROCESSABLE_RESPONSE)
    @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    @HttpCode(HttpStatus.OK)
    @Post('search/initiate')
    async initiate(@Body() hotelSearchInitiateDto: HotelSearchInitiateV2Dto, @Headers() headers): Promise<InitiateResultResponse> {
        const startTime = Date.now();
        console.log(`[HOTEL-SEARCH-V2] HTTP request received at ${new Date(startTime).toISOString()}`);
        try {
            const response = await this.searchV2Service.searchInitiate(hotelSearchInitiateDto, headers);
            console.log(`[HOTEL-SEARCH-V2] reqId=${response.searchReqId} response sent to client, total end-to-end time: ${((Date.now() - startTime) / 1000).toFixed(3)}s`);
            return response;
        } catch (error: unknown) {
            throwHotelApiError(error, 'Hotel search initiation failed');
        }
    }

    @ApiResponse(SWG_SUCCESS_RESPONSE)
    @ApiResponse(SWG_NOT_FOUND_RESPONSE)
    @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    @ApiResponse(SWG_UNPROCESSABLE_RESPONSE)
    @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    @HttpCode(HttpStatus.OK)
    @Post('search/check-results')
    async checkResults(@Body() hotelSearchCheckResultsDto: HotelSearchCheckResultsDto, @Headers() headers): Promise<InitiateResultResponse> {
        try {
            return await this.searchService.searchCheckResults(hotelSearchCheckResultsDto, headers);
        } catch (error: unknown) {
            throwHotelApiError(error, 'Hotel search check results failed');
        }
    }

    @ApiResponse(SWG_SUCCESS_RESPONSE)
    @ApiResponse(SWG_NOT_FOUND_RESPONSE)
    @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    @ApiResponse(SWG_UNPROCESSABLE_RESPONSE)
    @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    @HttpCode(HttpStatus.OK)
    @Post('search/filtration')
    async filtration(@Body() hotelSearchFiltrationDto: HotelSearchFiltrationDto, @Headers() headers): Promise<InitiateResultResponse> {
        try {
            return await this.searchService.searchFiltration(hotelSearchFiltrationDto, headers);
        } catch (error: unknown) {
            throwHotelApiError(error, 'Hotel search filtration failed');
        }
    }
}
