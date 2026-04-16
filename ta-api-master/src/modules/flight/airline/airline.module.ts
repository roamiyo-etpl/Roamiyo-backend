import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Airline } from 'src/shared/entities/airline.entity';
import { AirlineService } from './airline.service';

@Module({
    imports: [TypeOrmModule.forFeature([Airline])],
    providers: [AirlineService],
    exports: [AirlineService],
})
export class AirlineModule {}
