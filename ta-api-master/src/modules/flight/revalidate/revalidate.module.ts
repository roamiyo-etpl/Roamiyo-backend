import { Module } from '@nestjs/common';
import { RevalidateService } from './revalidate.service';
import { RevalidateController } from './revalidate.controller';
import { ProviderModule } from '../providers/provider.module';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [ProviderModule, ConfigModule],
    providers: [RevalidateService],
    controllers: [RevalidateController],
    exports: [RevalidateService],
})
export class RevalidateModule {}
