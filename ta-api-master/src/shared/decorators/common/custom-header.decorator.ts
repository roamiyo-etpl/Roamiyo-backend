import { SetMetadata } from '@nestjs/common';

export const RequiredHeaders = (headers: string[]) => SetMetadata('requiredHeaders', headers);
