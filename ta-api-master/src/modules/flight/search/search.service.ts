import { ProviderSearchService } from '../providers/provider-search.service';
import { CheckRoutingDto } from './dtos/check-routing.dto';
import { StartRoutingDto } from './dtos/start-routing.dto';
import { Fare, StartRoutingResponse } from './interfaces/start-routing.interface';
import { CheckRoutingResponse } from './interfaces/check-routing.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SearchService {
    constructor(private readonly providerSearchService: ProviderSearchService) {}

    /** [@Description: This method is used to start the flight search]
     * @author: Prashant Joshi at 29-09-2025 **/
    async startRouting(searchReq: StartRoutingDto, headers: Headers): Promise<StartRoutingResponse> {
        const response = await this.providerSearchService.providerSearch(searchReq, headers);
        return response;
    }

    /** [@Description: This method is used to check the flight search]
     * @author: Prashant Joshi at 29-09-2025 **/
    async collectivePolling(searchReq: CheckRoutingDto): Promise<CheckRoutingResponse> {
        const response = await this.providerSearchService.providerCheckRouting(searchReq);
        return response;
    }
}
