import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { CalendarFareDto } from '../calendar-fare/dtos/calendar-fare.dto';
import { CalendarFareResponse } from '../calendar-fare/interfaces/calendar-fare.interface';
import { ConfigurationService } from '../configuration/configuration.service';
import { TboCalendarFareService } from './tbo/tbo-calendar-fare.service';

@Injectable()
export class ProviderCalendarFareService {
    constructor(
        private configService: ConfigurationService,
        private tboCalendarFareService: TboCalendarFareService,
    ) {}

    /** [@Description: This method is used to fetch the calendar fare of the month]
     * @author: Prashant Joshi at 13-08-2026 **/
    async providerCalendarFare(calendarFareReq: CalendarFareDto, headers: Headers): Promise<CalendarFareResponse> {
        const providerConfig = await this.configService.getConfiguration({ supplierCode: 'TBO', mode: '', module: 'Flight' });

        if (!providerConfig) {
            throw new NotFoundException('Provider code is not valid, Check your provider code and try again.');
        }

        const calendarFareRequest = [];
        calendarFareRequest['calendarFareReq'] = calendarFareReq;
        calendarFareRequest['calendarFareReqId'] = uuid();
        calendarFareRequest['searchReqId'] = calendarFareRequest['calendarFareReqId'];
        calendarFareRequest['headers'] = headers;
        calendarFareRequest['providerCred'] = JSON.parse(providerConfig.provider_credentials);

        return this.tboCalendarFareService.calendarFare(calendarFareRequest);
    }
}
