import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GenericCancelController } from './cancel.controller';
import { GenericCancelService } from './cancel.service';
import { FlightModule } from '../flight/flight.module';
import { HotelModule } from '../hotel/hotel.module';

@Module({
    imports: [ConfigModule, FlightModule, HotelModule],
    controllers: [GenericCancelController],
    providers: [GenericCancelService],
    exports: [GenericCancelService],
})
export class GenericCancelModule {}


