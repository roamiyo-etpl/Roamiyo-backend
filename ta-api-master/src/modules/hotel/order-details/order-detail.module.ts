import { Module } from '@nestjs/common';
import { ProvidersModule } from '../providers/providers.module';
import { HotelOrderDetailService } from './order-detail.service';
import { HotelOrderDetailController } from './order-detail.controller';
import { SupplierCredService } from 'src/modules/generic/supplier-credientials/supplier-cred.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProviderMaster } from 'src/shared/entities/provider-master.entity';


@Module({
    imports: [ProvidersModule, TypeOrmModule.forFeature([ProviderMaster])],
    providers: [HotelOrderDetailService, SupplierCredService],
    controllers: [HotelOrderDetailController],
    exports: [HotelOrderDetailService],
})
export class HotelOrderDetailModule {}
