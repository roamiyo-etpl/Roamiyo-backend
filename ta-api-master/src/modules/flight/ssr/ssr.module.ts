import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SsrService } from './ssr.service';
import { SsrController } from './ssr.controller';
import { SsrCacheService } from './ssr-cache.service';
import { SsrResponseCacheEntity } from 'src/shared/entities/ssr-response-cache.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SsrResponseCacheEntity])],
  controllers: [SsrController],
  providers: [SsrService, SsrCacheService],
  exports: [SsrCacheService],
})
export class SsrModule {}
