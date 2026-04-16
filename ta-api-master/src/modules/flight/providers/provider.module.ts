import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ProviderMaster } from 'src/shared/entities/provider-master.entity';
import { SearchResponse } from 'src/shared/entities/search-response.entity';
import { ErrorLogs } from 'src/shared/entities/error-logs.entity';
import { ConfigurationService } from '../configuration/configuration.service';
import { ProviderRepoService } from './provider-repo.service';
import { ProviderSearchService } from './provider-search.service';
import { ProviderBookService } from './provider-book.service';
import { ProviderRevalidateService } from './provider-revalidate.service';
import { ProviderOrderDetailService } from './provider-order-detail.service';
import { ProviderCancellationService } from './provider-cancellation.service';
import { TboSearchService } from './tbo/tbo-search.service';
import { TboBookService } from './tbo/tbo-book.service';
import { TboRevalidateService } from './tbo/tbo-revalidate.service';
import { TboOrderDetailService } from './tbo/tbo-order-detail.service';
import { TboAuthTokenService } from './tbo/tbo-auth-token.service';
import { TboCancellationService } from './tbo/tbo-cancellation.service';
import { GenericRepo } from 'src/shared/utilities/flight/generic-repo.utility';
import { s3BucketService } from 'src/shared/utilities/flight/s3bucket.utility';
import { SupplierLogUtility } from 'src/shared/utilities/flight/supplier-log.utility';
import { ConfigurationModule } from '../configuration/configuration.module';
import { ProviderBalanceService } from './provider-balance.service';
import { RevalidateResponseEntity } from 'src/shared/entities/revalidate-response.entity';

@Module({
    imports: [TypeOrmModule.forFeature([ProviderMaster, SearchResponse, RevalidateResponseEntity, ErrorLogs]), ConfigurationModule, ConfigModule],
    providers: [
        ConfigurationService,
        ProviderRepoService,
        ProviderSearchService,
        ProviderBookService,
        ProviderRevalidateService,
        ProviderOrderDetailService,
        TboSearchService,
        TboBookService,
        TboRevalidateService,
        TboOrderDetailService,
        TboAuthTokenService,
        TboCancellationService,
        ProviderBalanceService,
        ProviderCancellationService,
        GenericRepo,
        s3BucketService,
        SupplierLogUtility,
    ],
    exports: [
        ConfigurationService,
        ProviderRepoService,
        ProviderSearchService,
        ProviderBookService,
        ProviderRevalidateService,
        ProviderOrderDetailService,
        ProviderCancellationService,
        TboSearchService,
        TboBookService,
        TboRevalidateService,
        TboOrderDetailService,
        TboAuthTokenService,
        TboCancellationService,
        ProviderBalanceService,
        s3BucketService,
        SupplierLogUtility,
    ],
})
export class ProviderModule {}
