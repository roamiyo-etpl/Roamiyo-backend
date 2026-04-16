import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CancelService } from './cancel.service';
import { CancelRepository } from './cancel.repository';
import { ProviderModule } from '../providers/provider.module';
import { Booking } from 'src/shared/entities/bookings.entity';
import { Cancellation } from 'src/shared/entities/cancellations.entity';

@Module({
    imports: [ProviderModule, ConfigModule, TypeOrmModule.forFeature([CancelRepository, Booking, Cancellation])],
    providers: [CancelService, CancelRepository],
    controllers: [],
    exports: [CancelService],
})
export class CancelModule {}

