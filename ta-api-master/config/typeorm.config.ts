import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';

export const typeOrmConfig: TypeOrmModuleAsyncOptions = {
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: async (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('main_db.host'),
        port: configService.get('main_db.port'),
        username: configService.get('main_db.username'),
        password: configService.get('main_db.password'),
        database: configService.get('main_db.database'),
        synchronize: configService.get('main_db.synchronize'),
        ssl: { rejectUnauthorized: false },
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    }),
};
