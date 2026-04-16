import { Controller, Post, Body, UseGuards, Headers, HttpCode, HttpStatus } from '@nestjs/common';
import { HotelOrderDetailService } from './order-detail.service';
import { ApiHeaders, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
    SWG_BAD_REQUEST_RESPONSE,
    SWG_INTERNAL_SERVER_ERROR_RESPONSE,
    SWG_NOT_FOUND_RESPONSE,
    SWG_SUCCESS_RESPONSE,
    SWG_UNPROCESSABLE_RESPONSE,
} from 'src/shared/constants/standard-api-responses.constant';
import { RequiredHeaders } from 'src/shared/decorators/common/custom-header.decorator';
import {
    DEC_HEADER_API_VERSION_MANDATE,
    DEC_HEADER_CURRENCY_PREFERENCE_MANDATE,
    DEC_HEADER_DEVICE_INFORMATION_MANDATE,
    DEC_HEADER_IP_ADDRESS_MANDATE,
    DEC_HEADER_CLUB_ID_MANDATE,
    DEC_HEADER_LANGUAGE_PREFERENCE_MANDATE,
    SWG_HEADER_API_VERSION_MANDATE,
    SWG_HEADER_CLUB_ID_MANDATE,
    SWG_HEADER_CURRENCY_PREFERENCE,
    SWG_HEADER_IP_MANDATE,
    SWG_HEADER_LANGUAGE_PREFERENCE_MANDATE,
    SWG_HEADER_DEVICE_INFORMATION_MANDATE,
} from 'src/shared/constants/standard-api-headers.constant';
import { HeaderValidationGuard } from 'src/shared/guards/common/header.validation.guard';

@ApiHeaders([SWG_HEADER_CURRENCY_PREFERENCE, SWG_HEADER_IP_MANDATE, SWG_HEADER_API_VERSION_MANDATE])
@RequiredHeaders([DEC_HEADER_IP_ADDRESS_MANDATE, DEC_HEADER_API_VERSION_MANDATE, DEC_HEADER_CURRENCY_PREFERENCE_MANDATE])
@ApiTags('Hotel')
@Controller('/hotel')
export class HotelOrderDetailController {
    constructor(
        private readonly orderDetailService: HotelOrderDetailService
    ) {}

    @Post('order-detail')
    @ApiOperation({ summary: 'Get order details' })
    @ApiResponse(SWG_SUCCESS_RESPONSE)
    @ApiResponse(SWG_NOT_FOUND_RESPONSE)
    @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    @ApiResponse(SWG_UNPROCESSABLE_RESPONSE)
    @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    @HttpCode(HttpStatus.OK)
    async getOrderDetails(@Body() orderReq: any, @Headers() headers: Headers): Promise<any> {
        // console.log(orderReq,"orderReq");
        // return true;
        return this.orderDetailService.getOrderDetails(orderReq, headers);
    }
}
