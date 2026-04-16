import { InjectRepository } from '@nestjs/typeorm';
import { SearchResponse } from 'src/shared/entities/search-response.entity';
import { Repository } from 'typeorm';
import moment from 'moment';
import { StartRoutingResponse } from '../search/interfaces/start-routing.interface';

export class ProviderRepoService {
    constructor(@InjectRepository(SearchResponse) private searchResponseRepo: Repository<SearchResponse>) {}

    /** [@Description: Store search response]
     * @author: Prashant Joshi at 23-09-2025 **/
    async storeSearchResponse(data: StartRoutingResponse, providerName = '') {
        const searchData = await this.getSearchResponseByID(data);

        let status = 0;
        /* Checking for the data is already stored or not */
        if (!searchData) {
            status = 1;
        }

        const response = this.searchResponseRepo.create({
            search_id: data.searchReqId,
            provider_name: providerName != '' ? providerName : data.route[0].groupHash[0].provider[0],
            response: JSON.stringify(data),
            status: status,
            date: moment().format('YYYY-MM-DD HH:mm:ss'),
        });

        return await this.searchResponseRepo.save(response);
    }

    /** [@Description: Update provider count]
     * @author: Prashant Joshi at 23-09-2025 **/
    async updateProviderCount(searchReqId, count) {
        return await this.searchResponseRepo.update({ search_id: searchReqId }, { provider_count: count });
    }

    /** [@Description: Get all response by ID]
     * @author: Prashant Joshi at 23-09-2025 **/
    async getAllResponseByID(data) {
        return await this.searchResponseRepo.find({ where: { search_id: data.searchReqId } });
    }

    /** [@Description: Delete search result]
     * @author: Prashant Joshi at 23-09-2025 **/
    async deleteSearchResult(searchReqId) {
        return await this.searchResponseRepo.delete({ search_id: searchReqId });
    }

    /** [@Description: Get search response by ID]
     * @author: Prashant Joshi at 23-09-2025 **/
    async getSearchResponseByID(data) {
        return await this.searchResponseRepo.findOne({ where: { search_id: data.searchReqId } });
    }
}
