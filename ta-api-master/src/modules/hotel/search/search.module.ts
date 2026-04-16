import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { ProvidersModule } from '../providers/providers.module';
import { GenericModule } from '../../generic/generic.module';
import { CachingUtility } from 'src/shared/utilities/common/caching.utility';
import { Cacheable } from 'cacheable';

@Module({
    imports: [ProvidersModule, GenericModule],
    controllers: [SearchController],
    providers: [
        SearchService,
        CachingUtility,
        {
            provide: 'CACHE_INSTANCE',
            useValue: new Cacheable(),
        },
    ],
})
export class SearchModule {}
