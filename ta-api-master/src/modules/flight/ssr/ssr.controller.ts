import { Controller, Post, Body, Headers, UseGuards } from '@nestjs/common';
import { SsrService } from './ssr.service';
import { HeaderValidationGuard } from 'src/shared/guards/common/header.validation.guard';
import {
  DEC_HEADER_API_VERSION_MANDATE,
  DEC_HEADER_CURRENCY_PREFERENCE_MANDATE,
  DEC_HEADER_IP_ADDRESS_MANDATE,
} from 'src/shared/constants/standard-api-headers.constant';
import { RequiredHeaders } from 'src/shared/decorators/common/custom-header.decorator';

@UseGuards(HeaderValidationGuard)
@RequiredHeaders([
  DEC_HEADER_API_VERSION_MANDATE,
  DEC_HEADER_CURRENCY_PREFERENCE_MANDATE,
  DEC_HEADER_IP_ADDRESS_MANDATE,
])
@Controller('/flight')
export class SsrController {
  constructor(private readonly ssrService: SsrService) {}

  @Post('ssr/seat-map')
  async getSeatMap(@Body() body: any, @Headers() headers: any) {
    return this.ssrService.flightSeatMapping(body, headers);
  }

  @Post('ssr/grouped-seat-map')
  async getGroupedSeatMap(@Body() body: any, @Headers() headers: any) {
    return this.ssrService.flightGroupedSeatMap(body, headers);
  }
}