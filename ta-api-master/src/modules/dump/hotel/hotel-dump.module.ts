import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { HotelDumpService } from './hotel-dump.service';
import { HotelDumpController } from './hotel-dump.controller';
import { AmenityMasterEntity } from './entities/amenity-master.entity';
import { AmenityMappingEntity } from './entities/amenity-mapping.entity';
import { BoardCodeMasterEntity } from './entities/board-code-master.entity';
import { BoardCodeMappingEntity } from './entities/board-code-mapping.entity';
import { CountryEntity } from 'src/shared/entities/country.entity';
import { CityEntity } from 'src/shared/entities/city.entity';
import { HotelMasterEntity } from 'src/shared/entities/hotel-master.entity';
import { SupplierCredService } from 'src/modules/generic/supplier-credientials/supplier-cred.service';
import { ProviderMaster } from 'src/shared/entities/provider-master.entity';
import { TboHotelRoomContentEntity } from './entities/tbo-hotel-room-content.entity';
import { TboHotelContentEntity } from './entities/tbo-hotel-content.entity';
import { TboHotelImagesEntity } from './entities/tbo-hotel-images.entity';
import { TboHotelAdditionalDetailsEntity } from './entities/tbo-hotel-additional-details.entity';

/**
 * Hotel dump module - handles hotel data dump operations
 * @author Prashant - TBO Integration
 */
@Module({
    imports: [
        ConfigModule,
        TypeOrmModule.forFeature([
            AmenityMasterEntity,
            AmenityMappingEntity,
            BoardCodeMasterEntity,
            BoardCodeMappingEntity,
            TboHotelAdditionalDetailsEntity,
            TboHotelImagesEntity,
            TboHotelContentEntity,
            TboHotelRoomContentEntity,
            CountryEntity,
            CityEntity,
            HotelMasterEntity,
            ProviderMaster,
        ]),
    ],
    providers: [HotelDumpService, SupplierCredService],
    controllers: [HotelDumpController],
    exports: [HotelDumpService],
})
export class HotelDumpModule {}
