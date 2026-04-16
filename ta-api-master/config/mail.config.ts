import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const mailConfig = {
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: async (configService: ConfigService) => ({
        transport: {
            host: configService.get('email.host'),
            port: configService.get('email.port'),
            ignoreTLS: true,
            secure: configService.get('email.secure'),
            auth: {
                user: configService.get('email.user'),
                pass: configService.get('email.pass'),
            },
        },
        preview: configService.get('server.env') == 'development',
        defaults: {
            from: configService.get('email.from'),
            bcc: configService.get('server.env') == 'production' ? configService.get('email.bcc') : '',
            cc: configService.get('server.env') == 'production' ? configService.get('email.cc') : '',
        },
        template: {
            dir: 'src/shared/email-templates',
            adapter: new HandlebarsAdapter(),
            options: {
                strict: true,
            },
        },
    }),
};
