import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchModule } from './search/search.module';
import { ProviderModule } from './providers/provider.module';
import { ProviderMaster } from 'src/shared/entities/provider-master.entity';
import { SearchResponse } from 'src/shared/entities/search-response.entity';
import { ErrorLogs } from 'src/shared/entities/error-logs.entity';
import { BookModule } from './book/book.module';
import { OrderDetailModule } from './order-details/order-detail.module';
import { RevalidateModule } from './revalidate/revalidate.module';
import { BalanceCheckModule } from './balance-check/balance-check.module';
import { CancelModule } from './cancel/cancel.module';
import { AirlineModule } from './airline/airline.module';
import { AirportModule } from './airport/airport.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([ProviderMaster, SearchResponse, ErrorLogs]),
        SearchModule,
        ProviderModule,
        OrderDetailModule,
        BookModule,
        RevalidateModule,
        BalanceCheckModule,
        CancelModule,
        AirlineModule,
        AirportModule,
    ],
    controllers: [],
    providers: [],
    exports: [SearchModule, ProviderModule, OrderDetailModule, BookModule, RevalidateModule, BalanceCheckModule, CancelModule, AirlineModule, AirportModule],
})
export class FlightModule {}
