import { TboAuthTokenService } from './tbo-auth-token.service';
import { GenericRepo } from 'src/shared/utilities/flight/generic-repo.utility';
import { StartRoutingResponse, Segment, Fare } from '../../search/interfaces/start-routing.interface';
export declare class TboSearchService {
    private readonly tboAuthTokenService;
    private readonly genericRepo;
    constructor(tboAuthTokenService: TboAuthTokenService, genericRepo: GenericRepo);
    search(searchRequest: any): Promise<StartRoutingResponse>;
    creatingSearchRequest(searchRequest: any): {
        EndUserIp: any;
        TokenId: any;
        AdultCount: number;
        ChildCount: number;
        InfantCount: number;
        DirectFlight: boolean;
        OneStopFlight: boolean;
        ResultFareType: any;
        JourneyType: any;
        PreferredAirlines: null;
        Segments: any[];
        Sources: null;
    };
    convertingResponse(searchRequest: any, results: any): Promise<StartRoutingResponse>;
    settingUpPrices(searchReq: any, passengerFareArr: any, fareBreakDown: any, preferredCurrency: any, FareType: any): Fare;
    settingUpSegments(segment: any): Segment;
    settingUpLocationInfo(flightSegment: any): never[];
}
