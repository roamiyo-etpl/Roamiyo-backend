import { Injectable, InternalServerErrorException, ServiceUnavailableException } from '@nestjs/common';
import { StartRoutingDto } from '../search/dtos/start-routing.dto';
import { CheckRoutingDto } from '../search/dtos/check-routing.dto';
import { ConfigurationService } from '../configuration/configuration.service';
import { v4 as uuid } from 'uuid';
import { Generic } from 'src/shared/utilities/flight/generic.utility';
import { GenericRepo } from 'src/shared/utilities/flight/generic-repo.utility';
import { GroupHash, StartRoutingResponse, Route } from '../search/interfaces/start-routing.interface';
import { CheckRoutingResponse } from '../search/interfaces/check-routing.interface';
import { ProviderRepoService } from './provider-repo.service';
import moment from 'moment';
import { TboSearchService } from './tbo/tbo-search.service';

@Injectable()
export class ProviderSearchService {
    constructor(
        private readonly configService: ConfigurationService,
        private readonly genericRepo: GenericRepo,
        private readonly providerRepoService: ProviderRepoService,
        private readonly tboSearchService: TboSearchService,
    ) {}

    /** [@Description: Fetch search from providers]
     * @author: Prashant Joshi at 23-09-2025 **/
    async providerSearch(searchReq: StartRoutingDto, headers: Headers): Promise<StartRoutingResponse> {
        const activeProviders = await this.configService.getActiveProviderList({ module: 'Flight' });
        if (activeProviders.length) {
            const activeProvidersName = activeProviders.map((data) => data.code);
            const searchResults: any[] = [];
            const searchRequest = [];

            searchRequest['searchReq'] = searchReq;
            searchRequest['searchReqId'] = uuid();
            searchRequest['headers'] = headers;
            const infantCount = Generic.getInfantCount(searchReq);

            const supplierCount: string[] = [];

            /* For TBO */
            if (activeProvidersName.indexOf('TBO') !== -1) {
                const tboCred = activeProviders.filter((item) => {
                    return item.code == 'TBO';
                });
                searchRequest['providerCred'] = JSON.parse(tboCred[0].provider_credentials);
                const tboSearchResult = new Promise((resolve) => resolve(this.tboSearchService.search(searchRequest)));
                searchResults.push(tboSearchResult);
                supplierCount.push('TBO');
            }

            // Check if searchResults is empty
            if (searchResults.length === 0) {
                throw new ServiceUnavailableException('There are no active providers available for the request.');
            }

            /* Checking for first Come response from the Providers */
            const result = await Promise.race(searchResults).catch((error) => {
                this.genericRepo.storeLogs(searchRequest['searchReqId'], 1, error, 0);
                throw new InternalServerErrorException('There is an issue while fetching data from the providers.');
            });

            /* Adding De-duplication */
            const deDuplicatedData = this.deduplicationFilter(result, 'startRouting');

            const searchResponse: StartRoutingResponse = new StartRoutingResponse();
            searchResponse.searchReqId = result.searchReqId;
            searchResponse.mode = result.mode;
            searchResponse.error = result.error;
            searchResponse.message = result.message;
            searchResponse.route = deDuplicatedData;
            searchResponse.trackingId = result?.trackingId;

            /* Check how many supplier supports the requests */
            if (supplierCount.length <= 1) {
                searchResponse.complete = true;
            } else {
                searchResponse.complete = false;
            }

            /* Updating the supplier count into database */
            await this.providerRepoService.updateProviderCount(searchResponse.searchReqId, supplierCount.length);

            return searchResponse;
        } else {
            throw new ServiceUnavailableException('No active provider found.');
        }
    }

    /** [@Description: Check routing]
     * @author: Prashant Joshi at 23-09-2025 **/
    async providerCheckRouting(searchReq: CheckRoutingDto): Promise<CheckRoutingResponse> {
        const { searchReqId } = searchReq;
        const routingResponse = new CheckRoutingResponse();
        const checkProviderData = await this.providerRepoService.getAllResponseByID(searchReq);
        const activeProviders = await this.configService.getActiveProviderList({ module: 'Flight' });
        /* Setting Config mode */
        let mode = '';
        activeProviders.forEach((item) => {
            mode += mode == '' ? item.code + '-' + JSON.parse(item.provider_credentials).mode : '|' + item.code + '-' + JSON.parse(item.provider_credentials).mode;
        });
        /* Creating a cases for complete key in response */
        /* Check for the request Time */
        const currentDate = moment();
        const dateDiff = checkProviderData.length > 0 ? currentDate.diff(moment(checkProviderData[0].date), 'seconds') : 0;

        let statusComplete = false;
        if (checkProviderData.length > 0) {
            /* In case of API time is greater than 30 sec
            || provider data length is greater or equal to active provide list */
            if (dateDiff >= 30 || checkProviderData.length >= checkProviderData[0].provider_count) {
                statusComplete = true;
            }
        } else {
            statusComplete = true;
        }

        if (checkProviderData.length > 0) {
            routingResponse.complete = statusComplete;

            const deDuplicatedData = this.deduplicationFilter(checkProviderData, 'checkRouting');
            routingResponse.searchReqId = searchReqId;
            routingResponse.mode = mode;
            routingResponse.route = deDuplicatedData;
            routingResponse.message = 'OK';

            /* Sorting a data to price */
            routingResponse.route.sort((a, b) => a.fare[0].totalFare - b.fare[0].totalFare);
        } else {
            /* Checking for complete state */
            routingResponse.complete = statusComplete;
            routingResponse.searchReqId = searchReqId;
            routingResponse.mode = mode;
            routingResponse.route = [];
            routingResponse.message = 'No Data Found, Check again after few seconds.';
        }

        /* Clearing the search request */
        try {
            if (routingResponse.complete == true) {
                await this.providerRepoService.deleteSearchResult(searchReqId);
            }
        } catch (error) {
            this.genericRepo.storeLogs(searchReqId, 1, error, 0);
        }

        return routingResponse;
    }

    /** [@Description: Deduplication filter]
     * @author: Prashant Joshi at 23-09-2025 **/
    deduplicationFilter(allResult: StartRoutingResponse | Array<{ response: string }>, type: 'startRouting' | string): Route[] {
        let mergeRes: Route[] = [];

        /* In Case of Start Routing */
        if (type == 'startRouting') {
            mergeRes = [...(allResult as StartRoutingResponse).route];
        } else {
            const resultArray = allResult as Array<{ response: string }>;
            for (let i = 0; i < resultArray.length; i++) {
                if (typeof resultArray[i] != 'undefined') mergeRes = [...mergeRes, ...JSON.parse(resultArray[i].response).route];
            }
        }
        console.log('before: ' + mergeRes.length);
        let groupHash: GroupHash;
        const filteredRes: Route[] = [];
        for (let i = 0; i < mergeRes.length; i++) {
            groupHash = new GroupHash();
            const find = filteredRes.findIndex((item) => {
                /* In the case of roundtrip */
                if (mergeRes[i].solutionId.length > 1) {
                    return item.groupHashCode == mergeRes[i].groupHashCode;
                } else {
                    return item.hashCode[0] == mergeRes[i].hashCode[0];
                }
            });

            if (find == -1) {
                /* Only with roundtrip flights */
                if (mergeRes[i].solutionId.length > 1) {
                    /* check if loop data's hashCode already exist in new array */
                    const duplicateOutbound = filteredRes.some((element) => element.hashCode[0] === mergeRes[i].hashCode[0]);

                    /* Update the flag to true */
                    if (duplicateOutbound === true) {
                        mergeRes[i].isDuplicateOutbound = true;
                    }
                }

                filteredRes.push(mergeRes[i]);
            } else {
                groupHash.provider = mergeRes[i].groupHash[0].provider;
                groupHash.hashCode = mergeRes[i].groupHash[0].hashCode;
                groupHash.groupHashCode = mergeRes[i].groupHash[0].groupHashCode;
                groupHash.solutionId = mergeRes[i].groupHash[0].solutionId;
                groupHash.totalAmount = mergeRes[i].fare[0].totalFare;

                /* Updating booking Code */
                /* Outbound */
                for (let s = 0; s < filteredRes[find].flightSegments.length; s++) {
                    if (mergeRes[i].flightSegments[s]) {
                        filteredRes[find].flightSegments[s].bookingCode = mergeRes[i].flightSegments[s].bookingCode
                            ? mergeRes[i].flightSegments[s].bookingCode
                            : filteredRes[find].flightSegments[s].bookingCode;
                    }
                }

                if (filteredRes[find].fare[0].totalFare > mergeRes[i].fare[0].totalFare) {
                    const isDuplicateOutbound = filteredRes[find].isDuplicateOutbound;
                    mergeRes[i].isDuplicateOutbound = isDuplicateOutbound;
                    filteredRes[find] = mergeRes[i];
                }

                filteredRes[find].groupHash.push(groupHash);
                filteredRes[find].groupHash.sort((a, b) => a.totalAmount - b.totalAmount);
            }
        }
        console.log('after: ' + filteredRes.length);
        return filteredRes;
    }
}
