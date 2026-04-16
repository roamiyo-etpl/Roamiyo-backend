import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GenericCancelController } from './cancel.controller';
import { GenericCancelService } from './cancel.service';
import { FlightModule } from '../flight/flight.module';

@Module({
    imports: [ConfigModule, FlightModule],
    controllers: [GenericCancelController],
    providers: [GenericCancelService],
    exports: [GenericCancelService],
})
export class GenericCancelModule {}


