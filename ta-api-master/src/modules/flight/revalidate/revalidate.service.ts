import { Injectable } from '@nestjs/common';
import { RevalidateDto } from './dtos/revalidate.dto';
import { RevalidateResponse } from './interfaces/revalidate.interface';
import { ProviderRevalidateService } from '../providers/provider-revalidate.service';

@Injectable()
export class RevalidateService {
    constructor(private readonly providerRevalidateService: ProviderRevalidateService) {}

    async revalidate(revalidateDto: RevalidateDto, headers: Headers): Promise<RevalidateResponse> {
        return this.providerRevalidateService.providerRevalidate(revalidateDto, headers);
    }
}
