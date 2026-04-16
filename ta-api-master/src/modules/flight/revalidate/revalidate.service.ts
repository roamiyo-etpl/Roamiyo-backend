import { Injectable } from '@nestjs/common';
import { RevalidateDto } from './dtos/revalidate.dto';
import { RevalidateResponse } from './interfaces/revalidate.interface';
import { ProviderRevalidateService } from '../providers/provider-revalidate.service';

@Injectable()
export class RevalidateService {
    constructor(private readonly providerRevalidateService: ProviderRevalidateService) {}

    /** [@Description: This method is used to revalidate the flight]
     * @author: Prashant Joshi at 29-09-2025 **/
    async revalidate(revalidateDto: RevalidateDto, headers: Headers): Promise<RevalidateResponse> {
        let response = await this.providerRevalidateService.providerRevalidate(revalidateDto, headers);
        return response;
    }
}
