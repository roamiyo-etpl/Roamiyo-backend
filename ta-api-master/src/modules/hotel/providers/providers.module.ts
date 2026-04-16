import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProvidersSearchService } from './providers-search.service';
import { ProviderRoomsService } from './providers-rooms.service';
import { HotelbedsSearchService } from './hotelbeds/hotelbeds-search.service';
import { TboSearchService } from './tbo/tbo-search.service';
import { TboRoomService } from './tbo/tbo-room.service';
import { TboRepository } from './tbo/tbo.repository';
import { HotelMasterEntity } from 'src/shared/entities/hotel-master.entity';
import { TboHotelAdditionalDetailsEntity } from 'src/modules/dump/hotel/entities/tbo-hotel-additional-details.entity';
import { TboHotelImagesEntity } from 'src/modules/dump/hotel/entities/tbo-hotel-images.entity';
import { ProviderBookService } from './provider-book.service';
import { TboBookService } from './tbo/tbo-book.service';
import { TboAuthTokenService } from './tbo/tbo-auth-token.service';
import { ProviderMaster } from 'src/shared/entities/provider-master.entity';
import { ConfigurationModule } from '../configuration/configuration.module';
import { ProviderOrderDetailService } from './provider-order-detail.service';
import { TboOrderDetailService } from './tbo/tbo-order-detail.service';
import { TboCancellationService } from './tbo/tbo-cancellation.service';

@Module({
    imports: [TypeOrmModule.forFeature([ProviderMaster,HotelMasterEntity, TboHotelAdditionalDetailsEntity, TboHotelImagesEntity]), ConfigurationModule],
    providers: [ProvidersSearchService, ProviderRoomsService, ProviderBookService, ProviderOrderDetailService, HotelbedsSearchService, TboSearchService, TboRoomService,TboBookService, TboCancellationService, TboOrderDetailService, TboAuthTokenService, TboRepository],
    exports: [ProvidersSearchService, ProviderRoomsService, ProviderBookService, ProviderOrderDetailService, TboAuthTokenService],
})
export class ProvidersModule {}
