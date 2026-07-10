import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { logHotelClientRequest } from 'src/shared/utilities/hotel/hotel-api-log.utility';

@Injectable()
export class HotelApiLoggingInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const http = context.switchToHttp();
        const request = http.getRequest<Request>();

        if (request?.url?.startsWith('/hotel')) {
            const protocol = request.protocol ?? 'http';
            const host = request.get('host') ?? 'localhost';
            const fullUrl = `${protocol}://${host}${request.originalUrl ?? request.url}`;

            logHotelClientRequest({
                method: request.method ?? 'GET',
                fullUrl,
                apiPath: request.originalUrl ?? request.url,
            });
        }

        return next.handle();
    }
}
