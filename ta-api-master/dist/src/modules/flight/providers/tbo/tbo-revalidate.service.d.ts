import { GenericRepo } from "src/shared/utilities/flight/generic-repo.utility";
import { TboAuthTokenService } from "./tbo-auth-token.service";
import { s3BucketService } from "src/shared/utilities/flight/s3bucket.utility";
import { CancellationFareRule, FareRules, RevalidateResponse } from "../../revalidate/interfaces/revalidate.interface";
import { Fare, Segment } from "../../search/interfaces/start-routing.interface";
import { RevalidateResponseEntity } from "src/shared/entities/revalidate-response.entity";
import { Repository } from "typeorm";
import { SupplierLogUtility } from "src/shared/utilities/flight/supplier-log.utility";
export declare class TboRevalidateService {
    private readonly tboAuthToken;
    private readonly s3BucketService;
    private readonly genericRepo;
    private revalidateRepo;
    private readonly supplierLogUtility;
    logDate: number;
    constructor(tboAuthToken: TboAuthTokenService, s3BucketService: s3BucketService, genericRepo: GenericRepo, revalidateRepo: Repository<RevalidateResponseEntity>, supplierLogUtility: SupplierLogUtility);
    revalidate(requestData: any): Promise<RevalidateResponse | RevalidateResponse[]>;
    createRequest(requestData: any, authToken: any): {
        ResultIndex: any;
        EndUserIp: any;
        TokenId: any;
        TraceId: any;
    };
    convertingResponse(revalidateRequest: any, results: any): Promise<RevalidateResponse>;
    getCancellationFareRules(fareRuleRequest: any, i: any): Promise<CancellationFareRule>;
    settingUpPrices(searchReq: any, passengerFareArr: any, fareBreakDown: any, preferredCurrency: any, FareType: any): Fare;
    settingUpSegments(segment: any): Segment;
    settingUpLocationInfo(flightSegment: any): never[];
    getFareRuleRequest(changeRequestFareReq: any, authToken: any, headers: any): {
        TokenId: any;
        TraceId: any;
        ResultIndex: any;
        EndUserIp: any;
    };
    createFareRules(fareRule: any): FareRules;
    convertFareRuleResponse(apiReqData: any, searchResult: any): Promise<CancellationFareRule>;
}
