import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { join } from 'path';
import * as fs from 'fs';

@Injectable()
export class HeaderValidationGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const handler = context.getHandler();
        const controller = context.getClass();

        const requiredHeaders = this.reflector.get<string[]>('requiredHeaders', handler) || this.reflector.get<string[]>('requiredHeaders', controller);

        if (!requiredHeaders || requiredHeaders.length === 0) {
            return true; /* No headers are required */
        }

        const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
        const headers: Record<string, string | string[] | undefined> = request.headers ?? {};

        /* Validating required headers here */
        const errors: string[] = [];

        for (const header of requiredHeaders) {
            if (!headers[header.toLowerCase()]) {
                errors.push(`${header} header is required`);
            }

            /* Additional validations */
            if (header.toLowerCase() === 'api-version' && !/^v[0-9]+(\.[0-9]+)*$/.test(headers[header.toLowerCase()] as string)) {
                errors.push('Invalid Api-version format. Expected format: v1, v1.0, etc.');
            }

            if (
                header.toLowerCase() === 'ip-address' &&
                !/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
                    headers['ip-address'] as string,
                )
            ) {
                errors.push('Invalid Ip-Address format. Expected format: xxx.xxx.xxx.xxx');
            }

            if (header.toLocaleLowerCase() === 'currency-preference') {
                /* Get Currency data */
                // Combine and resolve the full path to currency.json directly for efficiency
                const currencyFile = join(process.cwd(), 'json', 'currency.json');
                const currencyData = JSON.parse(fs.readFileSync(currencyFile, 'utf8'));
                const preferredCurrency = headers['currency-preference'] as string;

                if (headers['currency-preference']?.length !== 3 && !/^[A-Z]{3}$/.test(headers['currency-preference'] as string)) {
                    errors.push('Invalid Currency-Preference format. Expected format: 3 digit currency code');
                } else if (!currencyData[preferredCurrency.toUpperCase()]) {
                    errors.push(`${preferredCurrency} is not a supported currency. Please provide a valid currency code.`);
                }
            }

            if (header.toLocaleLowerCase() === 'language' && (typeof headers['language'] !== 'string' || !headers['language'].trim())) {
                errors.push('Invalid Language format. Expected a non-empty string');
            }
            if (header.toLocaleLowerCase() === 'club-id' && (typeof headers['club-id'] !== 'string' || !headers['club-id'].trim())) {
                errors.push('Invalid Club-Id format. Expected a non-empty string');
            }

            if (header.toLocaleLowerCase() === 'device-information' && typeof headers['device-information'] !== 'string') {
                errors.push('Invalid Device-Information format. Expected a string');
            }
        }

        if (errors.length > 0) {
            throw new BadRequestException(errors.join(', '));
        }

        /* In case all the validations passes */
        return true;
    }
}
