import { Module } from '@nestjs/common';
import { HotelRoomService } from './room.service';
import { HotelRoomController } from './room.controller';
import { ProvidersModule } from '../providers/providers.module';
import { SupplierCredService } from 'src/modules/generic/supplier-credientials/supplier-cred.service';
import { ProviderMaster } from 'src/shared/entities/provider-master.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
    imports: [ProvidersModule, TypeOrmModule.forFeature([ProviderMaster])],
    providers: [HotelRoomService, SupplierCredService],
    controllers: [HotelRoomController],
    exports: [HotelRoomService]
})
export class RoomModule {}
