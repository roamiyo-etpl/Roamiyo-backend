import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Configuration } from 'config/configuration';
import { typeOrmConfig } from 'config/typeorm.config';
import { validationSchema } from 'config/validation';
import { HotelModule } from './modules/hotel/hotel.module';
import { GenericModule } from './modules/generic/generic.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CommonScheduler } from './shared/schedulers/common/common.scheduler';
import { FlightModule } from './modules/flight/flight.module';
import { GenericCancelModule } from './modules/cancel/cancel.module';
import { DumpModule } from './modules/dump/dump.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { mailConfig } from 'config/mail.config';
import { BookingStatusUpdateScheduler } from './shared/schedulers/flight/booking-status-update.scheduler';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: `${process.cwd()}/config/env/.env.${process.env.NODE_ENV}`,
            load: [Configuration],
            validationSchema,
        }),
        ScheduleModule.forRoot(),
        // Mailer module
        MailerModule.forRootAsync(mailConfig),

        // Postgres main DB
        TypeOrmModule.forRootAsync(typeOrmConfig),
        HotelModule,
        GenericModule,
        HotelModule,
        FlightModule,
        DumpModule,
        GenericCancelModule,
    ],
    controllers: [],
    providers: [CommonScheduler, BookingStatusUpdateScheduler],
})
export class AppModule {}
