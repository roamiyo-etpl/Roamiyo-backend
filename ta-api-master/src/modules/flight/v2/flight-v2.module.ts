import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErrorLogs } from 'src/shared/entities/error-logs.entity';
import { GenericRepo } from 'src/shared/utilities/flight/generic-repo.utility';
import { ProviderModule } from '../providers/provider.module';
import { SearchV2Controller } from './search-v2.controller';
import { SearchV2Service } from './search-v2.service';
import { TboSearchV11Service } from './tbo/tbo-search-v11.service';
import { FareRuleV2Controller } from './fare-rule-v2.controller';
import { FareRuleV2Service } from './fare-rule-v2.service';
import { TboFareRuleV11Service } from './tbo/tbo-fare-rule-v11.service';
import { FareUpsellV2Controller } from './fare-upsell-v2.controller';
import { FareUpsellV2Service } from './fare-upsell-v2.service';
import { TboFareUpsellV11Service } from './tbo/tbo-fare-upsell-v11.service';

/**
 * Flight v2 (/flight/v2/...) on TBO Air API V11. Self-contained: v1 flight routes and
 * services are not changed. Uses ProviderModule's exported ConfigurationService,
 * TboAuthTokenService and SupplierLogUtility as-is (same TBO row, token and log storage as v1).
 */
@Module({
    imports: [TypeOrmModule.forFeature([ErrorLogs]), ProviderModule],
    controllers: [SearchV2Controller, FareRuleV2Controller, FareUpsellV2Controller],
    providers: [
        SearchV2Service,
        TboSearchV11Service,
        FareRuleV2Service,
        TboFareRuleV11Service,
        FareUpsellV2Service,
        TboFareUpsellV11Service,
        GenericRepo,
    ],
})
export class FlightV2Module {}
