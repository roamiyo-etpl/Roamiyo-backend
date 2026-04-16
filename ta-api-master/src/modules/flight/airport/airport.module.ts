import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Airports } from 'src/shared/entities/airports.entity';
import { AirportService } from './airport.service';

@Module({
    imports: [TypeOrmModule.forFeature([Airports])],
    providers: [AirportService],
    exports: [AirportService],
})
export class AirportModule {}
