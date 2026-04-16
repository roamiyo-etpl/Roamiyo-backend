import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { SwaggerConfig } from 'config/swagger.config';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    const configService = app.get<ConfigService>(ConfigService);
    /* Adding Swagger documentation */

    
    const document = SwaggerModule.createDocument(app, SwaggerConfig);
    const filePath = path.resolve('swagger/swagger.json');

    const whiteList = configService.getOrThrow<string[]>('server.origin');

    app.enableCors({
        origin: function (origin, callback) {
            if (!origin || whiteList.findIndex((url) => origin.startsWith(url)) !== -1) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        // origin: true,
        methods: 'GET,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
    });

    fs.writeFileSync(filePath, JSON.stringify(document, null, 2), 'utf-8');
    SwaggerModule.setup('api-doc', app, document);
    const serverPort = configService.get('server.port') as number;

    await app.listen(serverPort);
    const logger = new Logger('Bootstrap');

    logger.log(`Application is running on: ${await app.getUrl()}`);
    logger.verbose(`Server is running on port -> ${serverPort}`);
}
bootstrap();
