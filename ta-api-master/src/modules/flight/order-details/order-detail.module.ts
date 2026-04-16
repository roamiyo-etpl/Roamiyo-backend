import { Module } from '@nestjs/common';
import { OrderDetailService } from './order-detail.service';
import { OrderDetailController } from './order-detail.controller';
import { ProviderModule } from '../providers/provider.module';
import { OrderDetailRepository } from './order-detail.repository';

@Module({
    imports: [ProviderModule],
    providers: [OrderDetailService, OrderDetailRepository],
    controllers: [OrderDetailController],
    exports: [OrderDetailService],
})
export class OrderDetailModule {}
