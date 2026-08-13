import { Body, Controller, Headers, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeaders } from '@nestjs/swagger';
import { CalendarFareService } from './calendar-fare.service';
import { CalendarFareDto } from './dtos/calendar-fare.dto';
import { CalendarFareResponse } from './interfaces/calendar-fare.interface';
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

@ApiTags('Flight')
@UseGuards(HeaderValidationGuard)
@ApiHeaders([SWG_HEADER_CURRENCY_PREFERENCE, SWG_HEADER_IP_MANDATE, SWG_HEADER_API_VERSION_MANDATE])
@RequiredHeaders([DEC_HEADER_API_VERSION_MANDATE, DEC_HEADER_CURRENCY_PREFERENCE_MANDATE, DEC_HEADER_IP_ADDRESS_MANDATE])
@Controller('flight')
export class CalendarFareController {
    constructor(private readonly calendarFareService: CalendarFareService) {}

    @Post('calendar-fare')
    @ApiOperation({ summary: 'Get the lowest airfare of the month for a domestic sector' })
    @ApiResponse(SWG_SUCCESS_RESPONSE)
    @ApiResponse(SWG_NOT_FOUND_RESPONSE)
    @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    @ApiResponse(SWG_UNPROCESSABLE_RESPONSE)
    @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    async calendarFare(@Body() calendarFareDto: CalendarFareDto, @Headers() headers: Headers): Promise<CalendarFareResponse> {
        return this.calendarFareService.calendarFare(calendarFareDto, headers);
    }
}
