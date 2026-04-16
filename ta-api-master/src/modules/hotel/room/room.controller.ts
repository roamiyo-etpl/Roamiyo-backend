import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiHeaders, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import {
    DEC_HEADER_API_VERSION_MANDATE,
    DEC_HEADER_CURRENCY_PREFERENCE_MANDATE,
    DEC_HEADER_IP_ADDRESS_MANDATE,
    SWG_HEADER_API_VERSION_MANDATE,
    SWG_HEADER_CURRENCY_PREFERENCE,
    SWG_HEADER_IP_MANDATE,
} from 'src/shared/constants/standard-api-headers.constant';
import { SWG_BAD_REQUEST_RESPONSE, SWG_INTERNAL_SERVER_ERROR_RESPONSE, SWG_NOT_FOUND_RESPONSE, SWG_UNPROCESSABLE_RESPONSE } from 'src/shared/constants/standard-api-responses.constant';
import { HotelRoomService } from './room.service';
import { RequiredHeaders } from 'src/shared/decorators/common/custom-header.decorator';
import { HotelRoomListRequestDto } from './dtos/hotel-room-list.dto';
import { HotelRoomResponse } from './interfaces/room-list-response.interface';
import { HotelRoomQuoteDto } from './dtos/hotel-room-quote.dto';
import { HotelRoomQuoteResponse } from './interfaces/room-quote-response.interface';

@ApiHeaders([SWG_HEADER_CURRENCY_PREFERENCE, SWG_HEADER_IP_MANDATE, SWG_HEADER_API_VERSION_MANDATE])
@RequiredHeaders([DEC_HEADER_IP_ADDRESS_MANDATE, DEC_HEADER_API_VERSION_MANDATE, DEC_HEADER_CURRENCY_PREFERENCE_MANDATE])
@ApiTags('Hotel')
@Controller('hotel/room')
export class HotelRoomController {
    constructor(private readonly roomService: HotelRoomService) {}

    /**
     * [@Description: Get Hotel Room List]
     * @author: Prashant - Updated following dmc-api-backend pattern
     */
    @ApiOperation({
        summary: 'Get available room types and rates for a specific hotel',
        description: 'Retrieves available room types, rates, and pricing information for a specific hotel based on check-in/check-out dates and guest requirements.',
    })
    @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    @ApiResponse(SWG_NOT_FOUND_RESPONSE)
    @ApiResponse(SWG_UNPROCESSABLE_RESPONSE)
    @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    @HttpCode(HttpStatus.OK)
    @Post('list')
    async getRoomList(@Body() hotelRoomListRequestDto: HotelRoomListRequestDto, @Headers() headers): Promise<HotelRoomResponse> {
        return await this.roomService.getHotelRoomList(hotelRoomListRequestDto, headers);
    }

    /**
     * [@Description: Get Hotel Room Quote]
     * @author: Prashant - Updated following dmc-api-backend pattern
     */
    @ApiOperation({
        summary: 'Get available room types and rates for a specific hotel quote',
        description: 'Retrieves available room types, rates, and pricing information for a specific hotel based on check-in/check-out dates and guest requirements.',
    })
    @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    @ApiResponse(SWG_NOT_FOUND_RESPONSE)
    @ApiResponse(SWG_UNPROCESSABLE_RESPONSE)
    @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    @HttpCode(HttpStatus.OK)
    @Post('quote')
    async getRoomQuote(@Body() hotelRoomQuotedto: HotelRoomQuoteDto, @Headers() headers): Promise<HotelRoomQuoteResponse> {
        return await this.roomService.getHotelRoomQuote(hotelRoomQuotedto, headers);
    }
}
