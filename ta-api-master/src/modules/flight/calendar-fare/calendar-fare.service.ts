import { Injectable } from '@nestjs/common';
import { CalendarFareDto } from './dtos/calendar-fare.dto';
import { CalendarFareResponse } from './interfaces/calendar-fare.interface';
import { ProviderCalendarFareService } from '../providers/provider-calendar-fare.service';

@Injectable()
export class CalendarFareService {
    constructor(private readonly providerCalendarFareService: ProviderCalendarFareService) {}

    async calendarFare(calendarFareDto: CalendarFareDto, headers: Headers): Promise<CalendarFareResponse> {
        return this.providerCalendarFareService.providerCalendarFare(calendarFareDto, headers);
    }
}
