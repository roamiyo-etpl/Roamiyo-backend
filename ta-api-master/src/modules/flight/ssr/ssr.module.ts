import { Module } from '@nestjs/common';
import { SsrService } from './ssr.service';
import { SsrController } from './ssr.controller';

@Module({
  controllers: [SsrController],
  providers: [SsrService],
})
export class SsrModule {}