import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { GeographyDumpService } from './geography-dump.service';
import { GeographyDumpController } from './geography-dump.controller';
import { GeographyRepository } from './geography.repository';
import { CityEntity } from 'src/shared/entities/city.entity';
import { StateEntity } from 'src/shared/entities/state.entity';
import { CountryEntity } from 'src/shared/entities/country.entity';

/**
 * Geography dump module - handles geography data operations
 * @author Prashant - TBO Integration
 */
@Module({
    imports: [ConfigModule, TypeOrmModule.forFeature([CityEntity, StateEntity, CountryEntity])],
    providers: [GeographyDumpService, GeographyRepository],
    controllers: [GeographyDumpController],
    exports: [GeographyDumpService],
})
export class GeographyDumpModule {}
