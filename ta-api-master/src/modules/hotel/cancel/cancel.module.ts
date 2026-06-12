import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HotelCancelService } from './cancel.service';
import { HotelCancelRepository } from './cancel.repository';
import { ProvidersModule } from '../providers/providers.module';
import { Booking } from 'src/shared/entities/bookings.entity';
import { Cancellation } from 'src/shared/entities/cancellations.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Booking, Cancellation]),
        ProvidersModule,
    ],
    providers: [HotelCancelService, HotelCancelRepository],
    exports: [HotelCancelService],
})
export class HotelCancelModule {}
