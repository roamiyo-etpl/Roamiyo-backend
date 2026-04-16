import { Module } from '@nestjs/common';
import { HotelBookService } from './book.service';
import { HotelBookController } from './book.controller';
import { ProvidersModule } from '../providers/providers.module';
import { RoomModule } from '../room/room.module';
import { BookRepository } from './book.repository';
import { SupplierCredService } from 'src/modules/generic/supplier-credientials/supplier-cred.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProviderMaster } from 'src/shared/entities/provider-master.entity';

@Module({
    imports: [ProvidersModule, RoomModule, TypeOrmModule.forFeature([ProviderMaster])],
    providers: [HotelBookService, BookRepository, SupplierCredService],
    controllers: [HotelBookController],
})
export class HotelBookModule { }