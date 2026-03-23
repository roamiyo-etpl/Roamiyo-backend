import { Controller, Post, Get, Query, Headers, HttpCode, HttpStatus, InternalServerErrorException, HttpException, Put, Body } from '@nestjs/common';
import { HotelDumpService } from './hotel-dump.service';
import { HotelDetailRequestDto } from './dtos/hotel-detail.dto';

/**
 * Hotel dump controller - handles hotel data dump operations
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

import { ApiHeaders, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequiredHeaders } from 'src/shared/decorators/common/custom-header.decorator';
import { HotelAutocompleteDto } from './dtos/hotel-autocomplete.dto';
import {
    SWG_BAD_REQUEST_RESPONSE,
    SWG_INTERNAL_SERVER_ERROR_RESPONSE,
    SWG_NOT_FOUND_RESPONSE,
    SWG_SUCCESS_RESPONSE,
    SWG_UNPROCESSABLE_RESPONSE,
} from 'src/shared/constants/standard-api-responses.constant';
import { HotelAutocompleteResponse } from './interfaces/hotel-response.interface';
import { CommonResponse } from 'src/shared/interfaces/common-response.interface';
import { HotelDetailResponse } from './interfaces/hotel-detail.interface';
import { ContentDumpRequestDto } from './dtos/hotel-content-dump.dto';
import { TransferDataToHotelContent } from './dtos/transfer-data-to-hotel-content.dto';

@ApiTags('Hotel Dump')
@ApiHeaders([SWG_HEADER_CURRENCY_PREFERENCE, SWG_HEADER_IP_MANDATE, SWG_HEADER_API_VERSION_MANDATE])
@RequiredHeaders([DEC_HEADER_IP_ADDRESS_MANDATE, DEC_HEADER_API_VERSION_MANDATE, DEC_HEADER_CURRENCY_PREFERENCE_MANDATE])
@Controller('dump/hotel')
export class HotelDumpController {
    constructor(private readonly hotelDumpService: HotelDumpService) {}

    @ApiOperation({ summary: 'Get hotel autocomplete suggestions' })
    @ApiResponse(SWG_SUCCESS_RESPONSE)
    @ApiResponse(SWG_NOT_FOUND_RESPONSE)
    @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    @ApiResponse(SWG_UNPROCESSABLE_RESPONSE)
    @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    @Get('autocomplete')
    @HttpCode(HttpStatus.OK)
    async getHotelAutocomplete(@Query() hotelAutocompleteDto: HotelAutocompleteDto, @Headers() headers: Headers): Promise<HotelAutocompleteResponse> {
        try {
            return await this.hotelDumpService.getHotelAutocomplete(hotelAutocompleteDto);
        } catch (error) {
            throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @ApiOperation({ summary: 'Get hotel details by hotel code' })
    @ApiResponse(SWG_SUCCESS_RESPONSE)
    @ApiResponse(SWG_NOT_FOUND_RESPONSE)
    @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    @ApiResponse(SWG_UNPROCESSABLE_RESPONSE)
    @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    @Post('detail')
    @HttpCode(HttpStatus.OK)
    async getHotelDetails(@Body() hotelDetailRequestDto: HotelDetailRequestDto, @Headers() headers: Headers): Promise<HotelDetailResponse> {
        try {
            return await this.hotelDumpService.getHotelDetails(hotelDetailRequestDto.hotelId);
        } catch (error) {
            throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @ApiOperation({ summary: 'Get hotel room content by hotel code' })
    @ApiResponse(SWG_SUCCESS_RESPONSE)
    @ApiResponse(SWG_NOT_FOUND_RESPONSE)
    @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    @ApiResponse(SWG_UNPROCESSABLE_RESPONSE)
    @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    @Get('room-content')
    @HttpCode(HttpStatus.OK)
    async getHotelRoomContent(@Query() hotelDetailRequestDto: HotelDetailRequestDto, @Headers() headers: Headers): Promise<any> {
        try {
            return await this.hotelDumpService.getHotelRoomContent(hotelDetailRequestDto.hotelId);
        } catch (error) {
            throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @ApiOperation({ summary: 'Transfer data to hotel content table' })
    @ApiResponse(SWG_SUCCESS_RESPONSE)
    @ApiResponse(SWG_NOT_FOUND_RESPONSE)
    @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    @ApiResponse(SWG_UNPROCESSABLE_RESPONSE)
    @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    @Post('transfer-data')
    @HttpCode(HttpStatus.OK)
    async transferDataToHotelContent(@Body() transferData: TransferDataToHotelContent, @Headers() headers: Headers): Promise<CommonResponse> {
        try {
            return await this.hotelDumpService.transferDataToHotelContent(transferData);
        } catch (error) {
            throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @ApiOperation({ summary: 'Add country list dump from TBO API' })
    @ApiResponse(SWG_SUCCESS_RESPONSE)
    @ApiResponse(SWG_NOT_FOUND_RESPONSE)
    @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    @ApiResponse(SWG_UNPROCESSABLE_RESPONSE)
    @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    @Get('country-list')
    @HttpCode(HttpStatus.OK)
    async addCountryList(@Headers() headers: Headers){
        try {
            // return await this.hotelDumpService.addCountryList(headers);
            return await this.hotelDumpService.addCountryList(headers);
        } catch (error) {
            throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @ApiOperation({ summary: 'Add city list dump from TBO API' })
    @ApiResponse(SWG_SUCCESS_RESPONSE)
    @ApiResponse(SWG_NOT_FOUND_RESPONSE)
    @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    @ApiResponse(SWG_UNPROCESSABLE_RESPONSE)
    @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    @Get('city-list')
    @ApiQuery({
        name: 'countryCode',
        required: false,
    })
    @HttpCode(HttpStatus.OK)
    async addCityList(@Headers() headers: Headers, @Query('countryCode') countryCode?: string) {
        try {
            return await this.hotelDumpService.addCityList(headers, countryCode);
        } catch (error) {
            throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // @ApiOperation({ summary: 'Add hotel list dump from TBO API' })
    // @ApiResponse(SWG_SUCCESS_RESPONSE)
    // @ApiResponse(SWG_NOT_FOUND_RESPONSE)
    // @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    // @ApiResponse(SWG_UNPROCESSABLE_RESPONSE)
    // @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    // @Post('hotel-list')
    // @HttpCode(HttpStatus.OK)
    // async addHotelList(@Headers() headers: Headers): Promise<CommonResponse> {
    //     try {
    //         return await this.hotelDumpService.addHotelList(headers);
    //     } catch (error) {
    //         throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
    //     }
    // }


    @ApiOperation({ summary: 'Add hotel basic details list dump from TBO API' })
    @ApiResponse(SWG_SUCCESS_RESPONSE)
    @ApiResponse(SWG_NOT_FOUND_RESPONSE)
    @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    @ApiResponse(SWG_UNPROCESSABLE_RESPONSE)
    @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    @Get('hotel-basic-details')
    @ApiQuery({
        name: 'cityCode',
        required: false,
    })
    @HttpCode(HttpStatus.OK)
    async dumpHotelBasicDetails(@Headers() headers: Headers, @Query('cityCode') cityCode?: string) {
        try {
            return await this.hotelDumpService.dumpHotelBasicDetails(headers, cityCode);
        } catch (error) {
            throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }


    @ApiOperation({ summary: 'update hotel information details from TBO API' })
    @ApiResponse(SWG_SUCCESS_RESPONSE)
    @ApiResponse(SWG_NOT_FOUND_RESPONSE)
    @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    @ApiResponse(SWG_UNPROCESSABLE_RESPONSE)
    @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    @Get('update-hotel-details')
    async dumpHotelInfo(@Headers() headers: Headers) {
         try {
            return await this.hotelDumpService.dumpHotelInfo(headers);
        } catch (error) {
            throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

}
 