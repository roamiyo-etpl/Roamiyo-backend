import { Module } from '@nestjs/common';
import { BookService } from './book.service';
import { BookController } from './book.controller';
import { ProviderModule } from '../providers/provider.module';
import { ConfigModule } from '@nestjs/config';
import { BookRepository } from './book.repository';
import { RevalidateModule } from '../revalidate/revalidate.module';

@Module({
    imports: [ProviderModule, ConfigModule, RevalidateModule],
    providers: [BookService, BookRepository],
    controllers: [BookController],
    exports: [BookService],
})
export class BookModule {}
