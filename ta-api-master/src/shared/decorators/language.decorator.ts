import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { getLanguageDictionary } from '../utilities/language/language.utility';

export const Language = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();

    const langHeader = request.header('language');

    const language = typeof langHeader === 'string' ? langHeader.toLowerCase() : 'english';

    return getLanguageDictionary(language);
});
