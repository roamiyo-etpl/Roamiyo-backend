import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CurrencyController } from './currency/currency.controller';
import { CurrencyService } from './currency/currency.service';
import { CurrencyRepository } from './currency/currency.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurrencyConversionEntity } from 'src/shared/entities/currency-rate.entity';
import { ProviderMaster } from 'src/shared/entities/provider-master.entity';
import { CommonScheduler } from 'src/shared/schedulers/common/common.scheduler';
import { SupplierCredService } from './supplier-credientials/supplier-cred.service';

@Module({
    imports: [TypeOrmModule.forFeature([CurrencyConversionEntity, ProviderMaster]), ScheduleModule.forRoot()],
    controllers: [CurrencyController],
    providers: [CurrencyService, CurrencyRepository, CommonScheduler, SupplierCredService],
    exports: [CurrencyService, SupplierCredService],
})
export class GenericModule {}
