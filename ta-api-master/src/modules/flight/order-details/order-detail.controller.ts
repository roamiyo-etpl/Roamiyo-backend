import { Controller, Post, Body, UseGuards, Headers } from '@nestjs/common';
import { OrderDetailService } from './order-detail.service';
import { OrderDetailDto } from './dtos/order-detail.dto';
import { OrderDetailResponse } from './interfaces/order-detail.interface';
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

@ApiTags('Flight')
@UseGuards(HeaderValidationGuard)
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
    DEC_HEADER_API_VERSION_MANDATE,
    DEC_HEADER_CURRENCY_PREFERENCE_MANDATE,
    DEC_HEADER_DEVICE_INFORMATION_MANDATE,
    DEC_HEADER_CLUB_ID_MANDATE,
    DEC_HEADER_IP_ADDRESS_MANDATE,
])
@Controller('/flight')
export class OrderDetailController {
    constructor(private readonly orderDetailService: OrderDetailService) {}

    @Post('order-detail')
    @ApiOperation({ summary: 'Get order details' })
    @ApiResponse(SWG_SUCCESS_RESPONSE)
    @ApiResponse(SWG_NOT_FOUND_RESPONSE)
    @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    @ApiResponse(SWG_UNPROCESSABLE_RESPONSE)
    @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    async getOrderDetails(@Body() orderReq: OrderDetailDto, @Headers() headers: Headers): Promise<OrderDetailResponse[]> {
        let { orderDetails } = await this.orderDetailService.getOrderDetails(orderReq, headers);
        return orderDetails;
    }
}
