import { Body, Controller, Headers, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeaders } from '@nestjs/swagger';
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
    DEC_HEADER_IP_ADDRESS_MANDATE,
    SWG_HEADER_API_VERSION_MANDATE,
    SWG_HEADER_CURRENCY_PREFERENCE,
    SWG_HEADER_IP_MANDATE,
} from 'src/shared/constants/standard-api-headers.constant';
import { HeaderValidationGuard } from 'src/shared/guards/common/header.validation.guard';
import { FareUpsellV2Service } from './fare-upsell-v2.service';
import { FareUpsellV2Dto } from './dtos/fare-upsell-v2.dto';
import { FareUpsellV2Response } from './interfaces/fare-upsell-v2.interface';

@ApiTags('Flight V2 (TBO V11)')
@UseGuards(HeaderValidationGuard)
@ApiHeaders([SWG_HEADER_CURRENCY_PREFERENCE, SWG_HEADER_IP_MANDATE, SWG_HEADER_API_VERSION_MANDATE])
@RequiredHeaders([DEC_HEADER_API_VERSION_MANDATE, DEC_HEADER_CURRENCY_PREFERENCE_MANDATE, DEC_HEADER_IP_ADDRESS_MANDATE])
@Controller('v2')
export class FareUpsellV2Controller {
    constructor(private readonly fareUpsellV2Service: FareUpsellV2Service) {}

    @Post('fare-upsell')
    @ApiOperation({ summary: 'Fare options (fare family, inclusions, services) on TBO V11. Call after search, before revalidate; send the chosen option solutionId to revalidate' })
    @ApiResponse(SWG_SUCCESS_RESPONSE)
    @ApiResponse(SWG_NOT_FOUND_RESPONSE)
    @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    @ApiResponse(SWG_UNPROCESSABLE_RESPONSE)
    @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    async fareUpsell(@Body() fareUpsellReq: FareUpsellV2Dto, @Headers() headers: Headers): Promise<FareUpsellV2Response> {
        return this.fareUpsellV2Service.fareUpsell(fareUpsellReq, headers);
    }
}
