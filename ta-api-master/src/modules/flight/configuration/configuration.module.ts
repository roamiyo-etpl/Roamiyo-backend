import { Module } from '@nestjs/common';
import { ConfigurationService } from './configuration.service';
import { ProviderMaster } from 'src/shared/entities/provider-master.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
    imports: [TypeOrmModule.forFeature([ProviderMaster])],
    providers: [ConfigurationService],
    exports: [ConfigurationService],
})
export class ConfigurationModule {}
