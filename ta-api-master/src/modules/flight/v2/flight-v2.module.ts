import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErrorLogs } from 'src/shared/entities/error-logs.entity';
import { GenericRepo } from 'src/shared/utilities/flight/generic-repo.utility';
import { ProviderModule } from '../providers/provider.module';
import { SearchV2Controller } from './search-v2.controller';
import { SearchV2Service } from './search-v2.service';
import { TboSearchV11Service } from './tbo/tbo-search-v11.service';

/**
 * Flight v2 (/flight/v2/...) on TBO Air API V11. Self-contained: v1 flight routes and
 * services are not changed. Uses ProviderModule's exported ConfigurationService,
 * TboAuthTokenService and SupplierLogUtility as-is (same TBO row, token and log storage as v1).
 */
@Module({
    imports: [TypeOrmModule.forFeature([ErrorLogs]), ProviderModule],
    controllers: [SearchV2Controller],
    providers: [SearchV2Service, TboSearchV11Service, GenericRepo],
})
export class FlightV2Module {}
