import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cacheable } from 'cacheable';
import { GenericModule } from '../../generic/generic.module';
import { SearchService } from '../search/search.service';
import { ProvidersSearchService } from '../providers/providers-search.service';
import { HotelbedsSearchService } from '../providers/hotelbeds/hotelbeds-search.service';
import { TboSearchService } from '../providers/tbo/tbo-search.service';
import { TboRepository } from '../providers/tbo/tbo.repository';
import { CachingUtility } from 'src/shared/utilities/common/caching.utility';
import { HotelMasterEntity } from 'src/shared/entities/hotel-master.entity';
import { TboHotelListEntity } from 'src/modules/dump/hotel/entities/tbo-hotel-list.entity';
import { TboHotelAdditionalDetailsEntity } from 'src/modules/dump/hotel/entities/tbo-hotel-additional-details.entity';
import { TboHotelImagesEntity } from 'src/modules/dump/hotel/entities/tbo-hotel-images.entity';
import { HotelCityGeoEntity } from './entities/hotel-city-geo.entity';
import { TboV2Repository } from './tbo-v2.repository';
import { SearchV2Controller } from './search-v2.controller';
import { SearchV2Service } from './search-v2.service';
import { HotelAutocompleteV2Service } from './hotel-autocomplete-v2.service';

/**
 * Hotel search v2 (/hotel/v2/...). Self-contained: it has its own instances of the v1 search
 * services, so v1 (/hotel/search/...) is not affected. The only difference in the shared pipeline
 * is TboRepository -> TboV2Repository (hotel-code lookups from tbo_hotel_list).
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([HotelMasterEntity, TboHotelListEntity, TboHotelAdditionalDetailsEntity, TboHotelImagesEntity, HotelCityGeoEntity]),
        GenericModule,
    ],
    controllers: [SearchV2Controller],
    providers: [
        SearchV2Service,
        HotelAutocompleteV2Service,
        SearchService,
        ProvidersSearchService,
        HotelbedsSearchService,
        TboSearchService,
        { provide: TboRepository, useClass: TboV2Repository },
        CachingUtility,
        {
            provide: 'CACHE_INSTANCE',
            useValue: new Cacheable(),
        },
    ],
})
export class HotelV2Module {}
