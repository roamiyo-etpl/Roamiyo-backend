import { Module } from '@nestjs/common';
import { BalanceCheckService } from './balance-check.service';
import { BalanceCheckController } from './balance-check.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProviderMaster } from 'src/shared/entities/provider-master.entity';
import { ProviderModule } from '../providers/provider.module';

@Module({
    imports: [TypeOrmModule.forFeature([ProviderMaster]), ProviderModule],
    providers: [BalanceCheckService],
    controllers: [BalanceCheckController],
})
export class BalanceCheckModule {}
