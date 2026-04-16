import { Module } from '@nestjs/common';
import { SearchModule } from './search/search.module';
import { ProvidersModule } from './providers/providers.module';
import { RoomModule } from './room/room.module';
import { HotelBookModule } from './book/book.module';

@Module({
    controllers: [],
    providers: [],
    imports: [SearchModule, ProvidersModule, RoomModule, HotelBookModule],
})
export class HotelModule {}
