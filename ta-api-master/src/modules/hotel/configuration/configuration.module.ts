import { Module } from '@nestjs/common';
import { ProviderMaster } from 'src/shared/entities/provider-master.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigurationService } from './configuration.service';

@Module({
    imports: [TypeOrmModule.forFeature([ProviderMaster])],
    providers: [ConfigurationService],
    exports: [ConfigurationService],
})
export class ConfigurationModule {}
