import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SearchModule } from './search/search.module';
import { ProvidersModule } from './providers/providers.module';
import { RoomModule } from './room/room.module';
import { HotelBookModule } from './book/book.module';
import { HotelCancelModule } from './cancel/cancel.module';
import { HotelApiLoggingInterceptor } from './interceptors/hotel-api-logging.interceptor';
import { HotelV2Module } from './v2/hotel-v2.module';

@Module({
    controllers: [],
    providers: [
        {
            provide: APP_INTERCEPTOR,
            useClass: HotelApiLoggingInterceptor,
        },
    ],
    imports: [SearchModule, ProvidersModule, RoomModule, HotelBookModule, HotelCancelModule, HotelV2Module],
    exports: [HotelCancelModule],
})
export class HotelModule {}
