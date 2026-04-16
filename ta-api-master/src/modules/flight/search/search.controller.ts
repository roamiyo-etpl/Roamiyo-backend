import { Body, Controller, Headers, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeaders } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { StartRoutingDto } from './dtos/start-routing.dto';
import { CheckRoutingDto } from './dtos/check-routing.dto';
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
import { StartRoutingResponse } from './interfaces/start-routing.interface';
import { CheckRoutingResponse } from './interfaces/check-routing.interface';

@ApiTags('Flight')
@UseGuards(HeaderValidationGuard)
@ApiHeaders([SWG_HEADER_CURRENCY_PREFERENCE, SWG_HEADER_IP_MANDATE, SWG_HEADER_API_VERSION_MANDATE])
@RequiredHeaders([DEC_HEADER_API_VERSION_MANDATE, DEC_HEADER_CURRENCY_PREFERENCE_MANDATE, DEC_HEADER_IP_ADDRESS_MANDATE])
@Controller('flight/search')
export class SearchController {
    constructor(private readonly searchService: SearchService) {}

    @Post('start-routing')
    @ApiOperation({ summary: 'Start flight search routing' })
    @ApiResponse(SWG_SUCCESS_RESPONSE)
    @ApiResponse(SWG_NOT_FOUND_RESPONSE)
    @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    @ApiResponse(SWG_UNPROCESSABLE_RESPONSE)
    @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    async startRouting(@Body() searchReq: StartRoutingDto, @Headers() headers: Headers): Promise<StartRoutingResponse> {
        const startTime = Date.now();
        const response = await this.searchService.startRouting(searchReq, headers);
        const endTime = Date.now();
        console.log('startRouting', `${(endTime - startTime) / 1000} seconds`);
        return response;
    }

    @Post('check-routing')
    @ApiOperation({ summary: 'Check flight search routing' })
    @ApiResponse(SWG_SUCCESS_RESPONSE)
    @ApiResponse(SWG_NOT_FOUND_RESPONSE)
    @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    @ApiResponse(SWG_UNPROCESSABLE_RESPONSE)
    @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    async collectivePolling(@Body() searchReq: CheckRoutingDto): Promise<CheckRoutingResponse> {
        return this.searchService.collectivePolling(searchReq);
    }
}
