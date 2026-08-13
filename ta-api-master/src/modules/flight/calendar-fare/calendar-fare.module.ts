import { Module } from '@nestjs/common';
import { CalendarFareService } from './calendar-fare.service';
import { CalendarFareController } from './calendar-fare.controller';
import { ProviderModule } from '../providers/provider.module';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [ProviderModule, ConfigModule],
    providers: [CalendarFareService],
    controllers: [CalendarFareController],
    exports: [CalendarFareService],
})
export class CalendarFareModule {}
