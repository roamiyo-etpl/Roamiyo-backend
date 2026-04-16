import { Body, Controller, Headers, Post, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiHeaders, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GenericCancelService } from './cancel.service';
import { GenericCancelDto, GenericGetCancellationChargesDto } from './dto/cancel.dto';
import { RequiredHeaders } from 'src/shared/decorators/common/custom-header.decorator';
import { HeaderValidationGuard } from 'src/shared/guards/common/header.validation.guard';
import {
    SWG_BAD_REQUEST_RESPONSE,
    SWG_INTERNAL_SERVER_ERROR_RESPONSE,
    SWG_NOT_FOUND_RESPONSE,
    SWG_SUCCESS_RESPONSE,
    SWG_UNPROCESSABLE_RESPONSE,
} from 'src/shared/constants/standard-api-responses.constant';
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

@ApiTags('Cancel')
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
@Controller('/')
export class GenericCancelController {
    constructor(private readonly cancelService: GenericCancelService) {}

    @Post('cancel')
    @ApiOperation({ summary: 'Generic cancel API (flight/hotel)' })
    @ApiResponse(SWG_SUCCESS_RESPONSE)
    @ApiResponse(SWG_NOT_FOUND_RESPONSE)
    @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    @ApiResponse(SWG_UNPROCESSABLE_RESPONSE)
    @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    async cancel(@Body() dto: GenericCancelDto, @Headers() headers: Headers) {
        if (!dto?.mode) {
            throw new BadRequestException('mode is required ("flight" | "hotel")');
        }
        return this.cancelService.cancel({ cancelReq: dto, headers });
    }

    @Post('cancellation-charges')
    @ApiOperation({ summary: 'Generic cancellation charges (flight/hotel)' })
    @ApiResponse(SWG_SUCCESS_RESPONSE)
    @ApiResponse(SWG_NOT_FOUND_RESPONSE)
    @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    @ApiResponse(SWG_UNPROCESSABLE_RESPONSE)
    @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    async getCancellationCharges(@Body() dto: GenericGetCancellationChargesDto, @Headers() headers: Headers) {
        if (!dto?.mode) {
            throw new BadRequestException('mode is required ("flight" | "hotel")');
        }
        return this.cancelService.getCancellationCharges({ cancelReq: dto, headers });
    }
}


