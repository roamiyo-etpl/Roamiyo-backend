import { Controller, Post, UseGuards } from '@nestjs/common';
import { Body } from '@nestjs/common';
import { BalanceCheckService } from './balance-check.service';
import { BalanceCheckDto } from './dtos/balance-check.dto';
import { BalanceCheckResponse } from './interfaces/balance-response.interface';
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
    DEC_HEADER_IP_ADDRESS_MANDATE,
    SWG_HEADER_API_VERSION_MANDATE,
    SWG_HEADER_CURRENCY_PREFERENCE,
    SWG_HEADER_IP_MANDATE,
} from 'src/shared/constants/standard-api-headers.constant';
import { HeaderValidationGuard } from 'src/shared/guards/common/header.validation.guard';

@Controller('flight')
@ApiTags('Flight')
@UseGuards(HeaderValidationGuard)
@ApiHeaders([SWG_HEADER_CURRENCY_PREFERENCE, SWG_HEADER_IP_MANDATE, SWG_HEADER_API_VERSION_MANDATE])
@RequiredHeaders([DEC_HEADER_API_VERSION_MANDATE, DEC_HEADER_CURRENCY_PREFERENCE_MANDATE, DEC_HEADER_IP_ADDRESS_MANDATE])
export class BalanceCheckController {
    constructor(private readonly balanceCheckService: BalanceCheckService) {}

    @Post('balance-check')
    @ApiOperation({ summary: 'Check balance' })
    @ApiResponse(SWG_SUCCESS_RESPONSE)
    @ApiResponse(SWG_NOT_FOUND_RESPONSE)
    @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    @ApiResponse(SWG_UNPROCESSABLE_RESPONSE)
    @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    async balanceCheck(@Body() balanceReq: BalanceCheckDto): Promise<BalanceCheckResponse> {
        return this.balanceCheckService.checkBalance(balanceReq);
    }
}
